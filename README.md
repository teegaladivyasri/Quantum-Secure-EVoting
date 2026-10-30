# Quantum-Secure Electronic Voting System
> **Academic & Research Software Prototype**  
> Combining Qiskit BB84 Quantum Key Distribution Simulation, AES-256-GCM Authenticated Encryption, DeepFace Biometric Verification, Multi-Gateway Telephony, and Relational Participation Separation.

---

## 🏛️ Project Purpose & Scope

This project is a software-based academic research prototype designed to evaluate:
1. **Qiskit BB84 Protocol Simulation**: Simulating quantum key establishment, Alice/Bob basis choice (default 800 qubits via CSPRNG `secrets`), single-qubit preparation, Qiskit Aer simulation, basis sifting, and Quantum Bit Error Rate (QBER) calculation, providing additional attempts if statistical variation causes a round to produce fewer than 256 usable bits.
2. **Channel Disturbance Detection & 11% Threshold**: Automated rejection if $QBER > 11\%$ (e.g., under simulated intercept-resend eavesdropping). Observed disturbance causes key-establishment rejection; BB84 does not claim mathematical proof of an attacker.
3. **BB84 vs. Ballot Encryption Distinction**: BB84 simulates quantum key establishment to provide ephemeral raw key material; **BB84 does not encrypt the ballot**. Actual ballot confidentiality and integrity are provided by AES-256-GCM.
4. **Direct AES-256-GCM Key Construction**: Selecting exactly 256 usable shared key bits (after QBER estimation sample removal) and packing them directly into a 32-byte AES-256 key with zero intermediate key derivation functions or hashing, protecting ballot payloads with a 96-bit CSPRNG nonce and 128-bit authentication tag.
5. **Multi-Stage Voter KYC & Authentication**:
   - **Stage 1 (Voter ID Lookup):** Validates pre-registered voter records and securely masks registered contact details (`******XXXX`).
   - **Stage 2 (SMS OTP Verification):** Dispatches one-time verification codes via telephony gateways (TextBee / Fast2SMS) with E.164 number normalization, 60-second cooldown rate-limiting, and single-use session invalidation.
   - **Stage 3 (Biometric Face Verification):** Real-time webcam frame decoding and facial recognition powered by DeepFace and OpenCV, verifying voters against enrolled portrait records with an accessible demo fallback.
6. **Dynamic Election & Candidate Management (Andhra Pradesh 2024 Model)**:
   - Full support for **24 Legislative Assembly Constituencies** across Vizianagaram and Visakhapatnam districts.
   - **1-Click Official Candidate Loader** (`Load 2024 Candidates`) alongside real-time dynamic manual entry, inline editing, and deletion.
   - **None of the Above (NOTA)** is strictly enforced and automatically positioned as the final ballot choice.
7. **Absolute Voter-Ballot Data Separation**: The `ballots` table contains **zero voter identifiers**, zero usernames, and zero cryptographic keys. Participation tracking (`participation_records`) enforces the one-vote-per-election policy separately.
8. **Civic Accessibility & Inclusion**: Trilingual user interface (**English, Telugu, and Hindi**), Web Speech API audio assistance, high-contrast touch-friendly controls, and seamless Light/Dark themes adhering to the design system.

---

## 🔒 Integrated Voting & Cryptographic Flow

The voting system incorporates a multi-tier security lifecycle from voter verification to quantum-encrypted ballot casting:

```
[VOTER ONBOARDING & MULTI-STAGE KYC]
Stage 1: Voter ID Lookup (Masked Phone: ******XXXX)
  ↓
Stage 2: SMS OTP Verification (TextBee / Fast2SMS Gateway + 60s Cooldown)
  ↓
Stage 3: DeepFace Biometric Verification (Live Webcam vs. Enrolled Portrait)
  ↓
[EVM BALLOTING & QUANTUM CRYPTOGRAPHY]
Constituency Ballot Retrieval (Strict Isolation to Voter's Assigned AP Constituency + NOTA)
  ↓
BB84 Quantum Key Establishment (800-Qubit Transmission & Basis Sifting)
  ↓
QBER Verification (Threshold ≤ 11.0%; Sample Bits Discarded)
  ↓
Direct 256 Usable BB84 Bits (Zero Intermediate Classical KDF/Hashing)
  ↓
Direct 32-Byte AES-256 Key Construction
  ↓
AES-256-GCM Authenticated Encryption (Payload Sealed with 96-bit Nonce & 128-bit MAC Tag)
  ↓
Protected Ballot Persisted (Stored with Zero Voter Identity Linkage)
  ↓
Participation Record Updated (has_voted=True; Double-Voting Blocked with 409 Conflict)
```

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, React Router, Lucide Icons, Vanilla CSS Design System with CSS Tokens (Light/Dark themes).
- **Backend**: Python 3.13, Flask, Flask-Cors, Flask-SQLAlchemy, PyJWT, Bcrypt, Cryptography (PyCA).
- **Biometrics & Computer Vision**: DeepFace, OpenCV (`cv2`), ONNX Runtime.
- **Telephony & SMS**: TextBee Android SMS Gateway, Fast2SMS API with E.164 normalization.
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
python -m backend.app
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

### 3. Run Security & Cryptographic Diagnostic

To verify the BB84 quantum channel, AES-256-GCM AEAD tamper detection, and eavesdropping defense in real time:

```powershell
.\backend\venv\Scripts\python.exe .\backend\scripts\security_audit.py
```

