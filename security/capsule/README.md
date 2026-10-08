# Kshitij Patient Case Capsule - Delta Encoding & Cryptographic Security

High-efficiency, tamper-evident telemetry serialization and authentication framework for the **Kshitij Patient Case Capsule**.

---

## 🎯 Purpose & Key Features

1. **Delta Encoding Engine**:
   - Maintains stateful baseline dictionary for patient vitals, GPS, eye-gaze commands, and triage status.
   - Computes recursive dictionary diffs transmitting **ONLY modified delta fields**.
   - Achieves **~60-90% bandwidth reduction** over tactical mesh, BLE, and satellite channels.
   
2. **HMAC-SHA256 Cryptographic Authentication**:
   - Canonical JSON serialization with constant-time signature verification (`hmac.compare_digest`).
   - `sign_capsule(capsule_json, secret_key)`: Generates signed capsule envelope.
   - `verify_capsule(signed_capsule_json, secret_key)`: Returns `VERIFIED` on authentic data, or `TAMPERED` if payload/signature was manipulated or forged.

3. **Mock Data Generator & Transports**:
   - Simulates real-time clinical trajectories (tachycardia crises, fall detection triggers, triage color shifts, eye-gaze commands).
   - In-memory `MockSerialChannel` (UART/Serial) with active tamper injection testing.
   - Zero-dependency local `MockSocketChannelServer` for live telemetry broadcasting.

---

## 📊 Capsule Data Schema

```json
{
  "patient_id": "KZ-PATIENT-001",
  "status": "MONITORING",
  "triage_color": "GREEN",
  "fall_detected": false,
  "vitals": {
    "heart_rate_bpm": 75,
    "spo2_percent": 98,
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "temperature_c": 36.8,
    "respiratory_rate": 16
  },
  "gps": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "altitude_m": 920.0,
    "accuracy_m": 2.5
  },
  "eye_gaze": {
    "direction": "CENTER",
    "blink_count": 0,
    "last_command": "NONE"
  }
}
```

### Delta Payload Example (Tachycardia Update Only)
```json
{
  "patient_id": "KZ-PATIENT-001",
  "seq": 2,
  "delta": {
    "vitals": {
      "heart_rate_bpm": 125
    }
  }
}
```

### Signed Capsule Envelope
```json
{
  "payload": {
    "patient_id": "KZ-PATIENT-001",
    "seq": 2,
    "delta": { "vitals": { "heart_rate_bpm": 125 } }
  },
  "signature": "3c987fa0081bf489f64858b76c8c4a96deff0e9803212fb9a79c9ee0e6c5bbbc",
  "algorithm": "HMAC-SHA256",
  "signed_at": 1718000000.123
}
```

---

## 🖥️ CLI Usage

```bash
# 1. Run multi-step clinical emergency simulation with live compression metrics
python -m security.capsule.cli --simulate

# 2. Run Man-in-the-Middle (MitM) tamper-detection demonstration
python -m security.capsule.cli --tamper-demo

# 3. Stream simulation in real-time cadence
python -m security.capsule.cli --simulate --realtime
```

---

## 🧪 Running Unit Tests

```bash
python -m unittest security.capsule.test_capsule -v
```
