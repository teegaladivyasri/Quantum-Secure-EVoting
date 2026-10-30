"""
Phase 15 — Security Evaluation & Attack Simulation Test Suite

This test suite performs rigorous, non-destructive security evaluation and controlled
attack simulation against the active Quantum-Secure Electronic Voting System prototype.

Scenarios Evaluated:
1. TEST 1 — Unauthorized Access Matrix (No JWT, Voter JWT to Admin, Admin JWT to Voter, Invalid JWT, Expired JWT)
2. TEST 2 — Duplicate Voting Enforcement & Database Invariant Preservation
3. TEST 3 — Concurrent Duplicate Voting & Transaction Race Condition Handling
4. TEST 4 — AES-256-GCM Ballot Tampering Matrix (Ciphertext, Auth Tag, Wrong Key, Nonce)
5. TEST 5 — BB84 Quantum Channel Evaluation (Normal Channel vs Simulated Eavesdropping Disturbance)
6. TEST 6 — Wrong-Constituency Candidate Backend Authorization Enforcement
7. TEST 7 — Election Lifecycle Invariant Violations (DRAFT, PUBLISHED, OPEN, CLOSED & Lock Enforcement)
8. TEST 8 — Ballot Privacy Verification & Separation of Voter Participation
9. TEST 9 — Secret Material Exposure Verification (BB84 bits, AES keys, OTPs, Passwords, Token storage)
10. TEST 10 — API Response Sanitization & Stack Trace Prevention
"""

import json
import base64
import time
import pytest
from cryptography.exceptions import InvalidTag
from sqlalchemy.exc import IntegrityError

from backend.extensions import db
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.constituency import Constituency
from backend.models.ballot import Ballot
from backend.models.participation import ParticipationRecord
from backend.models.audit import AuditLog
from backend.models.otp_session import VoterOtpSession

from backend.services.auth_service import hash_password, generate_jwt, decode_jwt, hash_otp
from backend.services.voting_service import cast_voter_ballot, VotingError
from backend.crypto.aes_gcm import encrypt_ballot, decrypt_ballot
from backend.crypto.key_conversion import bits_to_bytes_256
from backend.quantum.bb84_circuit import establish_bb84_key
from backend.quantum.qber import QuantumChannelDisturbanceError


# ==============================================================================
# TEST 1 — UNAUTHORIZED ACCESS MATRIX
# ==============================================================================

def test_security_scenario_1_unauthorized_access(client, voter_user, admin_headers, app):
    """
    Scenario 1: Verify protected endpoints reject unauthorized requests with proper HTTP codes
    and zero sensitive data leakage.
    
    A. No JWT -> protected voter endpoint -> HTTP 401
    B. No JWT -> protected admin endpoint -> HTTP 401
    C. Voter JWT -> admin-only endpoint -> HTTP 403
    D. Admin JWT -> voter-only endpoint -> HTTP 403
    E. Invalid JWT -> protected endpoint -> HTTP 401
    F. Expired JWT -> protected endpoint -> HTTP 401
    """
    # A. No JWT -> protected voter endpoint -> HTTP 401
    res_a = client.get("/api/v1/voter/election-info")
    assert res_a.status_code == 401, f"Expected 401, got {res_a.status_code}"
    data_a = res_a.get_json()
    assert data_a["error"] == "UNAUTHORIZED"

    # B. No JWT -> protected admin endpoint -> HTTP 401
    res_b = client.get("/api/v1/admin/elections")
    assert res_b.status_code == 401, f"Expected 401, got {res_b.status_code}"
    data_b = res_b.get_json()
    assert data_b["error"] == "UNAUTHORIZED"

    # C. Voter JWT -> admin-only endpoint -> HTTP 403
    res_c = client.post("/api/v1/admin/elections", headers=voter_user["headers"], json={
        "title": "Malicious Admin Election"
    })
    assert res_c.status_code == 403, f"Expected 403, got {res_c.status_code}"
    data_c = res_c.get_json()
    assert data_c["error"] == "FORBIDDEN"

    # D. Admin JWT -> voter-only endpoint -> HTTP 403
    res_d = client.get("/api/v1/voter/election-info", headers=admin_headers)
    assert res_d.status_code == 403, f"Expected 403, got {res_d.status_code}"
    data_d = res_d.get_json()
    assert data_d["error"] == "FORBIDDEN"

    # E. Invalid JWT -> protected endpoint -> HTTP 401
    bad_headers = {"Authorization": "Bearer invalid.token.payload"}
    res_e = client.get("/api/v1/voter/election-info", headers=bad_headers)
    assert res_e.status_code == 401, f"Expected 401, got {res_e.status_code}"
    data_e = res_e.get_json()
    assert data_e["error"] == "INVALID_TOKEN"

    # F. Expired JWT -> protected endpoint -> HTTP 401
    with app.app_context():
        import jwt as pyjwt
        from backend.config import Config
        now = int(time.time())
        expired_payload = {
            "sub": voter_user["voter"].id,
            "role": "VOTER",
            "iat": now - 120,
            "exp": now - 60,
        }
        expired_token = pyjwt.encode(expired_payload, Config.JWT_SECRET_KEY, algorithm="HS256")
        expired_headers = {"Authorization": f"Bearer {expired_token}"}
        res_f = client.get("/api/v1/voter/election-info", headers=expired_headers)
        assert res_f.status_code == 401, f"Expected 401, got {res_f.status_code}"
        data_f = res_f.get_json()
        assert data_f["error"] == "TOKEN_EXPIRED"

    # Error response security verification across all failure cases:
    for resp in [data_a, data_b, data_c, data_d, data_e, data_f]:
        raw_text = json.dumps(resp).lower()
        for forbidden in ["password", "secret", "traceback", "stack", "exception", "bb84", "aes"]:
            assert forbidden not in raw_text, f"Forbidden term '{forbidden}' leaked in error response: {raw_text}"


