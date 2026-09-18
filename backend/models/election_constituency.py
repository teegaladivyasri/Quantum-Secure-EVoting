import uuid
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.extensions import db

class ElectionConstituency(db.Model):
    __tablename__ = "election_constituencies"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    election_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("elections.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    constituency_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("constituencies.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("election_id", "constituency_id", name="uq_election_constituency"),
    )

    # Relationships
    election = relationship("Election", back_populates="constituency_associations")
    constituency = relationship("Constituency", back_populates="election_associations")

    def to_dict(self):
        return {
            "id": self.id,
            "election_id": self.election_id,
            "constituency_id": self.constituency_id,
            "constituency": self.constituency.to_dict() if self.constituency else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