---

## 🧪 Automated Testing & Security Verification

All **148 automated test cases** can be executed via `pytest`:

```powershell
.\backend\venv\Scripts\python.exe -m pytest -v
```

### Verified Test Matrix (148 Passing Tests):
- ✅ **Authentication & KYC Security (23 tests)**: Multi-stage voter initiation, 60s OTP cooldown enforcement, replay attack prevention, session invalidation, and RBAC admin protections.
- ✅ **Telephony & SMS Delivery (13 tests)**: TextBee API dispatch, Fast2SMS gateway routing, E.164 phone sanitization, and graceful provider fallback.
- ✅ **Biometric Verification (8 tests)**: DeepFace live frame base64 decoding, reference portrait matching, non-enrolled voter handling, and biometric mismatch rejection.
- ✅ **BB84 Quantum Simulation & Key Establishment (10 tests)**: 800-qubit transmission, basis sifting, normal sifting ($QBER \le 11\%$), simulated channel disturbance rejection ($QBER \approx 25\%$ raising `QuantumChannelDisturbanceError`), discarding QBER sample bits, yielding $\ge 256$ usable bits, and ephemeral memory management.
- ✅ **Direct AES-256 Key Construction (8 tests)**: Pure bit-to-byte packing of 256 bits into 32 bytes without intermediate hashing or KDF, rejection of insufficient/invalid bits, and verified absence of KDF from active cryptography.
- ✅ **AES-256-GCM Integrity (6 tests)**: Round-trip encryption, 96-bit nonce, 128-bit tag, tampered ciphertext detection (`InvalidTag`), tampered authentication tag detection (`InvalidTag`), and incorrect key rejection.
- ✅ **Security Scenarios & Anti-Tampering (10 tests)**: Concurrent voting race condition handling, ballot tampering resistance matrix, inactive election rejection, and secret material isolation.
- ✅ **Performance & Timing Benchmarks (11 tests)**: Sub-second BB84 quantum circuit execution, AES-256-GCM throughput, and database transaction timing.
- ✅ **Andhra Pradesh E2E Election Workflow (2 tests)**: Complete end-to-end simulation across Vizianagaram & Visakhapatnam assembly constituencies, verifying strict candidate isolation, voter ballot casting, and zero candidate-voter linkage.
- ✅ **Data Models, Multilingual Localization & Privacy (57 tests)**: Multilingual candidate/party/constituency translations (English, Telugu, Hindi), PostgreSQL ORM schemas, and proof that `ballots` has no voter identity columns.

---

## 🔑 Demo Credentials (Initialized via `seed_demo_data.py`)

> [!NOTE]
> Registered phone numbers are strictly protected and normalized according to Indian TRAI privacy standards. In the application interface, phone numbers are masked as `******XXXX`.

| Role | Voter ID / Username | Full Name | Assigned AP Constituency | Authentication Flow |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin` | Administrator | Headquarters | Master Password (`AdminSecure2026!`) |
| **Voter** | `VTR-2026-00301` | Divya | Bhimili | Voter ID $\to$ SMS OTP $\to$ Biometric KYC |
| **Voter** | `VTR-2026-00302` | Murthy | Bobbili | Voter ID $\to$ SMS OTP $\to$ Biometric KYC |
| **Voter** | `VTR-2026-00303` | Mahesh | Gajuwaka | Voter ID $\to$ SMS OTP $\to$ Biometric KYC |
| **Voter** | `VTR-2026-00304` | Gupta | Anakapalle | Voter ID $\to$ SMS OTP $\to$ Biometric KYC |
| **Voter** | `VTR-2026-00401` | Tarun | Visakhapatnam East | Voter ID $\to$ SMS OTP $\to$ Biometric KYC |
| **Voter** | `VTR-2026-00402` | Aswin | Visakhapatnam North | Voter ID $\to$ SMS OTP $\to$ Biometric KYC |

---

## ⚠️ Known Limitations & Academic Prototype Notices

1. **Software Simulation**: Quantum key distribution is simulated using Qiskit circuits on classical hardware; it does not utilize optical quantum links or physical single-photon detectors.
2. **Channel Disturbance vs. Eavesdropping**: QBER above the configured threshold causes the BB84 key-establishment attempt to be rejected because the observed disturbance is too high. The disturbance may be caused by simulated eavesdropping, channel noise, or other errors. The system does not claim QBER mathematically proves an external attacker.
3. **Direct Key Construction & Entropy Bounds**: Exactly 256 usable shared key bits are packed directly into a 32-byte AES-256 key without key derivation functions or intermediate hashing. Direct bit conversion does not create additional entropy; the cryptographic security of the AES key is strictly bounded by the entropy of the underlying BB84 key material.
4. **Key Ephemerality & Memory Semantics**: The AES key is kept ephemeral, is not persisted, is not returned through APIs, and its references are released after use. Strong memory-level zeroization is not guaranteed by ordinary Python runtime semantics.
5. **Database Configuration**: The approved runtime database is PostgreSQL. If running offline or in an environment where PostgreSQL service is inactive, configure `DATABASE_URL` appropriately in `.env`.
6. **Host Security & Anonymity Bounds**: AES-GCM protects stored ciphertexts against unauthorized tampering; it cannot defend against a root attacker with active server memory access. In small-constituency groups with sparse turnout, timing correlation between `cast_at` on ballots and `voted_at` on participation records could theoretically allow correlation without a shuffle/mixnet mechanism.