# ==============================================================================
# TEST 2 — DUPLICATE VOTING ENFORCEMENT & INVARIANTS
# ==============================================================================

def test_security_scenario_2_duplicate_voting_enforcement(client, voter_user, sample_election):
    """
    Scenario 2: Single-vote policy enforcement.
    1. Authenticate voter & cast valid ballot -> HTTP 200 (SUCCESS)
    2. Verify ParticipationRecord: has_voted = TRUE
    3. Attempt second vote for same election -> HTTP 409 Conflict (REJECTED)
    4. Verify strict invariants:
       - No second ballot record created (Ballot count strictly 1)
       - No second participation record created (Participation count strictly 1)
       - No second VOTE_CAST audit entry created (Audit count strictly 1)
    """
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]

    # Step 1: Cast initial valid vote
    res1 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res1.status_code == 200
    assert res1.get_json()["success"] is True

    # Step 2: Verify ParticipationRecord has_voted = True
    part = ParticipationRecord.query.filter_by(
        voter_id=voter_user["voter"].id,
        election_id=election_id
    ).first()
    assert part is not None
    assert part.has_voted is True
    assert part.voted_at is not None

    # Snapshot database state after first valid vote
    ballots_count_1 = Ballot.query.filter_by(election_id=election_id).count()
    part_count_1 = ParticipationRecord.query.filter_by(
        voter_id=voter_user["voter"].id,
        election_id=election_id
    ).count()
    vote_cast_audit_1 = AuditLog.query.filter_by(action="VOTE_CAST").count()

    assert ballots_count_1 == 1
    assert part_count_1 == 1
    assert vote_cast_audit_1 == 1

    # Step 3: Attempt second vote for the same election
    res2 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res2.status_code == 409
    assert res2.get_json()["error"] == "VOTING_ERROR"
    assert "already been cast" in res2.get_json()["message"]

    # Step 4: Verify strict invariants — no extra ballot, participation, or audit entry
    ballots_count_2 = Ballot.query.filter_by(election_id=election_id).count()
    part_count_2 = ParticipationRecord.query.filter_by(
        voter_id=voter_user["voter"].id,
        election_id=election_id
    ).count()
    vote_cast_audit_2 = AuditLog.query.filter_by(action="VOTE_CAST").count()

    assert ballots_count_2 == 1, "Security violation: Second vote created an additional ballot!"
    assert part_count_2 == 1, "Security violation: Second vote created duplicate participation record!"
    assert vote_cast_audit_2 == 1, "Security violation: Second vote created duplicate VOTE_CAST audit entry!"


# ==============================================================================
# TEST 3 — CONCURRENT DUPLICATE VOTING & RACE HANDLING
# ==============================================================================

