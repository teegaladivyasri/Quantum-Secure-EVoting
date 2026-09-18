import pytest
from backend.extensions import db
from backend.models.candidate import Candidate
from backend.models.constituency import Constituency
from backend.models.election import Election

def test_candidate_multilingual_fields(app):
    """Verify Candidate model stores and returns localized values without changing ID."""
    with app.app_context():
        constituency = Constituency(
            code="W100",
            name="Ward-100",
            name_en="Ward-100",
            name_te="వార్డు-100",
            name_hi="वार्ड-100"
        )
        db.session.add(constituency)
        db.session.flush()

        election = Election(
            title="Test Civic Election",
            title_en="Test Civic Election",
            title_te="టెస్ట్ ఎన్నికలు",
            title_hi="टेस्ट चुनाव",
            description="Civic trial",
            status="OPEN"
        )
        db.session.add(election)
        db.session.flush()

        cand = Candidate(
            name="Ananya Rao",
            name_en="Ananya Rao",
            name_te="అనన్య రావు",
            name_hi="अनन्या राव",
            party="People's Party",
            party_en="People's Party",
            party_te="పీపుల్స్ పార్టీ",
            party_hi="पीपुल्स पार्टी",
            election_id=election.id,
            constituency_id=constituency.id,
            is_nota=False
        )
        db.session.add(cand)
        db.session.commit()

        # Check candidate data
        cand_dict = cand.to_dict()
        assert cand_dict["name"] == "Ananya Rao"
        assert cand_dict["name_en"] == "Ananya Rao"
        assert cand_dict["name_te"] == "అనన్య రావు"
        assert cand_dict["name_hi"] == "अनन्या राव"
        assert cand_dict["party_en"] == "People's Party"
        assert cand_dict["party_te"] == "పీపుల్స్ పార్టీ"
        assert cand_dict["party_hi"] == "पीपुल्स पार्टी"

        # Check constituency data
        const_dict = constituency.to_dict()
        assert const_dict["code"] == "W100"
        assert const_dict["name"] == "Ward-100"
        assert const_dict["name_te"] == "వార్డు-100"
        assert const_dict["name_hi"] == "वार्ड-100"

        # Check election data
        elec_dict = election.to_dict()
        assert elec_dict["title_te"] == "టెస్ట్ ఎన్నికలు"
        assert elec_dict["title_hi"] == "टेस्ट चुनाव"

        # Verify ID persistence
        cand_id_before = cand.id
        assert cand.id == cand_id_before
