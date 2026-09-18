"""
Database Seeding Script for Live Academic Demo
Creates / ensures:
1. Constituencies: Ward-1, Ward-2, Ward-3
2. Default Admin: admin / AdminSecure2026!
3. Active Demo Election: General Assembly Election 2026 (status: OPEN)
4. Participating Constituencies for Demo Election
5. Candidates across Ward-1, Ward-2, and Ward-3 with NOTA
6. Pre-provisioned Voters:
   - voter_alice / Password123! (Ward-1)
   - voter_bob / Password123! (Ward-1)
   - voter_charlie / Password123! (Ward-2)
"""

import sys
from pathlib import Path
from datetime import date
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.constituency import Constituency
from backend.models.election_constituency import ElectionConstituency
from backend.services.auth_service import hash_password

def seed():
    app = create_app()
    with app.app_context():
        # Ensure tables exist
        db.create_all()

        # 0. Constituencies
        constituencies_map = {}
        const_specs = [
            ("Ward-1", "W1", "North District", "వార్డు-1", "वार्ड-1"),
            ("Ward-2", "W2", "South District", "వార్డు-2", "वार्ड-2"),
            ("Ward-3", "W3", "Central District", "వార్డు-3", "वार्ड-3")
        ]
        for cname, ccode, _, cte, chi in const_specs:
            c = Constituency.query.filter_by(name=cname).first()
            if not c:
                c = Constituency(
                    name=cname,
                    name_en=cname,
                    name_te=cte,
                    name_hi=chi,
                    code=ccode,
                    state="Example State",
                    is_active=True
                )
                db.session.add(c)
                db.session.flush()
                print(f"[SEED] Created constituency: {c.name}")
            else:
                c.name_en = c.name_en or cname
                c.name_te = c.name_te or cte
                c.name_hi = c.name_hi or chi
            constituencies_map[cname] = c

        # 1. Admin
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(
                username="admin",
                password_hash=hash_password("AdminSecure2026!"),
                role="ADMIN",
                constituency="HEADQUARTERS"
            )
            db.session.add(admin)
            print("[SEED] Created default admin: admin / AdminSecure2026!")
        else:
            print("[SEED] Admin account 'admin' already exists.")

        # 2. Election
        election = Election.query.filter_by(title="General Assembly Election 2026").first()
        if not election:
            election = Election(
                title="General Assembly Election 2026",
                title_en="General Assembly Election 2026",
                title_te="సార్వత్రిక శాసనసభ ఎన్నికలు 2026",
                title_hi="आम विधानसभा चुनाव 2026",
                description="Constituency-segregated legislative assembly election with quantum-simulated ballot security.",
                description_en="Constituency-segregated legislative assembly election with quantum-simulated ballot security.",
                description_te="క్వాంటమ్-రక్షిత బ్యాలెట్ భద్రతతో నియోజకవర్గాల వారీగా శాసనసభ ఎన్నికలు.",
                description_hi="क्वांटम-सुरक्षित मतपत्र सुरक्षा के साथ निर्वाचन क्षेत्र-वार विधानसभा चुनाव।",
                election_type="State Legislative Assembly",
                election_type_en="State Legislative Assembly",
                election_type_te="రాష్ట్ర శాసనసభ",
                election_type_hi="राज्य विधान सभा",
                state="Example State",
                election_date=date(2026, 10, 15),
                status="OPEN",
                is_active=True
            )
            db.session.add(election)
            db.session.flush()
            print(f"[SEED] Created demo election: {election.title} (ID: {election.id})")
        else:
            election.title_en = election.title_en or "General Assembly Election 2026"
            election.title_te = election.title_te or "సార్వత్రిక శాసనసభ ఎన్నికలు 2026"
            election.title_hi = election.title_hi or "आम विधानसभा चुनाव 2026"
            print(f"[SEED] Demo election exists: {election.title} (Status: {election.status})")

        # 2b. Election Constituency Associations
        for cname, const_obj in constituencies_map.items():
            assoc = ElectionConstituency.query.filter_by(election_id=election.id, constituency_id=const_obj.id).first()
            if not assoc:
                assoc = ElectionConstituency(election_id=election.id, constituency_id=const_obj.id)
                db.session.add(assoc)
                print(f"[SEED] Associated {cname} with election {election.title}")

        # 3. Candidates
        candidates_data = [
            ("Dr. Sarah Rao", "డాక్టర్ సారా రావు", "डॉ. सारा राव", "Progressive Coalition", "ప్రోగ్రెసివ్ కూటమి", "प्रगतिशील गठबंधन", "Ward-1", 1),
            ("K. Venkatesh", "కె. వెంకటేష్", "के. वेंकटेश", "Democratic Alliance", "డెమోక్రటిక్ అలయన్స్", "डेमोक्रेटिक अलायंस", "Ward-1", 2),
            ("A. Narayan", "ఎ. నారాయణ్", "ए. नारायण", "National Front", "నేషనల్ ఫ్రంట్", "नेशनल फ्रंट", "Ward-1", 3),
            ("P. Sundaram", "పి. సుందరం", "पी. सुंदरम", "Green Future Movement", "గ్రీన్ ఫ్యూచర్ ఉద్యమం", "ग्रीन फ्यूचर मूवमेंट", "Ward-2", 1),
            ("M. Lakshmi", "ఎం. లక్ష్మి", "एम. लक्ष्मी", "Civic Union", "సివిక్ యూనియన్", "सिविक यूनियन", "Ward-2", 2),
            ("R. Kulkarni", "ఆర్. కులకర్ణి", "आर. कुलकर्णी", "United People's Party", "యునైటెడ్ పీపుల్స్ పార్టీ", "यूनाइटेड पीपुल्स पार्टी", "Ward-3", 1),
        ]

        candidates_added = 0
        for name, n_te, n_hi, party, p_te, p_hi, const_name, pos in candidates_data:
            const_obj = constituencies_map.get(const_name)
            existing = Candidate.query.filter_by(election_id=election.id, name=name, constituency_id=const_obj.id).first()
            if not existing:
                cand = Candidate(
                    election_id=election.id,
                    constituency_id=const_obj.id,
                    constituency=const_name,
                    name=name,
                    name_en=name,
                    name_te=n_te,
                    name_hi=n_hi,
                    party=party,
                    party_en=party,
                    party_te=p_te,
                    party_hi=p_hi,
                    ballot_position=pos,
                    is_active=True,
                    is_nota=False
                )
                db.session.add(cand)
                candidates_added += 1
            else:
                existing.name_en = existing.name_en or name
                existing.name_te = existing.name_te or n_te
                existing.name_hi = existing.name_hi or n_hi
                existing.party_en = existing.party_en or party
                existing.party_te = existing.party_te or p_te
                existing.party_hi = existing.party_hi or p_hi

        # NOTA Options
        for const_name, const_obj in constituencies_map.items():
            nota_existing = Candidate.query.filter_by(election_id=election.id, constituency_id=const_obj.id, is_nota=True).first()
            if not nota_existing:
                max_pos = Candidate.query.filter_by(election_id=election.id, constituency_id=const_obj.id, is_nota=False).count()
                nota = Candidate(
                    election_id=election.id,
                    constituency_id=const_obj.id,
                    constituency=const_name,
                    name="None of the Above (NOTA)",
                    name_en="None of the Above (NOTA)",
                    name_te="పై వారిలో ఎవరూ కాదు (NOTA)",
                    name_hi="इनमें से कोई नहीं (NOTA)",
                    party="NOTA",
                    party_en="NOTA",
                    party_te="నోటా",
                    party_hi="नोटा",
                    ballot_position=max_pos + 1,
                    is_active=True,
                    is_nota=True
                )
                db.session.add(nota)
                candidates_added += 1
            else:
                nota_existing.name_en = "None of the Above (NOTA)"
                nota_existing.name_te = "పై వారిలో ఎవరూ కాదు (NOTA)"
                nota_existing.name_hi = "इनमें से कोई नहीं (NOTA)"
                nota_existing.party_en = "NOTA"
                nota_existing.party_te = "నోటా"
                nota_existing.party_hi = "नोटा"

        print(f"[SEED] Candidates verified. Added {candidates_added} new candidates.")

        # 4. Synthetic Demo Voters
        voters_data = [
            {
                "username": "voter_alice",
                "voter_id": "VTR-2026-00101",
                "full_name": "Alice Sharma",
                "registered_mobile": "+91 98765 43101",
                "constituency": "Ward-1",
                "password": "Password123!",
                "synthetic_identity_reference": "SYNTH_REF_ALICE_W1"
            },
            {
                "username": "voter_bob",
                "voter_id": "VTR-2026-00102",
                "full_name": "Bob Verma",
                "registered_mobile": "+91 98765 43102",
                "constituency": "Ward-1",
                "password": "Password123!",
                "synthetic_identity_reference": "SYNTH_REF_BOB_W1"
            },
            {
                "username": "voter_charlie",
                "voter_id": "VTR-2026-00201",
                "full_name": "Charlie Patel",
                "registered_mobile": "+91 98765 43201",
                "constituency": "Ward-2",
                "password": "Password123!",
                "synthetic_identity_reference": "SYNTH_REF_CHARLIE_W2"
            },
            {
                "username": "voter_divya",
                "voter_id": "VTR-2026-00301",
                "full_name": "Divya",
                "registered_mobile": "+91 98765 43301",
                "constituency": "Ward-1",
                "password": "Password123!",
                "synthetic_identity_reference": "SYNTH_REF_DIVYA_W1"
            },
            {
                "username": "voter_murthy",
                "voter_id": "VTR-2026-00302",
                "full_name": "Murthy",
                "registered_mobile": "+91 98765 43302",
                "constituency": "Ward-1",
                "password": "Password123!",
                "synthetic_identity_reference": "SYNTH_REF_MURTHY_W1"
            },
            {
                "username": "voter_mahesh",
                "voter_id": "VTR-2026-00303",
                "full_name": "Mahesh",
                "registered_mobile": "+91 98765 43303",
                "constituency": "Ward-2",
                "password": "Password123!",
                "synthetic_identity_reference": "SYNTH_REF_MAHESH_W2"
            },
            {
                "username": "voter_gupta",
                "voter_id": "VTR-2026-00304",
                "full_name": "Gupta",
                "registered_mobile": "+91 98765 43304",
                "constituency": "Ward-3",
                "password": "Password123!",
                "synthetic_identity_reference": "SYNTH_REF_GUPTA_W3"
            },
        ]

        voters_added = 0
        voters_updated = 0
        for vdata in voters_data:
            voter = User.query.filter((User.username == vdata["username"]) | (User.voter_id == vdata["voter_id"])).first()
            if not voter:
                voter = User(
                    username=vdata["username"],
                    password_hash=hash_password(vdata["password"]),
                    role="VOTER",
                    constituency=vdata["constituency"],
                    voter_id=vdata["voter_id"],
                    full_name=vdata["full_name"],
                    registered_mobile=vdata["registered_mobile"],
                    is_active=True,
                    synthetic_identity_reference=vdata["synthetic_identity_reference"]
                )
                db.session.add(voter)
                voters_added += 1
            else:
                voter.voter_id = vdata["voter_id"]
                voter.full_name = vdata["full_name"]
                voter.registered_mobile = vdata["registered_mobile"]
                voter.is_active = True
                voter.synthetic_identity_reference = vdata["synthetic_identity_reference"]
                voter.constituency = vdata["constituency"]
                voters_updated += 1

        print(f"[SEED] Synthetic voters verified. Added: {voters_added}, Updated: {voters_updated}.")

        db.session.commit()
        print("[SEED] Database successfully verified & seeded in PostgreSQL (quantum_evoting_db)!")

if __name__ == "__main__":
    seed()