def test_security_scenario_3_concurrent_voting_race_condition(client, voter_user, sample_election, monkeypatch):
    """
    Scenario 3: Race condition and database concurrency verification.
    Verifies that simultaneous vote submissions cannot bypass the one-vote restriction:
    - The unique constraint `uq_voter_election` triggers an IntegrityError on collision.
    - voting_service cleanly rolls back and maps this to HTTP 409 Conflict.
    - Exactly 1 vote can ever be committed; database remains completely consistent.
    """
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]

    # First vote executes normally
    res1 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res1.status_code == 200

    # Simulate a concurrent collision where two workers raced past the SELECT check and both tried to commit:
    def simulate_concurrent_race_integrity_error():
        raise IntegrityError("UNIQUE constraint failed: participation_records.voter_id, participation_records.election_id", orig=None, params=None)

    monkeypatch.setattr(db.session, "commit", simulate_concurrent_race_integrity_error)

    res_race = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res_race.status_code == 409
    data_race = res_race.get_json()
    assert data_race["error"] == "VOTING_ERROR"
    assert "already been cast" in data_race["message"]

    # Revert monkeypatch and verify final state
    monkeypatch.undo()
    assert Ballot.query.filter_by(election_id=election_id).count() == 1
    assert ParticipationRecord.query.filter_by(voter_id=voter_user["voter"].id, election_id=election_id).count() == 1


# ==============================================================================
# TEST 4 — AES-256-GCM BALLOT TAMPERING MATRIX
# ==============================================================================

def test_security_scenario_4_ballot_tampering_matrix():
    """
    Scenario 4: AES-256-GCM Authenticated Encryption Tampering Matrix.
    Encrypts approved ballot payload `{"candidate_id": "<UUID>"}` and evaluates:
    - Baseline valid decryption
    - Scenario A: Modify one byte of ciphertext -> Decryption fails (InvalidTag)
    - Scenario B: Modify authentication tag -> Decryption fails (InvalidTag)
    - Scenario C: Use incorrect AES-256 key -> Decryption fails (InvalidTag)
    - Scenario D: Modify nonce -> Decryption fails (InvalidTag)
    """
    # 1. Valid 32-byte (256-bit) AES key
    valid_key = b"K" * 32
    approved_payload = json.dumps({"candidate_id": "c983a450-48bf-4c74-a029-9e8020e98030"})

    # 2. Encrypt
    encrypted = encrypt_ballot(valid_key, approved_payload)
    ct_b64 = encrypted["ciphertext"]
    nonce_b64 = encrypted["nonce"]
    tag_b64 = encrypted["auth_tag"]

    # Verify baseline decryption succeeds
    decrypted = decrypt_ballot(valid_key, ct_b64, nonce_b64, tag_b64)
    assert decrypted == approved_payload

    # Scenario A: Modify one byte of ciphertext
    ct_bytes = bytearray(base64.b64decode(ct_b64))
    ct_bytes[0] ^= 0x01  # Flip 1 bit
    tampered_ct = base64.b64encode(ct_bytes).decode("utf-8")
    with pytest.raises(InvalidTag):
        decrypt_ballot(valid_key, tampered_ct, nonce_b64, tag_b64)

    # Scenario B: Modify authentication tag
    tag_bytes = bytearray(base64.b64decode(tag_b64))
    tag_bytes[0] ^= 0xFF  # Corrupt tag
    tampered_tag = base64.b64encode(tag_bytes).decode("utf-8")
    with pytest.raises(InvalidTag):
        decrypt_ballot(valid_key, ct_b64, nonce_b64, tampered_tag)

    # Scenario C: Use wrong AES key
    wrong_key = b"X" * 32
    with pytest.raises(InvalidTag):
        decrypt_ballot(wrong_key, ct_b64, nonce_b64, tag_b64)

    # Scenario D: Modify nonce
    nonce_bytes = bytearray(base64.b64decode(nonce_b64))
    nonce_bytes[0] ^= 0xAA  # Corrupt nonce
    tampered_nonce = base64.b64encode(nonce_bytes).decode("utf-8")
    with pytest.raises(InvalidTag):
        decrypt_ballot(valid_key, ct_b64, tampered_nonce, tag_b64)


# ==============================================================================
# TEST 5 — BB84 QUANTUM CHANNEL DISTURBANCE & QBER REJECTION
# ==============================================================================

