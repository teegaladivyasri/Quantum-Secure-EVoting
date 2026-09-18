"""
DEPRECATED / REMOVED FROM ACTIVE ARCHITECTURE

Notice:
Per Phase 4 Revision, HKDF has been removed from the active cryptographic pipeline.
The project directly constructs a 32-byte AES-256 key from exactly 256 usable
sifted BB84 quantum key bits (via backend.crypto.key_conversion.bits_to_bytes_256).

There is NO HKDF, NO SHA-256 hashing, and NO intermediate key derivation.
"""

def derive_256bit_aes_key(*args, **kwargs):
    raise NotImplementedError(
        "HKDF has been removed from the active architecture per Phase 4 Revision. "
        "Use backend.crypto.key_conversion.bits_to_bytes_256 for direct key construction."
    )
