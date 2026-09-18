from typing import Optional
import uuid
from sqlalchemy import String, Integer, Boolean, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.extensions import db

class Candidate(db.Model):
    __tablename__ = "candidates"
    
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
        ForeignKey("constituencies.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    constituency: Mapped[str] = mapped_column(
        String(100), 
        nullable=False, 
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    name_en: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    name_te: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    name_hi: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    party: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    party_en: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    party_te: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    party_hi: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    ballot_position: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    is_nota: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint("election_id", "constituency_id", "ballot_position", name="uq_candidate_election_constituency_position"),
        UniqueConstraint("election_id", "name", "constituency_id", name="uq_election_candidate_constituency"),
        CheckConstraint("ballot_position > 0", name="chk_candidate_ballot_position_positive"),
    )

    # Relationships
    election = relationship("Election", back_populates="candidates")
    constituency_rel = relationship("Constituency", back_populates="candidates")

    def __init__(self, **kwargs):
        # Auto-resolve constituency_id if only constituency string is provided
        if not kwargs.get("constituency_id") and kwargs.get("constituency"):
            from backend.models.constituency import Constituency
            cname = kwargs["constituency"].strip()
            c = Constituency.query.filter_by(name=cname).first()
            if not c:
                code_suffix = cname.replace(" ", "-")[:20].upper()
                c = Constituency(name=cname, code=code_suffix, state="Example State", is_active=True)
                db.session.add(c)
                db.session.flush()
            kwargs["constituency_id"] = c.id
        elif kwargs.get("constituency_id") and not kwargs.get("constituency"):
            from backend.models.constituency import Constituency
            c = Constituency.query.filter_by(id=kwargs["constituency_id"]).first()
            if c:
                kwargs["constituency"] = c.name

        # Auto-assign ballot_position if not provided
        if "ballot_position" not in kwargs or kwargs["ballot_position"] is None:
            if kwargs.get("election_id") and kwargs.get("constituency_id"):
                curr_count = Candidate.query.filter_by(
                    election_id=kwargs["election_id"],
                    constituency_id=kwargs["constituency_id"],
                    is_nota=False
                ).count()
                kwargs["ballot_position"] = curr_count + 1
            else:
                kwargs["ballot_position"] = 1

        # Default fallback for localized fields if not explicitly provided
        if kwargs.get("name"):
            kwargs.setdefault("name_en", kwargs["name"])
        if kwargs.get("party"):
            kwargs.setdefault("party_en", kwargs["party"])

        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "election_id": self.election_id,
            "constituency_id": self.constituency_id,
            "constituency": self.constituency,
            "name": self.name,
            "name_en": self.name_en or self.name,
            "name_te": self.name_te or self.name,
            "name_hi": self.name_hi or self.name,
            "party": self.party,
            "party_en": self.party_en or self.party,
            "party_te": self.party_te or self.party,
            "party_hi": self.party_hi or self.party,
            "ballot_position": self.ballot_position,
            "is_active": self.is_active,
            "is_nota": self.is_nota
        }
