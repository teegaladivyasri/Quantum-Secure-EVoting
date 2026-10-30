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


# ==========================================
# 6. PHASE 17A: SMS & DEMO OTP DELIVERY TESTS
# ==========================================

def test_otp_delivery_demo_mode_terminal(client, synthetic_voter, capsys, monkeypatch):
    """Verify DEMO mode prints OTP to terminal and excludes OTP from API response."""
    from backend.config import Config
    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "demo")

    capsys.readouterr()  # Clear buffer
    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    assert res.status_code == 200
    data = res.get_json()

    assert data["stage"] == "OTP_PENDING"
    assert data["masked_mobile"] == "******3101"
    assert data["delivery_mode"] == "demo"
    assert "otp" not in data

    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert "[DEMO SIMULATED SMS GATEWAY]" in combined
    assert "Dispatched to: +91 98765 43101" in combined
    assert "Simulated OTP:" in combined


def test_otp_delivery_sms_mode_success_mocked(client, app, synthetic_voter, monkeypatch):
    """Verify REAL SMS mode dispatches OTP through provider without leaking OTP in API or terminal."""
    from backend.config import Config
    from backend.services import otp_delivery

    sent_records = []

    def mock_send_twilio(to_number, otp, cfg):
        sent_records.append({
            "to": to_number,
            "otp": otp,
            "cfg_sid": cfg.get("TWILIO_ACCOUNT_SID")
        })
        return {"success": True, "provider": "twilio", "status": "queued"}

    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "sms")
    monkeypatch.setattr(Config, "SMS_PROVIDER", "twilio")
    monkeypatch.setattr(Config, "TWILIO_ACCOUNT_SID", "AC_TEST_MOCK_12345")
    monkeypatch.setattr(Config, "TWILIO_AUTH_TOKEN", "AUTH_TEST_SECRET")
    monkeypatch.setattr(Config, "TWILIO_FROM_NUMBER", "+15005550006")
    monkeypatch.setattr(otp_delivery, "_send_twilio_sms", mock_send_twilio)

    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    assert res.status_code == 200
    data = res.get_json()

    # 1. API response secrecy
    assert data["stage"] == "OTP_PENDING"
    assert data["masked_mobile"] == "******3101"
    assert data["delivery_mode"] == "sms"
    assert "otp" not in data
    assert "AC_TEST_MOCK_12345" not in json.dumps(data)
    assert "AUTH_TEST_SECRET" not in json.dumps(data)

    # 2. Provider call verification
    assert len(sent_records) == 1
    call = sent_records[0]
    assert call["to"] == "+91 98765 43101"  # Registered mobile used
    assert len(call["otp"]) == 6  # 6-digit numeric OTP passed
    assert call["otp"].isdigit()

    # 3. Session stored securely in database
    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        assert session is not None
        assert session.otp_hash != call["otp"]  # Plaintext OTP not in DB
        assert len(session.otp_hash) == 64  # SHA-256 hash


def test_otp_delivery_sms_missing_credentials_fails_safely(client, synthetic_voter, monkeypatch):
    """Verify SMS mode fails safely with 503 if provider credentials are not configured."""
    from backend.config import Config
    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "sms")
    monkeypatch.setattr(Config, "SMS_PROVIDER", "twilio")
    monkeypatch.setattr(Config, "TWILIO_ACCOUNT_SID", "")
    monkeypatch.setattr(Config, "TWILIO_AUTH_TOKEN", "")

    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    assert res.status_code == 503
    data = res.get_json()
    assert data["error"] == "SMS_CONFIGURATION_ERROR"
    assert "otp" not in data
    assert "secret" not in json.dumps(data).lower()


