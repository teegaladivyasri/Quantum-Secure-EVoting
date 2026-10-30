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

    # OTP Delivery Configuration (Phase 17A)
    # Mode: 'demo' (outputs simulated SMS to terminal) or 'sms' (dispatches via provider)
    OTP_DELIVERY_MODE = os.getenv("OTP_DELIVERY_MODE", "demo").lower()
    SMS_PROVIDER = os.getenv("SMS_PROVIDER", "twilio").lower()

    # Twilio Provider Configuration
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
    TWILIO_MESSAGING_SERVICE_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")

    # Fast2SMS Provider Configuration (India DLT / Quick SMS / OTP)
    FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")
    FAST2SMS_ROUTE = os.getenv("FAST2SMS_ROUTE", "otp").lower()
    FAST2SMS_SENDER_ID = os.getenv("FAST2SMS_SENDER_ID", "")
    FAST2SMS_TEMPLATE_ID = os.getenv("FAST2SMS_TEMPLATE_ID", "")

    # Generic HTTP SMS Gateway Configuration
    SMS_GATEWAY_URL = os.getenv("SMS_GATEWAY_URL", "")
    SMS_GATEWAY_API_KEY = os.getenv("SMS_GATEWAY_API_KEY", "")

    # TextBee SMS Gateway Configuration
    TEXTBEE_API_KEY = os.getenv("TEXTBEE_API_KEY", "")
    TEXTBEE_DEVICE_ID = os.getenv("TEXTBEE_DEVICE_ID", "")
    TEXTBEE_API_URL = os.getenv("TEXTBEE_API_URL", "https://api.textbee.dev/api/v1/gateway/send-sms")

    # Facial Recognition Configuration (DeepFace)
    FACIAL_RECOGNITION_ENABLED = os.getenv("FACIAL_RECOGNITION_ENABLED", "true").lower() == "true"
    VOTER_FACES_DIR = os.getenv("VOTER_FACES_DIR", str(backend_dir / "data" / "voter_faces"))
    DEEPFACE_MODEL = os.getenv("DEEPFACE_MODEL", "Facenet512")
    DEEPFACE_DETECTOR = os.getenv("DEEPFACE_DETECTOR", "opencv")
