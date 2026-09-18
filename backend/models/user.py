from typing import Optional
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.extensions import db

class User(db.Model):
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    username: Mapped[str] = mapped_column(
        String(64), 
        unique=True, 
        nullable=False, 
        index=True
    )
    password_hash: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    role: Mapped[str] = mapped_column(
        String(20), 
        nullable=False, 
        default="VOTER"
    )  # 'ADMIN' or 'VOTER'
    constituency: Mapped[str] = mapped_column(
        String(100), 
        nullable=False
    )
    voter_id: Mapped[Optional[str]] = mapped_column(
        String(32),
        unique=True,
        nullable=True,
        index=True
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(120),
        nullable=True
    )
    registered_mobile: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    synthetic_identity_reference: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    participations = relationship("ParticipationRecord", back_populates="voter", cascade="all, delete-orphan")
    otp_sessions = relationship("VoterOtpSession", back_populates="voter", cascade="all, delete-orphan")

    def to_dict(self):
        masked_mobile = None
        if self.registered_mobile:
            clean = self.registered_mobile.strip()
            suffix = clean[-4:] if len(clean) >= 4 else clean
            masked_mobile = f"******{suffix}"

        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "constituency": self.constituency,
            "voter_id": self.voter_id,
            "full_name": self.full_name,
            "is_active": self.is_active,
            "masked_mobile": masked_mobile,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

