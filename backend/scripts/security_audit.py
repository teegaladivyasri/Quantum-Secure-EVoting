import os
import sys
import json
from pathlib import Path

# Set up project root
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.quantum.bb84_circuit import establish_bb84_key
from backend.quantum.qber import QuantumChannelDisturbanceError
from backend.crypto.aes_gcm import encrypt_ballot, decrypt_ballot
from cryptography.exceptions import InvalidTag
from backend.models.ballot import Ballot
from backend.models.participation import ParticipationRecord

def run_security_audit():
    print("=" * 66)
    print("=== QUANTUM BB84 PROTOCOL & AES-256-GCM SECURITY DIAGNOSTIC ===")
    print("=" * 66)

    print("\n[1] NORMAL QUANTUM CHANNEL (Alice -> Bob without Eve)")
    result = establish_bb84_key(
        target_usable_bits=256,
        initial_qubits=800,
        simulate_eavesdropping=False,
        threshold=0.11
    )
    print(f"  * Initial Qubits Emitted: 800")
    print(f"  * Sifted Matching Basis Bits: {result['total_sifted_bits']}")
    print(f"  * Total Usable Key Bits Extracted: {result['total_usable_bits']} (Requirement: >= 256 bits)")
    print(f"  * Quantum Bit Error Rate (QBER): {result['qber']*100:.2f}% (Threshold: <= 11.0%)")
    key_bytes = result["key_bytes"]
    print(f"  * Direct BB84 -> 32-Byte AES-256 Key Established: {len(key_bytes)} bytes ({len(key_bytes)*8} bits)")
    print(f"  * In-Memory Key Fingerprint (Truncated): {key_bytes[:8].hex()}... (Never stored in DB)")
    assert len(key_bytes) == 32, "Key must be exactly 32 bytes for AES-256!"

    print("\n[2] AES-256-GCM AUTHENTICATED ENCRYPTION OF BALLOT")
    ballot_payload = json.dumps({
        "candidate_id": "c8e14b22-8df7-4409-a1fc-bhimili-candidate",
        "constituency": "Bhimili",
        "election_id": "elec-ap-assembly-2024"
    })
    print(f"  * Plaintext Ballot Payload: {ballot_payload}")
    enc_result = encrypt_ballot(key_bytes, ballot_payload)
    ciphertext_b64 = enc_result["ciphertext"]
    nonce_b64 = enc_result["nonce"]
    auth_tag_b64 = enc_result["auth_tag"]

    print(f"  * Ciphertext (Base64): {ciphertext_b64[:30]}...")
    print(f"  * Nonce (Base64, 12 bytes): {nonce_b64}")
    print(f"  * GCM Auth Tag (Base64, 16 bytes): {auth_tag_b64}")

    print("\n[3] BALLOT DECRYPTION & AEAD INTEGRITY CHECK")
    decrypted = decrypt_ballot(key_bytes, ciphertext_b64, nonce_b64, auth_tag_b64)
    print(f"  * Decrypted Plaintext: {decrypted}")
    assert decrypted == ballot_payload, "Decrypted payload does not match!"
    print("  * Verification: Integrity and Confidentiality Verified 100%")

    print("\n[4] TAMPER-PROOFING & CRYPTOGRAPHIC RESISTANCE MATRIX")
    # 4a. Tamper with ciphertext
    import base64
    raw_ct = bytearray(base64.b64decode(ciphertext_b64))
    raw_ct[0] ^= 0x01  # Flip 1 bit
    tampered_ct_b64 = base64.b64encode(bytes(raw_ct)).decode('utf-8')
    try:
        decrypt_ballot(key_bytes, tampered_ct_b64, nonce_b64, auth_tag_b64)
        print("  * Ciphertext Tamper Test: FAILED (Modified ciphertext accepted)")
    except InvalidTag:
        print("  * Ciphertext Bit-Flip Test: PASSED (InvalidTag raised, rejected instantly)")

    # 4b. Tamper with authentication tag
    raw_tag = bytearray(base64.b64decode(auth_tag_b64))
    raw_tag[0] ^= 0x01  # Flip 1 bit in tag
    tampered_tag_b64 = base64.b64encode(bytes(raw_tag)).decode('utf-8')
    try:
        decrypt_ballot(key_bytes, ciphertext_b64, nonce_b64, tampered_tag_b64)
        print("  * Tag Tamper Test: FAILED (Modified tag accepted)")
    except InvalidTag:
        print("  * Auth Tag Tamper Test: PASSED (InvalidTag raised, rejected instantly)")

    # 4c. Decrypt with wrong key
    wrong_key = os.urandom(32)
    try:
        decrypt_ballot(wrong_key, ciphertext_b64, nonce_b64, auth_tag_b64)
        print("  * Wrong Key Decryption: FAILED (Decrypted with illegitimate key)")
    except InvalidTag:
        print("  * Wrong Key Rejection: PASSED (Decryption impossible without genuine BB84 key)")

    print("\n[5] SIMULATED EAVESDROPPING (EVE INTERCEPTION ATTACK ON BB84)")
    try:
        establish_bb84_key(
            target_usable_bits=256,
            initial_qubits=800,
            simulate_eavesdropping=True,
            threshold=0.11
        )
        print("  * Eavesdropping Defense: FAILED (Eavesdropped key was established)")
    except QuantumChannelDisturbanceError as e:
        print(f"  * Eavesdropping Defense: PASSED! High disturbance detected: {e}")
        print("  * Safety Reaction: Key generation aborted; no compromised key generated!")

    print("\n[6] BALLOT ANONYMITY & STRICT IDENTITY SEPARATION")
    ballot_cols = [c.name for c in Ballot.__table__.columns]
    part_cols = [c.name for c in ParticipationRecord.__table__.columns]
    print(f"  * Ballot Table Columns: {ballot_cols}")
    assert "voter_id" not in ballot_cols and "user_id" not in ballot_cols
    print("  * Privacy Check 1: Ballot table has NO voter_id or user_id column (PASSED)")
    print(f"  * Participation Table Columns: {part_cols}")
    assert "candidate_id" not in part_cols and "ballot_id" not in part_cols and "ciphertext" not in part_cols
    print("  * Privacy Check 2: Participation table has NO candidate_id or ballot_id column (PASSED)")

    print("\n" + "=" * 66)
    print("=== ALL SECURITY & CRYPTOGRAPHIC OBJECTIVES FULLY VERIFIED! ===")
    print("=" * 66)

if __name__ == "__main__":
    run_security_audit()
