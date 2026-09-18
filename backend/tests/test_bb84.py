"""
Phase 4 Revision BB84 Quantum Key Distribution Simulation Tests
Direct BB84 -> 256 Usable Shared Key Bits -> 32-Byte AES-256 Key (No HKDF)

Verifies:
1. BB84 simulation executes with default 800 qubits to ensure >= 256 usable sifted bits.
2. Basis sifting retains only matching basis positions.
3. BB84 key establishment reliably produces at least 256 usable key bits.
4. Exactly 256 bits are selected and converted directly into a 32-byte AES key.
5. QBER sample bits are discarded and NOT reused as AES key material.
6. Different BB84 runs produce different, independent key material.
7. High QBER / simulated eavesdropping causes key-establishment rejection.
8. QBER sampling does not use Python's insecure random module.
9. Empty or insufficient sifted key material is handled safely without zero division.
10. Secret BB84 key material is not persisted in database models.
"""
import inspect
import pytest
from backend.quantum.bb84_circuit import generate_bb84_session, establish_bb84_key
from backend.quantum.sifting import sift_bases
from backend.quantum.qber import calculate_qber_and_extract_key, QuantumChannelDisturbanceError
from backend.quantum import qber as qber_module
from backend.models.ballot import Ballot
from backend.models.audit import AuditLog


def test_bb84_simulation_default_800_qubits():
    """Verify BB84 simulation executes with default 800 qubits."""
    session = generate_bb84_session()  # Default num_qubits=800
    assert session["num_qubits"] == 800
    assert len(session["alice_bits"]) == 800
    assert len(session["alice_bases"]) == 800
    assert len(session["bob_bases"]) == 800
    assert len(session["bob_measurements"]) == 800
    assert session["eavesdropping_simulated"] is False


def test_bb84_basis_sifting_logic():
    """Verify basis sifting retains only positions with identical bases."""
    alice_bases = [0, 1, 0, 1, 0, 1, 0, 1]
    bob_bases   = [0, 0, 0, 1, 1, 1, 0, 0]
    # Matching positions: 0, 2, 3, 5, 6 (5 matches)
    alice_bits  = [1, 0, 1, 1, 0, 0, 1, 0]
    bob_meas    = [1, 1, 1, 1, 1, 0, 1, 1]

    sifted = sift_bases(alice_bases, bob_bases, alice_bits, bob_meas)
    assert sifted["matching_indices"] == [0, 2, 3, 5, 6]
    assert sifted["sifted_count"] == 5
    assert sifted["alice_sifted"] == [1, 1, 1, 0, 1]
    assert sifted["bob_sifted"] == [1, 1, 1, 0, 1]


def test_bb84_establishes_at_least_256_usable_bits_and_32byte_key():
    """Verify BB84 produces >= 256 usable bits and directly constructs a 32-byte AES key."""
    result = establish_bb84_key(
        target_usable_bits=256,
        initial_qubits=800,
        simulate_eavesdropping=False,
        threshold=0.11
    )
    assert result["total_usable_bits"] >= 256
    assert len(result["selected_bits"]) == 256
    assert len(result["key_bytes"]) == 32
    assert result["qber"] <= 0.11
    assert result["eavesdropping_simulated"] is False


def test_qber_sample_bits_not_reused_in_key():
    """Verify that bits sacrificed for QBER calculation are discarded and not present in remaining key."""
    alice_sifted = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1] * 2  # 40 bits
    bob_sifted   = list(alice_sifted)

    qber_result = calculate_qber_and_extract_key(
        alice_sifted=alice_sifted,
        bob_sifted=bob_sifted,
        sample_ratio=0.25,
        threshold=0.11
    )
    sample_size = qber_result["sample_size"]
    remaining_bits = qber_result["remaining_key_bits"]

    # Sample size + remaining bits must equal total sifted bits
    assert sample_size + len(remaining_bits) == len(alice_sifted)
    assert len(remaining_bits) < len(alice_sifted)


def test_different_bb84_runs_produce_different_keys():
    """Verify non-deterministic quantum simulation produces independent keys across runs."""
    res1 = establish_bb84_key(target_usable_bits=256, initial_qubits=800)
    res2 = establish_bb84_key(target_usable_bits=256, initial_qubits=800)
    assert res1["key_bytes"] != res2["key_bytes"]
    assert res1["selected_bits"] != res2["selected_bits"]


def test_bb84_eavesdropping_simulation_rejection():
    """Verify eavesdropping simulation triggers high QBER and raises QuantumChannelDisturbanceError."""
    with pytest.raises(QuantumChannelDisturbanceError) as exc_info:
        establish_bb84_key(
            target_usable_bits=256,
            initial_qubits=800,
            simulate_eavesdropping=True,
            threshold=0.11
        )
    assert "exceeding safety threshold 11.0%" in str(exc_info.value)


def test_qber_calculation_accuracy_and_threshold_evaluation():
    """Verify QBER calculation accuracy with known error rates and 0.11 threshold."""
    # 20 identical bits -> 0% error
    alice_sifted = [0] * 20
    bob_sifted   = [0] * 20
    res = calculate_qber_and_extract_key(alice_sifted, bob_sifted, sample_ratio=0.25, threshold=0.11)
    assert res["qber"] == 0.0
    assert res["errors_detected"] == 0
    assert res["is_acceptable"] is True

    # Controlled failure: sample with high error rate (100% error)
    bob_inverted = [1] * 20
    with pytest.raises(QuantumChannelDisturbanceError):
        calculate_qber_and_extract_key(alice_sifted, bob_inverted, sample_ratio=0.25, threshold=0.11)


def test_qber_sampling_does_not_use_insecure_random_module():
    """Verify QBER calculation uses secrets.SystemRandom rather than python random module."""
    source = inspect.getsource(qber_module)
    assert "import random" not in source
    assert "random.sample" not in source
    assert "secrets.SystemRandom" in source


def test_insufficient_sifted_key_handling():
    """Verify short or empty sifted key raises ValueError without division by zero."""
    with pytest.raises(ValueError) as exc_info:
        calculate_qber_and_extract_key([], [], threshold=0.11)
    assert "Sifted key too short" in str(exc_info.value)

    with pytest.raises(ValueError) as exc_info:
        calculate_qber_and_extract_key([1] * 10, [1] * 10, threshold=0.11)
    assert "Sifted key too short" in str(exc_info.value)


def test_secret_bb84_keys_never_persisted_in_models():
    """Verify database schemas do not contain any BB84 key material columns."""
    ballot_columns = [col.name for col in Ballot.__table__.columns]
    audit_columns = [col.name for col in AuditLog.__table__.columns]

    for col in ["bb84_key", "raw_bits", "quantum_key", "alice_bits", "bob_measurements", "aes_key"]:
        assert col not in ballot_columns
        assert col not in audit_columns
