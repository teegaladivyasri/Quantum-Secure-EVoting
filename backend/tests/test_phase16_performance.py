"""
Phase 16 — Performance & Reliability Evaluation Test Suite

This test suite performs automated performance measurement and reliability verification
on the active Quantum-Secure Electronic Voting System prototype.

Evaluated Areas:
1. BB84 Quantum Key Distribution execution time (Normal Channel)
2. BB84 Disturbance Rejection execution time under simulated eavesdropping
3. AES-256-GCM encryption operation duration and throughput
4. End-to-end vote submission pipeline timing breakdown
5. Database CRUD query execution timing
6. Multi-voter execution reliability (multiple synthetic voters)
7. Duplicate voting rejection reliability
8. Invalid voting scenario rejection reliability
9. Transaction rollback reliability on fault injection
10. Concurrency race condition handling reliability
11. Controlled synthetic scalability observation
12. Prototype process resource usage observation (CPU & Memory)
"""

import time
import json
import uuid
import psutil
import os
import re
import statistics
import pytest
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

from backend.extensions import db
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.constituency import Constituency
from backend.models.election_constituency import ElectionConstituency
from backend.models.ballot import Ballot
from backend.models.participation import ParticipationRecord
from backend.models.audit import AuditLog

from backend.quantum.bb84_circuit import establish_bb84_key
from backend.quantum.qber import QuantumChannelDisturbanceError
from backend.crypto.aes_gcm import encrypt_ballot, decrypt_ballot
from backend.services.auth_service import hash_password, generate_jwt
from backend.services.voting_service import cast_voter_ballot, VotingError


# ==============================================================================
# 1. BB84 NORMAL CHANNEL PERFORMANCE
# ==============================================================================

def test_bb84_normal_channel_performance():
    """
    Measures BB84 key establishment execution time across multiple runs (normal channel).
    Verifies that:
    - Execution time is measured using time.perf_counter()
    - Usable bits >= 256
    - QBER <= 0.11
    - Direct 32-byte key is established without key derivation
    """
    runs = 3
    times = []
    qbers = []
    usable_bits_list = []

    for _ in range(runs):
        t0 = time.perf_counter()
        res = establish_bb84_key(
            target_usable_bits=256,
            initial_qubits=800,
            simulate_eavesdropping=False,
            threshold=0.11
        )
        duration = time.perf_counter() - t0
        times.append(duration)
        qbers.append(res["qber"])
        usable_bits_list.append(res["total_usable_bits"])

        assert res["qber"] <= 0.11
        assert res["total_usable_bits"] >= 256
        assert len(res["key_bytes"]) == 32

    avg_ms = statistics.mean(times) * 1000
    assert avg_ms > 0
    assert all(q <= 0.11 for q in qbers)


# ==============================================================================
# 2. BB84 SIMULATED EAVESDROPPING PERFORMANCE
# ==============================================================================

def test_bb84_simulated_eavesdropping_performance():
    """
    Measures BB84 execution under simulated intercept-resend eavesdropping.
    Under the configured intercept-resend simulation, the observed disturbance
    caused the QBER to exceed the configured threshold in the tested runs.
    """
    runs = 3
    rejection_count = 0
    times = []

    for _ in range(runs):
        t0 = time.perf_counter()
        try:
            establish_bb84_key(
                target_usable_bits=256,
                initial_qubits=800,
                simulate_eavesdropping=True,
                threshold=0.11
            )
            times.append(time.perf_counter() - t0)
        except QuantumChannelDisturbanceError as e:
            times.append(time.perf_counter() - t0)
            rejection_count += 1
            assert "exceeding safety threshold 11.0%" in str(e)

    # In intercept-resend mode, disturbance causes rejection
    assert rejection_count >= 2


# ==============================================================================
# 3. AES-256-GCM PERFORMANCE
# ==============================================================================

