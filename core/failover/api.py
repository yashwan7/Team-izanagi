"""
FastAPI REST API and Web Dashboard for Dual-Port Failover Engine.
Provides live status, metrics, event history, and fault injection endpoints.
"""

import asyncio
from typing import Optional, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .engine import FailoverEngine
from .models import PortId, SystemState

app = FastAPI(
    title="Kshitij Dual-Port Failover & Telemetry API",
    version="1.0.0",
    description="Dual-port telemetry generation, 8D sliding window evaluation, and TinyML failover engine.",
)

# Enable CORS for local dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global engine instance
engine: Optional[FailoverEngine] = None


def get_engine() -> FailoverEngine:
    global engine
    if engine is None:
        engine = FailoverEngine()
        engine.start()
    return engine


class DegradationRequest(BaseModel):
    port: str = Field(default="PORT_A", description="'PORT_A', 'PORT_B', or 'BOTH'")
    duration_sec: float = Field(default=15.0, description="Duration in seconds (0 for indefinite)")
    latency_spike_ms: float = Field(default=280.0, description="Latency spike added to link (ms)")
    packet_loss_spike_pct: float = Field(default=35.0, description="Packet loss spike (%)")
    jitter_spike_ms: float = Field(default=25.0, description="Jitter spike (ms)")
    dns_spike_ms: float = Field(default=120.0, description="DNS lookup delay spike (ms)")


@app.on_event("startup")
def startup_event():
    get_engine()


@app.on_event("shutdown")
def shutdown_event():
    global engine
    if engine:
        engine.stop()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "kshitij-failover-engine"}


@app.get("/api/status")
def get_status() -> Dict[str, Any]:
    """Get current system state, active path, degradation scores, and 8D feature vector."""
    eng = get_engine()
    return eng.get_system_status()


@app.get("/api/telemetry")
def get_telemetry() -> Dict[str, Any]:
    """Get latest 100ms raw telemetry sample."""
    eng = get_engine()
    sample = eng.telemetry.get_latest_sample()
    return {
        "timestamp": sample.timestamp if sample else None,
        "sample": sample.model_dump() if sample else None,
        "sliding_window_8d_vector": eng.state_machine.get_sliding_window_8d_vector(),
    }


@app.get("/api/window")
def get_sliding_window() -> Dict[str, Any]:
    """Get recent 50 samples of 8D sliding window matrix."""
    eng = get_engine()
    matrix = eng.state_machine.get_sliding_window_matrix()
    return {
        "sample_count": len(matrix),
        "window_capacity": eng.state_machine.window_size,
        "dimension_labels": [
            "A_latency_ms", "A_jitter_ms", "A_loss_pct", "A_dns_ms",
            "B_latency_ms", "B_jitter_ms", "B_loss_pct", "B_dns_ms",
        ],
        "sliding_window_mean_8d": eng.state_machine.get_sliding_window_8d_vector(),
        "matrix": matrix,
    }


@app.post("/api/degrade")
def inject_degradation(req: DegradationRequest) -> Dict[str, Any]:
    """Simulate network link degradation or link drop."""
    eng = get_engine()
    profile = eng.inject_network_degradation(
        port=req.port,
        duration_sec=req.duration_sec,
        latency_spike_ms=req.latency_spike_ms,
        packet_loss_spike_pct=req.packet_loss_spike_pct,
        jitter_spike_ms=req.jitter_spike_ms,
        dns_spike_ms=req.dns_spike_ms,
    )
    return {
        "status": "degradation_injected",
        "profile": profile.model_dump(),
        "active_degradations": eng.telemetry.get_active_degradations(),
    }


@app.post("/api/recover")
def clear_degradation(port: Optional[str] = None) -> Dict[str, Any]:
    """Clear active degradation and restore nominal baseline."""
    eng = get_engine()
    eng.clear_degradation(port)
    return {"status": "degradation_cleared", "port": port or "ALL"}


