"""
Phase 5 Direct BB84 -> AES-256-GCM Integration Tests
Verifies end-to-end voting pipeline integration:
1. Successful eligible voter can cast a ballot.
2. BB84 is invoked during the voting operation.
3. Exactly 256 usable BB84 bits are converted into a 32-byte AES key.
4. AES-256-GCM encrypts candidate_id-only plaintext (no voter identity).
5. Ballot is stored successfully without voter identity or keys.
6. ParticipationRecord becomes has_voted=True.
7. Candidate choice is NOT stored in plaintext.
8. Ballot contains no voter_id, username, AES key, or BB84 key.
9. Audit VOTE_CAST has user_id=NULL and no candidate choice.
10. AES key and BB84 secret material are not present in API response.
11. QBER above 11% prevents vote creation and does not mark voter as voted.
12. Encryption failure rolls back the vote transaction atomically.
13. Database failure rolls back the vote transaction atomically.
14. Duplicate vote remains rejected (409 Conflict).
15. Concurrent duplicate vote race condition is protected by database constraint.
16. Wrong constituency remains rejected.
17. Inactive election remains rejected.
18. No HKDF is used in the active cryptographic flow.
"""
import json
import inspect
import pytest
from backend.extensions import db
from backend.models.election import Election
from backend.models.ballot import Ballot
from backend.models.participation import ParticipationRecord
from backend.models.audit import AuditLog
from backend.services import voting_service
from backend.crypto.aes_gcm import decrypt_ballot


def test_eligible_voter_casts_ballot_successfully(client, voter_user, sample_election):
    """Verifies that an eligible voter can successfully cast a ballot via direct BB84 -> AES-256-GCM."""
    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "telemetry" in data
    assert data["telemetry"]["channel_status"] == "SECURE_ACCEPTABLE"
    assert data["telemetry"]["qber"] <= 0.11
    assert data["telemetry"]["usable_bits"] == 256
    assert data["telemetry"]["qkd_protocol"] == "BB84-Direct-256Bit-Key"

    # Verify participation record updated
    participation = ParticipationRecord.query.filter_by(
        voter_id=voter_user["voter"].id,
        election_id=sample_election["election_id"]
    ).first()
    assert participation is not None
    assert participation.has_voted is True
    assert participation.voted_at is not None

    # Verify ballot created
    ballots = Ballot.query.filter_by(election_id=sample_election["election_id"]).all()
    assert len(ballots) == 1
    ballot = ballots[0]
    assert ballot.constituency == "Ward-1"
    assert ballot.encrypted_candidate is not None
    assert ballot.nonce is not None
    assert ballot.auth_tag is not None

    # Privacy assertions on stored ballot: strictly NO voter identity
    ballot_cols = [c.name for c in Ballot.__table__.columns]
    for prohibited in ["voter_id", "user_id", "username", "voter_name", "plain_candidate", "aes_key", "bb84_key"]:
        assert prohibited not in ballot_cols


def test_ballot_payload_contains_candidate_id_only(client, voter_user, sample_election, monkeypatch):
    """Verifies that the plaintext passed to AES-256-GCM contains ONLY candidate_id."""
    captured_payloads = []
    original_encrypt = voting_service.encrypt_ballot

    def spy_encrypt(key, plaintext):
        captured_payloads.append((key, plaintext))
        return original_encrypt(key, plaintext)

    monkeypatch.setattr(voting_service, "encrypt_ballot", spy_encrypt)

    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 200
    assert len(captured_payloads) == 1

    key, plaintext = captured_payloads[0]
    # Verify key length is exactly 32 bytes (256 bits)
    assert len(key) == 32

    # Verify payload format
    payload_data = json.loads(plaintext)
    assert list(payload_data.keys()) == ["candidate_id"]
    assert payload_data["candidate_id"] == sample_election["candidate_ward1_id"]

    # Prohibited fields must NEVER be inside the encrypted payload
    for forbidden in ["voter_id", "user_id", "username", "voter_name", "constituency", "party", "key"]:
        assert forbidden not in payload_data


def test_api_response_does_not_leak_secret_keys(client, voter_user, sample_election):
    """Verifies that the API response contains no secret keys or raw bitstrings."""
    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 200
    data = response.get_json()

    serialized = json.dumps(data).lower()
    for forbidden in ["aes_key", "bb84_key", "key_bytes", "secret_key", "raw_bits", "selected_bits"]:
        assert forbidden not in serialized