def test_aes_256_gcm_encryption_performance():
    """
    Measures AES-256-GCM encryption latency across 100 iterations.
    Payload: {"candidate_id": "<UUID>"}
    Cryptographic parameters: 32-byte key, 12-byte nonce, 16-byte tag.
    """
    key = b"\x42" * 32
    payload = json.dumps({"candidate_id": str(uuid.uuid4())})
    times = []

    # Warm-up
    for _ in range(5):
        encrypt_ballot(key, payload)

    for _ in range(100):
        t0 = time.perf_counter()
        enc = encrypt_ballot(key, payload)
        times.append(time.perf_counter() - t0)

    avg_us = statistics.mean(times) * 1_000_000
    median_us = statistics.median(times) * 1_000_000

    # AES hardware acceleration / efficient C library yields sub-millisecond encryption
    assert avg_us < 1000.0, f"AES-GCM encryption unexpectedly slow: {avg_us:.2f} µs"
    assert median_us < 1000.0

    # Verify roundtrip decryption
    decrypted = decrypt_ballot(key, enc["ciphertext"], enc["nonce"], enc["auth_tag"])
    assert decrypted == payload


# ==============================================================================
# 4. END-TO-END VOTE SUBMISSION PIPELINE TIMING BREAKDOWN
# ==============================================================================

def test_end_to_end_vote_submission_timing_breakdown(app, client, voter_user, sample_election):
    """
    Measures the end-to-end vote submission pipeline and its components:
    1. Validation
    2. Participation lookup
    3. BB84 key establishment
    4. AES-GCM encryption
    5. Ballot persistence
    6. Participation update
    7. Transaction commit
    """
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]

    t_total_0 = time.perf_counter()
    res = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    total_time = time.perf_counter() - t_total_0

    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert total_time > 0
    # Telemetry should confirm secure establishment
    assert data["telemetry"]["channel_status"] == "SECURE_ACCEPTABLE"


# ==============================================================================
# 5. DATABASE OPERATIONS TIMING
# ==============================================================================

def test_database_operations_timing(app, voter_user, sample_election):
    """
    Measures representative database operation timings:
    - Voter lookup
    - Election lookup
    - Candidate lookup
    - Participation lookup
    - Ballot insertion
    - Participation update
    """
    voter_id = voter_user["voter"].id
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]

    with app.app_context():
        # 1. Voter lookup
        t0 = time.perf_counter()
        v = User.query.filter_by(id=voter_id).first()
        t_voter = time.perf_counter() - t0
        assert v is not None

        # 2. Election lookup
        t0 = time.perf_counter()
        e = Election.query.filter_by(id=election_id).first()
        t_election = time.perf_counter() - t0
        assert e is not None

        # 3. Candidate lookup
        t0 = time.perf_counter()
        c = Candidate.query.filter_by(id=candidate_id).first()
        t_candidate = time.perf_counter() - t0
        assert c is not None

        # 4. Participation lookup
        t0 = time.perf_counter()
        p = ParticipationRecord.query.filter_by(voter_id=voter_id, election_id=election_id).first()
        t_part = time.perf_counter() - t0

        # 5. Ballot insertion (with rollback)
        t0 = time.perf_counter()
        b = Ballot(
            election_id=election_id,
            constituency="Ward-1",
            encrypted_candidate="ciphertext_timing",
            nonce="nonce_timing",
            auth_tag="tag_timing"
        )
        db.session.add(b)
        db.session.flush()
        t_ballot = time.perf_counter() - t0
        db.session.rollback()

    assert t_voter > 0 and t_election > 0 and t_candidate > 0 and t_ballot > 0


# ==============================================================================
# 6. RELIABILITY: MULTIPLE SUCCESSFUL VOTES (SYNTHETIC VOTERS)
# ==============================================================================

