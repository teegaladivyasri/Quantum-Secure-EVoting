import json
from datetime import date
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.constituency import Constituency
from backend.models.election_constituency import ElectionConstituency
from backend.models.ballot import Ballot
from backend.models.participation import ParticipationRecord
from backend.extensions import db

def test_admin_voter_registration_rejected_403(client, admin_headers):
    """Admin cannot register voters; voter registry is pre-provisioned."""
    res = client.post("/api/v1/admin/voters", headers=admin_headers, json={
        "username": "new_synthetic_voter",
        "password": "Password123!",
        "constituency": "Ward-1"
    })
    assert res.status_code == 403
    data = res.get_json()
    assert data["error"] == "VOTER_REGISTRY_PREPROVISIONED"
    assert "pre-provisioned" in data["message"].lower()

def test_read_only_voter_registry_summary(client, admin_headers):
    """Admin can view read-only aggregate summary without credential management."""
    res = client.get("/api/v1/admin/voters", headers=admin_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "summary" in data
    assert "total_registered_voters" in data["summary"]
    assert "active_voters" in data["summary"]
    assert "constituency_counts" in data["summary"]
    # Ensure no passwords or hashes leaked
    for v in data["voters"]:
        assert "password" not in v
        assert "password_hash" not in v

def test_election_lifecycle_and_configuration_locking(client, admin_headers):
    """Verifies DRAFT -> PUBLISHED -> OPEN -> CLOSED with strict configuration locking."""
    # 1. Create election (initial state DRAFT)
    res = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "State Assembly Election 2026",
        "description": "Legislative Assembly Election",
        "election_type": "State Legislative Assembly",
        "state": "Example State",
        "election_date": "2026-11-20"
    })
    assert res.status_code == 201
    election = res.get_json()["election"]
    election_id = election["id"]
    assert election["status"] == "DRAFT"
    assert election["is_active"] is False

    # 2. Add participating constituency while DRAFT
    w1 = Constituency.query.filter_by(name="Ward-1").first()
    res = client.post(f"/api/v1/admin/elections/{election_id}/constituencies", headers=admin_headers, json={
        "constituency_id": w1.id
    })
    assert res.status_code == 201

    # 3. Add candidate while DRAFT
    res = client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": election_id,
        "constituency_id": w1.id,
        "name": "Candidate Alpha",
        "party": "Progressive Party",
        "ballot_position": 1
    })
    assert res.status_code == 201
    cand_alpha_id = res.get_json()["candidate"]["id"]

    # 4. Edit election details while DRAFT
    res = client.patch(f"/api/v1/admin/elections/{election_id}", headers=admin_headers, json={
        "title": "State Assembly General Election 2026"
    })
    assert res.status_code == 200

    # 5. Transition DRAFT -> PUBLISHED
    res = client.patch(f"/api/v1/admin/elections/{election_id}/status", headers=admin_headers, json={
        "status": "PUBLISHED"
    })
    assert res.status_code == 200
    assert res.get_json()["election"]["status"] == "PUBLISHED"
    assert res.get_json()["election"]["is_active"] is False

    # 6. Attempt editing configuration while PUBLISHED (must be locked with 409)
    res = client.patch(f"/api/v1/admin/elections/{election_id}", headers=admin_headers, json={
        "title": "Hacked Title"
    })
    assert res.status_code == 409
    assert res.get_json()["error"] == "LOCKED"

    # Attempt adding candidate while PUBLISHED (must be locked with 409)
    res = client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": election_id,
        "constituency_id": w1.id,
        "name": "Late Candidate",
        "party": "Late Party"
    })
    assert res.status_code == 409
    assert res.get_json()["error"] == "LOCKED"

    # 7. Transition PUBLISHED -> OPEN
    res = client.patch(f"/api/v1/admin/elections/{election_id}/status", headers=admin_headers, json={
        "status": "OPEN"
    })
    assert res.status_code == 200
    assert res.get_json()["election"]["status"] == "OPEN"
    assert res.get_json()["election"]["is_active"] is True

    # 8. Transition OPEN -> CLOSED
    res = client.patch(f"/api/v1/admin/elections/{election_id}/status", headers=admin_headers, json={
        "status": "CLOSED"
    })
    assert res.status_code == 200
    assert res.get_json()["election"]["status"] == "CLOSED"
    assert res.get_json()["election"]["is_active"] is False

    # 9. Attempt transition from CLOSED to OPEN (forbidden)
    res = client.patch(f"/api/v1/admin/elections/{election_id}/status", headers=admin_headers, json={
        "status": "OPEN"
    })
    assert res.status_code == 400
    assert res.get_json()["error"] == "INVALID_TRANSITION"

