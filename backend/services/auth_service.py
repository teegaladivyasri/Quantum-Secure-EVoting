import time
import secrets
import hashlib
import bcrypt
import jwt
from backend.config import Config

def hash_password(password: str) -> str:
    """Hashes a plaintext password using Bcrypt with salt rounds=12."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    """Verifies a plaintext password against a stored Bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))

def generate_jwt(user_id: str, role: str) -> str:
    """
    Generates a signed JWT with strict minimal claims:
    - sub: user ID
    - role: user role (ADMIN or VOTER)
    - iat: issued-at timestamp
    - exp: expiration timestamp
    """
    now = int(time.time())
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + Config.JWT_EXPIRATION_SECONDS,
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

def decode_jwt(token: str) -> dict:
    """Decodes and cryptographically verifies a JWT."""
    return jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])

def generate_otp() -> str:
    """
    Generates a cryptographically secure 6-digit numeric OTP using CSPRNG.
    Format: exactly 6 digits between 100000 and 999999.
    """
    return f"{secrets.randbelow(900000) + 100000:06d}"

def hash_otp(otp: str, salt: str) -> str:
    """Computes SHA-256 hash of salt + OTP for secure persistent storage."""
    return hashlib.sha256(f"{salt}:{otp}".encode("utf-8")).hexdigest()

def verify_otp(otp: str, salt: str, expected_hash: str) -> bool:
    """Constant-time verification of candidate OTP against stored hash."""
    candidate_hash = hash_otp(otp, salt)
    return secrets.compare_digest(candidate_hash, expected_hash)

def generate_stage_token(user_id: str, stage: str, ttl_seconds: int = 300) -> str:
    """
    Generates a short-lived token for multi-stage authentication:
    - sub: user ID
    - stage: authentication phase ('OTP_PENDING' or 'IDENTITY_PENDING')
    - iat: issued-at timestamp
    - exp: expiration timestamp (default 5 minutes)
    """
    now = int(time.time())
    payload = {
        "sub": user_id,
        "stage": stage,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

def decode_stage_token(token: str, expected_stage: str) -> dict:
    """
    Decodes and validates a stage token, asserting the token matches the required stage.
    Raises jwt.InvalidTokenError if stage mismatch occurs.
    """
    payload = decode_jwt(token)
    if payload.get("stage") != expected_stage:
        raise jwt.InvalidTokenError(f"Invalid authentication stage. Expected '{expected_stage}'.")
    return payload

def mask_mobile(mobile: str | None) -> str:
    """
    Masks a mobile phone number for privacy display.
    Example: '+91 98765 43101' -> '******0101' or '+91 ********0101'.
    """
    if not mobile:
        return "******0000"
    clean = mobile.strip()
    suffix = clean[-4:] if len(clean) >= 4 else clean
    return f"******{suffix}"

