"""
Phase 4 Revision Cryptographic Tests
Verifies:
1. Direct bit-to-byte conversion (256 bits -> 32 bytes) without HKDF or hashing
2. Exactly 256 bits required; < 256 bits rejected
3. Invalid bit values rejected
4. AES-256-GCM round trip with directly constructed 32-byte key
5. Tampered ciphertext rejection (InvalidTag)
6. Tampered authentication tag rejection (InvalidTag)
7. Incorrect key rejection (InvalidTag)
8. Cryptographic parameters: 12-byte nonce, 16-byte auth tag
9. Verification that HKDF is not in the active cryptographic path
"""
import base64
import pytest
from cryptography.exceptions import InvalidTag
from backend.crypto.key_conversion import bits_to_bytes_256
from backend.crypto.aes_gcm import encrypt_ballot, decrypt_ballot
from backend.crypto import kdf as deprecated_kdf


def test_direct_bits_to_bytes_conversion():
    """Verify exactly 256 bits convert directly into exactly 32 bytes without KDF/hashing."""
    # Pattern of alternating 0 and 1: 0b10101010 = 0xAA = 170
    bits = [1, 0, 1, 0, 1, 0, 1, 0] * 32  # exactly 256 bits
    key = bits_to_bytes_256(bits)
    assert len(key) == 32
    assert key == b"\xAA" * 32

    # Deterministic packing
    assert bits_to_bytes_256(bits) == key


def test_insufficient_bits_rejected():
    """Verify fewer than 256 bits raises ValueError."""
    short_bits = [1] * 255
    with pytest.raises(ValueError) as exc_info:
        bits_to_bytes_256(short_bits)
    assert "at least 256 usable bits are required" in str(exc_info.value)


def test_invalid_bits_rejected():
    """Verify bits other than 0 or 1 raise ValueError."""
    invalid_bits = [0] * 255 + [2]
    with pytest.raises(ValueError) as exc_info:
        bits_to_bytes_256(invalid_bits)
    assert "Invalid bit at position 255" in str(exc_info.value)


def test_aes_gcm_with_direct_bb84_key():
    """Verify AES-256-GCM encryption and decryption roundtrip using directly converted key."""
    # Generate 256 sample bits
    bits = ([1, 1, 0, 0, 1, 0, 1, 0] * 32)
    key = bits_to_bytes_256(bits)
    assert len(key) == 32

    plaintext = '{"candidate_id": "c983a450-48bf-4c74-a029-9e8020e98030"}'
    encrypted = encrypt_ballot(key, plaintext)

    assert "ciphertext" in encrypted
    assert "nonce" in encrypted
    assert "auth_tag" in encrypted

    # Check nonce (12 bytes) and auth tag (16 bytes)
    nonce_bytes = base64.b64decode(encrypted["nonce"])
    tag_bytes = base64.b64decode(encrypted["auth_tag"])
    assert len(nonce_bytes) == 12
    assert len(tag_bytes) == 16

    decrypted = decrypt_ballot(
        key=key,
        ciphertext_b64=encrypted["ciphertext"],
        nonce_b64=encrypted["nonce"],
        auth_tag_b64=encrypted["auth_tag"]
    )
    assert decrypted == plaintext


def test_tampered_ciphertext_fails_integrity():
    """Verify tampering a single bit of ciphertext fails authentication."""
    key = b"B" * 32
    plaintext = '{"candidate_id": "real-candidate"}'
    encrypted = encrypt_ballot(key, plaintext)

    raw_ct = bytearray(base64.b64decode(encrypted["ciphertext"]))
    raw_ct[0] ^= 0xFF  # Flip bits in ciphertext
    tampered_ct_b64 = base64.b64encode(raw_ct).decode("utf-8")

    with pytest.raises(InvalidTag):
        decrypt_ballot(
            key=key,
            ciphertext_b64=tampered_ct_b64,
            nonce_b64=encrypted["nonce"],
            auth_tag_b64=encrypted["auth_tag"]
        )


def test_tampered_auth_tag_fails_integrity():
    """Verify tampering authentication tag fails authentication."""
    key = b"C" * 32
    plaintext = '{"candidate_id": "real-candidate"}'
    encrypted = encrypt_ballot(key, plaintext)

    raw_tag = bytearray(base64.b64decode(encrypted["auth_tag"]))
    raw_tag[0] ^= 0xFF  # Flip bits in tag
    tampered_tag_b64 = base64.b64encode(raw_tag).decode("utf-8")

    with pytest.raises(InvalidTag):
        decrypt_ballot(
            key=key,
            ciphertext_b64=encrypted["ciphertext"],
            nonce_b64=encrypted["nonce"],
            auth_tag_b64=tampered_tag_b64
        )


def test_incorrect_key_fails_decryption():
    """Verify wrong AES key fails authentication."""
    key1 = b"1" * 32
    key2 = b"2" * 32
    plaintext = '{"candidate_id": "real-candidate"}'
    encrypted = encrypt_ballot(key1, plaintext)

    with pytest.raises(InvalidTag):
        decrypt_ballot(
            key=key2,
            ciphertext_b64=encrypted["ciphertext"],
            nonce_b64=encrypted["nonce"],
            auth_tag_b64=encrypted["auth_tag"]
        )


def test_hkdf_removed_from_active_cryptography():
    """Verify HKDF is deprecated and not callable in active architecture."""
    with pytest.raises(NotImplementedError) as exc_info:
        deprecated_kdf.derive_256bit_aes_key([1] * 256)
    assert "HKDF has been removed from the active architecture" in str(exc_info.value)
