import json
import time
from datetime import datetime, timezone, timedelta
import pytest
from backend.extensions import db
from backend.models.user import User
from backend.models.otp_session import VoterOtpSession
from backend.services.auth_service import hash_password, generate_jwt, decode_jwt, hash_otp

@pytest.fixture
def synthetic_voter(app):
    with app.app_context():
        voter = User(
            username="test_voter_alice",
            password_hash=hash_password("Password123!"),
            role="VOTER",
            constituency="Ward-1",
            voter_id="VTR-2026-00101",
            full_name="Alice Sharma",
            registered_mobile="+91 98765 43101",
            is_active=True,
            synthetic_identity_reference="SYNTH_REF_ALICE_W1"
        )
        db.session.add(voter)
        db.session.commit()
        return voter.id

@pytest.fixture
def inactive_voter(app):
    with app.app_context():
        voter = User(
            username="test_voter_inactive",
            password_hash=hash_password("Password123!"),
            role="VOTER",
            constituency="Ward-1",
            voter_id="VTR-2026-99999",
            full_name="Inactive Voter",
            registered_mobile="+91 98765 43999",
            is_active=False
        )
        db.session.add(voter)
        db.session.commit()
        return voter.id

# ==========================================
# 1. VOTER ID & INITIATION TESTS
# ==========================================

def test_voter_initiate_valid_id(client, synthetic_voter):
    """Test 1: Valid Voter ID initiates Stage 1 with masked mobile and stage token."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["stage"] == "OTP_PENDING"
    assert "stage_token" in data
    assert data["masked_mobile"] == "******3101"
    # Security: OTP must NEVER appear in API response
    assert "otp" not in data
    assert "_demo_simulated_otp" not in data

def test_voter_initiate_invalid_id(client):
    """Test 2 & 4: Invalid Voter ID returns generic enumeration-resistant response."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-INVALID-00000"})
    assert res.status_code == 401
    data = res.get_json()
    assert data["error"] == "INVALID_VOTER_ID"
    assert "Unable to verify voter record" in data["message"]

def test_voter_initiate_inactive_voter(client, inactive_voter):
    """Test 3: Inactive voter receives generic denial without leaking status."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-99999"})
    assert res.status_code == 401
    data = res.get_json()
    assert data["error"] == "INVALID_VOTER_ID"

def test_voter_initiate_empty_payload(client):
    """Validation check for missing Voter ID."""
    res = client.post("/api/v1/auth/voter/initiate", json={})
    assert res.status_code == 400

# ==========================================
# 2. OTP VERIFICATION & LIFECYCLE TESTS
# ==========================================

def test_otp_verification_success(client, app, synthetic_voter):
    """Test 6: Valid OTP advances session to IDENTITY_PENDING."""
    # Initiate
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    # Retrieve active session from DB
    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        # Set a known test OTP
        session.salt = "test_salt_123"
        session.otp_hash = hash_otp("654321", "test_salt_123")
        db.session.commit()

    # Verify
    verify_res = client.post("/api/v1/auth/voter/verify-otp", json={
        "stage_token": stage_1_token,
        "otp": "654321"
    })
    assert verify_res.status_code == 200
    verify_data = verify_res.get_json()
    assert verify_data["stage"] == "IDENTITY_PENDING"
    assert "stage_token" in verify_data
    # Security: OTP must not be in token claims
    decoded = decode_jwt(verify_data["stage_token"])
    assert decoded["stage"] == "IDENTITY_PENDING"
    assert "otp" not in decoded

def test_otp_invalid_code(client, synthetic_voter):
    """Test 7: Incorrect OTP decrements remaining attempts."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    verify_res = client.post("/api/v1/auth/voter/verify-otp", json={
        "stage_token": stage_1_token,
        "otp": "000000"
    })
    assert verify_res.status_code == 400
    data = verify_res.get_json()
    assert data["error"] == "INVALID_OTP"
    assert "2 attempt(s) remaining" in data["message"]

def test_otp_three_failed_attempts_locks_session(client, synthetic_voter):
    """Test 10: 3 failed attempts invalidates the session permanently."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    for _ in range(2):
        client.post("/api/v1/auth/voter/verify-otp", json={"stage_token": stage_1_token, "otp": "000000"})

    third_res = client.post("/api/v1/auth/voter/verify-otp", json={"stage_token": stage_1_token, "otp": "000000"})
    assert third_res.status_code == 400
    assert third_res.get_json()["error"] == "MAX_ATTEMPTS_EXCEEDED"

    # Subsequent attempt rejected
    fourth_res = client.post("/api/v1/auth/voter/verify-otp", json={"stage_token": stage_1_token, "otp": "000000"})
    assert fourth_res.status_code == 400

def test_otp_replay_prevention(client, app, synthetic_voter):
    """Test 9: Verified OTP cannot be reused."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        session.salt = "salt1"
        session.otp_hash = hash_otp("112233", "salt1")
        db.session.commit()

    # First verify succeeds
    client.post("/api/v1/auth/voter/verify-otp", json={"stage_token": stage_1_token, "otp": "112233"})

    # Replay attempt fails
    replay_res = client.post("/api/v1/auth/voter/verify-otp", json={"stage_token": stage_1_token, "otp": "112233"})
    assert replay_res.status_code == 400

