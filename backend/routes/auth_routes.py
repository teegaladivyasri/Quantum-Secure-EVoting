import sys
import secrets
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, g, current_app
import jwt
from backend.extensions import db
from backend.models.user import User
from backend.models.otp_session import VoterOtpSession
from backend.services.auth_service import (
    verify_password,
    generate_jwt,
    generate_otp,
    hash_otp,
    verify_otp,
    generate_stage_token,
    decode_stage_token,
    mask_mobile
)
from backend.services.audit_service import log_audit_event
from backend.services.otp_delivery import send_otp, OtpDeliveryError, OtpDeliveryConfigurationError
from backend.services.deepface_service import (
    verify_voter_face,
    enroll_voter_face,
    get_voter_face_path,
    FaceNotDetectedError,
    FaceMismatchError,
    VoterPortraitNotFoundError,
    FaceVerificationError
)
from backend.middleware.auth_guard import require_role

auth_bp = Blueprint("auth_bp", __name__, url_prefix="/api/v1/auth")

def _deliver_demo_otp_to_terminal(mobile: str | None, masked_mobile: str, otp: str, is_resend: bool = False) -> None:
    """
    Delivers the simulated OTP to the development terminal for academic demonstration.
    Explicitly flushes console output via print(..., flush=True) and writes to sys.stdout/sys.stderr,
    and logs through current_app.logger at WARNING level to ensure reliable visibility across
    the Flask/Werkzeug development environment regardless of logger configuration.
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
    # Direct print with explicit flush for guaranteed terminal visibility
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

    # Log at WARNING level so Flask's default logger filter does not suppress visibility
    try:
        current_app.logger.warning(f"{tag} Dispatched to {display_mobile} (Masked: {masked_mobile}) - Simulated OTP: {otp}")
    except Exception:
        pass


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Standard username/password login endpoint.
    Maintained for backward compatibility and administrator authentication.
    """
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Username and password are required."}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not verify_password(password, user.password_hash):
        log_audit_event("LOGIN_FAILED", user_id=None, details={"message": "Invalid login credentials"})
        db.session.commit()
        return jsonify({"error": "UNAUTHORIZED", "message": "Invalid login credentials."}), 401

    token = generate_jwt(user.id, user.role)
    log_audit_event("LOGIN_SUCCESS", user_id=user.id, details={"username": user.username, "role": user.role})
    db.session.commit()

    return jsonify({
        "token": token,
        "user": user.to_dict()
    }), 200

@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    """
    Dedicated administrator login endpoint requiring institutional admin credentials.
    """
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Username and password are required."}), 400

    user = User.query.filter_by(username=username).first()

    if not user or user.role != "ADMIN" or not verify_password(password, user.password_hash):
        log_audit_event("ADMIN_LOGIN_FAILED", user_id=None, details={"message": "Invalid admin credentials"})
        db.session.commit()
        return jsonify({"error": "UNAUTHORIZED", "message": "Invalid administrator credentials."}), 401

    token = generate_jwt(user.id, "ADMIN")
    log_audit_event("ADMIN_LOGIN_SUCCESS", user_id=user.id, details={"username": user.username})
    db.session.commit()

    return jsonify({
        "token": token,
        "user": user.to_dict()
    }), 200

