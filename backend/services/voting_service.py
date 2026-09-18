import json
import logging
from datetime import datetime, timezone
from flask import current_app
from sqlalchemy.exc import IntegrityError
from backend.extensions import db
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.user import User
from backend.models.participation import ParticipationRecord
from backend.models.ballot import Ballot
from backend.quantum.bb84_circuit import generate_bb84_session, establish_bb84_key
from backend.quantum.sifting import sift_bases
from backend.quantum.qber import calculate_qber_and_extract_key, QuantumChannelDisturbanceError
from backend.crypto.key_conversion import bits_to_bytes_256
from backend.crypto.aes_gcm import encrypt_ballot
from backend.services.audit_service import log_audit_event
from backend.config import Config

class VotingError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

def cast_voter_ballot(voter_id: str, election_id: str, candidate_id: str, simulate_eavesdropping: bool | None = None):
    """
    Executes the secure end-to-end voting transaction pipeline:
    1. Authenticate voter & constituency verification
    2. Active election validation
    3. Candidate eligibility verification (must match voter constituency)
    4. Concurrency check: Single vote per election enforcement
    5. BB84 Quantum Key Distribution simulation
    6. Quantum basis sifting & QBER calculation
    7. QBER threshold verification (<= 11%)
    8. Direct 256-bit AES key construction from sifted bits
    9. AES-256-GCM ballot authenticated encryption (payload: candidate_id only)
    10. Ephemeral key reference release (memory-level zeroization not guaranteed by Python runtime)
    11. Protected Ballot persistence (ZERO identity linkage)
    12. ParticipationRecord update (voter marked as voted)
    13. Sanitized audit logging (user_id=None, no candidate choice)
    14. Commit transaction (with full rollback on any failure)
    """
    if simulate_eavesdropping is None:
        if current_app:
            simulate_eavesdropping = current_app.config.get("SIMULATE_EAVESDROPPING", Config.SIMULATE_EAVESDROPPING)
        else:
            simulate_eavesdropping = Config.SIMULATE_EAVESDROPPING

    try:
        # Step 1: Verify Voter
        voter = User.query.filter_by(id=voter_id).first()
        if not voter or voter.role != "VOTER":
            raise VotingError("Voter record not found or invalid role.", status_code=403)

        # Step 2: Verify Active Election & Voting Window
        election = Election.query.filter_by(id=election_id).first()
        if not election:
            raise VotingError("Election not found.", status_code=404)
        if election.status != "OPEN" or not election.is_active:
            raise VotingError(f"The requested election is not active (status: {election.status}).", status_code=400)

        now_utc = datetime.now(timezone.utc)
        if election.voting_open_at and now_utc < election.voting_open_at:
            raise VotingError("Voting window has not opened yet.", status_code=400)
        if election.voting_close_at and now_utc > election.voting_close_at:
            raise VotingError("Voting window has closed.", status_code=400)

        # Step 3: Verify Candidate belongs to this Election and Voter's Assigned Constituency
        candidate = Candidate.query.filter_by(id=candidate_id, election_id=election_id).first()
        if not candidate:
            raise VotingError("Candidate does not exist in this election.", status_code=400)
        if not candidate.is_active:
            raise VotingError("The selected candidate option is not currently active.", status_code=400)
        if candidate.constituency.strip().lower() != voter.constituency.strip().lower():
            raise VotingError(
                f"Constituency mismatch: Voter is registered in '{voter.constituency}', but candidate is in '{candidate.constituency}'.",
                status_code=400
            )

        # Step 4: Concurrency Check / Row Lock for One-Vote Enforcement
        participation = ParticipationRecord.query.filter_by(voter_id=voter_id, election_id=election_id).with_for_update().first()
        if participation and participation.has_voted:
            raise VotingError("A ballot has already been cast by this voter for this election.", status_code=409)

        # Step 5, 6, 7 & 8: Direct BB84 Key Establishment & QBER Evaluation
        # Transmits sufficient qubits (default 800) to yield >= 256 usable sifted bits after QBER sampling.
        # Exactly 256 unrevealed usable bits are directly converted into a 32-byte AES-256 key without key derivation or hashing.
        qubit_count = current_app.config.get("BB84_DEFAULT_QUBIT_COUNT", Config.BB84_DEFAULT_QUBIT_COUNT) if current_app else Config.BB84_DEFAULT_QUBIT_COUNT
        threshold = current_app.config.get("BB84_QBER_THRESHOLD", Config.BB84_QBER_THRESHOLD) if current_app else Config.BB84_QBER_THRESHOLD

        try:
            bb84_result = establish_bb84_key(
                target_usable_bits=256,
                initial_qubits=qubit_count,
                simulate_eavesdropping=simulate_eavesdropping,
                threshold=threshold,
            )
            aes_key = bb84_result["key_bytes"]
        except QuantumChannelDisturbanceError as e:
            db.session.rollback()
            try:
                log_audit_event(
                    action="BB84_QBER_HIGH",
                    user_id=None,
                    details={
                        "election_id": election_id, 
                        "error": str(e),
                        "explanation": "QBER above the configured threshold causes the BB84 key-establishment attempt to be rejected because the observed disturbance is too high. The disturbance may be caused by simulated eavesdropping, channel noise, or other errors."
                    }
                )
                db.session.commit()
            except Exception:
                db.session.rollback()
            raise VotingError(str(e), status_code=400)

        # Step 9: AES-256-GCM Encrypt Ballot Payload (candidate_id ONLY per approved specification)
        ballot_payload = json.dumps({
            "candidate_id": candidate.id,
        })

        encrypted = encrypt_ballot(aes_key, ballot_payload)

        # Step 10: Release Ephemeral Key References
        # The AES key is kept ephemeral, is not persisted, is not returned through APIs,
        # and its references are released after use. Strong memory-level zeroization
        # is not guaranteed by ordinary Python runtime semantics.
        del aes_key

        # Step 11: Persist Ballot (STRICTLY NO voter_id, username, or plaintext candidate)
        ballot = Ballot(
            election_id=election.id,
            constituency=voter.constituency,
            encrypted_candidate=encrypted["ciphertext"],
            nonce=encrypted["nonce"],
            auth_tag=encrypted["auth_tag"],
            cast_at=datetime.now(timezone.utc),
        )
        db.session.add(ballot)

        # Step 12: Update Participation Record
        if not participation:
            participation = ParticipationRecord(
                voter_id=voter.id,
                election_id=election.id,
                has_voted=True,
                voted_at=datetime.now(timezone.utc),
            )
            db.session.add(participation)
        else:
            participation.has_voted = True
            participation.voted_at = datetime.now(timezone.utc)

        # Step 13: Sanitized Audit Log (user_id = None, zero candidate disclosure)
        log_audit_event(
            action="VOTE_CAST",
            user_id=None,
            details={
                "election_id": election.id,
                "qber": bb84_result["qber"],
                "qber_percentage": bb84_result["qber_percentage"],
                "sifted_bits_count": bb84_result["total_sifted_bits"],
                "usable_bits_count": 256,
            }
        )

        # Step 14: Commit Entire Transaction Atomically
        db.session.commit()

        return {
            "success": True,
            "message": "Ballot encrypted via quantum-established key and successfully stored.",
            "telemetry": {
                "qkd_protocol": "BB84-Direct-256Bit-Key",
                "qber": bb84_result["qber"],
                "qber_percentage": bb84_result["qber_percentage"],
                "sifted_bits": bb84_result["total_sifted_bits"],
                "usable_bits": 256,
                "eavesdropping_simulated": simulate_eavesdropping,
                "channel_status": "SECURE_ACCEPTABLE"
            }
        }

    except VotingError:
        db.session.rollback()
        raise
    except IntegrityError:
        # Handles concurrent race conditions where two requests race to insert ParticipationRecord;
        # database constraint 'uq_voter_election' triggers an IntegrityError which is mapped cleanly to HTTP 409
        db.session.rollback()
        raise VotingError("A ballot has already been cast by this voter for this election.", status_code=409)
    except Exception as e:
        db.session.rollback()
        raise VotingError(f"Voting transaction failed: {str(e)}", status_code=500)
