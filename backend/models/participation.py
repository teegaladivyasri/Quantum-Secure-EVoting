import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.extensions import db

class ParticipationRecord(db.Model):
    __tablename__ = "participation_records"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    voter_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey("users.id", ondelete="RESTRICT"), 
        nullable=False, 
        index=True
    )
    election_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey("elections.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    has_voted: Mapped[bool] = mapped_column(
        Boolean, 
        default=False, 
        nullable=False
    )
    voted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=True
    )

    __table_args__ = (
        UniqueConstraint("voter_id", "election_id", name="uq_voter_election"),
    )

    # Relationships
    voter = relationship("User", back_populates="participations")
    election = relationship("Election", back_populates="participations")

    def to_dict(self):
        return {
            "id": self.id,
            "voter_id": self.voter_id,
            "election_id": self.election_id,
            "has_voted": self.has_voted,
            "voted_at": self.voted_at.isoformat() if self.voted_at else None
        }