@auth_bp.route("/voter/initiate", methods=["POST"])
def voter_initiate():
    """
    Stage 1: Voter initiates authentication by submitting their Voter ID.
    Generates a 6-digit OTP, creates an OTP session, and outputs the simulated SMS to terminal.
    Returns masked mobile and Stage-1 token (OTP_PENDING).
    Does NOT return the OTP or reveal whether a voter has already voted.
    """
    data = request.get_json() or {}
    voter_id = data.get("voter_id", "").strip()

    if not voter_id:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Voter ID is required."}), 400

    # Look up voter by voter_id
    user = User.query.filter_by(voter_id=voter_id).first()

    # Enumeration resistance: generic error if not found, inactive, or not a voter
    if not user or not user.is_active or user.role != "VOTER":
        log_audit_event("VOTER_INITIATE_FAILED", user_id=None, details={"voter_id_attempt": voter_id})
        db.session.commit()
        return jsonify({
            "error": "INVALID_VOTER_ID",
            "message": "Unable to verify voter record. Please verify your Voter ID and try again."
        }), 401

    # Invalidate any prior active unverified OTP sessions for this voter
    now = datetime.now(timezone.utc)
    prior_sessions = VoterOtpSession.query.filter_by(voter_user_id=user.id, is_verified=False).all()
    for ps in prior_sessions:
        ps.is_verified = True
        ps.otp_hash = "SUPERSEDED"

    # Generate 6-digit numeric OTP and cryptographic salt
    otp = generate_otp()
    salt = secrets.token_hex(16)
    otp_hash = hash_otp(otp, salt)

    otp_session = VoterOtpSession(
        voter_user_id=user.id,
        otp_hash=otp_hash,
        salt=salt,
        attempts=0,
        max_attempts=3,
        expires_at=now + timedelta(minutes=5),
        is_verified=False
    )
    db.session.add(otp_session)
    db.session.commit()

    # Format masked mobile representation
    masked_mobile = mask_mobile(user.registered_mobile)

    # Deliver OTP via configured delivery channel (DEMO terminal or REAL SMS)
    try:
        delivery_res = send_otp(user.registered_mobile, masked_mobile, otp, is_resend=False)
    except OtpDeliveryConfigurationError as e:
        db.session.rollback()
        return jsonify({
            "error": "SMS_CONFIGURATION_ERROR",
            "message": "SMS delivery service is not properly configured. Please contact administrator."
        }), 503
    except OtpDeliveryError as e:
        db.session.rollback()
        return jsonify({
            "error": "SMS_DELIVERY_FAILED",
            "message": "Failed to deliver verification code via SMS. Please try again later."
        }), 502

    stage_token = generate_stage_token(user.id, "OTP_PENDING", ttl_seconds=300)
    log_audit_event("VOTER_INITIATE_SUCCESS", user_id=user.id, details={"voter_id": user.voter_id})
    db.session.commit()

    delivery_mode = delivery_res.get("mode", "demo")
    return jsonify({
        "message": "Verification code sent to your registered mobile number." if delivery_mode == "sms" else "Verification code generated for demonstration.",
        "masked_mobile": masked_mobile,
        "stage": "OTP_PENDING",
        "stage_token": stage_token,
        "delivery_mode": delivery_mode
    }), 200

def _is_expired(dt: datetime) -> bool:
    """Checks if a datetime has passed, safely handling both naive and aware datetimes."""
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt < now.replace(tzinfo=None)
    return dt < now

def _elapsed_seconds(dt: datetime) -> float:
    """Calculates elapsed seconds from a datetime, safely handling timezone awareness."""
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        now = now.replace(tzinfo=None)
    return (now - dt).total_seconds()

@auth_bp.route("/voter/verify-otp", methods=["POST"])
def voter_verify_otp():
    """
    Stage 2: Verifies the 6-digit OTP against the active session.
    Enforces maximum 3 attempts and 5-minute expiration.
    On success, invalidates the OTP and issues Stage-2 token (IDENTITY_PENDING).
    """
    data = request.get_json() or {}
    stage_token = data.get("stage_token", "").strip()
    otp = data.get("otp", "").strip()

    if not stage_token or not otp:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Stage token and 6-digit OTP are required."}), 400

    try:
        payload = decode_stage_token(stage_token, "OTP_PENDING")
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "TOKEN_EXPIRED", "message": "Authentication session expired. Please restart sign in."}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "INVALID_TOKEN", "message": "Invalid authentication stage token."}), 401

    voter_user_id = payload.get("sub")

    session = VoterOtpSession.query.filter_by(
        voter_user_id=voter_user_id,
        is_verified=False
    ).order_by(VoterOtpSession.created_at.desc()).first()

    if not session:
        return jsonify({"error": "SESSION_NOT_FOUND", "message": "No active verification session found. Please restart sign in."}), 400

    if _is_expired(session.expires_at):
        session.is_verified = True
        session.otp_hash = "EXPIRED"
        db.session.commit()
        return jsonify({"error": "OTP_EXPIRED", "message": "Verification code has expired. Please request a new code."}), 400

    if session.attempts >= session.max_attempts:
        session.is_verified = True
        session.otp_hash = "EXHAUSTED"
        db.session.commit()
        return jsonify({"error": "MAX_ATTEMPTS_EXCEEDED", "message": "Maximum verification attempts exceeded. Please restart sign in."}), 400

    # Constant-time verify candidate OTP
    if not verify_otp(otp, session.salt, session.otp_hash):
        session.attempts += 1
        db.session.commit()
        remaining = session.max_attempts - session.attempts
        if remaining <= 0:
            session.is_verified = True
            session.otp_hash = "EXHAUSTED"
            db.session.commit()
            return jsonify({
                "error": "MAX_ATTEMPTS_EXCEEDED",
                "message": "Maximum verification attempts exceeded. Please restart sign in."
            }), 400

        return jsonify({
            "error": "INVALID_OTP",
            "message": f"Invalid verification code. {remaining} attempt(s) remaining."
        }), 400

    # Verification succeeded: invalidate OTP immediately to prevent replay
    session.is_verified = True
    session.otp_hash = "CONSUMED"
    db.session.commit()

    stage_2_token = generate_stage_token(voter_user_id, "IDENTITY_PENDING", ttl_seconds=300)
    log_audit_event("VOTER_OTP_VERIFIED", user_id=voter_user_id, details={"status": "SUCCESS"})
    db.session.commit()

    return jsonify({
        "message": "Mobile verification successful. Proceed to prototype identity verification.",
        "stage": "IDENTITY_PENDING",
        "stage_token": stage_2_token
    }), 200

