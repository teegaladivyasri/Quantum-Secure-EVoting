# Quantum-Secure Electronic Voting System
> **Academic & Research Software Prototype**  
> Combining Qiskit BB84 Quantum Key Distribution Simulation, AES-256-GCM Authenticated Encryption, and Relational Participation Separation.

---

## 🏛️ Project Purpose & Scope

This project is a software-based academic research prototype designed to evaluate:
1. **Qiskit BB84 Protocol Simulation**: Simulating quantum key establishment, Alice/Bob basis choice (default 800 qubits via CSPRNG `secrets`), single-qubit preparation, Qiskit Aer simulation, basis sifting, and Quantum Bit Error Rate (QBER) calculation, providing additional attempts if statistical variation causes a round to produce fewer than 256 usable bits.
2. **Channel Disturbance Detection & 11% Threshold**: Automated rejection if $QBER > 11\%$ (e.g., under simulated intercept-resend eavesdropping). Observed disturbance causes key-establishment rejection; BB84 does not claim mathematical proof of an attacker.
3. **BB84 vs. Ballot Encryption Distinction**: BB84 simulates quantum key establishment to provide ephemeral raw key material; **BB84 does not encrypt the ballot**. Actual ballot confidentiality and integrity are provided by AES-256-GCM.
4. **Direct AES-256-GCM Key Construction**: Selecting exactly 256 usable shared key bits (after QBER estimation sample removal) and packing them directly into a 32-byte AES-256 key with zero intermediate key derivation functions or hashing, protecting ballot payloads with a 96-bit CSPRNG nonce and 128-bit authentication tag.
5. **Absolute Voter-Ballot Data Separation**: The `ballots` table contains **zero voter identifiers**, zero usernames, and zero cryptographic keys. Participation tracking (`participation_records`) enforces the one-vote-per-election policy separately.
6. **Civic Accessibility & Inclusion**: Fully bilingual interface (**English and Telugu**), Web Speech API audio guidance, high-contrast touch-friendly controls, and Light/Dark modes adhering to the approved **Navy (`#1F2A44`)**, **Warm Beige (`#E8DCC8`)**, and **Soft Gold (`#C6A75E`)** palette.

---

## 🔒 Integrated Voting Cryptographic Flow

BB84 is used for quantum key establishment simulation. After successful QBER verification, 256 usable shared bits are directly converted into the 32-byte AES-256 key. AES-256-GCM provides authenticated encryption for the ballot.

The integrated vote-casting pipeline follows this sequential flow:

```
Authentication (JWT & Role Verification)
  ↓
Eligibility (Active Election & Constituency Matching)
  ↓
BB84 key establishment (800-qubit transmission)
  ↓
QBER verification (Threshold ≤ 11%; sample bits discarded)
  ↓
256 usable BB84 bits (Sifted unrevealed bits)
  ↓
Direct 32-byte AES-256 key (Direct bit-to-byte conversion)
  ↓
AES-256-GCM (Authenticated encryption of candidate_id payload)
  ↓
Protected ballot (Persisted with zero voter identity linkage)
  ↓
Participation update (Voter marked as has_voted=True)
```


---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, React Router, Lucide Icons, Vanilla CSS Design System with CSS Tokens (Light/Dark themes).
- **Backend**: Python 3.13, Flask, Flask-Cors, Flask-SQLAlchemy, PyJWT, Bcrypt, Cryptography (PyCA).
- **Quantum Simulation**: Qiskit 2.5, Qiskit Aer Simulator.
- **Database**: PostgreSQL (Approved Runtime Architecture via SQLAlchemy ORM). An isolated in-memory SQLite database is used for automated test execution.

---

## 🚀 Quickstart Guide

### 1. Backend Setup & Run

Open a terminal in the project root:

```powershell
# Activate Python virtual environment
.\backend\venv\Scripts\Activate.ps1

# (Optional) Seed demo election and candidates
$env:PYTHONPATH="."
python .\seed_demo_data.py

# Start Flask API server on port 5000
python .\backend\app.py
```

The backend REST API will be listening at `http://localhost:5000`.
- **API Base Path**: `/api/v1`
- **Health Check**: `GET http://localhost:5000/api/v1/health`
- **Runtime Database**: PostgreSQL (configured via `DATABASE_URL` in `.env`)

---

### 2. Frontend Setup & Run

Open a second terminal in the project root:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Automated Testing & Security Verification
 
All 48 security, transactional, cryptographic, and functional test cases can be executed via `pytest`:

```powershell
.\backend\venv\Scripts\python.exe -m pytest .\backend\tests -v
```

