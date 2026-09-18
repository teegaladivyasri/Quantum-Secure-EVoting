"""
Migration script to add localized multilingual columns to PostgreSQL database:
- candidates: name_en, name_te, name_hi, party_en, party_te, party_hi
- constituencies: name_en, name_te, name_hi
- elections: title_en, title_te, title_hi, description_en, description_te, description_hi, election_type_en, election_type_te, election_type_hi
And backfills synthetic localized demo data.
"""

from backend.app import create_app
from backend.extensions import db

TRANSLATION_MAP = {
    # Candidates
    "Dr. Sarah Rao": {"te": "డాక్టర్ సారా రావు", "hi": "डॉ. सारा राव"},
    "K. Venkatesh": {"te": "కె. వెంకటేష్", "hi": "के. वेंकटेश"},
    "A. Narayan": {"te": "ఎ. నారాయణ్", "hi": "ए. नारायण"},
    "P. Sundaram": {"te": "పి. సుందరం", "hi": "पी. सुंदरम"},
    "M. Lakshmi": {"te": "ఎం. లక్ష్మి", "hi": "एम. लक्ष्मी"},
    "R. Kulkarni": {"te": "ఆర్. కులకర్ణి", "hi": "आर. कुलकर्णी"},
    "Ananya Rao": {"te": "అనన్య రావు", "hi": "अनन्या राव"},
    "Ravi Kumar": {"te": "రవి కుమార్", "hi": "रवि कुमार"},
    "Meera Das": {"te": "మీరా దాస్", "hi": "मीरा दास"},
    "Arjun Patel": {"te": "అర్జున్ పటేల్", "hi": "अर्जुन पटेल"},
    "Kavya Singh": {"te": "కావ్య సింగ్", "hi": "काव्या सिंह"},
    "Suresh Nair": {"te": "సురేష్ నాయర్", "hi": "सुरेश नायर"},
    "Priya Sharma": {"te": "ప్రియా శర్మ", "hi": "प्रिया शर्मा"},
    "Vikram Reddy": {"te": "విక్రమ్ రెడ్డి", "hi": "विक्रम रेड्डी"},
    "Neha Joseph": {"te": "నేహా జోసెఫ్", "hi": "नेहा जोसेफ"},
    "None of the Above (NOTA)": {"te": "పై వారిలో ఎవరూ కాదు (NOTA)", "hi": "इनमें से कोई नहीं (NOTA)"},
    "Himesh": {"te": "హిమేష్", "hi": "हिमेश"},
    "KA Paul": {"te": "కె.ఎ. పాల్", "hi": "के.ए. पॉल"},

    # Parties
    "Progressive Coalition": {"te": "ప్రోగ్రెసివ్ కూటమి", "hi": "प्रगतिशील गठबंधन"},
    "Democratic Alliance": {"te": "డెమోక్రటిక్ అలయన్స్", "hi": "डेमोक्रेटिक अलायंस"},
    "National Front": {"te": "నేషనల్ ఫ్రంట్", "hi": "नेशनल फ्रंट"},
    "Green Future Movement": {"te": "గ్రీన్ ఫ్యూచర్ ఉద్యమం", "hi": "ग्रीन फ्यूचर मूवमेंट"},
    "Civic Union": {"te": "సివిక్ యూనియన్", "hi": "सिविक यूनियन"},
    "United People's Party": {"te": "యునైటెడ్ పీపుల్స్ పార్టీ", "hi": "यूनाइटेड पीपुल्स पार्टी"},
    "People's Party": {"te": "పీపుల్స్ పార్టీ", "hi": "पीपुल्स पार्टी"},
    "People’s Party": {"te": "పీపుల్స్ పార్టీ", "hi": "पीपुल्स पार्टी"},
    "National Party": {"te": "నేషనల్ పార్టీ", "hi": "नेशनल पार्टी"},
    "Independent": {"te": "స్వతంత్ర అభ్యర్థి", "hi": "स्वतंत्र उम्मीदवार"},
    "NOTA": {"te": "నోటా", "hi": "नोटा"},
    "JJ": {"te": "జేజే", "hi": "जेजे"},
    "MKL": {"te": "ఎంకేఎల్", "hi": "एमकेएल"},

    # Constituencies
    "Ward-1": {"te": "వార్డు-1", "hi": "वार्ड-1"},
    "Ward-2": {"te": "వార్డు-2", "hi": "वार्ड-2"},
    "Ward-3": {"te": "వార్డు-3", "hi": "वार्ड-3"},
    "HEADQUARTERS": {"te": "ప్రధాన కార్యాలయం", "hi": "मुख्यालय"},

    # Elections
    "General Assembly Election 2026": {"te": "సార్వత్రిక శాసనసభ ఎన్నికలు 2026", "hi": "आम विधानसभा चुनाव 2026"},
    "Constituency-segregated legislative assembly election with quantum-simulated ballot security.": {
        "te": "క్వాంటమ్-రక్షిత బ్యాలెట్ భద్రతతో నియోజకవర్గాల వారీగా శాసనసభ ఎన్నికలు.",
        "hi": "क्वांटम-सुरक्षित मतपत्र सुरक्षा के साथ निर्वाचन क्षेत्र-वार विधानसभा चुनाव।"
    },
    "State Legislative Assembly": {"te": "రాష్ట్ర శాసనసభ", "hi": "राज्य विधान सभा"},
    "Panchayat elections": {"te": "పంచాయతీ ఎన్నికలు", "hi": "पंचायत चुनाव"},
    "State Elections": {"te": "రాష్ట్ర ఎన్నికలు", "hi": "राज्य चुनाव"},
    "E2E Live Assembly Election 2026": {"te": "సార్వత్రిక శాసనసభ ఎన్నికలు 2026", "hi": "आम विधानसभा चुनाव 2026"}
}

