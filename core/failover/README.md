# Dual-Port Telemetry & TinyML Failover Engine for Kshitij

A high-performance, modular **C++ & Python software engine** designed for Team Izanagi to simulate and manage dual-port network telemetry, 8-dimensional sliding window link health evaluation, and automatic sub-second failover.

---

## 🚀 Key Features

### 1. Dual-Port Telemetry Generator (100ms Interval)
- Generates synchronized synthetic telemetry every **100ms** for:
  - **Port A (Primary IP):** Baseline latency ~22ms, jitter ~2.5ms, packet loss ~0.1%, DNS lookup ~10ms.
  - **Port B (Backup Path):** Baseline latency ~40ms, jitter ~5.0ms, packet loss ~0.3%, DNS lookup ~18ms.
- **Fault Injection (`inject_network_degradation`):**
  - Allows injecting configurable network degradation profiles (latency spikes, packet loss spikes, jitter, DNS delay).
  - Simulates brownouts, bufferbloat, physical link degradation, and black-hole failures.
  - Supports automatic duration timeouts and manual recovery.

### 2. 8-Dimensional Sliding Window & State Machine (500ms Evaluation)
- Maintains a **50-sample sliding window** spanning the last **5.0 seconds** of network traffic.
- Tracks the continuous **8-dimensional feature vector**:
  $$\vec{v} = [A_{\text{lat}}, A_{\text{jit}}, A_{\text{loss}}, A_{\text{dns}}, B_{\text{lat}}, B_{\text{jit}}, B_{\text{loss}}, B_{\text{dns}}]$$
- Evaluates link health every **500ms**:
  - **Degradation Score > 0.60:** Emits `STATE_WARNING` (Yellow).
  - **Degradation Score > 0.85 OR Critical > 0.50:** Executes immediate path failover to **Port B** (`FAILOVER_PORT_B`).
  - **Both Ports Critical (> 0.50):** Triggers software callback to activate **Mesh Mode** (`MESH_ACTIVE`).
  - **Auto-Recovery:** Smoothly reverts traffic back to Port A once link metrics stabilize for 3 consecutive evaluation cycles.

### 3. Interactive CLI & REST API
- **Live Terminal CLI:** Real-time ANSI dashboard showing active path, live latency/jitter/loss/DNS tables, health score bars, and interactive degradation keys.
- **FastAPI REST API & WebSocket:** Provides full programmatic control over telemetry, presets, state evaluations, and live streaming.
- **Built-in Web Dashboard:** Accessible at `http://localhost:8000/` featuring live status badges, metric gauges, and scenario trigger buttons.

---

## 📂 Project Structure

```
core/failover/
├── __init__.py           # Package exports
├── models.py             # Pydantic data schemas & state enums
├── telemetry.py          # 100ms synthetic generator & fault injector
├── state_machine.py      # 50-sample sliding window & 500ms health evaluator
├── engine.py             # Core orchestrator & callback dispatch pipeline
├── api.py                # FastAPI REST API, WebSocket stream & Web UI
├── cli.py                # Interactive ANSI terminal dashboard
├── main.py               # Unified CLI/API launcher
├── README.md             # Engine documentation & developer guide
└── cpp/                  # Modular C++ implementation
    ├── CMakeLists.txt
    ├── include/
    │   ├── models.hpp
    │   ├── telemetry.hpp
    │   ├── state_machine.hpp
    │   └── engine.hpp
    └── src/
        ├── telemetry.cpp
        ├── state_machine.cpp
        ├── engine.cpp
        └── main.cpp
```

---

## ⚡ Quick Start

### Python Engine

#### Run CLI Dashboard
```bash
python -m core.failover.main --mode cli
```

#### Run REST API Server
```bash
python -m core.failover.main --mode api --port 8000
```
Visit `http://localhost:8000/` in your browser for the Web UI or `http://localhost:8000/docs` for the interactive OpenAPI documentation.

#### Run Both Simultaneously
```bash
python -m core.failover.main --mode both --port 8000
```

---

## 🌐 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Current system state, active path, and 8D feature vector |
| `GET` | `/api/telemetry` | Latest 100ms raw dual-port telemetry sample |
| `GET` | `/api/window` | 50-sample sliding window matrix |
| `POST` | `/api/degrade` | Inject custom network fault profile |
| `POST` | `/api/recover` | Clear fault injections and restore nominal baseline |
| `POST` | `/api/presets/{name}` | Trigger preset scenario (`warning`, `failover`, `mesh`, `recover`) |
| `GET` | `/api/events` | Event log of state transitions |
| `WS` | `/ws/telemetry` | WebSocket streaming dual-port telemetry & state every 200ms |

### Degradation Payload Example
```json
POST /api/degrade
{
  "port": "PORT_A",
  "duration_sec": 15.0,
  "latency_spike_ms": 280.0,
  "packet_loss_spike_pct": 35.0,
  "jitter_spike_ms": 25.0,
  "dns_spike_ms": 120.0
}
```

---

## 🔧 Software Callbacks Integration

To integrate with Kshitij's networking layers:

```python
from core.failover import FailoverEngine, SystemState

engine = FailoverEngine()

# 1. Warning callback (degradation > 0.60)
@engine.on_warning
def handle_warning(event):
    print(f"Alert: Port A degraded. Score: {event['port_a_degradation']}")

# 2. Immediate failover callback
@engine.on_failover
def handle_failover(event):
    print(f"Traffic rerouted: {event['old_state']} -> {event['new_state']}")

# 3. Mesh Mode activation callback (both ports critical)
@engine.on_mesh_activate
def activate_mesh_network(event):
    print(f"CRITICAL: Activating Ad-hoc Mesh Mode! Reason: {event['message']}")

engine.start()
```

---

## 🧪 Testing

Run the automated test suite:
```bash
python -m unittest discover tests
```
12 comprehensive unit and integration tests verifying telemetry generation, 8D sliding window buffering, degradation injection, state warning thresholds, failover to Port B, and Mesh Mode callback dispatching.
