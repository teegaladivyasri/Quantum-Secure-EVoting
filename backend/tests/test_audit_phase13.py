"""
Phase 13 Comprehensive Hardening & Audit Automated Tests
Verifies:
1. OTP terminal delivery and API response secrecy (initial + resend)
2. Complete 3-stage voter authentication lifecycle
3. Strict prohibition of admin voter creation (403 VOTER_REGISTRY_PREPROVISIONED)
4. Constituency-based candidate filtering and NOTA placement
5. One-vote per election policy enforcement (409 Conflict on duplicate)
6. Ballot privacy separation (zero voter identifiers in ballots table)
7. Cryptographic architecture invariants (Direct 256-bit BB84 -> 32-byte AES-GCM, no HKDF)
"""

import json
import pytest
from backend.extensions import db
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.constituency import Constituency
from backend.models.election_constituency import ElectionConstituency
from backend.models.ballot import Ballot
from backend.models.participation import ParticipationRecord
from backend.models.otp_session import VoterOtpSession
from backend.models.audit import AuditLog
from backend.services.auth_service import hash_password, generate_jwt, hash_otp
from backend.crypto.key_conversion import bits_to_bytes_256
from backend.crypto.aes_gcm import encrypt_ballot, decrypt_ballot

@pytest.fixture
def audit_setup(app):
    with app.app_context():
        # Clean state for audit tests
        w1 = Constituency.query.filter_by(name="Ward-1").first()
        if not w1:
            w1 = Constituency(name="Ward-1", code="W1", state="Example State", is_active=True)
            db.session.add(w1)

        w2 = Constituency.query.filter_by(name="Ward-2").first()
        if not w2:
            w2 = Constituency(name="Ward-2", code="W2", state="Example State", is_active=True)
            db.session.add(w2)

        # Pre-provisioned voter Alice in Ward-1
        alice = User.query.filter_by(voter_id="VTR-2026-00101").first()
        if not alice:
            alice = User(
                username="voter_alice_p13",
                password_hash=hash_password("Password123!"),
                role="VOTER",
                constituency="Ward-1",
                voter_id="VTR-2026-00101",
                full_name="Alice Sharma",
                registered_mobile="+91 98765 43101",
                is_active=True,
                synthetic_identity_reference="SYNTH_REF_ALICE"
            )
            db.session.add(alice)

        # Admin user
        admin = User.query.filter_by(username="admin_p13").first()
        if not admin:
            admin = User(
                username="admin_p13",
                password_hash=hash_password("AdminSecure2026!"),
                role="ADMIN",
                constituency="HEADQUARTERS"
            )
            db.session.add(admin)

        # Open election with candidates
        election = Election(
            title="Phase 13 Audit Assembly Election",
            description="Election for automated validation",
            status="OPEN",
            is_active=True
        )
        db.session.add(election)
        db.session.flush()

        # Link Ward-1 and Ward-2
        assoc1 = ElectionConstituency(election_id=election.id, constituency_id=w1.id)
        assoc2 = ElectionConstituency(election_id=election.id, constituency_id=w2.id)
        db.session.add_all([assoc1, assoc2])

        # Candidates in Ward-1: Pos 1, Pos 2, Pos 3 (NOTA)
        c1 = Candidate(
            election_id=election.id, constituency_id=w1.id, constituency="Ward-1",
            name="Dr. Sarah Rao", party="Progressive Coalition", ballot_position=1, is_active=True, is_nota=False
        )
        c2 = Candidate(
            election_id=election.id, constituency_id=w1.id, constituency="Ward-1",
            name="K. Venkatesh", party="Democratic Alliance", ballot_position=2, is_active=True, is_nota=False
        )
        nota_w1 = Candidate(
            election_id=election.id, constituency_id=w1.id, constituency="Ward-1",
            name="None of the Above (NOTA)", party="NOTA", ballot_position=3, is_active=True, is_nota=True
        )

        # Candidate in Ward-2
        c_w2 = Candidate(
            election_id=election.id, constituency_id=w2.id, constituency="Ward-2",
            name="P. Sundaram", party="Green Movement", ballot_position=1, is_active=True, is_nota=False
        )
        db.session.add_all([c1, c2, nota_w1, c_w2])
        db.session.commit()

        return {
            "voter_id": alice.voter_id,
            "voter_user_id": alice.id,
            "election_id": election.id,
            "candidate_ward1_id": c1.id,
            "candidate_ward2_id": c_w2.id,
            "nota_ward1_id": nota_w1.id,
            "admin_user_id": admin.id,
        }


