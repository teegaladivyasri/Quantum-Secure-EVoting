import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.extensions import db

class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    action: Mapped[str] = mapped_column(
        String(50), 
        nullable=False, 
        index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    details: Mapped[str] = mapped_column(
        Text, 
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        nullable=False, 
        index=True
    )

    # Optional relationship to user
    user = relationship("User")

    def to_dict(self):
        parsed_details = None
        if self.details:
            try:
                parsed_details = json.loads(self.details)
            except Exception:
                parsed_details = self.details

        return {
            "id": self.id,
            "action": self.action,
            "user_id": self.user_id,
            "details": parsed_details,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
