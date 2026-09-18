from backend.models.ballot import Ballot
from backend.models.audit import AuditLog

def test_ballot_table_has_no_voter_identity_column():
    column_names = [col.name for col in Ballot.__table__.columns]
    
    # Critical privacy assertions
    assert "voter_id" not in column_names
    assert "user_id" not in column_names
    assert "username" not in column_names
    assert "voter_name" not in column_names
    assert "plain_candidate" not in column_names
    assert "aes_key" not in column_names
    assert "bb84_key" not in column_names

def test_vote_cast_audit_event_anonymity(client, voter_user, sample_election):
    # Cast a ballot
    response = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": sample_election["election_id"],
        "candidate_id": sample_election["candidate_ward1_id"]
    })
    assert response.status_code == 200

    # Inspect audit log
    audit = AuditLog.query.filter_by(action="VOTE_CAST").first()
    assert audit is not None
    assert audit.user_id is None  # Anonymity preserved

    details = audit.to_dict()["details"]
    assert "candidate_id" not in details
    assert "candidate_name" not in details
    assert "voter_id" not in details
    assert "key" not in details
