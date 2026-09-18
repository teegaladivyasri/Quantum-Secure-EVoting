import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory or project root
backend_dir = Path(__file__).resolve().parent
load_dotenv(backend_dir / ".env")
load_dotenv(backend_dir.parent / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "default-dev-secret-key-change-in-production")
    
    # Database URL: Configured for PostgreSQL runtime according to approved architecture
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/quantum_evoting_db")
    # Fix postgresql:// URI format for SQLAlchemy 2.0 if needed
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-super-secret-default-key-change-in-production")
    JWT_EXPIRATION_SECONDS = int(os.getenv("JWT_EXPIRATION_SECONDS", 7200))
    
    # Quantum Simulation Parameters: 800 qubits ensure >= 256 usable sifted bits after QBER sampling
    BB84_DEFAULT_QUBIT_COUNT = int(os.getenv("BB84_DEFAULT_QUBIT_COUNT", 800))
    BB84_QBER_THRESHOLD = float(os.getenv("BB84_QBER_THRESHOLD", 0.11))
    SIMULATE_EAVESDROPPING = os.getenv("SIMULATE_EAVESDROPPING", "false").lower() == "true"
    
    # CORS
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
