import secrets
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from backend.quantum.sifting import sift_bases
from backend.quantum.qber import calculate_qber_and_extract_key, QuantumChannelDisturbanceError
from backend.crypto.key_conversion import bits_to_bytes_256

def generate_bb84_session(num_qubits: int = 800, simulate_eavesdropping: bool = False):
    """
    Executes a software-simulated BB84 Quantum Key Distribution session using Qiskit.
    
    Academic Prototype Note:
    This protocol operates purely in classical software simulation.
    When simulate_eavesdropping is True, an intercept-resend attack is simulated to demonstrate
    channel disturbance. QBER above the configured threshold causes the BB84 key-establishment attempt
    to be rejected because the observed disturbance is too high. The disturbance may be caused by simulated
    eavesdropping, channel noise, or other errors.
    
    :param num_qubits: Total number of qubits sent by Alice (default 800 to ensure >= 256 usable sifted bits)
    :param simulate_eavesdropping: If True, Eve intercepts and measures qubits in random bases
    :return: dict containing Alice bits/bases, Bob bases/measurements, and Eve simulation status
    """
    # 0 = Z basis (Computational: |0>, |1>)
    # 1 = X basis (Hadamard: |+>, |->)
    alice_bits = [secrets.randbits(1) for _ in range(num_qubits)]
    alice_bases = [secrets.randbits(1) for _ in range(num_qubits)]
    bob_bases = [secrets.randbits(1) for _ in range(num_qubits)]

    bob_measurements = []
    simulator = AerSimulator()

    for i in range(num_qubits):
        qc = QuantumCircuit(1, 1)

        # Alice encodes state
        if alice_bits[i] == 1:
            qc.x(0)
        if alice_bases[i] == 1:
            qc.h(0)

        # Simulated Eavesdropper (Eve) Intercept-Resend Attack
        if simulate_eavesdropping:
            eve_basis = secrets.randbits(1)
            if eve_basis == 1:
                qc.h(0)
            qc.measure(0, 0)
            # Re-prepare according to measurement for transmission to Bob
            # In Qiskit Aer, measuring collapses the state; if Eve's basis was X, re-applying H prepares Eve's collapsed state
            if eve_basis == 1:
                qc.h(0)

        # Bob measures state
        if bob_bases[i] == 1:
            qc.h(0)
        qc.measure(0, 0)

        # Execute single shot simulation
        result = simulator.run(qc, shots=1, memory=True).result()
        measured_bit = int(result.get_memory()[0])
        bob_measurements.append(measured_bit)

    return {
        "num_qubits": num_qubits,
        "alice_bits": alice_bits,
        "alice_bases": alice_bases,
        "bob_bases": bob_bases,
        "bob_measurements": bob_measurements,
        "eavesdropping_simulated": simulate_eavesdropping,
    }


def establish_bb84_key(
    target_usable_bits: int = 256,
    initial_qubits: int = 800,
    max_rounds: int = 5,
    simulate_eavesdropping: bool = False,
    threshold: float = 0.11,
    sample_ratio: float = 0.20,
) -> dict:
    """
    Executes BB84 simulation rounds until at least `target_usable_bits` (256) usable
    sifted bits are established after discarding QBER comparison samples.
    
    Direct Architecture (NO HKDF, NO SHA-256):
    BB84 -> Sifting -> QBER verification -> Discard sample -> 256 usable bits -> 32-byte AES key.
    
    :param target_usable_bits: Exactly 256 usable key bits required for AES-256
    :param initial_qubits: Number of qubits transmitted per round (default 800)
    :param max_rounds: Safety limit on rounds to prevent infinite loops (default 5)
    :param simulate_eavesdropping: If True, simulates Eve intercept-resend disturbance
    :param threshold: QBER acceptance threshold (default 0.11)
    :param sample_ratio: Proportion of sifted bits sacrificed for QBER calculation (default 0.20)
    :return: dict containing:
        - key_bytes: 32-byte AES key directly packed from 256 bits
        - selected_bits: List of 256 usable bits
        - total_usable_bits: Total usable bits accumulated
        - total_sifted_bits: Total sifted bits across rounds
        - total_qubits: Total qubits transmitted
        - qber: Latest calculated QBER
        - qber_percentage: Latest calculated QBER percentage
        - sample_size: Number of bits sacrificed for QBER estimation
        - rounds_executed: Number of rounds needed
        - eavesdropping_simulated: Boolean
    :raises QuantumChannelDisturbanceError: If QBER exceeds threshold in any round
    :raises RuntimeError: If target bits cannot be reached within max_rounds
    """
    accumulated_usable_bits: list[int] = []
    total_sifted_bits = 0
    total_qubits_transmitted = 0

    for round_num in range(1, max_rounds + 1):
        session = generate_bb84_session(
            num_qubits=initial_qubits,
            simulate_eavesdropping=simulate_eavesdropping
        )
        total_qubits_transmitted += initial_qubits

        sifted = sift_bases(
            alice_bases=session["alice_bases"],
            bob_bases=session["bob_bases"],
            alice_bits=session["alice_bits"],
            bob_measurements=session["bob_measurements"]
        )
        total_sifted_bits += sifted["sifted_count"]

        # Calculate QBER and extract remaining unrevealed key bits (sacrificing sample bits)
        # If QBER > threshold, raises QuantumChannelDisturbanceError immediately
        qber_result = calculate_qber_and_extract_key(
            alice_sifted=sifted["alice_sifted"],
            bob_sifted=sifted["bob_sifted"],
            sample_ratio=sample_ratio,
            threshold=threshold
        )

        # Append ONLY the unrevealed remaining bits (QBER sample bits are permanently discarded)
        accumulated_usable_bits.extend(qber_result["remaining_key_bits"])

        if len(accumulated_usable_bits) >= target_usable_bits:
            # Select exactly the first target_usable_bits (256 bits)
            selected_256_bits = accumulated_usable_bits[:target_usable_bits]
            key_bytes = bits_to_bytes_256(selected_256_bits)

            return {
                "key_bytes": key_bytes,
                "selected_bits": selected_256_bits,
                "total_usable_bits": len(accumulated_usable_bits),
                "total_sifted_bits": total_sifted_bits,
                "total_qubits": total_qubits_transmitted,
                "qber": qber_result["qber"],
                "qber_percentage": qber_result["qber_percentage"],
                "sample_size": qber_result["sample_size"],
                "rounds_executed": round_num,
                "eavesdropping_simulated": simulate_eavesdropping,
            }

    raise RuntimeError(
        f"Unable to establish {target_usable_bits} usable BB84 key bits after {max_rounds} rounds. "
        f"Accumulated only {len(accumulated_usable_bits)} usable bits."
    )
