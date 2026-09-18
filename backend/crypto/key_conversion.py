"""
Direct Bit-to-Byte Conversion for BB84-Derived Shared Key Material
Converts exactly 256 usable shared key bits directly into a 32-byte AES-256 key.

Architectural Notice:
There is NO HKDF, NO SHA-256 hashing, NO PBKDF, and NO intermediate key derivation.
The 256 bits established via BB84 and sifting (after QBER estimation sample removal)
are directly packed into 32 bytes (8 bits per byte).
No additional entropy is created or added by this conversion.
"""

def bits_to_bytes_256(bits: list[int]) -> bytes:
    """
    Directly converts at least 256 usable BB84 key bits into a 32-byte (256-bit) AES key.
    Takes exactly the first 256 bits and packs them into 32 bytes using big-endian bit order.

    :param bits: List of integers (0 or 1) of length >= 256
    :return: Exactly 32 bytes suitable for AES-256-GCM
    :raises ValueError: If fewer than 256 bits are provided or if values are not 0 or 1
    """
    if not isinstance(bits, (list, tuple)):
        raise TypeError("Key bits must be provided as a list or tuple of integers.")

    if len(bits) < 256:
        raise ValueError(
            f"Insufficient usable BB84 key bits: {len(bits)} bits provided, "
            f"at least 256 usable bits are required to construct an AES-256 key."
        )

    # Take exactly the first 256 usable bits
    selected_256_bits = bits[:256]

    key_bytes = bytearray(32)
    for byte_idx in range(32):
        byte_val = 0
        for bit_offset in range(8):
            bit = selected_256_bits[byte_idx * 8 + bit_offset]
            if bit not in (0, 1):
                raise ValueError(f"Invalid bit at position {byte_idx * 8 + bit_offset}: {bit}. Must be 0 or 1.")
            byte_val = (byte_val << 1) | bit
        key_bytes[byte_idx] = byte_val

    result = bytes(key_bytes)
    assert len(result) == 32, "Constructed AES-256 key must be exactly 32 bytes."
    return result
