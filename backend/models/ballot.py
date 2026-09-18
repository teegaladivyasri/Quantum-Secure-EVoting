import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.extensions import db

class Ballot(db.Model):
    """
    CRITICAL PRIVACY & SECURITY MODEL:
    - Absolutely NO voter_id, username, or voter identification column.
    - Plaintext candidate choices are NEVER stored.
    - AES cryptographic keys and BB84 quantum secret keys are NEVER stored.
    - Retains constituency solely for electoral district aggregation.
    """
    __tablename__ = "ballots"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    election_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey("elections.id", ondelete="RESTRICT"), 
        nullable=False, 
        index=True
    )
    constituency: Mapped[str] = mapped_column(
        String(100), 
        nullable=False, 
        index=True
    )
    encrypted_candidate: Mapped[str] = mapped_column(
        Text, 
        nullable=False
    )
    nonce: Mapped[str] = mapped_column(
        String(64), 
        nullable=False
    )
    auth_tag: Mapped[str] = mapped_column(
        String(64), 
        nullable=False
    )
    cast_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationship to election (NO relationship to User or voter_id)
    election = relationship("Election", back_populates="ballots")

    def to_dict(self):
        return {
            "id": self.id,
            "election_id": self.election_id,
            "constituency": self.constituency,
            "encrypted_candidate": self.encrypted_candidate,
            "nonce": self.nonce,
            "auth_tag": self.auth_tag,
            "cast_at": self.cast_at.isoformat() if self.cast_at else None
        }
