"""
Middleware and Security Guards for Quantum-Secure Electronic Voting System
"""

from backend.middleware.auth_guard import require_role

__all__ = ["require_role"]