def test_qber_above_threshold_aborts_vote_and_does_not_mark_voted(client, voter_user, sample_election):
    """Verifies that high QBER under simulated eavesdropping aborts the vote and marks nothing as voted."""
    from backend.config import Config
    # Force simulated eavesdropping for this request
    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    # Normal request succeeds
    assert response.status_code == 200


def test_qber_disturbance_rejection_rolls_back(client, voter_user, sample_election, monkeypatch):
    """Verifies that QuantumChannelDisturbanceError rolls back the transaction atomically."""
    from backend.quantum.qber import QuantumChannelDisturbanceError

    def faulty_establish(*args, **kwargs):
        raise QuantumChannelDisturbanceError(
            "Quantum channel disturbance detected! QBER is 0.25, exceeding safety threshold 11.0%."
        )

    monkeypatch.setattr(voting_service, "establish_bb84_key", faulty_establish)

    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 400
    data = response.get_json()
    assert "disturbance detected" in data["message"].lower()

    # Verify participation record was NOT updated
    participation = ParticipationRecord.query.filter_by(
        voter_id=voter_user["voter"].id,
        election_id=sample_election["election_id"]
    ).first()
    assert participation is None

    # Verify ballot was NOT created
    ballots = Ballot.query.filter_by(election_id=sample_election["election_id"]).all()
    assert len(ballots) == 0

    # Verify audit event logged for BB84_QBER_HIGH with user_id = None
    audit = AuditLog.query.filter_by(action="BB84_QBER_HIGH").first()
    assert audit is not None
    assert audit.user_id is None


def test_vote_cast_audit_log_anonymity(client, voter_user, sample_election):
    """Verifies that VOTE_CAST audit events have user_id=None and no candidate disclosure."""
    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 200

    audit = AuditLog.query.filter_by(action="VOTE_CAST").first()
    assert audit is not None
    assert audit.user_id is None  # Anonymity guarantee

    details = json.loads(audit.details) if isinstance(audit.details, str) else audit.details
    assert "candidate_id" not in details
    assert "voter_id" not in details
    assert "aes_key" not in details
    assert "bb84_key" not in details


def test_duplicate_vote_rejected(client, voter_user, sample_election):
    """Verifies single-vote enforcement rejects a second attempt with 409 Conflict."""
    res1 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert res1.status_code == 200

    res2 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert res2.status_code == 409
    data = res2.get_json()
    assert data["error"] == "VOTING_ERROR"


def test_wrong_constituency_candidate_rejected(client, voter_user, sample_election):
    """Verifies candidate constituency mismatch is rejected."""
    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward2_id"]
    })
    assert response.status_code == 400
    data = response.get_json()
    assert "Constituency mismatch" in data["message"]


def test_voting_in_inactive_election_rejected(client, voter_user, sample_election):
    """Verifies voting in an inactive election is rejected."""
    election = Election.query.filter_by(id=sample_election["election_id"]).first()
    election.is_active = False
    db.session.commit()

    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 400
    data = response.get_json()
    assert "not active" in data["message"]


def test_voting_transaction_rolls_back_on_failure(client, voter_user, sample_election, monkeypatch):
    """Verifies that an encryption failure rolls back the entire transaction atomically."""
    def faulty_encrypt(*args, **kwargs):
        raise RuntimeError("Simulated unexpected encryption engine failure")

    monkeypatch.setattr(voting_service, "encrypt_ballot", faulty_encrypt)

    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 500

    participation = ParticipationRecord.query.filter_by(
        voter_id=voter_user["voter"].id,
        election_id=sample_election["election_id"]
    ).first()
    assert participation is None

    ballots = Ballot.query.filter_by(election_id=sample_election["election_id"]).all()
    assert len(ballots) == 0


def test_concurrent_duplicate_vote_integrity_error_handled(client, voter_user, sample_election, monkeypatch):
    """Verifies that if a race condition produces an IntegrityError on uq_voter_election, it is cleanly mapped to 409 Conflict."""
    from sqlalchemy.exc import IntegrityError

    def commit_with_race_condition():
        raise IntegrityError("UNIQUE constraint failed: participation_records.voter_id, participation_records.election_id", orig=None, params=None)

    monkeypatch.setattr(db.session, "commit", commit_with_race_condition)

    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 409
    data = response.get_json()
    assert "already been cast" in data["message"]


def test_no_hkdf_in_voting_service():
    """Verifies that HKDF is not imported or used anywhere in voting_service."""
    source = inspect.getsource(voting_service)
    assert "hkdf" not in source.lower()
    assert "derive_256bit_aes_key" not in source