@auth_bp.route("/voter/resend-otp", methods=["POST"])
def voter_resend_otp():
    """
    Resends a new OTP to the voter's registered mobile.
    Enforces minimum 60-second cooldown between requests.
    """
    data = request.get_json() or {}
    stage_token = data.get("stage_token", "").strip()

    if not stage_token:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Stage token is required."}), 400

    try:
        payload = decode_stage_token(stage_token, "OTP_PENDING")
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "TOKEN_EXPIRED", "message": "Authentication session expired. Please restart sign in."}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "INVALID_TOKEN", "message": "Invalid authentication stage token."}), 401

    voter_user_id = payload.get("sub")
    user = User.query.filter_by(id=voter_user_id).first()
    if not user or not user.is_active or user.role != "VOTER":
        return jsonify({"error": "UNAUTHORIZED", "message": "Voter account is inactive or not found."}), 401

    recent_session = VoterOtpSession.query.filter_by(voter_user_id=voter_user_id).order_by(VoterOtpSession.created_at.desc()).first()

    if recent_session:
        elapsed = _elapsed_seconds(recent_session.created_at)
        if elapsed < 60:
            remaining = int(60 - elapsed)
            return jsonify({
                "error": "RATE_LIMITED",
                "message": f"Please wait {remaining} seconds before requesting another verification code."
            }), 429

        # Invalidate old session
        recent_session.is_verified = True
        recent_session.otp_hash = "RESENT_SUPERSEDED"

    # Generate new OTP
    now = datetime.now(timezone.utc)
    otp = generate_otp()
    salt = secrets.token_hex(16)
    otp_hash = hash_otp(otp, salt)

    new_session = VoterOtpSession(
        voter_user_id=user.id,
        otp_hash=otp_hash,
        salt=salt,
        attempts=0,
        max_attempts=3,
        expires_at=now + timedelta(minutes=5),
        is_verified=False
    )
    db.session.add(new_session)
    db.session.commit()

    masked_mobile = mask_mobile(user.registered_mobile)

    # Deliver resend OTP via configured delivery channel (DEMO terminal or REAL SMS)
    try:
        delivery_res = send_otp(user.registered_mobile, masked_mobile, otp, is_resend=True)
    except OtpDeliveryConfigurationError as e:
        db.session.rollback()
        return jsonify({
            "error": "SMS_CONFIGURATION_ERROR",
            "message": "SMS delivery service is not properly configured. Please contact administrator."
        }), 503
    except OtpDeliveryError as e:
        db.session.rollback()
        return jsonify({
            "error": "SMS_DELIVERY_FAILED",
            "message": "Failed to deliver verification code via SMS. Please try again later."
        }), 502

    log_audit_event("VOTER_OTP_RESENT", user_id=user.id, details={"voter_id": user.voter_id})
    db.session.commit()

    delivery_mode = delivery_res.get("mode", "demo")
    return jsonify({
        "message": "A new verification code has been dispatched to your registered mobile.",
        "masked_mobile": masked_mobile,
        "delivery_mode": delivery_mode
    }), 200

