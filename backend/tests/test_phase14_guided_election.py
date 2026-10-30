import pytest
from backend.models.election import Election
from backend.models.constituency import Constituency
from backend.models.candidate import Candidate
from backend.extensions import db

def test_phase14_workflow_and_validations(client, admin_headers):
    # Retrieve available constituencies (seeded in conftest or seed_demo_data)
    w1 = Constituency.query.filter_by(name="Ward-1").first()
    w2 = Constituency.query.filter_by(name="Ward-2").first()
    w3 = Constituency.query.filter_by(name="Ward-3").first()
    if not w3:
        w3 = Constituency(name="Ward-3", code="W3", state="Example State", is_active=True)
        db.session.add(w3)
        db.session.commit()

    # 1. Create election with no constituency -> status DRAFT, configuration INCOMPLETE
    res = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "Empty Constituencies Election 2026",
        "constituency_ids": []
    })
    assert res.status_code == 201
    el_empty_id = res.get_json()["election"]["id"]
    assert res.get_json()["election"]["configuration_status"] == "INCOMPLETE"

    # Attempt publishing election with no constituencies -> rejected
    pub_res = client.patch(f"/api/v1/admin/elections/{el_empty_id}/status", headers=admin_headers, json={
        "status": "PUBLISHED"
    })
    assert pub_res.status_code == 400
    assert pub_res.get_json()["error"] == "PREPARATION_INCOMPLETE"
    assert "No participating constituencies" in pub_res.get_json()["message"]

    # 2. Create election with constituencies but NO candidates -> status DRAFT, configuration INCOMPLETE
    res = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "No Candidates Election 2026",
        "constituency_ids": [w1.id, w2.id]
    })
    assert res.status_code == 201
    el_nocand_id = res.get_json()["election"]["id"]
    assert res.get_json()["election"]["configuration_status"] == "INCOMPLETE"

    # Readiness check reflects incomplete state
    readiness_res = client.get(f"/api/v1/admin/elections/{el_nocand_id}/readiness", headers=admin_headers)
    assert readiness_res.status_code == 200
    assert readiness_res.get_json()["is_ready"] is False
    assert readiness_res.get_json()["configuration_status"] == "INCOMPLETE"

    # Attempt publishing election with constituencies but no standard candidates -> rejected
    pub_res2 = client.patch(f"/api/v1/admin/elections/{el_nocand_id}/status", headers=admin_headers, json={
        "status": "PUBLISHED"
    })
    assert pub_res2.status_code == 400
    assert pub_res2.get_json()["error"] == "PREPARATION_INCOMPLETE"
    assert "has no configured candidates" in pub_res2.get_json()["message"]

    # 3. Create election with candidates for only SOME constituencies (Ward-1 and Ward-2 selected, only Ward-1 configured)
    res = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "Partial Configuration Election 2026",
        "constituency_ids": [w1.id, w2.id],
        "candidates": [
            {
                "constituency_id": w1.id,
                "name": "Candidate A1",
                "party": "Party Alpha",
                "ballot_position": 1
            }
        ]
    })
    assert res.status_code == 201
    el_partial_id = res.get_json()["election"]["id"]
    assert res.get_json()["election"]["configuration_status"] == "INCOMPLETE"

    # Attempt to publish partial election -> rejected identifying Ward-2
    pub_res3 = client.patch(f"/api/v1/admin/elections/{el_partial_id}/status", headers=admin_headers, json={
        "status": "PUBLISHED"
    })
    assert pub_res3.status_code == 400
    assert "Ward-2 has no configured candidates" in pub_res3.get_json()["message"]

    # 4. Duplicate ballot position within the same constituency -> rejected
    dup_pos_res = client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": el_partial_id,
        "constituency_id": w1.id,
        "name": "Candidate A2",
        "party": "Party Beta",
        "ballot_position": 1  # Collides with Candidate A1
    })
    assert dup_pos_res.status_code == 409
    assert dup_pos_res.get_json()["error"] == "CONFLICT"

    # 5. Same ballot position across DIFFERENT constituencies -> allowed
    diff_const_pos_res = client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": el_partial_id,
        "constituency_id": w2.id,
        "name": "Candidate B1",
        "party": "Party Gamma",
        "ballot_position": 1  # Position 1 in Ward-2 while Position 1 exists in Ward-1
    })
    assert diff_const_pos_res.status_code == 201
    assert diff_const_pos_res.get_json()["candidate"]["ballot_position"] == 1

    # 6. Verify NOTA exists and is strictly placed last for both constituencies
    cands_w1 = client.get(f"/api/v1/admin/candidates?election_id={el_partial_id}&constituency_id={w1.id}", headers=admin_headers).get_json()["candidates"]
    assert len(cands_w1) == 2  # 1 candidate + 1 NOTA
    assert cands_w1[0]["name"] == "Candidate A1" and cands_w1[0]["ballot_position"] == 1
    assert cands_w1[1]["is_nota"] is True and cands_w1[1]["ballot_position"] == 2

    cands_w2 = client.get(f"/api/v1/admin/candidates?election_id={el_partial_id}&constituency_id={w2.id}", headers=admin_headers).get_json()["candidates"]
    assert len(cands_w2) == 2  # 1 candidate + 1 NOTA
    assert cands_w2[0]["name"] == "Candidate B1" and cands_w2[0]["ballot_position"] == 1
    assert cands_w2[1]["is_nota"] is True and cands_w2[1]["ballot_position"] == 2

    # Now that both Ward-1 and Ward-2 have candidates, election configuration is complete
    readiness_w1_w2 = client.get(f"/api/v1/admin/elections/{el_partial_id}/readiness", headers=admin_headers).get_json()
    assert readiness_w1_w2["is_ready"] is True
    assert readiness_w1_w2["configuration_status"] == "COMPLETE"

    # 7. Complete DRAFT -> Can be published & locked
    pub_ok = client.patch(f"/api/v1/admin/elections/{el_partial_id}/status", headers=admin_headers, json={
        "status": "PUBLISHED"
    })
    assert pub_ok.status_code == 200
    assert pub_ok.get_json()["election"]["status"] == "PUBLISHED"

    # 8. Locked election cannot modify candidates
    lock_test_res = client.post("/api/v1/admin/candidates", headers=admin_headers, json={
        "election_id": el_partial_id,
        "constituency_id": w1.id,
        "name": "Late Candidate",
        "party": "Late Party"
    })
    assert lock_test_res.status_code == 409
    assert lock_test_res.get_json()["error"] == "LOCKED"

    # 9. Test candidate deletion and automatic NOTA repositioning in a DRAFT election
    draft_del = client.post("/api/v1/admin/elections", headers=admin_headers, json={
        "title": "Deletion Test Draft 2026",
        "constituency_ids": [w1.id],
        "candidates": [
            {"constituency_id": w1.id, "name": "Cand 1", "party": "Party 1", "ballot_position": 1},
            {"constituency_id": w1.id, "name": "Cand 2", "party": "Party 2", "ballot_position": 2},
            {"constituency_id": w1.id, "name": "Cand 3", "party": "Party 3", "ballot_position": 3}
        ]
    })
    assert draft_del.status_code == 201
    el_del_id = draft_del.get_json()["election"]["id"]
    
    del_cands = client.get(f"/api/v1/admin/candidates?election_id={el_del_id}&constituency_id={w1.id}", headers=admin_headers).get_json()["candidates"]
    assert len(del_cands) == 4  # 3 standard + 1 NOTA
    assert del_cands[3]["is_nota"] is True and del_cands[3]["ballot_position"] == 4

    # Attempting to delete NOTA directly is rejected
    nota_id = del_cands[3]["id"]
    del_nota_res = client.delete(f"/api/v1/admin/candidates/{nota_id}", headers=admin_headers)
    assert del_nota_res.status_code == 400
    assert "Cannot delete NOTA" in del_nota_res.get_json()["message"]

    # Delete Cand 2 -> Cand 3 re-compacts to pos 2, NOTA moves to pos 3
    cand2_id = del_cands[1]["id"]
    del_cand2_res = client.delete(f"/api/v1/admin/candidates/{cand2_id}", headers=admin_headers)
    assert del_cand2_res.status_code == 200

    cands_after_del = client.get(f"/api/v1/admin/candidates?election_id={el_del_id}&constituency_id={w1.id}", headers=admin_headers).get_json()["candidates"]
    assert len(cands_after_del) == 3
    assert cands_after_del[0]["name"] == "Cand 1" and cands_after_del[0]["ballot_position"] == 1
    assert cands_after_del[1]["name"] == "Cand 3" and cands_after_del[1]["ballot_position"] == 2
    assert cands_after_del[2]["is_nota"] is True and cands_after_del[2]["ballot_position"] == 3

    # 10. Test candidate editing via PATCH
    patch_cand_res = client.patch(f"/api/v1/admin/candidates/{cands_after_del[1]['id']}", headers=admin_headers, json={
        "name": "Cand 3 Renamed",
        "party": "Party 3 Updated"
    })
    assert patch_cand_res.status_code == 200
    assert patch_cand_res.get_json()["candidate"]["name"] == "Cand 3 Renamed"
    assert patch_cand_res.get_json()["candidate"]["party"] == "Party 3 Updated"