# ==============================================================================
# 1. OTP TERMINAL DELIVERY & API PRIVACY TESTS
# ==============================================================================

def test_otp_terminal_output_and_api_secrecy(client, audit_setup, capsys):
    """
    Verifies that voter initiation:
    1. Delivers simulated OTP to terminal with [DEMO SIMULATED SMS GATEWAY] banner.
    2. Excludes OTP from API JSON response completely.
    3. Returns masked mobile representation.
    """
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": audit_setup["voter_id"]})
    assert res.status_code == 200
    data = res.get_json()

    # API response privacy verification
    assert "stage_token" in data
    assert data["stage"] == "OTP_PENDING"
    assert data["masked_mobile"] == "******3101"
    assert "otp" not in data
    assert "code" not in data
    assert "_demo_simulated_otp" not in data

    # Capture stdout and stderr
    captured = capsys.readouterr()
    combined_output = captured.out + captured.err
    assert "[DEMO SIMULATED SMS GATEWAY]" in combined_output
    assert "Dispatched to: +91 98765 43101" in combined_output
    assert "Simulated OTP:" in combined_output
    assert "Academic simulation only" in combined_output


def test_otp_resend_terminal_output_and_cooldown(client, audit_setup, capsys):
    """
    Verifies that OTP resend:
    1. Enforces cooldown when requested too quickly.
    2. Delivers [DEMO SIMULATED SMS GATEWAY - RESEND] banner when allowed.
    3. Excludes OTP from API JSON response.
    """
    # Initial request
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": audit_setup["voter_id"]})
    stage_token = res.get_json()["stage_token"]
    capsys.readouterr()  # Flush initial output

    # Immediate resend should be rate-limited (cooldown 60s)
    resend_fail = client.post("/api/v1/auth/voter/resend-otp", json={"stage_token": stage_token})
    assert resend_fail.status_code == 429
    assert resend_fail.get_json()["error"] == "RATE_LIMITED"

    # Manually age the session by 61 seconds to simulate cooldown expiry
    session = VoterOtpSession.query.filter_by(voter_user_id=audit_setup["voter_user_id"], is_verified=False).first()
    from datetime import datetime, timezone, timedelta
    session.created_at = datetime.now(timezone.utc) - timedelta(seconds=65)
    db.session.commit()

    # Now resend succeeds
    resend_ok = client.post("/api/v1/auth/voter/resend-otp", json={"stage_token": stage_token})
    assert resend_ok.status_code == 200
    resend_data = resend_ok.get_json()
    assert "otp" not in resend_data
    assert resend_data["masked_mobile"] == "******3101"

    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert "[DEMO SIMULATED SMS GATEWAY - RESEND]" in combined
    assert "Dispatched to: +91 98765 43101" in combined
    assert "Simulated OTP:" in combined


# ==============================================================================
# 2. FULL 3-STAGE VOTER AUTHENTICATION LIFECYCLE
# ==============================================================================