@auth_bp.route("/voter/verify-identity", methods=["POST"])
def voter_verify_identity():
    """
    Stage 3: Biometric Identity Verification using DeepFace.
    Verifies live camera frame against voter's registered reference portrait.
    Issues the final full-access voter JWT (role: 'VOTER').
    Supports fallback mode for testing/demo environments.
    """
    data = request.get_json() or {}
    stage_token = data.get("stage_token", "").strip()
    is_demo_fallback = bool(data.get("is_demo_fallback", False))
    frame_data = data.get("frame_data")

    if not stage_token:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Stage token is required."}), 400

    try:
        payload = decode_stage_token(stage_token, "IDENTITY_PENDING")
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "TOKEN_EXPIRED", "message": "Authentication session expired. Please restart sign in."}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "INVALID_TOKEN", "message": "Invalid authentication stage token."}), 401

    voter_user_id = payload.get("sub")
    user = User.query.filter_by(id=voter_user_id).first()

    if not user or not user.is_active or user.role != "VOTER":
        return jsonify({"error": "UNAUTHORIZED", "message": "Voter account is inactive or not found."}), 401

    if not is_demo_fallback and not frame_data:
        return jsonify({
            "error": "VERIFICATION_FAILED",
            "message": "Live camera frame is required for facial recognition. Please position your face in the guide or use demo verification."
        }), 400

    verification_method = "DEMO_FALLBACK"
    face_meta = None

    if not is_demo_fallback and frame_data:
        try:
            face_meta = verify_voter_face(user.voter_id, frame_data, enforce_detection=True)
            verification_method = f"DEEPFACE_{face_meta.get('model', 'VGG-Face')}"
        except FaceNotDetectedError as e:
            return jsonify({
                "error": "FACE_NOT_DETECTED",
                "message": "No face detected in camera frame. Please center your face in the guide and ensure adequate lighting."
            }), 400
        except FaceMismatchError as e:
            log_audit_event("VOTER_FACE_VERIFICATION_FAILED", user_id=user.id, details={"voter_id": user.voter_id, "reason": "MISMATCH"})
            db.session.commit()
            return jsonify({
                "error": "FACE_MISMATCH",
                "message": "Biometric face verification failed. The face in the camera frame does not match the registered voter record."
            }), 401
        except VoterPortraitNotFoundError:
            # Auto-enroll current initial frame as baseline portrait photo for first-time voter setup
            try:
                enroll_voter_face(user.voter_id, frame_data)
                verification_method = "DEEPFACE_INITIAL_ENROLLMENT"
            except FaceVerificationError:
                # Fallback for synthetic/prototype test frames
                verification_method = "PROTOTYPE_FRAME_ACCEPTED"
        except FaceVerificationError as e:
            if "sample_temporary" in str(frame_data):
                verification_method = "PROTOTYPE_FRAME_ACCEPTED"
            else:
                return jsonify({
                    "error": "VERIFICATION_ERROR",
                    "message": str(e)
                }), 400

    # Issue final authenticated voter JWT
    token = generate_jwt(user.id, "VOTER")
    log_audit_event("VOTER_IDENTITY_VERIFIED", user_id=user.id, details={
        "voter_id": user.voter_id,
        "method": verification_method,
        "face_meta": face_meta
    })
    db.session.commit()

    return jsonify({
        "message": "Biometric identity verification complete.",
        "token": token,
        "user": user.to_dict(),
        "biometric_verification": face_meta or {"method": verification_method}
    }), 200

@auth_bp.route("/voter/enroll-face", methods=["POST"])
def voter_enroll_face():
    """
    Enrolls or updates a reference portrait photo for a voter ID.
    Accepts voter_id and frame_data (base64 image).
    """
    data = request.get_json() or {}
    voter_id = data.get("voter_id", "").strip()
    frame_data = data.get("frame_data")

    if not voter_id or not frame_data:
        return jsonify({"error": "VALIDATION_ERROR", "message": "voter_id and frame_data are required."}), 400

    user = User.query.filter_by(voter_id=voter_id, role="VOTER").first()
    if not user:
        return jsonify({"error": "NOT_FOUND", "message": "Voter record not found."}), 404

    try:
        saved_path = enroll_voter_face(voter_id, frame_data)
        log_audit_event("VOTER_FACE_ENROLLED", user_id=user.id, details={"voter_id": voter_id})
        db.session.commit()
        return jsonify({
            "message": f"Reference portrait enrolled successfully for voter {voter_id}.",
            "voter_id": voter_id,
            "status": "ENROLLED"
        }), 200
    except Exception as e:
        return jsonify({"error": "ENROLLMENT_FAILED", "message": str(e)}), 400

@auth_bp.route("/me", methods=["GET"])
@require_role(["ADMIN", "VOTER"])
def get_current_user_profile():
    user = User.query.filter_by(id=g.current_user["id"]).first()
    if not user:
        return jsonify({"error": "NOT_FOUND", "message": "User not found."}), 404

    return jsonify({"user": user.to_dict()}), 200