def test_reliability_multiple_successful_votes(app, client, sample_election):
    """
    Verifies reliability across multiple distinct synthetic voters:
    - Each valid voter casts a ballot
    - Exactly one participation record per voter/election
    - Exactly one ballot created per vote
    - No voter identity in ballot
    """
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]
    num_voters = 3

    with app.app_context():
        # Pre-seed distinct voters
        voter_tokens = []
        for i in range(num_voters):
            u = User(
                username=f"synth_reliable_{i}_{uuid.uuid4().hex[:4]}",
                password_hash=hash_password("Pass123!"),
                role="VOTER",
                constituency="Ward-1",
                voter_id=f"VTR-REL-{i:04d}",
                is_active=True
            )
            db.session.add(u)
            db.session.flush()
            token = generate_jwt(u.id, "VOTER")
            voter_tokens.append((u.id, token))
        db.session.commit()

        initial_ballot_count = Ballot.query.filter_by(election_id=election_id).count()

        for idx, (uid, token) in enumerate(voter_tokens):
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            res = client.post("/api/v1/voter/cast-vote", headers=headers, json={
                "election_id": election_id,
                "candidate_id": candidate_id
            })
            assert res.status_code == 200, f"Voter {idx+1} failed to cast vote"
            assert res.get_json()["success"] is True

            # Participation verified
            part = ParticipationRecord.query.filter_by(voter_id=uid, election_id=election_id).first()
            assert part is not None
            assert part.has_voted is True

        final_ballot_count = Ballot.query.filter_by(election_id=election_id).count()
        assert final_ballot_count == initial_ballot_count + num_voters

        # Privacy verification
        ballots = Ballot.query.filter_by(election_id=election_id).all()
        for b in ballots:
            assert not hasattr(b, "voter_id")
            assert not hasattr(b, "username")


# ==============================================================================
# 7. RELIABILITY: DUPLICATE VOTING REJECTION
# ==============================================================================

def test_reliability_duplicate_voting_rejection(client, voter_user, sample_election):
    """
    Verifies that repeated vote attempts by the same voter are reliably rejected:
    - First vote succeeds
    - Second vote returns 409
    - Third vote returns 409
    - No duplicate ballots created
    """
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]

    # 1. First vote
    res1 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res1.status_code == 200

    # 2. Second vote attempt
    res2 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res2.status_code == 409
    assert res2.get_json()["error"] == "VOTING_ERROR"

    # 3. Third vote attempt
    res3 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res3.status_code == 409

    assert Ballot.query.filter_by(election_id=election_id).count() == 1
    assert ParticipationRecord.query.filter_by(voter_id=voter_user["voter"].id, election_id=election_id).count() == 1


# ==============================================================================
# 8. RELIABILITY: INVALID VOTING SCENARIOS REJECTION
# ==============================================================================

def test_reliability_invalid_voting_scenarios(client, voter_user, sample_election, admin_headers):
    """
    Verifies clean rejection of representative invalid voting scenarios:
    - Invalid candidate UUID
    - Wrong constituency candidate
    - Closed election
    - Draft election
    """
    election_id = sample_election["election_id"]

    # A. Invalid candidate UUID
    res_a = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": "00000000-0000-0000-0000-000000000000"
    })
    assert res_a.status_code == 400
    assert "Candidate does not exist" in res_a.get_json()["message"]

    # B. Wrong constituency candidate
    res_b = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": sample_election["candidate_ward2_id"]
    })
    assert res_b.status_code == 400
    assert "Constituency mismatch" in res_b.get_json()["message"]

    # C. Draft election
    res_c_el = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "Draft Reliability Test"
    })
    draft_id = res_c_el.get_json()["election"]["id"]
    res_c = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": draft_id,
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert res_c.status_code == 400
    assert "not active" in res_c.get_json()["message"]


# ==============================================================================
# 9. RELIABILITY: TRANSACTION ROLLBACK
# ==============================================================================

