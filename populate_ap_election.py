"""
Seeds the official Andhra Pradesh Assembly Election with 24 constituencies
(9 Vizianagaram + 15 Visakhapatnam) with genuine candidate rosters and NOTA.
"""
from datetime import date
from backend.app import create_app
from backend.extensions import db
from backend.models.election import Election
from backend.models.constituency import Constituency
from backend.models.candidate import Candidate
from backend.models.election_constituency import ElectionConstituency
from backend.models.user import User

def populate():
    app = create_app()
    with app.app_context():
        # 1. Create or get AP Legislative Assembly Election 2024
        title = "Andhra Pradesh Legislative Assembly Election 2024"
        election = Election.query.filter_by(title=title).first()
        if not election:
            election = Election(
                title=title,
                title_en=title,
                title_te="ఆంధ్రప్రదేశ్ శాసనసభ ఎన్నికలు 2024",
                title_hi="आंध्र प्रदेश विधानसभा चुनाव 2024",
                description="General Assembly Elections across Andhra Pradesh Legislative Assembly with post-quantum biometric balloting.",
                description_en="General Assembly Elections across Andhra Pradesh Legislative Assembly with post-quantum biometric balloting.",
                description_te="క్వాంటమ్-రక్షిత బ్యాలెట్ భద్రతతో ఆంధ్రప్రదేశ్ శాసనసభ సాధారణ ఎన్నికలు.",
                description_hi="क्वांटम-सुरक्षित मतपत्र सुरक्षा के साथ आंध्र प्रदेश विधानसभा आम चुनाव।",
                election_type="State Legislative Assembly",
                election_type_en="State Legislative Assembly",
                election_type_te="రాష్ట్ర శాసనసభ",
                election_type_hi="राज्य विधान सभा",
                state="Andhra Pradesh",
                election_date=date(2024, 5, 13),
                status="OPEN",
                is_active=True
            )
            db.session.add(election)
            db.session.flush()
            print(f"[ELECTION] Created active election: {election.title} (ID: {election.id})")
        else:
            election.status = "OPEN"
            election.is_active = True
            db.session.flush()
            print(f"[ELECTION] Found existing election: {election.title}")

        # 2. Roster for 24 constituencies
        roster = [
            # Vizianagaram District (9 Constituencies)
            ("Bobbili", [
                ("R. V. S. K. K. Ranga Rao (Baby Nayana)", "TDP / NDA Alliance"),
                ("Venkata China Appala Naidu Sambangi", "YSRCP"),
                ("Maripi Vidyasagar (Vinay)", "INC"),
            ]),
            ("Cheepurupalli", [
                ("Kimidi Kalavenkata Rao", "TDP / NDA Alliance"),
                ("Botcha Satyanarayana", "YSRCP"),
                ("Aadinarayana Jammu", "INC"),
            ]),
            ("Gajapathinagaram", [
                ("Kondapalli Srinivas", "TDP / NDA Alliance"),
                ("Botcha Appalanarasayya", "YSRCP"),
                ("Dola Srinivas", "INC"),
            ]),
            ("Kurupam (ST)", [
                ("Jagadeeswari Thoyaka", "TDP / NDA Alliance"),
                ("Pamula Pushpa Sreevani", "YSRCP"),
                ("Mandangi Ramana", "CPI(M)"),
            ]),
            ("Nellimarla", [
                ("Lokam Naga Madhavi", "Janasena Party / NDA Alliance"),
                ("Appalanaidu Baddukonda", "YSRCP"),
                ("Saragada Ramesh Kumar", "INC"),
            ]),
            ("Parvathipuram (SC)", [
                ("Bonela Vijaya Chandra", "TDP / NDA Alliance"),
                ("Alajangi Jogarao", "YSRCP"),
                ("Bathina Mohanarao", "INC"),
            ]),
            ("Salur (ST)", [
                ("Gummidi Sandhyarani", "TDP / NDA Alliance"),
                ("Peedika Rajanna Dora", "YSRCP"),
                ("Muvvala Pushparao", "INC"),
            ]),
            ("Srungavarapukota", [
                ("Kolla Lalitha Kumari", "TDP / NDA Alliance"),
                ("Kadubandi Srinivasa Rao", "YSRCP"),
                ("Gedela Tirupati", "INC"),
            ]),
            ("Vizianagaram", [
                ("Aditi Vijayalakshmi Gajapathi Raju Pusapati", "TDP / NDA Alliance"),
                ("Kolagatla Veerabhadra Swamy", "YSRCP"),
                ("Satish Kumar Sunkari", "INC"),
            ]),

            # Visakhapatnam District (15 Constituencies)
            ("Anakapalle", [
                ("Konathala Ramakrishna", "Janasena Party / NDA Alliance"),
                ("Malasala Bharath Kumar", "YSRCP"),
                ("Illa Rama Gangadhara Rao", "INC"),
            ]),
            ("Araku Valley (ST)", [
                ("Regam Matyalingam", "YSRCP"),
                ("Rajarao Pangi", "BJP / NDA Alliance"),
                ("Gangadharaswami Setty", "INC"),
            ]),
            ("Bhimili", [
                ("Ganta Srinivasa Rao", "TDP / NDA Alliance"),
                ("Muttamsetti Srinivasa Rao (Avanthi Srinivas)", "YSRCP"),
                ("Addala Venkata Varma Raju", "INC"),
            ]),
            ("Chodavaram", [
                ("Surya Naga Sanyasi Raju Kalidindi", "TDP / NDA Alliance"),
                ("Karanam Dharmasri", "YSRCP"),
                ("Jagata Srinivasurao", "INC"),
            ]),
            ("Gajuwaka", [
                ("Palla Srinivasa Rao Yadav", "TDP / NDA Alliance"),
                ("Amarnath Gudivada", "YSRCP"),
                ("Maradana Jaggunaidu", "CPI(M)"),
            ]),
            ("Madugula", [
                ("Bandaru Satyanarayana Murthy", "TDP / NDA Alliance"),
                ("Anuradha Erli", "YSRCP"),
                ("Boddu Srinivasa", "INC"),
            ]),
            ("Narsipatnam", [
                ("Ayyannapatrudu Chintakayala", "TDP / NDA Alliance"),
                ("Uma Sankara Ganesh Petla", "YSRCP"),
                ("Ruthala Srirama Murthy", "INC"),
            ]),
            ("Paderu (ST)", [
                ("Matsyarasa Visweswara Raju", "YSRCP"),
                ("Eswari Giddi", "TDP / NDA Alliance"),
                ("Bullibabu Sataka", "INC"),
            ]),
            ("Payakaraopet (SC)", [
                ("Anitha Vangalapudi", "TDP / NDA Alliance"),
                ("Jogulu Kambala", "YSRCP"),
                ("Dr. Boni Tata Rao", "INC"),
            ]),
            ("Pendurthi", [
                ("Panchakarla Ramesh Babu", "Janasena Party / NDA Alliance"),
                ("Annamreddy Adeep Raj", "YSRCP"),
                ("Bhagat Piridi", "INC"),
            ]),
            ("Visakhapatnam East", [
                ("Velagapudi Ramakrishna Babu", "TDP / NDA Alliance"),
                ("M. V. V. Satyanarayana", "YSRCP"),
                ("Guthula Srinivas Rao", "INC"),
            ]),
            ("Visakhapatnam North", [
                ("Penmetsa Vishnu Kumar Raju", "BJP / NDA Alliance"),
                ("Kammila Kannaparaju", "YSRCP"),
                ("Lakkaraju Rama Rao", "INC"),
            ]),
            ("Visakhapatnam South", [
                ("Vamsi Krishna Srinivas Yadav", "Janasena Party / NDA Alliance"),
                ("Vasupalli Ganesh Kumar", "YSRCP"),
                ("Vasupalli Santosh", "INC"),
            ]),
            ("Visakhapatnam West", [
                ("P. G. V. R. Naidu (Gana Babu)", "TDP / NDA Alliance"),
                ("Adari Anand Kumar", "YSRCP"),
                ("Attili Vimala", "CPI"),
            ]),
            ("Yelamanchili", [
                ("Sundarapu Vijay Kumar", "Janasena Party / NDA Alliance"),
                ("Uppalapati Venkata Ramanamurthy Raju", "YSRCP"),
                ("Anantha Rama Narasingarao Thanakala", "INC"),
            ]),
        ]

        total_candidates = 0
        total_notas = 0
        for cname, candidates in roster:
            const_obj = Constituency.query.filter_by(name=cname).first()
            if not const_obj:
                print(f"[WARN] Constituency '{cname}' not found. Skipping.")
                continue

            # Ensure constituency association with election
            assoc = ElectionConstituency.query.filter_by(
                election_id=election.id, constituency_id=const_obj.id
            ).first()
            if not assoc:
                assoc = ElectionConstituency(election_id=election.id, constituency_id=const_obj.id)
                db.session.add(assoc)
                db.session.flush()

            # Clean any old candidates for this election & constituency
            Candidate.query.filter_by(
                election_id=election.id, constituency_id=const_obj.id
            ).delete()
            db.session.flush()

            # Add the 3 named candidates
            pos = 1
            for cand_name, party in candidates:
                cand = Candidate(
                    election_id=election.id,
                    constituency_id=const_obj.id,
                    constituency=cname,
                    name=cand_name,
                    name_en=cand_name,
                    party=party,
                    party_en=party,
                    ballot_position=pos,
                    is_active=True,
                    is_nota=False
                )
                db.session.add(cand)
                pos += 1
                total_candidates += 1

            # Add NOTA option as ballot position 4
            nota = Candidate(
                election_id=election.id,
                constituency_id=const_obj.id,
                constituency=cname,
                name="None of the Above (NOTA)",
                name_en="None of the Above (NOTA)",
                name_te="పై వారిలో ఎవరూ కాదు (NOTA)",
                name_hi="इनमें से कोई नहीं (NOTA)",
                party="NOTA",
                party_en="NOTA",
                party_te="నోటా",
                party_hi="नोटा",
                ballot_position=pos,
                is_active=True,
                is_nota=True
            )
            db.session.add(nota)
            total_notas += 1

        # 3. Map demo voters to these AP constituencies so they can directly vote!
        voter_map = {
            "voter_divya": "Bhimili",
            "voter_murthy": "Bobbili",
            "voter_mahesh": "Gajuwaka",
            "voter_gupta": "Anakapalle",
            "voter_tarun": "Visakhapatnam East",
            "voter_aswin": "Visakhapatnam North",
        }
        for uname, cname in voter_map.items():
            u = User.query.filter_by(username=uname).first()
            if u:
                u.constituency = cname

        db.session.commit()
        print(f"[DONE] Successfully populated election '{election.title}':")
        print(f"       Constituencies linked: {len(roster)}")
        print(f"       Candidates added: {total_candidates}")
        print(f"       NOTA options added: {total_notas}")
        print(f"       Total choices on ballots: {total_candidates + total_notas}")

if __name__ == "__main__":
    populate()

