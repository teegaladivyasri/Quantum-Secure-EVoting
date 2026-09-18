from flask import Blueprint, jsonify
from backend.extensions import db
from backend.config import Config

health_bp = Blueprint("health_bp", __name__, url_prefix="/api/v1")

@health_bp.route("/health", methods=["GET"])
def health_check():
    db_connected = False
    try:
        db.session.execute(db.text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False

    return jsonify({
        "status": "UP",
        "database": "CONNECTED" if db_connected else "DISCONNECTED",
        "quantum_simulation": "Qiskit-Aer-Ready",
        "cryptography": "AES-256-GCM-Ready",
        "eavesdropping_simulated": Config.SIMULATE_EAVESDROPPING
    }), 200
