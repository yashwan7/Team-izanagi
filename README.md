# HR2-OI-41CD6D4B — Kshitij (Team Izanagi)
**HACKERING 2.0 Round 2 Project Repository (Open Innovation Track)**  
*Austere Disaster & Tactical Triage Mission Control System*

Kshitij is a resilient tactical clinical triage and telemetry management stack built for degraded, austere, and disconnected field environments.

---

## Architecture Overview

The system is developed collaboratively across 4 specialized modules:

1. **Developer 1 — Network Failure Prediction & Dual-Port Failover Engine (`core/failover/`, `ml/network_anomaly/`)**:
   - Synthetic telemetry generator for Port A (Primary Eth0) and Port B (Backup LTE/Sat).
   - 8-dimensional sliding window state machine evaluating degradation scores.
   - Dynamic path failover (`PORT_A_ACTIVE` $\rightarrow$ `PORT_B_ACTIVE` $\rightarrow$ `MESH_ACTIVE`).
   - TinyML TFLite inference model classifying link state anomalies.

2. **Developer 2 — EOG DSP Filter, Case Capsule Encoder & RFID HMAC Security (`sensors/eog_dsp/`, `security/capsule/`)**:
   - 4th-order IIR Butterworth bandpass filter (0.1–10 Hz) for EOG eye-gaze and blink signal detection (`CALL_NURSE`, `PAIN`, `WATER`, `BATHROOM`).
   - Delta Encoding Engine reducing telemetry payload size by ~90%.
   - Cryptographic HMAC-SHA256 signature generator and verification (`VERIFIED` vs `TAMPERED`).

3. **Developer 3 — Local LLM Prompt Engine, Offline Merge & Mission Control Dashboard (`backend/`, `dashboard/`)**:
   - **Delay-Aware Clinical Triage Service (FastAPI + Ollama `llama3.2:3b`)**:
     - Calculates $\text{priority\_score} = (\text{severity} \times \text{time\_sensitivity}) / \text{time\_to\_help}$.
     - Protocol Adaptation:
       - `time_to_help <= 30m` $\rightarrow$ **Acute Stabilization** (MARCH algorithm, rapid transport packaging).
       - `time_to_help >= 24h` $\rightarrow$ **Prolonged Field Care (PFC)** (strict fluid/oxygen rationing, decubitus ulcer 2-hour rotation schedule, escalation red flags).
     - Strictly formatted JSON clinical outputs.
   - **Offline Sync & Merge Engine (`backend/merge_engine/`)**:
     - Deduplication and conflict resolution (e.g. duplicate medication dosages from offline multi-medic batches).
     - Chronological incident timeline and Ollama narrative synthesis.
   - **Real-Time Tactical Dashboard (`dashboard/` — React + Vite + Tailwind + Lucide + Leaflet)**:
     - Modern Apple iPad clinical hospital EMR interface.
     - Live Header & Network Bar with active failover indicators and interactive simulation triggers.
     - Harm-Ranked Queue auto-sorted by calculated `priority_score`.
     - Dedicated Patients Directory and clinical records registry.
     - Offline Tactical Leaflet Map with glowing triage pins.
     - AI Reports tab with delay-aware checklists and timeline synthesis.
     - Settings tab for hardware interfaces, failover thresholds, and DSP parameters.
     - Real-Time Eye-Gaze Alert Modal with live HMAC verification status.

---

## Quickstart

### 1. Backend Merge & Triage Service
```bash
# Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
pip install websockets

# Run Unit Tests
pytest backend/merge_engine/test_merge_engine.py -v

# Start FastAPI Merge Engine Service (Port 8000)
uvicorn backend.merge_engine.service:app --host 127.0.0.1 --port 8000 --reload
```

### 2. React Triage Dashboard
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

## Nirantara FRDM-MCXN236 ML deployment

The fixed Nirantara network-state model and its NXP FRDM-MCXN236 deployment are
under `ml/nirantara_network/` and `firmware/nxp_mcxn236/`. The model is a fully
INT8 TensorFlow Lite model with input shape `[1, 22]`, output shape `[1, 3]`,
and classes `CRITICAL`, `DEGRADING`, and `HEALTHY`. Its graph contains four
`FULLY_CONNECTED` operators followed by `SOFTMAX`; the firmware registers only
those operators. The original INT8 model is preserved byte-for-byte and has
SHA-256 `e4875d1643ebb1ac08284e64e41f5307b068eca018527a4291cb14f7787aae9d`.

The reported test results are approximately 97.70% FP32 accuracy and 97.6417%
INT8 accuracy, a 0.000583 drop. These are model evaluation results, not the
hardware benchmark. Training/conversion scripts, scaler assets, metadata, and
the evaluation report are in the ML directory. The 120,000-row dataset is not
included because its licensing has not been established and it is not required
for deployment.

The embedded model is linked as read-only data in internal Flash. TFLM runtime
storage is in SRAM with a 32,768-byte tensor arena; the verified used portion
is 13,572 bytes. The 633,756-byte raw application uses a single 1 MiB internal
Flash application area because the original dual 512 KiB MCUboot slots provide
only 523,264 bytes per application. The MCUboot partition and linker changes,
signing instructions, and SDK build instructions are documented with the
firmware.

On the physical FRDM-MCXN236, a normal reset produced successful MCUboot ECDSA
signature validation and chain-load, followed by UART prediction `DEGRADING`.
The recorded inference measurement was 1,545,556 cycles or 10.303 ms, with
13,572 bytes of tensor arena usage. These are verified hardware measurements;
they are distinct from the host TFLite evaluation results.