@app.get("/api/events")
def get_events() -> Dict[str, Any]:
    """Get event log of state machine transitions and failover events."""
    eng = get_engine()
    return {"events": eng.get_event_history()}


@app.post("/api/presets/{preset_name}")
def trigger_preset(preset_name: str) -> Dict[str, Any]:
    """
    Execute preset degradation scenario:
    - 'warning': Spikes Port A into STATE_WARNING (score > 0.60)
    - 'failover': Drops Port A into FAILOVER_PORT_B (score > 0.85 / critical > 0.50)
    - 'mesh': Spikes BOTH ports into MESH_ACTIVE (both critical > 0.50)
    - 'recover': Clears all degradation
    """
    eng = get_engine()
    if preset_name == "warning":
        prof = eng.inject_network_degradation(
            port=PortId.PORT_A,
            duration_sec=15.0,
            latency_spike_ms=160.0,
            packet_loss_spike_pct=14.0,
            jitter_spike_ms=18.0,
            dns_spike_ms=60.0,
        )
        return {"preset": "warning", "message": "Triggered STATE_WARNING scenario on Port A", "profile": prof.model_dump()}
    elif preset_name == "failover":
        prof = eng.inject_network_degradation(
            port=PortId.PORT_A,
            duration_sec=20.0,
            latency_spike_ms=320.0,
            packet_loss_spike_pct=42.0,
            jitter_spike_ms=35.0,
            dns_spike_ms=150.0,
        )
        return {"preset": "failover", "message": "Triggered Failover to Port B scenario", "profile": prof.model_dump()}
    elif preset_name == "mesh":
        prof = eng.inject_network_degradation(
            port=PortId.BOTH,
            duration_sec=25.0,
            latency_spike_ms=380.0,
            packet_loss_spike_pct=55.0,
            jitter_spike_ms=45.0,
            dns_spike_ms=200.0,
        )
        return {"preset": "mesh", "message": "Triggered Mesh Mode activation scenario (both ports critical)", "profile": prof.model_dump()}
    elif preset_name == "recover":
        eng.clear_degradation()
        return {"preset": "recover", "message": "All links restored to normal baseline"}
    else:
        return {"error": f"Unknown preset: {preset_name}. Use 'warning', 'failover', 'mesh', or 'recover'."}


@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    """Real-time streaming websocket sending dual-port telemetry and state evaluation every 200ms."""
    await websocket.accept()
    eng = get_engine()
    try:
        while True:
            status = eng.get_system_status()
            await websocket.send_json(status)
            await asyncio.sleep(0.20)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@app.get("/", response_class=HTMLResponse)