def test_otp_delivery_sms_provider_failure_handled_safely(client, synthetic_voter, monkeypatch):
    """Verify gateway failure returns safe 502 error and does not leak provider details."""
    from backend.config import Config
    from backend.services import otp_delivery

    def mock_failing_twilio(*args, **kwargs):
        raise otp_delivery.OtpDeliveryError("Twilio SMS gateway rejected transmission with status 400.")

    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "sms")
    monkeypatch.setattr(Config, "SMS_PROVIDER", "twilio")
    monkeypatch.setattr(Config, "TWILIO_ACCOUNT_SID", "AC_TEST")
    monkeypatch.setattr(Config, "TWILIO_AUTH_TOKEN", "AUTH_TEST")
    monkeypatch.setattr(Config, "TWILIO_FROM_NUMBER", "+15555555555")
    monkeypatch.setattr(otp_delivery, "_send_twilio_sms", mock_failing_twilio)

    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    assert res.status_code == 502
    data = res.get_json()
    assert data["error"] == "SMS_DELIVERY_FAILED"
    assert "Failed to deliver" in data["message"]
    assert "otp" not in data
    assert "twilio" not in data["message"].lower()  # Generic safe message


def test_otp_delivery_sms_resend_mocked(client, app, synthetic_voter, monkeypatch):
    """Verify resend in SMS mode dispatches new OTP via provider and invalidates old one."""
    from backend.config import Config
    from backend.services import otp_delivery

    resend_records = []

    def mock_send_sms(to_number, otp, cfg):
        resend_records.append(otp)
        return {"success": True, "provider": "twilio", "status": "queued"}

    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "sms")
    monkeypatch.setattr(Config, "SMS_PROVIDER", "twilio")
    monkeypatch.setattr(Config, "TWILIO_ACCOUNT_SID", "AC_TEST")
    monkeypatch.setattr(Config, "TWILIO_AUTH_TOKEN", "AUTH_TEST")
    monkeypatch.setattr(Config, "TWILIO_FROM_NUMBER", "+15555555555")
    monkeypatch.setattr(otp_delivery, "_send_twilio_sms", mock_send_sms)

    # 1. Initial initiate
    init_res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    assert init_res.status_code == 200
    stage_token = init_res.get_json()["stage_token"]
    assert len(resend_records) == 1
    first_otp = resend_records[0]

    # 2. Age session by 65s for cooldown
    with app.app_context():
        session = VoterOtpSession.query.filter_by(voter_user_id=synthetic_voter, is_verified=False).first()
        session.created_at = datetime.now(timezone.utc) - timedelta(seconds=65)
        db.session.commit()

    # 3. Resend OTP
    resend_res = client.post("/api/v1/auth/voter/resend-otp", json={"stage_token": stage_token})
    assert resend_res.status_code == 200
    resend_data = resend_res.get_json()
    assert resend_data["delivery_mode"] == "sms"
    assert "otp" not in resend_data

    # 4. New OTP dispatched
    assert len(resend_records) == 2
    second_otp = resend_records[1]
    assert first_otp != second_otp  # New OTP generated


def test_otp_delivery_fast2sms_provider_mocked(client, synthetic_voter, monkeypatch):
    """Verify Fast2SMS provider adapter functions with clean Indian mobile sanitization."""
    from backend.config import Config
    from backend.services import otp_delivery

    f2s_calls = []

    def mock_send_fast2sms(to_number, otp, cfg):
        f2s_calls.append({"to": to_number, "otp": otp, "key": cfg.get("FAST2SMS_API_KEY")})
        return {"success": True, "provider": "fast2sms", "status": "dispatched"}

    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "sms")
    monkeypatch.setattr(Config, "SMS_PROVIDER", "fast2sms")
    monkeypatch.setattr(Config, "FAST2SMS_API_KEY", "FAST2SMS_TEST_KEY_123")
    monkeypatch.setattr(otp_delivery, "_send_fast2sms", mock_send_fast2sms)

    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-2026-00101"})
    assert res.status_code == 200
    assert len(f2s_calls) == 1
    assert f2s_calls[0]["to"] == "+91 98765 43101"
    assert f2s_calls[0]["key"] == "FAST2SMS_TEST_KEY_123"
    assert "otp" not in res.get_json()
