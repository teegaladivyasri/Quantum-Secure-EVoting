"""
Unit and integration tests for TextBee SMS Gateway adapter.
Verifies:
1. International E.164 phone number normalization (Indian mobile, prefixes, spaces).
2. Official TextBee send-sms POST request structure, payload, headers, and deviceId.
3. Configuration validation (missing TEXTBEE_API_KEY).
4. Error handling and redaction (API key and OTP never leaked into logs/exceptions).
5. Provider routing through send_otp().
"""

import io
import json
import urllib.error
import urllib.request
import pytest
from backend.services.otp_delivery import (
    _send_textbee_sms,
    _normalize_e164,
    send_otp,
    OtpDeliveryError,
    OtpDeliveryConfigurationError,
)
from backend.config import Config


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
# 1. E.164 Number Normalization Tests
# ==============================================================================

def test_normalize_e164_valid_numbers():
    assert _normalize_e164("+91 98765 43101") == "+919876543101"
    assert _normalize_e164("9876543101") == "+919876543101"
    assert _normalize_e164("09876543101") == "+919876543101"
    assert _normalize_e164("919876543101") == "+919876543101"
    assert _normalize_e164("+1 (201) 555-0123") == "+12015550123"
    assert _normalize_e164("+44 7911 123456") == "+447911123456"


def test_normalize_e164_invalid_numbers():
    with pytest.raises(OtpDeliveryError):
        _normalize_e164("")
    with pytest.raises(OtpDeliveryError):
        _normalize_e164("abcde")
    with pytest.raises(OtpDeliveryError):
        _normalize_e164("123")


# ==============================================================================
# 2. TextBee Dispatch Success Tests
# ==============================================================================

def test_textbee_dispatch_success(monkeypatch):
    recorded_requests = []

    def mock_urlopen(req, timeout=10.0):
        recorded_requests.append(req)
        resp_data = {
            "success": True,
            "data": {
                "smsBatchId": "batch_tb_987654"
            }
        }
        return DummyHTTPResponse(200, json.dumps(resp_data).encode("utf-8"))

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)

    cfg = {
        "TEXTBEE_API_KEY": "txb_test_secret_key_12345",
        "TEXTBEE_DEVICE_ID": "6ae4628e59a24e053f51f8fa",
        "TEXTBEE_API_URL": "https://api.textbee.dev/api/v1/gateway/send-sms"
    }

    res = _send_textbee_sms("+91 98765 43101", "789012", cfg)

    assert res["success"] is True
    assert res["provider"] == "textbee"
    assert res["batch_id"] == "batch_tb_987654"

    # Verify request details
    assert len(recorded_requests) == 1
    req = recorded_requests[0]
    assert req.full_url == "https://api.textbee.dev/api/v1/gateway/send-sms"
    assert req.get_header("X-api-key") == "txb_test_secret_key_12345"
    assert "User-agent" in req.headers or "User-Agent" in req.headers

    body = json.loads(req.data.decode("utf-8"))
    assert body["recipients"] == ["+919876543101"]
    assert "789012" in body["message"]
    assert body["deviceId"] == "6ae4628e59a24e053f51f8fa"


# ==============================================================================
# 3. Missing Configuration Tests
# ==============================================================================

def test_textbee_missing_api_key():
    with pytest.raises(OtpDeliveryConfigurationError) as exc_info:
        _send_textbee_sms("+91 98765 43101", "123456", {"TEXTBEE_API_KEY": ""})
    assert "TEXTBEE_API_KEY is required" in str(exc_info.value)


# ==============================================================================
# 4. Error Sanitization & Secrecy Tests
# ==============================================================================

def test_textbee_http_error_redaction(monkeypatch):
    def mock_urlopen_error(req, timeout=10.0):
        fp = io.BytesIO(b'{"status_code": 401, "message": "Invalid API key txb_secret_key_val"}')
        raise urllib.error.HTTPError(
            url="https://api.textbee.dev/api/v1/gateway/send-sms",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=fp
        )

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_error)

    cfg = {
        "TEXTBEE_API_KEY": "txb_secret_key_val",
        "TEXTBEE_API_URL": "https://api.textbee.dev/api/v1/gateway/send-sms"
    }

    with pytest.raises(OtpDeliveryError) as exc_info:
        _send_textbee_sms("+91 98765 43101", "654321", cfg)

    # Asserts that sensitive secret key and raw OTP are never in the exception
    assert "txb_secret_key_val" not in str(exc_info.value)
    assert "654321" not in str(exc_info.value)


# ==============================================================================
# 5. Full Provider Router Test
# ==============================================================================

def test_send_otp_routes_to_textbee(monkeypatch, app):
    dispatched = []

    def mock_textbee_sms(to_num, otp, cfg):
        dispatched.append({"to": to_num, "otp": otp})
        return {"success": True, "provider": "textbee", "batch_id": "batch_mock_1", "status": "dispatched"}

    monkeypatch.setattr("backend.services.otp_delivery._send_textbee_sms", mock_textbee_sms)

    with app.app_context():
        app.config["OTP_DELIVERY_MODE"] = "sms"
        app.config["SMS_PROVIDER"] = "textbee"
        app.config["TEXTBEE_API_KEY"] = "txb_test_123"

        res = send_otp("+91 98765 43101", "******3101", "888999")
        assert res["success"] is True
        assert res["provider"] == "textbee"
        assert len(dispatched) == 1
        assert dispatched[0]["otp"] == "888999"

