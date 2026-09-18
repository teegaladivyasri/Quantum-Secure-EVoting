import json
from datetime import datetime, timezone
from backend.extensions import db
from backend.models.audit import AuditLog

def log_audit_event(action: str, user_id: str | None = None, details: dict | None = None):
    """
    Creates a sanitized audit log entry.
    
    Privacy Invariants:
    - For 'VOTE_CAST', user_id MUST be None.
    - Candidate choices and cryptographic keys are strictly excluded.
    """
    if action == "VOTE_CAST":
        user_id = None  # Enforce anonymity in audit trail
        if details:
            # Purge any accidental sensitive keys if present
            details.pop("candidate_id", None)
            details.pop("candidate_name", None)
            details.pop("key", None)
            details.pop("voter_id", None)

    serialized_details = json.dumps(details) if details else None

    log_entry = AuditLog(
        action=action,
        user_id=user_id,
        details=serialized_details,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(log_entry)
    # Caller controls the transaction boundary and commits when appropriate
    return log_entry
