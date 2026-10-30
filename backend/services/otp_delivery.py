"""
OTP Delivery Service (Phase 17A)

Provides a clean provider abstraction for voter OTP dispatch:
- DEMO MODE (default): Delivers simulated OTP to terminal with academic demonstration banner.
- REAL SMS MODE: Dispatches OTP via configured SMS provider (Twilio, Fast2SMS, or Generic HTTP Webhook).

Security & Privacy Guarantees:
1. No plaintext OTP is logged in SMS mode.
2. Provider credentials are never exposed in error responses or logs.
3. If SMS dispatch fails, an OtpDeliveryError is raised to prevent invalid session progression.
4. If SMS mode is requested without required provider credentials, an OtpDeliveryConfigurationError is raised.
"""

import sys
import re
import json
import logging
import base64
import urllib.request
import urllib.parse
import urllib.error
from flask import current_app
from backend.config import Config

logger = logging.getLogger(__name__)

class OtpDeliveryError(Exception):
    """Raised when an error occurs during OTP transmission."""
    pass

class OtpDeliveryConfigurationError(OtpDeliveryError):
    """Raised when the requested SMS provider is not configured properly."""
    pass


def _deliver_demo_terminal(mobile: str | None, masked_mobile: str, otp: str, is_resend: bool = False) -> None:
    """
    Delivers the simulated OTP to the development terminal for academic demonstration.
    Flushes console output via sys.stdout and sys.stderr, and logs through current_app.logger.
    """
    tag = "[DEMO SIMULATED SMS GATEWAY - RESEND]" if is_resend else "[DEMO SIMULATED SMS GATEWAY]"
    display_mobile = mobile or "Unknown"
    msg = (
        f"\n==================================================\n"
        f"{tag}\n"
        f"Dispatched to: {display_mobile} (Masked: {masked_mobile})\n"
        f"Simulated OTP: {otp}\n"
        f"Valid for: 5 minutes\n"
        f"Academic simulation only -- no real SMS sent.\n"
        f"==================================================\n"
    )

    try:
        print(msg, flush=True)
    except Exception:
        pass

    try:
        sys.stdout.write(msg)
        sys.stdout.flush()
    except Exception:
        pass

    try:
        sys.stderr.write(msg)
        sys.stderr.flush()
    except Exception:
        pass

    try:
        if current_app:
            current_app.logger.warning(
                f"{tag} Dispatched to {display_mobile} (Masked: {masked_mobile}) - Simulated OTP: {otp}"
            )
    except Exception:
        pass