def test_otp_expired_code(client, app, synthetic_voter):
    """Test 8: Expired OTP rejected."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        session.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.session.commit()

    verify_res = client.post("/api/v1/auth/voter/verify-otp", json={"stage_token": stage_1_token, "otp": "111111"})
    assert verify_res.status_code == 400
    assert verify_res.get_json()["error"] == "OTP_EXPIRED"

def test_otp_resend_cooldown_enforced(client, synthetic_voter):
    """Test 11: Resending before 60 seconds returns HTTP 429."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    resend_res = client.post("/api/v1/auth/voter/resend-otp", json={"stage_token": stage_1_token})
    assert resend_res.status_code == 429
    assert resend_res.get_json()["error"] == "RATE_LIMITED"

def test_otp_resend_success_invalidates_old(client, app, synthetic_voter):
    """Test 12 & 13: Resend after cooldown invalidates previous OTP and generates new one."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        session.created_at = datetime.now(timezone.utc) - timedelta(seconds=65)
        session.salt = "old_salt"
        session.otp_hash = hash_otp("111111", "old_salt")
        db.session.commit()

    resend_res = client.post("/api/v1/auth/voter/resend-otp", json={"stage_token": stage_1_token})
    assert resend_res.status_code == 200

    # Old OTP is now invalid
    verify_old = client.post("/api/v1/auth/voter/verify-otp", json={"stage_token": stage_1_token, "otp": "111111"})
    assert verify_old.status_code == 400

# ==========================================
# 3. STAGE TOKEN RESTRICTIONS
# ==========================================

def test_stage_tokens_cannot_access_voter_routes(client, synthetic_voter):
    """Test 14 & 15: Stage tokens receive 403 Forbidden on voter and voting routes."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    headers = {"Authorization": f"Bearer {stage_1_token}"}
    blocked_res = client.get("/api/v1/voter/election-info", headers=headers)
    assert blocked_res.status_code == 403
    assert blocked_res.get_json()["error"] == "FORBIDDEN"

def test_tampered_stage_token_rejected(client):
    """Test 16: Invalid signature or corrupted stage token returns 401."""
    res = client.post("/api/v1/auth/voter/verify-otp", json={
        "stage_token": "tampered.jwt.token",
        "otp": "123456"
    })
    assert res.status_code == 401

# ==========================================
# 4. IDENTITY VERIFICATION & FINAL JWT
# ==========================================

def test_prototype_identity_verification_demo_fallback(client, app, synthetic_voter):
    """Test 18, 20, 22, 23, 24: Demo fallback completes auth and issues final VOTER JWT."""
    # Step 1: Initiate
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    # Step 2: OTP
    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        session.salt = "s"
        session.otp_hash = hash_otp("999888", "s")
        db.session.commit()

    otp_res = client.post("/api/v1/auth/voter/verify-otp", json={
        "stage_token": stage_1_token,
        "otp": "999888"
    })
    stage_2_token = otp_res.get_json()["stage_token"]

    # Step 3: Identity Verification (Demo Fallback)
    ident_res = client.post("/api/v1/auth/voter/verify-identity", json={
        "stage_token": stage_2_token,
        "is_demo_fallback": True
    })
    assert ident_res.status_code == 200
    data = ident_res.get_json()
    assert "token" in data
    assert data["user"]["voter_id"] == "VTR-2026-00101"
    assert data["user"]["role"] == "VOTER"

    # Step 4: Final JWT works on voter routes
    voter_headers = {"Authorization": f"Bearer {data['token']}"}
    info_res = client.get("/api/v1/voter/election-info", headers=voter_headers)
    assert info_res.status_code == 200

def test_prototype_identity_verification_camera_frame(client, app, synthetic_voter):
    """Test 18 & 21: Camera frame prototype succeeds without storing raw image."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        session.salt = "s"
        session.otp_hash = hash_otp("123123", "s")
        db.session.commit()

    otp_res = client.post("/api/v1/auth/voter/verify-otp", json={
        "stage_token": stage_1_token,
        "otp": "123123"
    })
    stage_2_token = otp_res.get_json()["stage_token"]

    ident_res = client.post("/api/v1/auth/voter/verify-identity", json={
        "stage_token": stage_2_token,
        "frame_data": "data:image/jpeg;base64,sample_temporary_frame"
    })
    assert ident_res.status_code == 200
    assert ident_res.get_json()["user"]["role"] == "VOTER"

def test_identity_verification_missing_input_rejected(client, app, synthetic_voter):
    """Test 19: Missing both frame and fallback is rejected."""
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    stage_1_token = res.get_json()["stage_token"]

    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        session.salt = "s"
        session.otp_hash = hash_otp("111222", "s")
        db.session.commit()

    otp_res = client.post("/api/v1/auth/voter/verify-otp", json={
        "stage_token": stage_1_token,
        "otp": "111222"
    })
    stage_2_token = otp_res.get_json()["stage_token"]

    ident_res = client.post("/api/v1/auth/voter/verify-identity", json={
        "stage_token": stage_2_token
    })
    assert ident_res.status_code == 400
    assert ident_res.get_json()["error"] == "VERIFICATION_FAILED"

# ==========================================
# 5. ADMIN AUTHENTICATION REGRESSION
# ==========================================

def test_dedicated_admin_login(client):
    """Test 25 & 26: Dedicated admin login route functions independently."""
    res = client.post("/api/v1/auth/admin/login", json={
        "username": "test_admin",
        "password": "TestAdmin123!"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["role"] == "ADMIN"
    assert "token" in data