def index_dashboard():
    """Interactive real-time dark mode HTML dashboard for Kshitij & Team Izanagi."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kshitij Dual-Port Telemetry & TinyML Failover Engine</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f17;
      --card-bg: rgba(18, 24, 38, 0.8);
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f0f4fc;
      --text-muted: #8b9bb4;
      --green: #10b981;
      --yellow: #f59e0b;
      --orange: #f97316;
      --red: #ef4444;
      --blue: #3b82f6;
      --purple: #8b5cf6;
      --cyan: #06b6d4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      padding: 24px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
      flex-wrap: wrap;
      gap: 16px;
    }
    .title-group h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .title-group p {
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 4px;
    }
    .state-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      transition: all 0.3s ease;
    }
    .pulse-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 12px currentColor;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .state-normal { background: rgba(16, 185, 129, 0.15); color: var(--green); border: 1px solid var(--green); }
    .state-warning { background: rgba(245, 158, 11, 0.15); color: var(--yellow); border: 1px solid var(--yellow); }
    .state-failover { background: rgba(249, 115, 22, 0.15); color: var(--orange); border: 1px solid var(--orange); }
    .state-mesh { background: rgba(239, 68, 68, 0.15); color: var(--red); border: 1px solid var(--red); animation: borderGlow 1s infinite alternate; }
    @keyframes borderGlow { from { box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); } to { box-shadow: 0 0 25px rgba(239, 68, 68, 0.8); } }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 20px;
      backdrop-filter: blur(10px);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .card-header h2 { font-size: 18px; font-weight: 700; }
    .tag {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      background: rgba(255,255,255,0.06);
      color: var(--text-muted);
    }
    .tag.active {
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
      border: 1px solid #3b82f6;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 14px;
    }
    .metric-box {
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.04);
      padding: 12px;
      border-radius: 10px;
    }
    .metric-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; }
    .metric-value { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; }

    .score-bar-container { margin-top: 14px; }
    .score-label { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .progress-track {
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      overflow: hidden;
      margin-bottom: 10px;
    }
    .progress-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }

    .controls-card { margin-bottom: 24px; }
    .btn-row { display: flex; flex-wrap: wrap; gap: 12px; }
    button {
      padding: 10px 18px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s ease;
      background: rgba(255,255,255,0.05);
      color: var(--text);
    }
    button:hover { background: rgba(255,255,255,0.12); transform: translateY(-1px); }
    .btn-warn { border-color: var(--yellow); color: var(--yellow); }
    .btn-warn:hover { background: rgba(245, 158, 11, 0.2); }
    .btn-failover { border-color: var(--orange); color: var(--orange); }
    .btn-failover:hover { background: rgba(249, 115, 22, 0.2); }
    .btn-mesh { border-color: var(--red); color: var(--red); }
    .btn-mesh:hover { background: rgba(239, 68, 68, 0.2); }
    .btn-rec { border-color: var(--green); color: var(--green); }
    .btn-rec:hover { background: rgba(16, 185, 129, 0.2); }

    .vector-box {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: rgba(0,0,0,0.35);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.05);
      color: #7dd3fc;
      overflow-x: auto;
      white-space: nowrap;
    }

    .events-list {
      max-height: 220px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .event-item {
      padding: 8px 12px;
      border-radius: 6px;
      background: rgba(0,0,0,0.2);
      border-left: 3px solid #3b82f6;
    }
    .event-item.warning { border-left-color: var(--yellow); }
    .event-item.failover { border-left-color: var(--orange); }
    .event-item.mesh { border-left-color: var(--red); background: rgba(239, 68, 68, 0.08); }
    .event-item.normal { border-left-color: var(--green); }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <h1>KSHITIJ // Dual-Port Failover & Telemetry</h1>
      <p>50-Sample (5s) Sliding Window &bull; 100ms Telemetry Stream &bull; 500ms Health Evaluator</p>
    </div>
    <div id="stateBadge" class="state-badge state-normal">
      <span class="pulse-dot"></span>
      <span id="stateText">STATE_NORMAL</span>
    </div>
  </div>

  <div class="card controls-card">
    <div class="card-header">
      <h2>Interactive Degradation Scenarios</h2>
      <span class="tag">Simulate Hardware / Network Faults</span>
    </div>
    <div class="btn-row">
      <button class="btn-warn" onclick="triggerPreset('warning')">&#9888; 1. Inject Warning (&gt;0.60)</button>
      <button class="btn-failover" onclick="triggerPreset('failover')">&#8644; 2. Failover to Port B (&gt;0.85 / Crit &gt;0.50)</button>
      <button class="btn-mesh" onclick="triggerPreset('mesh')">&#9762; 3. Trigger Mesh Mode (Both Critical)</button>
      <button class="btn-rec" onclick="triggerPreset('recover')">&#10004; 4. Restore Baseline</button>
    </div>
  </div>

  <div class="grid-2">
    <!-- Port A -->
    <div class="card">
      <div class="card-header">
        <h2>PORT A (Primary IP)</h2>
        <span id="badgePortA" class="tag active">ACTIVE PATH</span>
      </div>
      <div class="metric-grid">
        <div class="metric-box">
          <div class="metric-label">Latency</div>
          <div class="metric-value" id="a_lat">-- ms</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Jitter</div>
          <div class="metric-value" id="a_jit">-- ms</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Packet Loss</div>
          <div class="metric-value" id="a_loss">-- %</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">DNS Time</div>
          <div class="metric-value" id="a_dns">-- ms</div>
        </div>
      </div>
      <div class="score-bar-container">
        <div class="score-label">
          <span>Degradation Score</span>
          <span id="a_deg_val">0.00</span>
        </div>
        <div class="progress-track">
          <div id="a_deg_bar" class="progress-fill" style="width: 0%; background: var(--green);"></div>
        </div>
        <div class="score-label">
          <span>Critical Score</span>
          <span id="a_crit_val">0.00</span>
        </div>
        <div class="progress-track">
          <div id="a_crit_bar" class="progress-fill" style="width: 0%; background: var(--blue);"></div>
        </div>
      </div>
    </div>

    <!-- Port B -->
    <div class="card">
      <div class="card-header">
        <h2>PORT B (Backup Path)</h2>
        <span id="badgePortB" class="tag">STANDBY</span>
      </div>
      <div class="metric-grid">
        <div class="metric-box">
          <div class="metric-label">Latency</div>
          <div class="metric-value" id="b_lat">-- ms</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Jitter</div>
          <div class="metric-value" id="b_jit">-- ms</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Packet Loss</div>
          <div class="metric-value" id="b_loss">-- %</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">DNS Time</div>
          <div class="metric-value" id="b_dns">-- ms</div>
        </div>
      </div>
      <div class="score-bar-container">
        <div class="score-label">
          <span>Degradation Score</span>
          <span id="b_deg_val">0.00</span>
        </div>
        <div class="progress-track">
          <div id="b_deg_bar" class="progress-fill" style="width: 0%; background: var(--green);"></div>
        </div>
        <div class="score-label">
          <span>Critical Score</span>
          <span id="b_crit_val">0.00</span>
        </div>
        <div class="progress-track">
          <div id="b_crit_bar" class="progress-fill" style="width: 0%; background: var(--blue);"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <!-- 8D Feature Vector -->
    <div class="card">
      <div class="card-header">
        <h2>8-Dimensional Sliding Window Vector</h2>
        <span class="tag">50 Samples (5.0s) Mean</span>
      </div>
      <div class="vector-box" id="vectorBox">
        [A_lat, A_jit, A_loss, A_dns, B_lat, B_jit, B_loss, B_dns]: Loading...
      </div>
      <p style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">
        Evaluated every 500ms by the TinyML link health heuristic engine.
      </p>
    </div>

    <!-- Event History -->
    <div class="card">
      <div class="card-header">
        <h2>State Transition & Failover Log</h2>
        <span class="tag">Live Callbacks</span>
      </div>
      <div class="events-list" id="eventsList">
        <div class="event-item normal">[System Initialized] State machine nominal.</div>
      </div>
    </div>
  </div>

  <script>
    async function triggerPreset(name) {
      try {
        await fetch('/api/presets/' + name, { method: 'POST' });
      } catch (err) {
        console.error('Trigger error:', err);
      }
    }

    function updateScoreBar(barId, valId, val) {
      const el = document.getElementById(barId);
      const valEl = document.getElementById(valId);
      if (valEl) valEl.innerText = val.toFixed(2);
      if (!el) return;
      const pct = Math.min(100, Math.max(0, val * 100));
      el.style.width = pct + '%';
      if (val > 0.85) el.style.background = 'var(--red)';
      else if (val > 0.60) el.style.background = 'var(--yellow)';
      else el.style.background = 'var(--green)';
    }

    function renderStatus(data) {
      if (!data) return;
      const state = data.current_state;
      const path = data.active_path;
      const evalData = data.evaluation || {};
      const sample = data.latest_sample || {};
      const portA = sample.port_a || {};
      const portB = sample.port_b || {};

      // State badge
      const badge = document.getElementById('stateBadge');
      const stateText = document.getElementById('stateText');
      stateText.innerText = state + ' (' + path + ')';
      badge.className = 'state-badge';
      if (state === 'STATE_NORMAL') badge.classList.add('state-normal');
      else if (state === 'STATE_WARNING') badge.classList.add('state-warning');
      else if (state === 'FAILOVER_PORT_B') badge.classList.add('state-failover');
      else if (state === 'MESH_ACTIVE') badge.classList.add('state-mesh');

      // Port active tags
      const tagA = document.getElementById('badgePortA');
      const tagB = document.getElementById('badgePortB');
      if (path === 'PORT_A') {
        tagA.className = 'tag active'; tagA.innerText = 'ACTIVE PATH';
        tagB.className = 'tag'; tagB.innerText = 'STANDBY';
      } else if (path === 'PORT_B') {
        tagA.className = 'tag'; tagA.innerText = 'FAILOVER';
        tagB.className = 'tag active'; tagB.innerText = 'ACTIVE PATH';
      } else if (path === 'MESH') {
        tagA.className = 'tag active'; tagA.innerText = 'MESH ACTIVE';
        tagB.className = 'tag active'; tagB.innerText = 'MESH ACTIVE';
      }

      // Port A Metrics
      if (portA.latency_ms !== undefined) {
        document.getElementById('a_lat').innerText = portA.latency_ms + ' ms';
        document.getElementById('a_jit').innerText = portA.jitter_ms + ' ms';
        document.getElementById('a_loss').innerText = portA.packet_loss_pct + ' %';
        document.getElementById('a_dns').innerText = portA.dns_time_ms + ' ms';
      }

      // Port B Metrics
      if (portB.latency_ms !== undefined) {
        document.getElementById('b_lat').innerText = portB.latency_ms + ' ms';
        document.getElementById('b_jit').innerText = portB.jitter_ms + ' ms';
        document.getElementById('b_loss').innerText = portB.packet_loss_pct + ' %';
        document.getElementById('b_dns').innerText = portB.dns_time_ms + ' ms';
      }

      // Scores
      updateScoreBar('a_deg_bar', 'a_deg_val', evalData.port_a_degradation_score || 0);
      updateScoreBar('a_crit_bar', 'a_crit_val', evalData.port_a_critical_score || 0);
      updateScoreBar('b_deg_bar', 'b_deg_val', evalData.port_b_degradation_score || 0);
      updateScoreBar('b_crit_bar', 'b_crit_val', evalData.port_b_critical_score || 0);

      // 8D Feature Vector
      if (data.feature_vector_8d) {
        document.getElementById('vectorBox').innerText =
          '[' + data.feature_vector_8d.join(', ') + ']';
      }
    }

    async function fetchEvents() {
      try {
        const res = await fetch('/api/events');
        const data = await res.json();
        const list = document.getElementById('eventsList');
        if (data.events && data.events.length > 0) {
          list.innerHTML = data.events.slice(-10).reverse().map(e => {
            let cls = 'normal';
            if (e.new_state.includes('WARNING')) cls = 'warning';
            else if (e.new_state.includes('FAILOVER')) cls = 'failover';
            else if (e.new_state.includes('MESH')) cls = 'mesh';
            return `<div class="event-item ${cls}">[${e.iso_time}] ${e.old_state} &rarr; ${e.new_state} (${e.active_path}): ${e.message}</div>`;
          }).join('');
        }
      } catch (e) {}
    }

    // Connect WebSocket
    function connectWS() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws/telemetry`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          renderStatus(data);
        } catch (e) {}
      };
      ws.onclose = () => {
        setTimeout(connectWS, 1000);
      };
      ws.onerror = () => {
        ws.close();
      };
    }

    connectWS();
    setInterval(fetchEvents, 1000);
  </script>
</body>
</html>
"""
    return HTMLResponse(content=html)