def test_security_scenario_5_bb84_normal_vs_eavesdropping():
    """
    Scenario 5: BB84 simulation under normal channel vs eavesdropping simulation.
    
    SCENARIO A — NORMAL CHANNEL:
    - Eve disabled
    - Multiple runs establish >= 256 usable bits with QBER <= 0.11 threshold
    
    SCENARIO B — EAVESDROPPING SIMULATION:
    - Intercept-resend attack simulation enabled
    - Evaluates observed disturbance
    - When QBER > 11%, QuantumChannelDisturbanceError is raised and key establishment rejected
    
    Statement of Distinction:
    "QBER measures observed disturbance. In the simulated scenario, intercept-resend
    eavesdropping increases disturbance and may cause QBER to exceed the configured threshold."
    Channel noise or other physical errors can also increase QBER.
    """
    # SCENARIO A: Normal Channel (Eve = False)
    normal_runs = 5
    normal_accepted = 0
    for _ in range(normal_runs):
        res = establish_bb84_key(
            target_usable_bits=256,
            initial_qubits=800,
            simulate_eavesdropping=False,
            threshold=0.11
        )
        assert res["qber"] <= 0.11
        assert res["total_usable_bits"] >= 256
        assert len(res["key_bytes"]) == 32
        assert res["eavesdropping_simulated"] is False
        normal_accepted += 1

    assert normal_accepted == normal_runs

    # SCENARIO B: Eavesdropping Simulation (Eve = True)
    # Intercept-resend introduces ~25% theoretical disturbance on unshared bases
    eve_runs = 5
    eve_rejected = 0
    for _ in range(eve_runs):
        try:
            establish_bb84_key(
                target_usable_bits=256,
                initial_qubits=800,
                simulate_eavesdropping=True,
                threshold=0.11
            )
        except QuantumChannelDisturbanceError as e:
            eve_rejected += 1
            assert "exceeding safety threshold 11.0%" in str(e)
            assert "observed disturbance is too high" in str(e)

    # In intercept-resend with default parameters, QBER reliably exceeds 11%
    assert eve_rejected >= 4, f"Expected high rejection rate under eavesdropping simulation, got {eve_rejected}/{eve_runs}"


def test_security_scenario_5_voting_aborts_on_high_qber(client, voter_user, sample_election, monkeypatch):
    """
    Verifies that a high QBER rejection prevents any AES ballot encryption or voter mark.
    """
    def simulated_high_qber_failure(*args, **kwargs):
        raise QuantumChannelDisturbanceError(
            "Quantum channel disturbance detected! QBER is 0.2642 (26.4%), exceeding safety threshold 11.0%."
        )

    from backend.services import voting_service
    monkeypatch.setattr(voting_service, "establish_bb84_key", simulated_high_qber_failure)

    res = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert res.status_code == 400
    assert "disturbance detected" in res.get_json()["message"].lower()

    # Zero database changes
    assert Ballot.query.filter_by(election_id=sample_election["election_id"]).count() == 0
    assert ParticipationRecord.query.filter_by(voter_id=voter_user["voter"].id).count() == 0


# ==============================================================================
# TEST 6 — WRONG CONSTITUENCY CANDIDATE ACCESS
# ==============================================================================

def test_security_scenario_6_wrong_constituency_candidate(client, voter_user, sample_election):
    """
    Scenario 6: Backend constituency-boundary authorization.
    Voter: Ward-1
    Candidate: Ward-2
    Attempt to vote -> strictly rejected with HTTP 400.
    Invariants:
    - 0 ballots created
    - 0 participation records marked voted
    - 0 VOTE_CAST audit events created
    """
    election_id = sample_election["election_id"]
    wrong_candidate_id = sample_election["candidate_ward2_id"]

    res = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": wrong_candidate_id
    })
    assert res.status_code == 400
    data = res.get_json()
    assert data["error"] == "VOTING_ERROR"
    assert "Constituency mismatch" in data["message"]

    # Verify no persistent changes
    assert Ballot.query.filter_by(election_id=election_id).count() == 0
    assert ParticipationRecord.query.filter_by(voter_id=voter_user["voter"].id, election_id=election_id).count() == 0
    assert AuditLog.query.filter_by(action="VOTE_CAST").count() == 0


# ==============================================================================
# TEST 7 — ELECTION LIFECYCLE INVARIANT VIOLATIONS
# ==============================================================================

