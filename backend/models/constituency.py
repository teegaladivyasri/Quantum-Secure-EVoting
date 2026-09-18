from typing import Optional
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.extensions import db

class Constituency(db.Model):
    __tablename__ = "constituencies"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(
        String(100), 
        unique=True, 
        nullable=False
    )
    name_en: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    name_te: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    name_hi: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    code: Mapped[str] = mapped_column(
        String(20), 
        unique=True, 
        nullable=False
    )
    state: Mapped[str] = mapped_column(
        String(100), 
        default="Example State", 
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, 
        default=True, 
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    election_associations = relationship(
        "ElectionConstituency", 
        back_populates="constituency", 
        cascade="all, delete-orphan"
    )
    candidates = relationship(
        "Candidate", 
        back_populates="constituency_rel", 
        cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "name_en": self.name_en or self.name,
            "name_te": self.name_te or self.name,
            "name_hi": self.name_hi or self.name,
            "code": self.code,
            "state": self.state,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