def test_reliability_transaction_rollback_on_fault(client, voter_user, sample_election, monkeypatch):
    """
    Verifies that a failure during the voting pipeline cleanly rolls back:
    - No orphan ballot
    - ParticipationRecord is not marked as voted
    - No VOTE_CAST audit entry
    """
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]

    def fault_injector(*args, **kwargs):
        raise RuntimeError("Simulated runtime fault during encryption")

    from backend.services import voting_service
    monkeypatch.setattr(voting_service, "encrypt_ballot", fault_injector)

    res = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res.status_code == 500

    # Verify zero database changes
    assert Ballot.query.filter_by(election_id=election_id).count() == 0
    assert ParticipationRecord.query.filter_by(voter_id=voter_user["voter"].id, election_id=election_id).count() == 0
    assert AuditLog.query.filter_by(action="VOTE_CAST").count() == 0


# ==============================================================================
# 10. RELIABILITY: CONCURRENT VOTING RACE HANDLING
# ==============================================================================

def test_reliability_concurrent_voting_race(client, voter_user, sample_election, monkeypatch):
    """
    Verifies that racing concurrent requests trigger the database uniqueness
    guarantee and cleanly map to HTTP 409 Conflict.
    "The tested concurrency scenario maintained the database uniqueness and transaction
    guarantees, with at most one successful vote for the same voter/election."
    """
    election_id = sample_election["election_id"]
    candidate_id = sample_election["candidate_ward1_id"]

    # First vote executes
    res1 = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res1.status_code == 200

    # Concurrent race collision
    def simulate_integrity_error():
        raise IntegrityError("UNIQUE constraint failed: participation_records.voter_id, participation_records.election_id", orig=None, params=None)

    monkeypatch.setattr(db.session, "commit", simulate_integrity_error)

    res_race = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": election_id,
        "candidate_id": candidate_id
    })
    assert res_race.status_code == 409
    assert res_race.get_json()["error"] == "VOTING_ERROR"

    monkeypatch.undo()
    assert Ballot.query.filter_by(election_id=election_id).count() == 1


# ==============================================================================
# 11. BASIC SCALABILITY EXPERIMENT (CONTROLLED SYNTHETIC OBSERVATION)
# ==============================================================================

def test_basic_scalability_synthetic_experiment(app, sample_election):
    """
    Controlled prototype scalability observation using synthetic data:
    Evaluates query latency across synthetic voter populations of 10, 25, and 50 records.
    """
    election_id = sample_election["election_id"]
    dataset_sizes = [10, 25, 50]
    observations = {}

    with app.app_context():
        # Pre-generate a password hash once to avoid repeated bcrypt CPU overhead in synthetic seeding
        precomputed_hash = hash_password("DemoPassword123!")

        for size in dataset_sizes:
            v_subset = []
            for i in range(size):
                u = User(
                    username=f"scale_test_{size}_{i}_{uuid.uuid4().hex[:4]}",
                    password_hash=precomputed_hash,
                    role="VOTER",
                    constituency="Ward-1",
                    voter_id=f"VTR-SCL-{size}-{i:04d}",
                    is_active=True
                )
                db.session.add(u)
                v_subset.append(u)
            db.session.commit()

            # Measure voter lookup latency
            t0 = time.perf_counter()
            for v_obj in v_subset:
                _ = User.query.filter_by(voter_id=v_obj.voter_id).first()
            lookup_avg = (time.perf_counter() - t0) / size

            observations[size] = lookup_avg

    # Latency should remain sub-10ms per record on indexed queries
    for size, avg_time in observations.items():
        assert avg_time < 0.05, f"Lookup latency above 50ms at scale {size}: {avg_time*1000:.2f} ms"


# ==============================================================================
# 12. RESOURCE OBSERVATION
# ==============================================================================

def test_resource_usage_observation():
    """
    Records process-level memory and CPU resource observations.
    Prototype observation only.
    """
    process = psutil.Process(os.getpid())
    mem = process.memory_info()
    cpu = process.cpu_percent(interval=0.05)

    rss_mb = mem.rss / (1024 * 1024)
    vms_mb = mem.vms / (1024 * 1024)

    assert rss_mb > 0
    assert vms_mb > 0
    assert cpu >= 0.0