def run_migration():
    app = create_app()
    with app.app_context():
        print("=== Migrating Multilingual Schema ===")
        with db.engine.connect() as conn:
            # 1. Candidates columns
            conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);"))
            conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS name_te VARCHAR(255);"))
            conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS name_hi VARCHAR(255);"))
            conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS party_en VARCHAR(255);"))
            conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS party_te VARCHAR(255);"))
            conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS party_hi VARCHAR(255);"))

            # 2. Constituencies columns
            conn.execute(db.text("ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS name_en VARCHAR(100);"))
            conn.execute(db.text("ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS name_te VARCHAR(100);"))
            conn.execute(db.text("ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS name_hi VARCHAR(100);"))

            # 3. Elections columns
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS title_en VARCHAR(255);"))
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS title_te VARCHAR(255);"))
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS title_hi VARCHAR(255);"))
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS description_en TEXT;"))
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS description_te TEXT;"))
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS description_hi TEXT;"))
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS election_type_en VARCHAR(100);"))
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS election_type_te VARCHAR(100);"))
            conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS election_type_hi VARCHAR(100);"))
            conn.commit()
            print("[DB] Columns successfully added or already present.")

        # 4. Backfill Candidates
        from backend.models.candidate import Candidate
        candidates = Candidate.query.all()
        for cand in candidates:
            cand_name = cand.name.strip()
            cand_party = cand.party.strip()

            # Name translations
            cand.name_en = cand.name_en or cand_name
            if not cand.name_te:
                cand.name_te = TRANSLATION_MAP.get(cand_name, {}).get("te", cand_name)
            if not cand.name_hi:
                cand.name_hi = TRANSLATION_MAP.get(cand_name, {}).get("hi", cand_name)

            # Party translations
            cand.party_en = cand.party_en or cand_party
            if not cand.party_te:
                cand.party_te = TRANSLATION_MAP.get(cand_party, {}).get("te", cand_party)
            if not cand.party_hi:
                cand.party_hi = TRANSLATION_MAP.get(cand_party, {}).get("hi", cand_party)

        # 5. Backfill Constituencies
        from backend.models.constituency import Constituency
        constituencies = Constituency.query.all()
        for const in constituencies:
            cname = const.name.strip()
            const.name_en = const.name_en or cname
            if not const.name_te:
                const.name_te = TRANSLATION_MAP.get(cname, {}).get("te", cname)
            if not const.name_hi:
                const.name_hi = TRANSLATION_MAP.get(cname, {}).get("hi", cname)

        # 6. Backfill Elections
        from backend.models.election import Election
        elections = Election.query.all()
        for el in elections:
            title = el.title.strip() if el.title else ""
            desc = el.description.strip() if el.description else ""
            etype = el.election_type.strip() if el.election_type else "State Legislative Assembly"

            el.title_en = el.title_en or title
            if not el.title_te:
                el.title_te = TRANSLATION_MAP.get(title, {}).get("te", title)
            if not el.title_hi:
                el.title_hi = TRANSLATION_MAP.get(title, {}).get("hi", title)

            el.description_en = el.description_en or desc
            if not el.description_te:
                el.description_te = TRANSLATION_MAP.get(desc, {}).get("te", desc)
            if not el.description_hi:
                el.description_hi = TRANSLATION_MAP.get(desc, {}).get("hi", desc)

            el.election_type_en = el.election_type_en or etype
            if not el.election_type_te:
                el.election_type_te = TRANSLATION_MAP.get(etype, {}).get("te", etype)
            if not el.election_type_hi:
                el.election_type_hi = TRANSLATION_MAP.get(etype, {}).get("hi", etype)

        db.session.commit()
        print(f"[DB] Backfilled {len(candidates)} candidates, {len(constituencies)} constituencies, {len(elections)} elections.")
        print("=== Migration Completed Successfully ===")

if __name__ == "__main__":
    run_migration()
