"""
Safe, Non-Destructive PostgreSQL Migration for Phase 12.
Preserves all existing data in quantum_evoting_db.
Executes within a transaction with rollback on error.
"""

import sys
import os
import uuid
sys.path.insert(0, os.getcwd())

from backend.app import create_app
from backend.extensions import db
from sqlalchemy import text

def run_migration():
    app = create_app()
    with app.app_context():
        conn = db.session.connection()
        print("=== [PHASE 12 MIGRATION] Starting safe PostgreSQL migration ===")

        # 1. Create constituencies table
        print("[1] Creating 'constituencies' table if not exists...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS constituencies (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                code VARCHAR(20) UNIQUE NOT NULL,
                state VARCHAR(100) NOT NULL DEFAULT 'Example State',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))

        # 2. Seed pre-provisioned constituencies (Ward-1, Ward-2, Ward-3)
        print("[2] Seeding pre-provisioned constituencies...")
        for name, code in [("Ward-1", "W1"), ("Ward-2", "W2"), ("Ward-3", "W3")]:
            conn.execute(text("""
                INSERT INTO constituencies (id, name, code, state, is_active, created_at)
                VALUES (:id, :name, :code, 'Example State', TRUE, NOW())
                ON CONFLICT (name) DO NOTHING;
            """), {"id": str(uuid.uuid4()), "name": name, "code": code})

        # 3. Create election_constituencies association table
        print("[3] Creating 'election_constituencies' association table if not exists...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS election_constituencies (
                id VARCHAR(36) PRIMARY KEY,
                election_id VARCHAR(36) NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
                constituency_id VARCHAR(36) NOT NULL REFERENCES constituencies(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_election_constituency UNIQUE (election_id, constituency_id)
            );
        """))

        # 4. Alter elections table (status, election_type, state, election_date, voting_open_at, voting_close_at)
        print("[4] Extending 'elections' table with authoritative lifecycle status...")
        conn.execute(text("""
            ALTER TABLE elections 
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
                ADD COLUMN IF NOT EXISTS election_type VARCHAR(50) NOT NULL DEFAULT 'State Legislative Assembly',
                ADD COLUMN IF NOT EXISTS state VARCHAR(100) NOT NULL DEFAULT 'Example State',
                ADD COLUMN IF NOT EXISTS election_date DATE,
                ADD COLUMN IF NOT EXISTS voting_open_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS voting_close_at TIMESTAMP WITH TIME ZONE;
        """))

        # Safely migrate existing elections to DRAFT (as strictly requested in Rule 3)
        print("[4b] Setting existing elections to 'DRAFT' and 'is_active = FALSE'...")
        conn.execute(text("""
            UPDATE elections 
            SET status = 'DRAFT', is_active = FALSE
            WHERE status = 'DRAFT' OR status IS NULL;
        """))

        # 5. Populate election_constituencies for all existing elections
        print("[5] Populating election_constituencies for existing elections...")
        elections = conn.execute(text("SELECT id FROM elections")).fetchall()
        constituencies = conn.execute(text("SELECT id FROM constituencies")).fetchall()
        for el in elections:
            for c in constituencies:
                conn.execute(text("""
                    INSERT INTO election_constituencies (id, election_id, constituency_id, created_at)
                    VALUES (:id, :el_id, :c_id, NOW())
                    ON CONFLICT (election_id, constituency_id) DO NOTHING;
                """), {"id": str(uuid.uuid4()), "el_id": el[0], "c_id": c[0]})

        # 6. Alter candidates table: constituency_id, ballot_position, is_active, is_nota
        print("[6] Extending 'candidates' table...")
        conn.execute(text("""
            ALTER TABLE candidates 
                ADD COLUMN IF NOT EXISTS constituency_id VARCHAR(36),
                ADD COLUMN IF NOT EXISTS ballot_position INTEGER NOT NULL DEFAULT 1,
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS is_nota BOOLEAN NOT NULL DEFAULT FALSE;
        """))

        # 7. Backfill candidates.constituency_id from constituencies table matching name
        print("[7] Backfilling candidates.constituency_id...")
        conn.execute(text("""
            UPDATE candidates c
            SET constituency_id = const.id
            FROM constituencies const
            WHERE c.constituency = const.name AND c.constituency_id IS NULL;
        """))

        # Verify zero unmatched candidates
        unmatched = conn.execute(text("SELECT COUNT(*) FROM candidates WHERE constituency_id IS NULL")).scalar()
        print(f"[7b] Verification: Unmatched candidates count = {unmatched}")
        if unmatched > 0:
            raise RuntimeError(f"Found {unmatched} candidates with unmatched constituency!")

        # Enforce NOT NULL and FK ON DELETE RESTRICT on candidates.constituency_id
        print("[8] Enforcing NOT NULL and ON DELETE RESTRICT foreign key on candidates.constituency_id...")
        conn.execute(text("""
            ALTER TABLE candidates 
                ALTER COLUMN constituency_id SET NOT NULL;
        """))

        # Check if FK already exists before creating
        existing_fks = conn.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'candidates' AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'candidates_constituency_id_fkey';
        """)).fetchall()
        if not existing_fks:
            conn.execute(text("""
                ALTER TABLE candidates
                    ADD CONSTRAINT candidates_constituency_id_fkey 
                    FOREIGN KEY (constituency_id) REFERENCES constituencies(id) ON DELETE RESTRICT;
            """))

        # Update candidate ballot positions partitioned by (election_id, constituency_id)
        print("[9] Deterministically assigning ballot_position for existing candidates...")
        conn.execute(text("""
            WITH ranked AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY election_id, constituency_id ORDER BY name) as pos
                FROM candidates
                WHERE is_nota = FALSE
            )
            UPDATE candidates
            SET ballot_position = ranked.pos
            FROM ranked
            WHERE candidates.id = ranked.id;
        """))

        # Add constraints on candidates: ballot_position > 0, UNIQUE(election_id, constituency_id, ballot_position)
        print("[10] Adding candidate uniqueness and positive ballot position constraints...")
        # Check if check constraint exists
        chk_exists = conn.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'candidates' AND constraint_type = 'CHECK' AND constraint_name = 'chk_candidate_ballot_position_positive';
        """)).fetchall()
        if not chk_exists:
            conn.execute(text("""
                ALTER TABLE candidates
                    ADD CONSTRAINT chk_candidate_ballot_position_positive
                    CHECK (ballot_position > 0);
            """))

        # Drop old UQ on (election_id, name, constituency) if it exists, or keep it, and add unique on (election_id, constituency_id, ballot_position)
        uq_exists = conn.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'candidates' AND constraint_type = 'UNIQUE' AND constraint_name = 'uq_candidate_election_constituency_position';
        """)).fetchall()
        if not uq_exists:
            conn.execute(text("""
                ALTER TABLE candidates
                    ADD CONSTRAINT uq_candidate_election_constituency_position
                    UNIQUE (election_id, constituency_id, ballot_position);
            """))

        # 11. Provision NOTA for each (election, constituency)
        print("[11] Provisioning NOTA options for each participating constituency...")
        el_consts = conn.execute(text("""
            SELECT ec.election_id, ec.constituency_id, c.name
            FROM election_constituencies ec
            JOIN constituencies c ON ec.constituency_id = c.id
        """)).fetchall()

        for el_id, c_id, c_name in el_consts:
            nota_exists = conn.execute(text("""
                SELECT id FROM candidates 
                WHERE election_id = :el_id AND constituency_id = :c_id AND is_nota = TRUE
            """), {"el_id": el_id, "c_id": c_id}).first()

            if not nota_exists:
                max_pos = conn.execute(text("""
                    SELECT COALESCE(MAX(ballot_position), 0) FROM candidates
                    WHERE election_id = :el_id AND constituency_id = :c_id
                """), {"el_id": el_id, "c_id": c_id}).scalar()

                conn.execute(text("""
                    INSERT INTO candidates (id, election_id, constituency_id, constituency, name, party, ballot_position, is_active, is_nota)
                    VALUES (:id, :el_id, :c_id, :c_name, 'None of the Above (NOTA)', 'NOTA', :pos, TRUE, TRUE)
                """), {
                    "id": str(uuid.uuid4()),
                    "el_id": el_id,
                    "c_id": c_id,
                    "c_name": c_name,
                    "pos": max_pos + 1
                })

        db.session.commit()
        print("=== [PHASE 12 MIGRATION] Migration committed successfully! ===")

if __name__ == "__main__":
    run_migration()