### Verified Test Matrix:
- ✅ **Authentication (5 tests)**: Admin login, voter registration, invalid password rejection (401), expired JWT rejection, and RBAC route protection (403 Forbidden).
- ✅ **BB84 Quantum Simulation & Key Establishment (10 tests)**: 800-qubit transmission, basis sifting, normal sifting ($QBER \le 11\%$), simulated channel disturbance rejection ($QBER \approx 25\%$ raising `QuantumChannelDisturbanceError`), discarding QBER sample bits, yielding $\ge 256$ usable bits, and providing additional attempts if statistical variation causes a round to produce fewer than 256 usable bits.
- ✅ **Direct AES-256 Key Construction (8 tests)**: Pure bit-to-byte packing of 256 bits into 32 bytes without key derivation functions or SHA-256, rejection of insufficient/invalid bits, and verified absence of KDF from active cryptography.
- ✅ **AES-256-GCM Integrity**: Round-trip encryption (`{"candidate_id": "..."}` only), 96-bit nonce, 128-bit tag, tampered ciphertext detection (`InvalidTag`), tampered authentication tag detection (`InvalidTag`), and incorrect key rejection.
- ✅ **Backend Foundation (5 tests)**: App factory, health endpoint, JSON 404 handler, and CORS headers.
- ✅ **Data Models & Privacy (6 tests)**: User roles/defaults, election-candidate relationships, participation record uniqueness, strict ballot-voter separation, audit log privacy, and PostgreSQL runtime configuration.
- ✅ **Privacy Guarantees (2 tests)**: Schema verification proving `ballots` table has no `voter_id` column, and audit logs have `user_id == None` with zero candidate disclosure.
- ✅ **Voting Pipeline Integration (12 tests)**: End-to-end direct BB84 $\to$ AES-256-GCM voting, payload restricted strictly to `candidate_id`, no secret keys in API responses or logs, QBER abort rollback, atomic transaction rollback on failure, single-vote rejection (409 Conflict), concurrent race condition handling via DB uniqueness, constituency enforcement, inactive election rejection, and verification that no KDF exists in the voting service.

---

## 🎬 Academic Demonstration Script (14 Steps)

To initialize demo accounts and run the complete 14-step academic evaluation flow in the terminal:

```powershell
# 1. Seed demo election, candidates, and demo credentials
python .\seed_demo_data.py

# 2. Run academic evaluation walkthrough
.\backend\venv\Scripts\python.exe .\demo_walkthrough.py
```

---

## 🔑 Demo Credentials (Initialized via `seed_demo_data.py`)

| Role | Username | Password | Constituency | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `AdminSecure2026!` | Headquarters | Election Commission Admin (Explicit seed only) |
| **Voter** | `voter_alice` | `Password123!` | Ward-1 | Registered Voter (Ward-1) |
| **Voter** | `voter_bob` | `Password123!` | Ward-1 | Registered Voter (Ward-1) |
| **Voter** | `voter_charlie` | `Password123!` | Ward-2 | Registered Voter (Ward-2) |

---

## ⚠️ Known Limitations & Academic Prototype Notices

1. **Software Simulation**: Quantum key distribution is simulated using Qiskit circuits on classical hardware; it does not utilize optical quantum links or physical single-photon detectors.
2. **Channel Disturbance vs. Eavesdropping**: QBER above the configured threshold causes the BB84 key-establishment attempt to be rejected because the observed disturbance is too high. The disturbance may be caused by simulated eavesdropping, channel noise, or other errors. The system does not claim QBER mathematically proves an external attacker.
3. **Direct Key Construction & Entropy Bounds**: Exactly 256 usable shared key bits are packed directly into a 32-byte AES-256 key without key derivation functions or intermediate hashing. Direct bit conversion does not create additional entropy; the cryptographic security of the AES key is strictly bounded by the entropy of the underlying BB84 key material.
4. **Key Ephemerality & Memory Semantics**: The AES key is kept ephemeral, is not persisted, is not returned through APIs, and its references are released after use. Strong memory-level zeroization is not guaranteed by ordinary Python runtime semantics.
5. **Database Configuration**: The approved runtime database is PostgreSQL. If running offline or in an environment where PostgreSQL service is inactive, configure `DATABASE_URL` appropriately in `.env`.
6. **Host Security & Anonymity Bounds**: AES-GCM protects stored ciphertexts against unauthorized tampering; it cannot defend against a root attacker with active server memory access. In small-constituency groups with sparse turnout, timing correlation between `cast_at` on ballots and `voted_at` on participation records could theoretically allow correlation without a shuffle/mixnet mechanism.
