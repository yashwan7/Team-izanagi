# Kshitij (Team Izanagi)
**Austere Disaster & Tactical Triage Mission Control System**

Kshitij is a resilient tactical clinical triage and telemetry management stack built for degraded, austere, and disconnected field environments.

---

## Architecture Overview

The system is developed collaboratively across 4 specialized modules:

1. **Developer 1 — Network Failure Prediction & Dual-Port Failover Engine**:
   - Synthetic telemetry generator for Port A (Primary Eth0) and Port B (Backup LTE/Sat).
   - 8-dimensional sliding window state machine evaluating degradation scores.
   - Dynamic path failover (`PORT_A_ACTIVE` $\rightarrow$ `PORT_B_ACTIVE` $\rightarrow$ `MESH_ACTIVE`).
   - TinyML inference model classifying link state.

2. **Developer 2 — EOG DSP Filter, Case Capsule Encoder & RFID HMAC Security**:
   - 4th-order IIR Butterworth bandpass filter (0.1–10 Hz) for EOG eye-gaze and blink signal detection (`CALL_NURSE`, `PAIN`, `WATER`, `BATHROOM`).
   - Delta Encoding Engine reducing telemetry payload size by ~90%.
   - Cryptographic HMAC-SHA256 signature generator and verification (`VERIFIED` vs `TAMPERED`).

3. **Developer 3 — Local LLM Prompt Engine, Offline Merge & Mission Control Dashboard**:
   - **Delay-Aware Clinical Triage Service (FastAPI + Ollama `llama3.2:3b`)**:
     - Calculates `priority_score = (severity * time_sensitivity) / time_to_help`.
     - Protocol Adaptation:
       - `time_to_help <= 30m` $\rightarrow$ **Acute Stabilization** (MARCH algorithm, rapid transport packaging).
       - `time_to_help >= 24h` $\rightarrow$ **Prolonged Field Care (PFC)** (strict fluid/oxygen rationing, decubitus ulcer 2-hour rotation schedule, escalation red flags).
     - Strictly formatted JSON clinical outputs.
   - **Offline Sync & Merge Engine**:
     - Deduplication and conflict resolution (e.g. duplicate medication dosages from offline multi-medic batches).
     - Chronological incident timeline and Ollama narrative synthesis.
   - **Real-Time Tactical Dashboard (React + Tailwind CSS + Leaflet)**:
     - Live Header & Network Bar with active failover indicators and interactive simulation triggers.
     - Harm-Ranked Queue auto-sorted by calculated `priority_score`.
     - Offline Tactical Leaflet Map with glowing triage pins.
     - Real-Time Eye-Gaze Alert Modal with live HMAC verification status.

---

## Quickstart

### 1. Backend Sync & Merge Service (`backend/merge_engine/`)
```bash
# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Run Unit Tests
pytest backend/merge_engine/test_merge_engine.py -v

# Start FastAPI Merge Engine Service (Port 8000)
uvicorn backend.merge_engine.service:app --host 127.0.0.1 --port 8000 --reload
```

### 2. React Triage Dashboard (`dashboard/`)
```bash
cd dashboard
npm install
npm run dev
# Dashboard available at http://localhost:5173
```

---

## Team Git Collaboration Rules

Because 4 developers are prompting and pushing simultaneously:
1. **Always pull before pushing**:
   ```bash
   git pull --rebase origin main
   git push origin main
   ```
2. Keep system files (`.DS_Store`, `node_modules/`, `venv/`) out of version control.