def test_nota_candidate_order_and_voting(client, voter_user, admin_headers):
    """Verifies NOTA is auto-provisioned, appears last, and can be voted for via standard UUID contract."""
    # 1. Create and publish election for Ward-1
    res = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "Municipal Council 2026"
    })
    el_id = res.get_json()["election"]["id"]
    w1 = Constituency.query.filter_by(name="Ward-1").first()

    # Add constituency
    client.post(f"/api/v1/admin/elections/{el_id}/constituencies", headers=admin_headers, json={
        "constituency_id": w1.id
    })

    # Add regular candidate
    client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": el_id,
        "constituency_id": w1.id,
        "name": "Jane Citizen",
        "party": "Independent",
        "ballot_position": 1
    })

    # List candidates as voter
    client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "PUBLISHED"})
    client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "OPEN"})

    info_res = client.get("/api/v1/voter/election-info", headers=voter_user["headers"])
    assert info_res.status_code == 200
    candidates = info_res.get_json()["eligible_candidates"]
    assert len(candidates) == 2

    # Standard candidate is first, NOTA is strictly last
    assert candidates[0]["name"] == "Jane Citizen"
    assert candidates[0]["is_nota"] is False
    assert candidates[1]["name"] == "None of the Above (NOTA)"
    assert candidates[1]["is_nota"] is True
    assert candidates[1]["ballot_position"] > candidates[0]["ballot_position"]

    # Vote for NOTA candidate
    nota_id = candidates[1]["id"]
    vote_res = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": el_id,
        "candidate_id": nota_id
    })
    assert vote_res.status_code == 200
    assert vote_res.get_json()["success"] is True

    # Check ballot storage: NO voter_id, valid encrypted ciphertext
    ballot = Ballot.query.filter_by(election_id=el_id).first()
    assert ballot is not None
    assert ballot.constituency == "Ward-1"
    assert ballot.encrypted_candidate is not None
    assert not hasattr(ballot, "voter_id")

def test_voter_constituency_isolation(client, voter_user, admin_headers):
    """Voter registered in Ward-1 cannot see or vote for Ward-2 candidates."""
    res = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "Inter-District Assembly 2026"
    })
    el_id = res.get_json()["election"]["id"]

    w1 = Constituency.query.filter_by(name="Ward-1").first()
    w2 = Constituency.query.filter_by(name="Ward-2").first()

    client.post(f"/api/v1/admin/elections/{el_id}/constituencies", headers=admin_headers, json={"constituency_id": w1.id})
    client.post(f"/api/v1/admin/elections/{el_id}/constituencies", headers=admin_headers, json={"constituency_id": w2.id})

    # Candidate in Ward-1
    client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": el_id,
        "constituency_id": w1.id,
        "name": "Ward 1 Candidate",
        "party": "Party A"
    })
    # Candidate in Ward-2
    c2_res = client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": el_id,
        "constituency_id": w2.id,
        "name": "Ward 2 Candidate",
        "party": "Party B"
    })
    ward2_cand_id = c2_res.get_json()["candidate"]["id"]

    client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "PUBLISHED"})
    client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "OPEN"})

    # Voter in Ward-1 queries election-info
    info = client.get("/api/v1/voter/election-info", headers=voter_user["headers"]).get_json()
    eligible = info["eligible_candidates"]
    assert all(c["constituency"] == "Ward-1" for c in eligible)
    assert not any(c["name"] == "Ward 2 Candidate" for c in eligible)

    # Attempt to vote for Ward-2 candidate
    vote_res = client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": el_id,
        "candidate_id": ward2_cand_id
    })
    assert vote_res.status_code == 400
    assert "Constituency mismatch" in vote_res.get_json()["message"]

def test_aggregate_participation_privacy_guarantee(client, admin_headers, voter_user):
    """Admin participation statistics must return aggregate counts with zero candidate choice leakage."""
    res = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "Participation Audit Test"
    })
    el_id = res.get_json()["election"]["id"]
    w1 = Constituency.query.filter_by(name="Ward-1").first()

    client.post(f"/api/v1/admin/elections/{el_id}/constituencies", headers=admin_headers, json={"constituency_id": w1.id})
    c_res = client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": el_id,
        "constituency_id": w1.id,
        "name": "Candidate Primary",
        "party": "Civic Union"
    })
    cand_id = c_res.get_json()["candidate"]["id"]

    client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "PUBLISHED"})
    client.patch(f"/api/v1/admin/elections/{el_id}/status", headers=admin_headers, json={"status": "OPEN"})

    # Voter casts ballot
    client.post("/api/v1/voter/cast-vote", headers=voter_user["headers"], json={
        "election_id": el_id,
        "candidate_id": cand_id
    })

    # Admin fetches participation stats
    stats_res = client.get(f"/api/v1/admin/elections/{el_id}/participation-stats", headers=admin_headers)
    assert stats_res.status_code == 200
    stats = stats_res.get_json()

    assert "total_eligible_voters" in stats
    assert "total_votes_cast" in stats
    assert stats["total_votes_cast"] == 1
    assert "constituency_breakdown" in stats

    # CRITICAL PRIVACY: Check exact required notice and absence of candidate breakdown
    assert stats["privacy_guarantee"] == "Voter participation is stored separately from the encrypted ballot. The system does not store a voter-to-candidate mapping."
    raw_text = json.dumps(stats)
    assert "Candidate Primary" not in raw_text
    assert "candidate_id" not in raw_text
    assert "voter_alice" not in raw_text