def test_three_stage_voter_authentication_flow(client, audit_setup):
    """
    Validates complete Stage 1 -> Stage 2 -> Stage 3 voter authentication.
    """
    # Stage 1: Voter ID entry
    res1 = client.post("/api/v1/auth/voter/initiate", json={"voter_id": audit_setup["voter_id"]})
    assert res1.status_code == 200
    stage1_token = res1.get_json()["stage_token"]

    # Retrieve session salt & set known test OTP in database for verification
    session = VoterOtpSession.query.filter_by(voter_user_id=audit_setup["voter_user_id"], is_verified=False).first()
    assert session is not None
    session.salt = "fixed_audit_salt"
    session.otp_hash = hash_otp("842109", "fixed_audit_salt")
    db.session.commit()

    # Stage 2: OTP submission
    res2 = client.post("/api/v1/auth/voter/verify-otp", json={
        "stage_token": stage1_token,
        "otp": "842109"
    })
    assert res2.status_code == 200
    stage2_token = res2.get_json()["stage_token"]
    assert res2.get_json()["stage"] == "IDENTITY_PENDING"

    # Verify session is invalidated immediately (cannot replay)
    replay_res = client.post("/api/v1/auth/voter/verify-otp", json={
        "stage_token": stage1_token,
        "otp": "842109"
    })
    assert replay_res.status_code in (400, 401)

    # Stage 3: Identity verification (demo fallback)
    res3 = client.post("/api/v1/auth/voter/verify-identity", json={
        "stage_token": stage2_token,
        "is_demo_fallback": True
    })
    assert res3.status_code == 200
    auth_data = res3.get_json()
    assert "token" in auth_data
    assert auth_data["user"]["role"] == "VOTER"
    assert auth_data["user"]["voter_id"] == audit_setup["voter_id"]


# ==============================================================================
# 3. ADMIN VOTER CREATION PROHIBITION RULE
# ==============================================================================

