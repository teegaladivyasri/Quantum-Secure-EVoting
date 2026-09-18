import secrets

class QuantumChannelDisturbanceError(Exception):
    """
    Raised when the calculated QBER exceeds the security threshold.
    QBER above the configured threshold causes the BB84 key-establishment attempt to be
    rejected because the observed disturbance is too high. The disturbance may be caused
    by simulated eavesdropping, channel noise, or other errors.
    """
    pass

def calculate_qber_and_extract_key(
    alice_sifted: list[int],
    bob_sifted: list[int],
    sample_ratio: float = 0.25,
    threshold: float = 0.11
):
    """
    Calculates the Quantum Bit Error Rate (QBER) by comparing a randomly chosen
    sample of the sifted key material using a cryptographically secure system RNG.
    
    If QBER <= threshold:
      Returns the calculated QBER and the remaining uncompared key material.
    If QBER > threshold:
      Raises QuantumChannelDisturbanceError: QBER above the configured threshold
      causes the BB84 key-establishment attempt to be rejected because the observed
      disturbance is too high. The disturbance may be caused by simulated eavesdropping,
      channel noise, or other errors.
    """
    sifted_length = len(alice_sifted)
    if sifted_length < 16:
        raise ValueError(f"Sifted key too short ({sifted_length} bits) to establish secure key.")

    sample_size = max(4, int(sifted_length * sample_ratio))
    
    # Pick random sample indices without replacement using CSPRNG SystemRandom
    sample_indices = set(secrets.SystemRandom().sample(range(sifted_length), sample_size))
    
    errors = 0
    remaining_key_bits = []

    for idx in range(sifted_length):
        if idx in sample_indices:
            if alice_sifted[idx] != bob_sifted[idx]:
                errors += 1
        else:
            # Only keep unrevealed bits for the final cryptographic key material
            remaining_key_bits.append(bob_sifted[idx])

    qber = errors / sample_size

    is_acceptable = qber <= threshold

    if not is_acceptable:
        raise QuantumChannelDisturbanceError(
            f"Quantum channel disturbance detected! QBER is {qber:.4f} ({qber*100:.1f}%), exceeding safety threshold {threshold*100:.1f}%. "
            f"Key-establishment rejected because observed disturbance is too high (may be caused by simulated eavesdropping, channel noise, or other errors)."
        )

    return {
        "qber": round(qber, 4),
        "qber_percentage": round(qber * 100, 2),
        "sample_size": sample_size,
        "errors_detected": errors,
        "remaining_key_bits": remaining_key_bits,
        "is_acceptable": True,
    }
