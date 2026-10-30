"""
Unit and integration tests for Fast2SMS OTP delivery adapter.
Verifies:
1. Official Fast2SMS bulkV2 OTP route payload, headers, and endpoint.
2. Indian mobile number sanitization (country code +91, leading 0, 10-digit validation).
3. Configuration validation (missing API key, missing DLT template).
4. HTTP 400 error handling, capturing, and local log sanitization.
5. Secrecy guarantees: No API keys, OTPs, or full mobile numbers leaked into logs or responses.
6. DLT and Quick SMS route handling.
7. Safe 502 responses from voter auth routes without provider leakage.
"""

import io
import json
import logging
import urllib.error
import urllib.request
import pytest
from backend.services.otp_delivery import (
    _send_fast2sms,
    _sanitize_provider_error,
    send_otp,
    OtpDeliveryError,
    OtpDeliveryConfigurationError,
)
from backend.config import Config


# ==============================================================================
# Helper Mock Class for HTTP Responses
# ==============================================================================

class DummyHTTPResponse:
    def __init__(self, status_code=200, body=b""):
        self.code = status_code
        self.status = status_code
        self.body = body

    def read(self, *args, **kwargs):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


# ==============================================================================
# 1. Official OTP Route Payload & Header Tests
# ==============================================================================

def test_fast2sms_otp_route_success(monkeypatch):
    """
    Verify that Fast2SMS uses POST to https://www.fast2sms.com/dev/bulkV2
    with official 'otp' route format: 'variables_values' for OTP and 10-digit 'numbers'.
    """
    recorded_requests = []

    def mock_urlopen(req, timeout=10.0):
        recorded_requests.append(req)
        resp_data = {
            "return": True,
            "request_id": "req_fast2sms_test_987",
            "message": ["Message sent successfully"]
        }
        return DummyHTTPResponse(200, json.dumps(resp_data).encode("utf-8"))

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)

    cfg = {
        "FAST2SMS_API_KEY": "test_api_key_valid_12345",
        "FAST2SMS_ROUTE": "otp"
    }

    res = _send_fast2sms("+91 98765 43101", "654321", cfg)

    assert res["success"] is True
    assert res["provider"] == "fast2sms"
    assert res["request_id"] == "req_fast2sms_test_987"
    assert res["status"] == "dispatched"

    # Verify HTTP request details
    assert len(recorded_requests) == 1
    req = recorded_requests[0]
    assert req.full_url == "https://www.fast2sms.com/dev/bulkV2"
    assert req.get_method() == "POST"
    assert req.headers["Authorization"] == "test_api_key_valid_12345"
    assert req.headers["Content-type"] == "application/json"
    assert req.headers["Accept"] == "application/json"

    # Verify JSON payload
    payload = json.loads(req.data.decode("utf-8"))
    assert payload["route"] == "otp"
    assert payload["variables_values"] == "654321"
    assert payload["numbers"] == "9876543101"
    # Ensure invalid fields are NOT present
    assert "message" not in payload
    assert "language" not in payload
    assert "flash" not in payload
    assert "sender_id" not in payload


# ==============================================================================
# 2. Indian Mobile Number Sanitization Tests
# ==============================================================================

@pytest.mark.parametrize("input_mobile,expected_clean", [
    ("+91 98765 43101", "9876543101"),
    ("+919876543101", "9876543101"),
    ("919876543101", "9876543101"),
    ("09876543101", "9876543101"),
    ("9876543101", "9876543101"),
    ("98765-43101", "9876543101"),
])
def test_fast2sms_mobile_sanitization(monkeypatch, input_mobile, expected_clean):
    """Verify phone numbers in Indian formats are sanitized to exact 10 digits."""
    sent_payloads = []

    def mock_urlopen(req, timeout=10.0):
        sent_payloads.append(json.loads(req.data.decode("utf-8")))
        return DummyHTTPResponse(200, b'{"return": true, "request_id": "r1"}')

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)

    cfg = {"FAST2SMS_API_KEY": "valid_key", "FAST2SMS_ROUTE": "otp"}
    _send_fast2sms(input_mobile, "123456", cfg)

    assert len(sent_payloads) == 1
    assert sent_payloads[0]["numbers"] == expected_clean


@pytest.mark.parametrize("invalid_mobile", [
    "12345",
    "abcdefghij",
    "+1 555 123 4567",
    "",
    "0091987654310123",
])
def test_fast2sms_invalid_mobile_rejected(invalid_mobile):
    """Verify non-10-digit Indian numbers raise clean OtpDeliveryError."""
    cfg = {"FAST2SMS_API_KEY": "valid_key", "FAST2SMS_ROUTE": "otp"}
    with pytest.raises(OtpDeliveryError) as exc_info:
        _send_fast2sms(invalid_mobile, "123456", cfg)
    assert "10 digits required" in str(exc_info.value)


# ==============================================================================
# 3. Missing Configuration Tests
# ==============================================================================

