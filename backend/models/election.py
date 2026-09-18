from typing import Optional
import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Text, Boolean, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from backend.extensions import db

class Election(db.Model):
    __tablename__ = "elections"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    title_en: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    title_te: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    title_hi: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, 
        nullable=True
    )
    description_en: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    description_te: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    description_hi: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    election_type: Mapped[str] = mapped_column(
        String(50),
        default="State Legislative Assembly",
        nullable=False
    )
    election_type_en: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    election_type_te: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    election_type_hi: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    state: Mapped[str] = mapped_column(
        String(100),
        default="Example State",
        nullable=False
    )
    election_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True
    )
    voting_open_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    voting_close_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="DRAFT",
        nullable=False,
        index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, 
        default=False, 
        nullable=False, 
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    constituency_associations = relationship(
        "ElectionConstituency", 
        back_populates="election", 
        cascade="all, delete-orphan"
    )
    candidates = relationship(
        "Candidate", 
        back_populates="election", 
        cascade="all, delete-orphan"
    )
    ballots = relationship("Ballot", back_populates="election")
    participations = relationship("ParticipationRecord", back_populates="election")

    def __init__(self, **kwargs):
        status = kwargs.get("status")
        is_active = kwargs.get("is_active")
        if status:
            allowed = ["DRAFT", "PUBLISHED", "OPEN", "CLOSED"]
            if status not in allowed:
                raise ValueError(f"Invalid election status '{status}'. Allowed: {allowed}")
            kwargs["status"] = status
            kwargs["is_active"] = (status == "OPEN")
        elif is_active is not None:
            kwargs["status"] = "OPEN" if is_active else "CLOSED"
            kwargs["is_active"] = bool(is_active)
        else:
            kwargs["status"] = "DRAFT"
            kwargs["is_active"] = False
        super().__init__(**kwargs)

    def set_status(self, new_status: str):
        allowed = ["DRAFT", "PUBLISHED", "OPEN", "CLOSED"]
        if new_status not in allowed:
            raise ValueError(f"Invalid election status '{new_status}'. Allowed: {allowed}")
        self.status = new_status
        self.is_active = (new_status == "OPEN")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "title_en": self.title_en or self.title,
            "title_te": self.title_te or self.title,
            "title_hi": self.title_hi or self.title,
            "description": self.description,
            "description_en": self.description_en or self.description,
            "description_te": self.description_te or self.description,
            "description_hi": self.description_hi or self.description,
            "election_type": self.election_type,
            "election_type_en": self.election_type_en or self.election_type,
            "election_type_te": self.election_type_te or self.election_type,
            "election_type_hi": self.election_type_hi or self.election_type,
            "state": self.state,
            "election_date": self.election_date.isoformat() if self.election_date else None,
            "voting_open_at": self.voting_open_at.isoformat() if self.voting_open_at else None,
            "voting_close_at": self.voting_close_at.isoformat() if self.voting_close_at else None,
            "status": self.status,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "participating_constituencies": [
                assoc.constituency.to_dict() 
                for assoc in self.constituency_associations 
                if assoc.constituency
            ] if self.constituency_associations else []
        }

from sqlalchemy import event

@event.listens_for(Election, "before_insert")
def sync_election_insert(mapper, connection, target):
    if target.status:
        target.is_active = (target.status == "OPEN")
    else:
        target.status = "OPEN" if target.is_active else "DRAFT"

@event.listens_for(Election, "before_update")
def sync_election_update(mapper, connection, target):
    # Synchronize if one was explicitly changed
    if not target.is_active and target.status == "OPEN":
        target.status = "CLOSED"
    elif target.is_active and target.status != "OPEN":
        target.status = "OPEN"
    else:
        target.is_active = (target.status == "OPEN")

