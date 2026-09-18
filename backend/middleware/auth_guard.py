from functools import wraps
from flask import request, jsonify, g
import jwt
from backend.services.auth_service import decode_jwt

def require_role(allowed_roles: list[str]):
    """
    Decorator enforcing Bearer JWT authentication and Role-Based Access Control (RBAC).
    Extracts Bearer token, validates signature/expiration, and verifies user role.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({
                    "error": "UNAUTHORIZED",
                    "message": "Authorization header missing or invalid format. Expected 'Bearer <token>'."
                }), 401

            token = auth_header.split(" ", 1)[1].strip()
            try:
                payload = decode_jwt(token)
            except jwt.ExpiredSignatureError:
                return jsonify({
                    "error": "TOKEN_EXPIRED",
                    "message": "Authentication token has expired. Please log in again."
                }), 401
            except jwt.InvalidTokenError:
                return jsonify({
                    "error": "INVALID_TOKEN",
                    "message": "Authentication token is invalid."
                }), 401

            # Explicitly reject stage tokens from accessing final role-protected endpoints
            if "stage" in payload or not payload.get("role"):
                return jsonify({
                    "error": "FORBIDDEN",
                    "message": "Stage token cannot access protected resources. Complete authentication stages first."
                }), 403

            user_role = payload.get("role")
            if user_role not in allowed_roles:
                return jsonify({
                    "error": "FORBIDDEN",
                    "message": f"Access denied. User role '{user_role}' is not authorized for this resource."
                }), 403

            # Store verified user claims in Flask application context
            g.current_user = {
                "id": payload.get("sub"),
                "role": user_role,
            }

            return fn(*args, **kwargs)
        return wrapper
    return decorator