def test_fast2sms_missing_api_key_raises_config_error():
    """Verify missing API key raises OtpDeliveryConfigurationError."""
    cfg = {"FAST2SMS_API_KEY": ""}
    with pytest.raises(OtpDeliveryConfigurationError) as exc_info:
        _send_fast2sms("9876543101", "123456", cfg)
    assert "FAST2SMS_API_KEY is required" in str(exc_info.value)


def test_fast2sms_unsupported_route_raises_config_error():
    """Verify unsupported route name raises OtpDeliveryConfigurationError."""
    cfg = {"FAST2SMS_API_KEY": "key123", "FAST2SMS_ROUTE": "bogus_route"}
    with pytest.raises(OtpDeliveryConfigurationError) as exc_info:
        _send_fast2sms("9876543101", "123456", cfg)
    assert "Unsupported Fast2SMS route" in str(exc_info.value)


# ==============================================================================
# 4. HTTP 400 Error Handling & Sanitization Tests
# ==============================================================================

def test_fast2sms_http_400_captured_and_sanitized(monkeypatch, caplog):
    """
    Verify that HTTP 400 from Fast2SMS is safely captured,
    diagnostic status/message logged, and generic OtpDeliveryError raised.
    """
    err_body = json.dumps({
        "return": False,
        "status_code": 996,
        "message": ["Before using OTP SMS API, complete KYC"]
    }).encode("utf-8")

    def mock_urlopen_fail(req, timeout=10.0):
        fp = io.BytesIO(err_body)
        raise urllib.error.HTTPError(
            url="https://www.fast2sms.com/dev/bulkV2",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=fp
        )

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_fail)

    cfg = {"FAST2SMS_API_KEY": "test_api_key_secret_999", "FAST2SMS_ROUTE": "otp"}

    with caplog.at_level(logging.ERROR):
        with pytest.raises(OtpDeliveryError) as exc_info:
            _send_fast2sms("9876543101", "654321", cfg)

    assert "Fast2SMS gateway rejected transmission with status 400" in str(exc_info.value)
    # Check log contains sanitized diagnostic
    assert "provider_code=996" in caplog.text
    assert "Before using OTP SMS API, complete KYC" in caplog.text
    # Check log does NOT contain the secret API key or unmasked mobile
    assert "test_api_key_secret_999" not in caplog.text


def test_fast2sms_error_sanitization_masks_secrets_and_pii(caplog):
    """
    Verify that _sanitize_provider_error redacts API keys, plaintext OTPs,
    and mobile numbers even if the provider echos them back in the error body.
    """
    raw_leak_response = (
        '{"return": false, "status_code": 401, '
        '"message": "Failed for key my_secret_fast2sms_key_8888 '
        'and mobile 9876543101 with otp code 817263"}'
    )

    sanitized = _sanitize_provider_error(
        raw_leak_response,
        secret_key="my_secret_fast2sms_key_8888",
        otp="817263"
    )

    # API key must be redacted
    assert "my_secret_fast2sms_key_8888" not in sanitized
    assert "[REDACTED_API_KEY]" in sanitized

    # OTP must be redacted
    assert "817263" not in sanitized
    assert "[REDACTED_OTP]" in sanitized

    # Mobile number must be masked
    assert "9876543101" not in sanitized
    assert "******3101" in sanitized


def test_fast2sms_gateway_rejection_on_http_200(monkeypatch, caplog):
    """
    Verify that if Fast2SMS returns HTTP 200 with 'return: false' (e.g. low balance),
    OtpDeliveryError is raised and the reason is safely logged.
    """
    resp_body = json.dumps({
        "return": False,
        "status_code": 416,
        "message": "You don't have sufficient wallet balance"
    }).encode("utf-8")

    def mock_urlopen(req, timeout=10.0):
        return DummyHTTPResponse(200, resp_body)

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)

    cfg = {"FAST2SMS_API_KEY": "valid_key", "FAST2SMS_ROUTE": "otp"}

    with caplog.at_level(logging.ERROR):
        with pytest.raises(OtpDeliveryError) as exc_info:
            _send_fast2sms("9876543101", "123456", cfg)

    assert "Fast2SMS gateway rejected message transmission" in str(exc_info.value)
    assert "provider_code=416" in caplog.text
    assert "sufficient wallet balance" in caplog.text.lower()


# ==============================================================================
# 5. DLT and Quick SMS Route Tests
# ==============================================================================

