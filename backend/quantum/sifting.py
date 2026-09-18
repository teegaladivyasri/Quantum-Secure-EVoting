def sift_bases(alice_bases: list[int], bob_bases: list[int], alice_bits: list[int], bob_measurements: list[int]):
    """
    Performs BB84 basis sifting.
    Retains only the bits where Alice and Bob randomly chose identical measurement bases.
    """
    matching_indices = []
    alice_sifted = []
    bob_sifted = []

    for i in range(len(alice_bases)):
        if alice_bases[i] == bob_bases[i]:
            matching_indices.append(i)
            alice_sifted.append(alice_bits[i])
            bob_sifted.append(bob_measurements[i])

    return {
        "matching_indices": matching_indices,
        "sifted_count": len(matching_indices),
        "alice_sifted": alice_sifted,
        "bob_sifted": bob_sifted,
    }
