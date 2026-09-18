"""
Phase 3 Database & Data Model Verification Tests
Verifies:
1. User model fields, UUID primary keys, and relationships
2. Election model structure and relationships
3. Candidate -> Election relationship, constituency, and uniqueness
4. ParticipationRecord -> User / Election relationships
5. uq_voter_election uniqueness constraint enforcement
6. Ballot -> Election relationship
7. Ballot model strict privacy separation (NO voter reference, NO plain candidate, NO keys)
8. AuditLog structure and optional user relationship
9. VOTE_CAST audit privacy rules
10. PostgreSQL configuration verification
"""
import uuid
import pytest
from sqlalchemy.exc import IntegrityError
from backend.extensions import db
from backend.config import Config
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.participation import ParticipationRecord
from backend.models.ballot import Ballot
from backend.models.audit import AuditLog
from backend.services.auth_service import hash_password


def test_user_model_attributes_and_defaults(app):
    """Verify User model creation, UUID generation, role, and constituency."""
    with app.app_context():
        user = User(
            username="model_test_user",
            password_hash=hash_password("SecurePass123!"),
            role="VOTER",
            constituency="Ward-1"
        )
        db.session.add(user)
        db.session.commit()

        retrieved = User.query.filter_by(username="model_test_user").first()
        assert retrieved is not None
        assert len(retrieved.id) == 36  # UUID v4 string
        assert retrieved.role == "VOTER"
        assert retrieved.constituency == "Ward-1"
        assert retrieved.created_at is not None

        # Verify username uniqueness constraint
        duplicate = User(
            username="model_test_user",
            password_hash=hash_password("AnotherPass!"),
            role="VOTER",
            constituency="Ward-1"
        )
        db.session.add(duplicate)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


def test_election_and_candidate_relationships(app):
    """Verify Election and Candidate models, relationships, and cascade."""
    with app.app_context():
        election = Election(
            title="Model Verification Election",
            description="Testing models and relationships",
            is_active=True
        )
        db.session.add(election)
        db.session.commit()

        cand1 = Candidate(
            election_id=election.id,
            name="Candidate One",
            party="Party A",
            constituency="Ward-1"
        )
        cand2 = Candidate(
            election_id=election.id,
            name="Candidate Two",
            party="Party B",
            constituency="Ward-2"
        )
        db.session.add_all([cand1, cand2])
        db.session.commit()

        # Check election -> candidates backref
        assert len(election.candidates) == 2
        assert election.candidates[0].name in ["Candidate One", "Candidate Two"]
        assert cand1.election.title == "Model Verification Election"

        # Check uniqueness constraint uq_election_candidate_constituency
        dup_cand = Candidate(
            election_id=election.id,
            name="Candidate One",
            party="Duplicate Party",
            constituency="Ward-1"
        )
        db.session.add(dup_cand)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


def test_participation_record_and_uq_voter_election_constraint(app):
    """Verify ParticipationRecord links voter & election and enforces uq_voter_election."""
    with app.app_context():
        voter = User(
            username="part_voter_1",
            password_hash=hash_password("Pass123!"),
            role="VOTER",
            constituency="Ward-1"
        )
        election = Election(
            title="Participation Test Election",
            is_active=True
        )
        db.session.add_all([voter, election])
        db.session.commit()

        record1 = ParticipationRecord(
            voter_id=voter.id,
            election_id=election.id,
            has_voted=True
        )
        db.session.add(record1)
        db.session.commit()

        assert record1.voter.username == "part_voter_1"
        assert record1.election.title == "Participation Test Election"
        assert record1.has_voted is True

        # Attempt duplicate participation for same (voter_id, election_id)
        record2 = ParticipationRecord(
            voter_id=voter.id,
            election_id=election.id,
            has_voted=True
        )
        db.session.add(record2)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


def test_ballot_strict_privacy_separation(app):
    """Verify Ballot links only to Election and contains NO voter identity or secret material."""
    with app.app_context():
        # Inspect columns
        column_names = [col.name for col in Ballot.__table__.columns]
        prohibited_columns = [
            "voter_id", "user_id", "username", "voter_name",
            "candidate_name", "candidate_id", "party", "plain_candidate",
            "aes_key", "bb84_key", "secret_key"
        ]
        for col in prohibited_columns:
            assert col not in column_names, f"Prohibited column '{col}' found in Ballot table!"

        # Inspect relationships
        rel_names = [rel.key for rel in Ballot.__mapper__.relationships]
        assert "election" in rel_names
        assert "voter" not in rel_names
        assert "user" not in rel_names

        # Verify Ballot insertion and link to Election
        election = Election(title="Ballot Test Election", is_active=True)
        db.session.add(election)
        db.session.commit()

        ballot = Ballot(
            election_id=election.id,
            constituency="Ward-1",
            encrypted_candidate="dummy_ciphertext_base64",
            nonce="dummy_nonce_base64",
            auth_tag="dummy_auth_tag_base64"
        )
        db.session.add(ballot)
        db.session.commit()

        assert ballot.id is not None
        assert ballot.election_id == election.id
        assert ballot.constituency == "Ward-1"
        assert ballot.election.title == "Ballot Test Election"
        assert len(election.ballots) == 1


def test_audit_log_structure_and_vote_cast_privacy(app):
    """Verify AuditLog structure and that VOTE_CAST events do not contain voter/candidate links."""
    with app.app_context():
        admin = User(
            username="audit_admin",
            password_hash=hash_password("Pass123!"),
            role="ADMIN",
            constituency="HEADQUARTERS"
        )
        db.session.add(admin)
        db.session.commit()

        # Admin audit log
        admin_log = AuditLog(
            action="ELECTION_CREATED",
            user_id=admin.id,
            details='{"election_title": "Assembly 2026"}'
        )
        db.session.add(admin_log)

        # Anonymous vote cast audit log
        vote_log = AuditLog(
            action="VOTE_CAST",
            user_id=None,  # MUST be NULL
            details='{"election_id": "dummy-uuid", "constituency": "Ward-1"}'
        )
        db.session.add(vote_log)
        db.session.commit()

        assert admin_log.user.username == "audit_admin"
        assert vote_log.user_id is None

        dict_log = vote_log.to_dict()
        assert dict_log["user_id"] is None
        assert "candidate_id" not in str(dict_log["details"])
        assert "voter_id" not in str(dict_log["details"])


def test_runtime_database_is_postgresql():
    """Verify that Config specifies PostgreSQL as the runtime database."""
    assert "postgresql://" in Config.SQLALCHEMY_DATABASE_URI
    assert "sqlite" not in Config.SQLALCHEMY_DATABASE_URI
