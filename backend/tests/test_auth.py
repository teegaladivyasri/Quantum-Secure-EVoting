import json
from backend.models.user import User

def test_admin_login_success(client):
    response = client.post("/api/v1/auth/login", json={
        "username": "test_admin",
        "password": "TestAdmin123!"
    })
    assert response.status_code == 200
    data = response.get_json()
    assert "token" in data
    assert data["user"]["username"] == "test_admin"
    assert data["user"]["role"] == "ADMIN"

def test_login_invalid_password(client):
    response = client.post("/api/v1/auth/login", json={
        "username": "test_admin",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401
    data = response.get_json()
    assert data["error"] == "UNAUTHORIZED"

def test_admin_voter_registration_is_disabled(client, admin_headers):
    response = client.post("/api/v1/admin/voters", headers=admin_headers, json={
        "username": "voter_bob",
        "password": "SecretPassword123!",
        "constituency": "Ward-1"
    })
    assert response.status_code == 403
    data = response.get_json()
    assert data["error"] == "VOTER_REGISTRY_PREPROVISIONED"

def test_voter_cannot_access_admin_routes(client, voter_user):
    response = client.post("/api/v1/admin/voters", headers=voter_user["headers"], json={
        "username": "hacker_user",
        "password": "Password123!",
        "constituency": "Ward-1"
    })
    assert response.status_code == 403
    data = response.get_json()
    assert data["error"] == "FORBIDDEN"

def test_unauthenticated_request_rejected(client):
    response = client.get("/api/v1/voter/election-info")
    assert response.status_code == 401
