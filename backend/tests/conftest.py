import pytest
from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.constituency import Constituency
from backend.models.election_constituency import ElectionConstituency
from backend.services.auth_service import hash_password, generate_jwt

class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = "test-jwt-secret-key-32-chars-at-least"
    JWT_EXPIRATION_SECONDS = 3600
    SECRET_KEY = "test-flask-secret-key"
    BB84_DEFAULT_QUBIT_COUNT = 800
    BB84_QBER_THRESHOLD = 0.11
    SIMULATE_EAVESDROPPING = False

@pytest.fixture(autouse=True)
def default_demo_delivery_mode(monkeypatch):
    """
    Ensures unit and integration tests run in DEMO mode by default,
    preventing tests from making accidental real SMS network calls.
    Tests specifically testing SMS mode can explicitly monkeypatch Config.OTP_DELIVERY_MODE.
    """
    from backend.config import Config
    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "demo")

@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        # Seed default test constituencies
        for name, code in [("Ward-1", "W1"), ("Ward-2", "W2"), ("Ward-3", "W3")]:
            c = Constituency(name=name, code=code, state="Example State", is_active=True)
            db.session.add(c)

        test_admin = User(
            username="test_admin",
            password_hash=hash_password("TestAdmin123!"),
            role="ADMIN",
            constituency="HEADQUARTERS"
        )
        db.session.add(test_admin)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def admin_headers(app):
    with app.app_context():
        admin = User.query.filter_by(username="test_admin").first()
        token = generate_jwt(admin.id, admin.role)
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

@pytest.fixture
def sample_election(app):
    with app.app_context():
        election = Election(
            title="Ward Council Election 2026",
            description="Constituency level election",
            status="OPEN"
        )
        db.session.add(election)
        db.session.flush()

        w1 = Constituency.query.filter_by(name="Ward-1").first()
        w2 = Constituency.query.filter_by(name="Ward-2").first()

        assoc1 = ElectionConstituency(election_id=election.id, constituency_id=w1.id)
        assoc2 = ElectionConstituency(election_id=election.id, constituency_id=w2.id)
        db.session.add_all([assoc1, assoc2])

        c1 = Candidate(election_id=election.id, constituency_id=w1.id, name="Candidate Alpha", party="Solar Party", constituency="Ward-1", ballot_position=1)
        c2 = Candidate(election_id=election.id, constituency_id=w1.id, name="Candidate Beta", party="Lunar Party", constituency="Ward-1", ballot_position=2)
        c3 = Candidate(election_id=election.id, constituency_id=w2.id, name="Candidate Gamma", party="Terra Party", constituency="Ward-2", ballot_position=1)
        db.session.add_all([c1, c2, c3])
        db.session.commit()

        return {
            "election_id": election.id,
            "candidate_ward1_id": c1.id,
            "candidate_ward2_id": c3.id,
        }

@pytest.fixture
def voter_user(app):
    with app.app_context():
        voter = User(
            username="voter_alice",
            password_hash=hash_password("Password123!"),
            role="VOTER",
            constituency="Ward-1"
        )
        db.session.add(voter)
        db.session.commit()
        token = generate_jwt(voter.id, voter.role)
        return {
            "voter": voter,
            "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        }