def _send_twilio_sms(to_number: str, otp: str, cfg: dict) -> dict:
    """
    Dispatches SMS using Twilio Messages REST API via standard library urllib.
    """
    account_sid = cfg.get("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = cfg.get("TWILIO_AUTH_TOKEN", "").strip()
    from_number = cfg.get("TWILIO_FROM_NUMBER", "").strip()
    messaging_service_sid = cfg.get("TWILIO_MESSAGING_SERVICE_SID", "").strip()

    if not account_sid or not auth_token or (not from_number and not messaging_service_sid):
        raise OtpDeliveryConfigurationError(
            "Twilio configuration is incomplete. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required."
        )

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    body_text = f"Your Quantum-Secure E-Voting verification code is: {otp}. Valid for 5 minutes. Do not share this code."

    data_payload = {
        "To": to_number,
        "Body": body_text
    }
    if messaging_service_sid:
        data_payload["MessagingServiceSid"] = messaging_service_sid
    else:
        data_payload["From"] = from_number

    encoded_data = urllib.parse.urlencode(data_payload).encode("utf-8")

    auth_string = f"{account_sid}:{auth_token}"
    auth_b64 = base64.b64encode(auth_string.encode("utf-8")).decode("utf-8")

    req = urllib.request.Request(
        url,
        data=encoded_data,
        headers={
            "Authorization": f"Basic {auth_b64}",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            resp_body = resp.read().decode("utf-8")
            resp_data = json.loads(resp_body) if resp_body else {}
            # Do NOT log the OTP or credentials
            logger.info(f"SMS dispatched successfully via Twilio (Status: {resp_data.get('status')})")
            return {
                "success": True,
                "provider": "twilio",
                "message_sid": resp_data.get("sid", "unknown"),
                "status": resp_data.get("status", "queued")
            }
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Twilio SMS delivery failed with HTTP {e.code}")
        raise OtpDeliveryError(f"Twilio SMS gateway rejected transmission with status {e.code}.")
    except Exception as e:
        logger.error(f"Network error during Twilio SMS dispatch: {type(e).__name__}")
        raise OtpDeliveryError("Network connection to SMS gateway failed.")


def _sanitize_provider_error(raw_text: str, secret_key: str | None = None, otp: str | None = None) -> str:
    """
    Safely captures and sanitizes provider error responses for local debugging.
    Guarantees:
    - Never logs API keys or authorization headers.
    - Never logs plaintext OTPs.
    - Never logs unmasked phone numbers.
    - Extracts structured provider status_code and message if JSON.
    - Truncates oversized responses.
    """
    if not raw_text:
        return "empty response"

    cleaned = raw_text

    # Redact secret key if present
    if secret_key and len(secret_key) >= 6:
        cleaned = cleaned.replace(secret_key, "[REDACTED_API_KEY]")

    # Redact OTP if present
    if otp and len(otp) >= 4:
        cleaned = cleaned.replace(otp, "[REDACTED_OTP]")

    # Mask Indian mobile numbers (10 digits starting with 6-9, optionally prefixed with 91 or 0)
    cleaned = re.sub(r'(?:\+?91|0)?([6-9]\d{5})(\d{4})\b', r'******\2', cleaned)

    # Redact Authorization header values
    cleaned = re.sub(r'(?i)(bearer\s+[a-zA-Z0-9_\-\.]+)', 'Bearer [REDACTED]', cleaned)
    cleaned = re.sub(r'(?i)(authorization["\']?\s*:\s*["\']?)[a-zA-Z0-9_\-\.]+', r'\1[REDACTED]', cleaned)

    # Try parsing as JSON to extract clean diagnostic info
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            status_code = data.get("status_code")
            msg = data.get("message")
            if isinstance(msg, list):
                msg = ", ".join(str(m) for m in msg)
            parts = []
            if status_code is not None:
                parts.append(f"provider_code={status_code}")
            if msg:
                parts.append(f"message='{msg}'")
            if parts:
                return ", ".join(parts)
    except Exception:
        pass

    # Strip HTML tags if HTML was returned
    cleaned = re.sub(r'<[^>]+>', ' ', cleaned)
    cleaned = " ".join(cleaned.split())
    if len(cleaned) > 200:
        cleaned = cleaned[:200] + "... [truncated]"

    return cleaned


def _send_fast2sms(to_number: str, otp: str, cfg: dict) -> dict:
    """
    Dispatches SMS using Fast2SMS REST API (India gateway).
    Supports:
    - 'otp' route (default): Dedicated TRAI-approved OTP delivery route on /dev/bulkV2.
      Requires numeric OTP in 'variables_values' and 10-digit Indian mobile in 'numbers'.
    - 'dlt' route: Enterprise DLT template route requiring approved sender_id and message template ID.
    - 'q' route: Quick SMS route for testing/development notifications.
    """
    api_key = cfg.get("FAST2SMS_API_KEY", "").strip()
    route = cfg.get("FAST2SMS_ROUTE", "otp").strip().lower()
    sender_id = cfg.get("FAST2SMS_SENDER_ID", "").strip()
    template_id = cfg.get("FAST2SMS_TEMPLATE_ID", "").strip() or cfg.get("FAST2SMS_MESSAGE_ID", "").strip()

    if not api_key:
        raise OtpDeliveryConfigurationError(
            "Fast2SMS configuration is incomplete. FAST2SMS_API_KEY is required."
        )

    # Sanitize mobile number: Fast2SMS expects 10 digits for Indian numbers
    clean_mobile = "".join(filter(str.isdigit, to_number))
    if clean_mobile.startswith("91") and len(clean_mobile) == 12:
        clean_mobile = clean_mobile[2:]
    elif clean_mobile.startswith("0") and len(clean_mobile) == 11:
        clean_mobile = clean_mobile[1:]

    if len(clean_mobile) != 10:
        raise OtpDeliveryError(
            "Invalid mobile number format for Fast2SMS. Exactly 10 digits required for Indian mobile numbers."
        )

    url = "https://www.fast2sms.com/dev/bulkV2"

    if route == "otp":
        # Official Fast2SMS OTP route (POST /dev/bulkV2):
        # Requires 'route': 'otp', 'variables_values': numeric OTP string, 'numbers': 10-digit mobile.
        # Fixed template delivers: "Your OTP: {variables_values}".
        # Must NOT include 'message', 'language', 'flash', or 'sender_id'.
        payload = {
            "route": "otp",
            "variables_values": str(otp).strip(),
            "numbers": clean_mobile
        }
    elif route == "dlt":
        # Enterprise DLT route with pre-approved template and sender header
        if not sender_id or not template_id:
            raise OtpDeliveryConfigurationError(
                "Fast2SMS DLT route requires FAST2SMS_SENDER_ID and FAST2SMS_TEMPLATE_ID."
            )
        payload = {
            "route": "dlt",
            "sender_id": sender_id,
            "message": template_id,
            "variables_values": str(otp).strip(),
            "numbers": clean_mobile
        }
    elif route == "q":
        # Quick SMS route (testing/alerts)
        body_text = f"Your Quantum-Secure E-Voting verification code is: {otp}. Valid for 5 minutes. Do not share this code."
        payload = {
            "route": "q",
            "message": body_text,
            "numbers": clean_mobile
        }
    else:
        raise OtpDeliveryConfigurationError(
            f"Unsupported Fast2SMS route '{route}'. Supported: 'otp', 'dlt', 'q'."
        )

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "authorization": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            resp_body = resp.read().decode("utf-8", errors="replace")
            resp_data = json.loads(resp_body) if resp_body else {}
            if resp_data.get("return") is True:
                logger.info("SMS dispatched successfully via Fast2SMS")
                return {
                    "success": True,
                    "provider": "fast2sms",
                    "request_id": resp_data.get("request_id", "unknown"),
                    "status": "dispatched"
                }
            else:
                sanitized_detail = _sanitize_provider_error(resp_body, secret_key=api_key, otp=otp)
                logger.error(f"Fast2SMS dispatch rejected: {sanitized_detail}")
                raise OtpDeliveryError("Fast2SMS gateway rejected message transmission.")
    except urllib.error.HTTPError as e:
        try:
            raw_err_body = e.read().decode("utf-8", errors="replace")
        except Exception:
            raw_err_body = ""
        sanitized_detail = _sanitize_provider_error(raw_err_body, secret_key=api_key, otp=otp)
        logger.error(f"Fast2SMS dispatch failed with HTTP {e.code}: {sanitized_detail}")
        raise OtpDeliveryError(f"Fast2SMS gateway rejected transmission with status {e.code}.")
    except Exception as e:
        if isinstance(e, OtpDeliveryError):
            raise
        logger.error(f"Network error during Fast2SMS dispatch: {type(e).__name__}")
        raise OtpDeliveryError("Network connection to SMS gateway failed.")


def _send_generic_http_sms(to_number: str, otp: str, cfg: dict) -> dict:
    """
    Dispatches SMS to an institutional or generic HTTP SMS Gateway webhook.
    """
    gateway_url = cfg.get("SMS_GATEWAY_URL", "").strip()
    api_key = cfg.get("SMS_GATEWAY_API_KEY", "").strip()

    if not gateway_url:
        raise OtpDeliveryConfigurationError(
            "Generic SMS Gateway configuration is incomplete. SMS_GATEWAY_URL is required."
        )

    payload = {
        "to": to_number,
        "message": f"Your Quantum-Secure E-Voting verification code is: {otp}. Valid for 5 minutes.",
        "otp": otp
    }

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(
        gateway_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            logger.info("SMS dispatched successfully via generic HTTP gateway")
            return {
                "success": True,
                "provider": "generic_http",
                "status": "dispatched"
            }
    except Exception as e:
        logger.error(f"Generic HTTP SMS dispatch failed: {type(e).__name__}")
        raise OtpDeliveryError("Generic SMS gateway communication failed.")


def _normalize_e164(to_number: str) -> str:
    """
    Normalizes a phone number to standard E.164 format (+<country_code><number>).
    Handles:
    - '+91 98765 43101' -> '+919876543101'
    - '9876543101' (10-digit Indian number) -> '+919876543101'
    - '09876543101' (11-digit leading 0) -> '+919876543101'
    - '919876543101' (12-digit leading 91) -> '+919876543101'
    """
    if not to_number:
        raise OtpDeliveryError("Recipient phone number is required.")

    cleaned = re.sub(r"[^\d+]", "", to_number.strip())

    if cleaned.startswith("+"):
        digits = cleaned[1:]
    else:
        digits = cleaned

    if not digits.isdigit():
        raise OtpDeliveryError(f"Invalid phone number '{to_number}'. Must contain valid digits.")

    # Auto-prefix Indian country code (+91) for 10-digit numbers
    if len(digits) == 10 and digits[0] in "6789":
        return f"+91{digits}"
    elif len(digits) == 11 and digits.startswith("0") and digits[1] in "6789":
        return f"+91{digits[1:]}"
    elif len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    elif 10 <= len(digits) <= 15:
        return f"+{digits}"

    raise OtpDeliveryError(f"Invalid phone number format: '{to_number}'. E.164 format with 10-15 digits required.")


def _send_textbee_sms(to_number: str, otp: str, cfg: dict) -> dict:
    """
    Dispatches SMS using TextBee REST API gateway (https://textbee.dev).
    Sends SMS through user's paired Android device.
    """
    api_key = cfg.get("TEXTBEE_API_KEY", "").strip()
    device_id = cfg.get("TEXTBEE_DEVICE_ID", "").strip()
    api_url = cfg.get("TEXTBEE_API_URL", "").strip() or "https://api.textbee.dev/api/v1/gateway/send-sms"

    if not api_key:
        raise OtpDeliveryConfigurationError(
            "TextBee configuration is incomplete. TEXTBEE_API_KEY is required."
        )

    clean_mobile = _normalize_e164(to_number)
    body_text = f"Quantum Secure login code: {otp}"

    payload = {
        "recipients": [clean_mobile],
        "message": body_text
    }
    if device_id:
        payload["deviceId"] = device_id

    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            resp_body = resp.read().decode("utf-8", errors="replace")
            resp_data = json.loads(resp_body) if resp_body else {}
            logger.info("SMS dispatched successfully via TextBee gateway")
            batch_id = resp_data.get("data", {}).get("smsBatchId", resp_data.get("smsBatchId", "dispatched"))
            return {
                "success": True,
                "provider": "textbee",
                "batch_id": batch_id,
                "status": "dispatched"
            }
    except urllib.error.HTTPError as e:
        try:
            raw_err_body = e.read().decode("utf-8", errors="replace")
        except Exception:
            raw_err_body = ""
        sanitized_detail = _sanitize_provider_error(raw_err_body, secret_key=api_key, otp=otp)
        logger.error(f"TextBee dispatch failed with HTTP {e.code}: {sanitized_detail}")
        raise OtpDeliveryError(f"TextBee gateway rejected transmission with status {e.code}.")
    except Exception as e:
        if isinstance(e, OtpDeliveryError):
            raise
        logger.error(f"Network error during TextBee dispatch: {type(e).__name__}")
        raise OtpDeliveryError("Network connection to TextBee gateway failed.")


def send_otp(mobile_number: str | None, masked_mobile: str, otp: str, is_resend: bool = False) -> dict:
    """
    Main OTP delivery dispatcher.
    Directs delivery according to OTP_DELIVERY_MODE ('demo' or 'sms').

    :param mobile_number: Voter's registered phone number from authoritative database record.
    :param masked_mobile: Privacy-masked phone number (e.g. '******3101').
    :param otp: Cryptographically generated 6-digit OTP string.
    :param is_resend: True if this is a resend request.
    :return: dict with delivery metadata (mode, status).
    :raises OtpDeliveryError: If SMS delivery fails.
    :raises OtpDeliveryConfigurationError: If SMS mode is enabled without valid provider credentials.
    """
    # Read active mode from Flask current_app config or default Config
    delivery_mode = "demo"
    if current_app:
        delivery_mode = current_app.config.get("OTP_DELIVERY_MODE", Config.OTP_DELIVERY_MODE)
    else:
        delivery_mode = Config.OTP_DELIVERY_MODE

    delivery_mode = str(delivery_mode).strip().lower()

    if delivery_mode == "demo":
        _deliver_demo_terminal(mobile_number, masked_mobile, otp, is_resend=is_resend)
        return {
            "success": True,
            "mode": "demo",
            "status": "DELIVERED_TO_TERMINAL"
        }

    if delivery_mode == "sms":
        if not mobile_number:
            raise OtpDeliveryError("No registered mobile number associated with this voter record.")

        # Determine configured SMS provider
        provider = "twilio"
        if current_app:
            provider = current_app.config.get("SMS_PROVIDER", Config.SMS_PROVIDER)
        else:
            provider = Config.SMS_PROVIDER

        provider = str(provider).strip().lower()

        # Build config dictionary safely from current_app or Config
        cfg = {}
        for key in [
            "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "TWILIO_MESSAGING_SERVICE_SID",
            "FAST2SMS_API_KEY", "FAST2SMS_ROUTE", "FAST2SMS_SENDER_ID", "FAST2SMS_TEMPLATE_ID", "FAST2SMS_MESSAGE_ID",
            "SMS_GATEWAY_URL", "SMS_GATEWAY_API_KEY",
            "TEXTBEE_API_KEY", "TEXTBEE_DEVICE_ID", "TEXTBEE_API_URL"
        ]:
            if current_app:
                cfg[key] = current_app.config.get(key, getattr(Config, key, ""))
            else:
                cfg[key] = getattr(Config, key, "")

        if provider == "twilio":
            res = _send_twilio_sms(mobile_number, otp, cfg)
        elif provider == "fast2sms":
            res = _send_fast2sms(mobile_number, otp, cfg)
        elif provider == "textbee":
            res = _send_textbee_sms(mobile_number, otp, cfg)
        elif provider in ["generic", "generic_http", "http"]:
            res = _send_generic_http_sms(mobile_number, otp, cfg)
        else:
            raise OtpDeliveryConfigurationError(f"Unsupported SMS provider '{provider}'. Supported: twilio, fast2sms, textbee, generic.")

        return {
            "success": True,
            "mode": "sms",
            "provider": provider,
            "status": "DISPATCHED"
        }

    raise OtpDeliveryConfigurationError(f"Invalid OTP_DELIVERY_MODE '{delivery_mode}'. Expected 'demo' or 'sms'.")