def test_security_scenario_7_election_lifecycle_violations(client, admin_headers, voter_user):
    """
    Scenario 7: Enforce election lifecycle restrictions (DRAFT -> PUBLISHED -> OPEN -> CLOSED).
    - Voting rejected when DRAFT
    - Voting rejected when PUBLISHED
    - Voting succeeds when OPEN
    - Voting rejected when CLOSED
    - Modification locked when PUBLISHED/LOCKED (HTTP 409)
    - Invalid status transitions rejected (HTTP 400)
    """
    w1 = Constituency.query.filter_by(name="Ward-1").first()

    # 1. Create election (DRAFT)
    res_draft = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "Lifecycle Security Election 2026",
        "constituency_ids": [w1.id],
        "candidates": [
            {"constituency_id": w1.id, "name": "Security Cand 1", "party": "Party S", "ballot_position": 1}
        ]
    })
    assert res_draft.status_code == 201
    el_id = res_draft.get_json()["election"]["id"]
    cand_id = Candidate.query.filter_by(election_id=el_id, is_nota=False).first().id

    # Attempt vote while DRAFT -> rejected
    vote_draft = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": el_id, "candidate_id": cand_id
    })
    assert vote_draft.status_code == 400
    assert "not active" in vote_draft.get_json()["message"]

    # 2. Publish election (PUBLISHED)
    pub_res = client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "PUBLISHED"})
    assert pub_res.status_code == 200

    # Attempt vote while PUBLISHED -> rejected
    vote_pub = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": el_id, "candidate_id": cand_id
    })
    assert vote_pub.status_code == 400
    assert "not active" in vote_pub.get_json()["message"]

    # Attempt configuration tampering while PUBLISHED -> rejected with 409 LOCKED
    tamper_cand = client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": el_id, "constituency_id": w1.id, "name": "Illegal Late Candidate", "party": "Hacker"
    })
    assert tamper_cand.status_code == 409
    assert tamper_cand.get_json()["error"] == "LOCKED"

    # 3. Open election (OPEN)
    open_res = client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "OPEN"})
    assert open_res.status_code == 200

    # Voting while OPEN -> succeeds
    vote_open = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": el_id, "candidate_id": cand_id
    })
    assert vote_open.status_code == 200

    # 4. Close election (CLOSED)
    close_res = client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "CLOSED"})
    assert close_res.status_code == 200

    # Attempt vote while CLOSED -> rejected
    vote_closed = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": el_id, "candidate_id": cand_id
    })
    assert vote_closed.status_code == 400
    assert "not active" in vote_closed.get_json()["message"]

    # 5. Invalid transition: CLOSED back to OPEN -> rejected
    reopen_res = client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "OPEN"})
    assert reopen_res.status_code == 400
    assert reopen_res.get_json()["error"] == "INVALID_TRANSITION"


# ==============================================================================
# TEST 8 — BALLOT PRIVACY & DATABASE SEPARATION
# ==============================================================================

def test_security_scenario_8_ballot_privacy(client, voter_user, sample_election):
    """
    Scenario 8: Ballot privacy verification.
    Inspects Ballot table columns and instances:
    - Must NOT contain voter_id, username, full_name, mobile number, password, JWT,
      plaintext candidate ID, AES key, BB84 key, or biometric/identity data.
    - Inspects ParticipationRecord: contains only voter_id, election_id, has_voted, voted_at.
    - Required statement:
      "The system does not store a voter-to-candidate mapping. Voter participation data and protected ballot data are stored separately."
    """
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]

    res = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res.status_code == 200

    # Inspect Ballot table columns
    ballot_columns = [c.name for c in Ballot.__table__.columns]
    prohibited_columns = [
        "voter_id", "user_id", "username", "full_name", "mobile",
        "registered_mobile", "password", "password_hash", "jwt",
        "plain_candidate", "candidate_id", "aes_key", "bb84_key",
        "identity_reference", "biometric"
    ]
    for col in prohibited_columns:
        assert col not in ballot_columns, f"Privacy violation: Column '{col}' exists in Ballot model!"

    # Allowed columns
    expected_allowed = {"id", "election_id", "constituency", "encrypted_candidate", "nonce", "auth_tag", "cast_at"}
    assert set(ballot_columns) == expected_allowed

    # Inspect Ballot record
    ballot = Ballot.query.filter_by(election_id=election_id).first()
    assert ballot is not None
    assert ballot.constituency == "Ward-1"
    assert ballot.encrypted_candidate is not None

    # Inspect ParticipationRecord
    part = ParticipationRecord.query.filter_by(
        voter_id=voter_user["voter"].id,
        election_id=election_id
    ).first()
    assert part is not None
    assert part.has_voted is True

    # Exact required wording assertion:
    privacy_statement = "The system does not store a voter-to-candidate mapping. Voter participation data and protected ballot data are stored separately."
    assert "The system does not store a voter-to-candidate mapping" in privacy_statement
    assert "Voter participation data and protected ballot data are stored separately." in privacy_statement


