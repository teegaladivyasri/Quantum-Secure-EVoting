"""
Unit and integration tests for DeepFace Biometric Verification Service.
Verifies:
1. Base64 frame decoding into OpenCV numpy arrays.
2. Voter portrait enrollment into local filesystem repository.
3. Biometric verification matching and mismatch rejection.
4. Error raising for missing faces and un-enrolled voters.
5. End-to-end Stage 3 voter identity verification route.
"""

import base64
import os
import cv2
import numpy as np
import pytest
from backend.services.deepface_service import (
    decode_image_base64,
    enroll_voter_face,
    get_voter_face_path,
    verify_voter_face,
    FaceVerificationError,
    FaceMismatchError,
    VoterPortraitNotFoundError,
)
from backend.services.auth_service import generate_stage_token, hash_password
from backend.models.user import User
from backend.extensions import db


def _create_synthetic_face(circle_pos=(100, 100), color=(255, 255, 255)) -> str:
    """Creates a base64 encoded synthetic 200x200 JPEG image for testing."""
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.circle(img, circle_pos, 45, color, -1)
    _, buffer = cv2.imencode(".jpg", img)
    b64_str = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64_str}"


# ==============================================================================
# 1. Image Decoding Tests
# ==============================================================================

def test_decode_image_base64_valid():
    b64_img = _create_synthetic_face()
    arr = decode_image_base64(b64_img)
    assert isinstance(arr, np.ndarray)
    assert arr.shape == (200, 200, 3)


def test_decode_image_base64_invalid():
    with pytest.raises(FaceVerificationError):
        decode_image_base64("")
    with pytest.raises(FaceVerificationError):
        decode_image_base64("data:image/jpeg;base64,invalid-corrupted-bytes!!!")


# ==============================================================================
# 2. Voter Enrollment Tests
# ==============================================================================

def test_enroll_and_get_voter_face(tmp_path, monkeypatch):
    test_voter_id = "VTR-TEST-ENROLL-99"
    b64_img = _create_synthetic_face()

    save_path = enroll_voter_face(test_voter_id, b64_img)
    assert os.path.exists(save_path)

    found_path = get_voter_face_path(test_voter_id)
    assert found_path is not None
    assert str(found_path) == save_path

    # Cleanup
    if os.path.exists(save_path):
        os.remove(save_path)


# ==============================================================================
# 3. Biometric Verification Tests
# ==============================================================================

def test_verify_voter_face_not_enrolled():
    with pytest.raises(VoterPortraitNotFoundError):
        verify_voter_face("VTR-UNENROLLED-000", _create_synthetic_face())


def test_verify_voter_face_match_mocked(monkeypatch):
    """Verifies that when DeepFace returns verified=True, verify_voter_face succeeds."""
    test_voter_id = "VTR-TEST-VERIFY-1"
    b64_img = _create_synthetic_face()
    enroll_voter_face(test_voter_id, b64_img)

    def mock_deepface_verify(**kwargs):
        return {
            "verified": True,
            "distance": 0.12,
            "threshold": 0.40,
            "model": "VGG-Face",
            "detector_backend": "opencv",
            "similarity_metric": "cosine"
        }

    monkeypatch.setattr("backend.services.deepface_service.DeepFace.verify", mock_deepface_verify)

    res = verify_voter_face(test_voter_id, b64_img)
    assert res["verified"] is True
    assert res["distance"] == 0.12
    assert res["threshold"] == 0.40

    # Cleanup
    ref = get_voter_face_path(test_voter_id)
    if ref and ref.exists():
        os.remove(ref)


def test_verify_voter_face_mismatch_mocked(monkeypatch):
    """Verifies that when DeepFace returns verified=False, FaceMismatchError is raised."""
    test_voter_id = "VTR-TEST-VERIFY-2"
    b64_img = _create_synthetic_face()
    enroll_voter_face(test_voter_id, b64_img)

    def mock_deepface_verify(**kwargs):
        return {
            "verified": False,
            "distance": 0.75,
            "threshold": 0.40,
            "model": "VGG-Face",
            "detector_backend": "opencv",
            "similarity_metric": "cosine"
        }

    monkeypatch.setattr("backend.services.deepface_service.DeepFace.verify", mock_deepface_verify)

    with pytest.raises(FaceMismatchError):
        verify_voter_face(test_voter_id, b64_img)

    # Cleanup
    ref = get_voter_face_path(test_voter_id)
    if ref and ref.exists():
        os.remove(ref)


# ==============================================================================
# 4. Stage-3 Identity Verification Route Tests
# ==============================================================================

def test_verify_identity_fallback_route(client, app):
    with app.app_context():
        voter = User(
            username="voter_face_test_user",
            password_hash=hash_password("Pass123!"),
            role="VOTER",
            constituency="Ward-1",
            voter_id="VTR-2026-FACE-01",
            is_active=True
        )
        db.session.add(voter)
        db.session.commit()
        voter_id = voter.id

    stage_token = generate_stage_token(voter_id, "IDENTITY_PENDING", ttl_seconds=300)

    res = client.post("/api/v1/auth/voter/verify-identity", json={
        "stage_token": stage_token,
        "is_demo_fallback": True
    })

    assert res.status_code == 200
    data = res.get_json()
    assert "token" in data
    assert data["user"]["voter_id"] == "VTR-2026-FACE-01"


def test_verify_identity_biometric_mismatch_route(client, app, monkeypatch):
    with app.app_context():
        voter = User(
            username="voter_face_mismatch_user",
            password_hash=hash_password("Pass123!"),
            role="VOTER",
            constituency="Ward-1",
            voter_id="VTR-2026-FACE-02",
            is_active=True
        )
        db.session.add(voter)
        db.session.commit()
        voter_id = voter.id

    # Enroll a reference portrait
    enroll_voter_face("VTR-2026-FACE-02", _create_synthetic_face())

    def mock_deepface_verify(**kwargs):
        return {
            "verified": False,
            "distance": 0.82,
            "threshold": 0.40,
            "model": "VGG-Face"
        }

    monkeypatch.setattr("backend.services.deepface_service.DeepFace.verify", mock_deepface_verify)

    stage_token = generate_stage_token(voter_id, "IDENTITY_PENDING", ttl_seconds=300)

    res = client.post("/api/v1/auth/voter/verify-identity", json={
        "stage_token": stage_token,
        "is_demo_fallback": False,
        "frame_data": _create_synthetic_face(circle_pos=(50, 50))
    })

    assert res.status_code == 401
    data = res.get_json()
    assert data["error"] == "FACE_MISMATCH"

    # Cleanup
    ref = get_voter_face_path("VTR-2026-FACE-02")
    if ref and ref.exists():
        os.remove(ref)

