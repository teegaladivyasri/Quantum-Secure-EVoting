"""
API Route Blueprints for Quantum-Secure Electronic Voting System
"""

from backend.routes.auth_routes import auth_bp
from backend.routes.admin_routes import admin_bp
from backend.routes.voter_routes import voter_bp
from backend.routes.health_routes import health_bp

__all__ = ["auth_bp", "admin_bp", "voter_bp", "health_bp"]
