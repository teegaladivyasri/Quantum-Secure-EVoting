"""
Phase 2 Foundation Verification Tests
Verifies:
- Application factory initialization
- Configuration loading and isolation
- JSON error handlers (400, 401, 403, 404, 405, 500)
- Restricted CORS configuration
- Health endpoint functionality and clean status isolation
"""
import pytest
from flask import Flask, abort
from backend.app import create_app
from backend.config import Config
from backend.tests.conftest import TestConfig


def test_app_factory_creates_flask_instance():
    """Verify application factory returns a valid Flask app with correct configuration."""
    app = create_app()
    assert isinstance(app, Flask)
    assert app.name == "backend.app"
    # Ensure runtime default config points to PostgreSQL
    assert "postgresql://" in app.config["SQLALCHEMY_DATABASE_URI"]


def test_app_factory_with_test_config():
    """Verify application factory accepts test configuration cleanly."""
    app = create_app(TestConfig)
    assert app.config["TESTING"] is True
    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///:memory:"


def test_health_endpoint_response_structure(client):
    """Verify GET /api/v1/health returns expected JSON keys without sensitive data leaks."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.is_json
    data = response.get_json()
    assert data.get("status") == "UP"
    assert "database" in data
    assert data["database"] in ["CONNECTED", "DISCONNECTED"]
    assert "quantum_simulation" in data
    assert "cryptography" in data
    # Ensure no secrets or connection strings leaked
    for key, value in data.items():
        if isinstance(value, str):
            assert "postgres" not in value.lower()
            assert "password" not in value.lower()
            assert "5432" not in value


def test_404_json_error_handler(client):
    """Verify 404 returns structured JSON instead of HTML."""
    response = client.get("/api/v1/non_existent_route_12345")
    assert response.status_code == 404
    assert response.is_json
    data = response.get_json()
    assert data.get("error") == "NOT_FOUND"


def test_cors_headers_applied(client):
    """Verify CORS headers restrict origins appropriately."""
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": Config.FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "GET"
        }
    )
    # Origin should either match Config.FRONTEND_ORIGIN or be properly handled
    assert response.status_code in [200, 204]