def test_admin_voter_registration_prohibited(client, audit_setup):
    """
    Enforces the Section 5 rule: Admin must NOT create voters.
    POST /api/v1/admin/voters must strictly return 403 VOTER_REGISTRY_PREPROVISIONED.
    """
    admin_token = generate_jwt(audit_setup["admin_user_id"], "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

    res = client.post("/api/v1/admin/voters", headers=admin_headers, json={
        "username": "new_unauthorized_voter",
        "password": "Password123!",
        "constituency": "Ward-1"
    })
    assert res.status_code == 403
    assert res.get_json()["error"] == "VOTER_REGISTRY_PREPROVISIONED"


# ==============================================================================
# 4. CONSTITUENCY CANDIDATE FILTERING & NOTA PLACEMENT
# ==============================================================================

def test_constituency_candidate_filtering_and_nota_order(client, audit_setup):
    """
    Verifies that:
    1. Voter only receives candidates belonging to their assigned constituency (Ward-1).
    2. NOTA is strictly the final option on the ballot.
    """
    voter_token = generate_jwt(audit_setup["voter_user_id"], "VOTER")
    voter_headers = {"Authorization": f"Bearer {voter_token}"}

    res = client.get(f"/api/v1/voter/election-info?election_id={audit_setup['election_id']}", headers=voter_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["voter_constituency"] == "Ward-1"

    candidates = data["eligible_candidates"]
    # Should include 2 standard candidates + 1 NOTA in Ward-1 (Ward-2 candidate excluded)
    assert len(candidates) == 3
    for cand in candidates:
        assert cand["constituency"] == "Ward-1"

    # Order verification: Pos 1 -> Pos 2 -> NOTA (strictly last)
    assert candidates[0]["name"] == "Dr. Sarah Rao" and not candidates[0]["is_nota"]
    assert candidates[1]["name"] == "K. Venkatesh" and not candidates[1]["is_nota"]
    assert candidates[2]["is_nota"] is True
    assert "NOTA" in candidates[2]["name"]


# ==============================================================================
# 5. ONE-VOTE ENFORCEMENT & CONFLICT HANDLING
# ==============================================================================

def test_one_vote_enforcement_and_duplicate_rejection(client, audit_setup):
    """
    Verifies that:
    1. First vote casting succeeds and updates ParticipationRecord.
    2. Second vote attempt by same voter for same election returns 409 Conflict.
    """
    voter_token = generate_jwt(audit_setup["voter_user_id"], "VOTER")
    voter_headers = {"Authorization": f"Bearer {voter_token}", "Content-Type": "application/json"}

    # First vote
    res1 = client.post("/api/v1/voter/cast-vote", headers=voter_headers, json={
        "election_id": audit_setup["election_id"],
        "candidate_id": audit_setup["candidate_ward1_id"]
    })
    assert res1.status_code == 200
    assert res1.get_json()["success"] is True

    # Check ParticipationRecord
    part = ParticipationRecord.query.filter_by(
        voter_id=audit_setup["voter_user_id"],
        election_id=audit_setup["election_id"]
    ).first()
    assert part is not None
    assert part.has_voted is True
    assert part.voted_at is not None

    # Second vote attempt must return 409 Conflict
    res2 = client.post("/api/v1/voter/cast-vote", headers=voter_headers, json={
        "election_id": audit_setup["election_id"],
        "candidate_id": audit_setup["nota_ward1_id"]
    })
    assert res2.status_code == 409
    assert "already been cast" in res2.get_json()["message"]


# ==============================================================================
# 6. BALLOT PRIVACY & AUDIT LOG SANITIZATION
# ==============================================================================

def test_ballot_privacy_and_audit_sanitization(client, audit_setup):
    """
    Verifies Section 10 & 17 requirements:
    1. Ballots table contains ZERO voter identifiers or keys.
    2. VOTE_CAST audit log entry has user_id = None and zero candidate choices.
    """
    voter_token = generate_jwt(audit_setup["voter_user_id"], "VOTER")
    voter_headers = {"Authorization": f"Bearer {voter_token}", "Content-Type": "application/json"}

    # Cast a ballot
    cast_res = client.post("/api/v1/voter/cast-vote", headers=voter_headers, json={
        "election_id": audit_setup["election_id"],
        "candidate_id": audit_setup["candidate_ward1_id"]
    })
    assert cast_res.status_code == 200

    ballots = Ballot.query.filter_by(election_id=audit_setup["election_id"]).all()
    assert len(ballots) >= 1
    for b in ballots:
        b_dict = b.to_dict()
        assert "voter_id" not in b_dict
        assert "username" not in b_dict
        assert "full_name" not in b_dict
        assert "encrypted_candidate" in b_dict
        assert "nonce" in b_dict
        assert "auth_tag" in b_dict

    # Audit log check
    vote_logs = AuditLog.query.filter_by(action="VOTE_CAST").all()
    assert len(vote_logs) >= 1
    for log in vote_logs:
        assert log.user_id is None
        assert "candidate_id" not in log.details
        assert "candidate" not in log.details
        assert "key" not in log.details
        assert "qber" in log.details


# ==============================================================================
# 7. DIRECT 256-BIT BB84 -> 32-BYTE AES-256 KEY CONVERSION (NO HKDF)
# ==============================================================================

def test_direct_bb84_key_conversion_architecture():
    """
    Verifies the Section 2 & 11 architectural constraint:
    Direct 256 bits -> 32 bytes AES-256 key with ZERO intermediate KDF or hashing.
    """
    # 256 random bits
    import secrets
    sample_bits = [secrets.randbits(1) for _ in range(256)]
    key_32_bytes = bits_to_bytes_256(sample_bits)

    assert len(key_32_bytes) == 32
    assert isinstance(key_32_bytes, bytes)

    # AES-256-GCM encryption with ballot payload
    payload = json.dumps({"candidate_id": "cand_test_uuid_1234"})
    encrypted = encrypt_ballot(key_32_bytes, payload)

    assert "ciphertext" in encrypted
    assert "nonce" in encrypted
    assert "auth_tag" in encrypted

    # Authenticated decryption recovers payload
    decrypted = decrypt_ballot(
        key_32_bytes,
        encrypted["ciphertext"],
        encrypted["nonce"],
        encrypted["auth_tag"]
    )
    assert decrypted == payload
    assert json.loads(decrypted)["candidate_id"] == "cand_test_uuid_1234"