def test_fast2sms_dlt_route_payload(monkeypatch):
    """Verify DLT route builds proper payload with sender_id, template message ID, and variables."""
    recorded_reqs = []

    def mock_urlopen(req, timeout=10.0):
        recorded_reqs.append(req)
        return DummyHTTPResponse(200, b'{"return": true, "request_id": "dlt_req_1"}')

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)

    cfg = {
        "FAST2SMS_API_KEY": "key123",
        "FAST2SMS_ROUTE": "dlt",
        "FAST2SMS_SENDER_ID": "QEVOTE",
        "FAST2SMS_TEMPLATE_ID": "110716155555555"
    }

    res = _send_fast2sms("9876543101", "654321", cfg)
    assert res["success"] is True

    payload = json.loads(recorded_reqs[0].data.decode("utf-8"))
    assert payload["route"] == "dlt"
    assert payload["sender_id"] == "QEVOTE"
    assert payload["message"] == "110716155555555"
    assert payload["variables_values"] == "654321"
    assert payload["numbers"] == "9876543101"


def test_fast2sms_dlt_missing_template_raises_config_error():
    """Verify DLT route requires both sender_id and template_id."""
    cfg = {
        "FAST2SMS_API_KEY": "key123",
        "FAST2SMS_ROUTE": "dlt",
        "FAST2SMS_SENDER_ID": "QEVOTE",
        "FAST2SMS_TEMPLATE_ID": ""
    }
    with pytest.raises(OtpDeliveryConfigurationError) as exc_info:
        _send_fast2sms("9876543101", "654321", cfg)
    assert "FAST2SMS_SENDER_ID and FAST2SMS_TEMPLATE_ID" in str(exc_info.value)


def test_fast2sms_quick_sms_route_payload(monkeypatch):
    """Verify Quick SMS route builds payload with message and numbers without unsupported fields."""
    recorded_reqs = []

    def mock_urlopen(req, timeout=10.0):
        recorded_reqs.append(req)
        return DummyHTTPResponse(200, b'{"return": true, "request_id": "q_req_1"}')

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)

    cfg = {
        "FAST2SMS_API_KEY": "key123",
        "FAST2SMS_ROUTE": "q"
    }

    res = _send_fast2sms("9876543101", "654321", cfg)
    assert res["success"] is True

    payload = json.loads(recorded_reqs[0].data.decode("utf-8"))
    assert payload["route"] == "q"
    assert "654321" in payload["message"]
    assert payload["numbers"] == "9876543101"
    assert "language" not in payload
    assert "flash" not in payload
    assert "sender_id" not in payload


# ==============================================================================
# 6. Full Dispatcher & API Integration Tests
# ==============================================================================

def test_send_otp_dispatcher_with_fast2sms_success(monkeypatch):
    """Verify send_otp() correctly delegates to Fast2SMS when configured."""
    def mock_send(to, otp, cfg):
        return {"success": True, "provider": "fast2sms", "request_id": "r1", "status": "dispatched"}

    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "sms")
    monkeypatch.setattr(Config, "SMS_PROVIDER", "fast2sms")
    monkeypatch.setattr(Config, "FAST2SMS_API_KEY", "test_key")

    from backend.services import otp_delivery
    monkeypatch.setattr(otp_delivery, "_send_fast2sms", mock_send)

    res = send_otp("+91 98765 43101", "******3101", "654321")
    assert res["success"] is True
    assert res["mode"] == "sms"
    assert res["provider"] == "fast2sms"


def test_voter_initiate_endpoint_fast2sms_failure_safe_502(client, app, monkeypatch):
    """
    Verify that voter initiation endpoint returns safe HTTP 502
    when Fast2SMS rejects transmission with HTTP 400,
    and returns generic error message without leaking provider internals.
    """
    from backend.models.user import User
    from backend.extensions import db
    from backend.services.auth_service import hash_password

    with app.app_context():
        user = User.query.filter_by(voter_id="VTR-F2S-TEST").first()
        if not user:
            user = User(
                username="voter_f2s_test",
                password_hash=hash_password("Password123!"),
                role="VOTER",
                constituency="Ward-1",
                voter_id="VTR-F2S-TEST",
                full_name="Fast2SMS Test Voter",
                registered_mobile="+91 98765 43101",
                is_active=True
            )
            db.session.add(user)
            db.session.commit()

    def mock_failing_fast2sms(*args, **kwargs):
        raise OtpDeliveryError("Fast2SMS gateway rejected transmission with status 400.")

    from backend.services import otp_delivery
    monkeypatch.setattr(Config, "OTP_DELIVERY_MODE", "sms")
    monkeypatch.setattr(Config, "SMS_PROVIDER", "fast2sms")
    monkeypatch.setattr(Config, "FAST2SMS_API_KEY", "test_key")
    monkeypatch.setattr(otp_delivery, "_send_fast2sms", mock_failing_fast2sms)

    res = client.post("/api/v1/auth/voter/initiate", json={"voter_id": "VTR-F2S-TEST"})
    assert res.status_code == 502
    data = res.get_json()
    assert data["error"] == "SMS_DELIVERY_FAILED"
    assert "Failed to deliver" in data["message"]
    # Verify NO secrets, NO OTP, and NO provider names leaked
    assert "otp" not in data
    assert "fast2sms" not in data["message"].lower()
    assert "400" not in data["message"]