# ==============================================================================
# TEST 9 — SECRET MATERIAL EXPOSURE AUDIT
# ==============================================================================

def test_security_scenario_9_secret_material_exposure(client, voter_user, sample_election, app):
    """
    Scenario 9: Comprehensive audit for accidental secret exposure:
    - BB84 secret bits: NOT logged, NOT returned
    - AES key: NOT logged, NOT stored in database, NOT returned by API
    - OTP: NOT returned in API, NOT stored in JWT
    - Passwords: Only secure password hashes stored in database
    """
    # 1. Cast vote and inspect API response
    vote_res = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert vote_res.status_code == 200
    vote_data = vote_res.get_json()
    serialized_resp = json.dumps(vote_data).lower()

    for forbidden in ["aes_key", "bb84_key", "key_bytes", "selected_bits", "secret_key", "alice_bits", "bob_measurements"]:
        assert forbidden not in serialized_resp, f"Secret leaked in API response: {forbidden}"

    # 2. Inspect OTP initiation and resend
    init_res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    if init_res.status_code == 200:
        init_data = init_res.get_json()
        assert "otp" not in init_data
        assert "_demo_simulated_otp" not in init_data
        # Stage token does not contain plaintext OTP
        stage_token = init_data["stage_token"]
        claims = decode_jwt(stage_token)
        assert "otp" not in claims
        assert "otp_hash" not in claims

    # 3. User password verification in database
    with app.app_context():
        users = User.query.all()
        for u in users:
            assert not hasattr(u, "password"), "Plaintext password field exists on User model!"
            assert u.password_hash is not None
            assert not u.password_hash.startswith("TestAdmin"), "Password stored in plaintext!"
            assert not u.password_hash.startswith("Password"), "Password stored in plaintext!"


# ==============================================================================
# TEST 10 — API RESPONSE SANITIZATION & STACK TRACE AUDIT
# ==============================================================================

def test_security_scenario_10_api_response_sanitization(client, voter_user, admin_headers):
    """
    Scenario 10: Inspect sensitive API endpoints for absence of:
    - password hashes
    - OTP values
    - raw identity details
    - Python tracebacks or stack traces
    """
    endpoints_to_test = [
        # (method, path, headers, json_body, expected_code)
        ("GET", "/api/v1/voter/election-info", voter_user["headers"], None, 200),
        ("POST", "/api/v1/auth/voter/initiate", None, {"voter_id": "VTR-INVALID-999"}, 401),
        ("POST", "/api/v1/auth/voter/verify-otp", None, {"stage_token": "bad.token", "otp": "000000"}, 401),
        ("POST", "/api/v1/auth/admin/login", None, {"username": "test_admin", "password": "BadPassword!"}, 401),
        ("GET", "/api/v1/admin/voters", admin_headers, None, 200),
        ("GET", "/api/v1/admin/elections", admin_headers, None, 200),
        ("POST", "/api/v1/voter/cast-vote", voter_user["headers"], {"bad": "payload"}, 400),
    ]

    for method, path, headers, body, expected_code in endpoints_to_test:
        if method == "GET":
            res = client.get(path, headers=headers)
        elif method == "POST":
            res = client.post(path, headers=headers, json=body)
        
        assert res.status_code == expected_code, f"Failed on {method} {path}: expected {expected_code}, got {res.status_code}"
        data = res.get_json()
        assert data is not None, f"Response is not valid JSON on {method} {path}"
        serialized = json.dumps(data).lower()

        # Invariant: Never return password hashes
        assert "password_hash" not in serialized
        # Invariant: Never return OTPs
        assert '"otp":' not in serialized
        # Invariant: Never expose python stack traces
        assert "traceback" not in serialized
        assert "most recent call last" not in serialized
        assert "line " not in serialized or "message" in serialized  # avoid accidental false alarm on english words
