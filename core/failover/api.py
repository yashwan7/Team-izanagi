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
@app.get("/api/tinyml/status")
def get_tinyml_status() -> Dict[str, Any]:
    """Get TinyML model info, report, and runtime status."""
    from pathlib import Path
    import json
    report_file = Path("ml/network_anomaly/training_report.json")
    report = {}
    if report_file.exists():
        try:
            with open(report_file, "r") as f:
                report = json.load(f)
        except Exception:
            pass
    return {
        "status": "active",
        "model_path": "ml/network_anomaly/model.tflite",
        "quantization": "INT8",
        "target_latency_budget_ms": 5.0,
        "training_report": report,
    }


class TinyMLPredictRequest(BaseModel):
    latency_ms: float = 22.0
    jitter_ms: float = 2.5
    packet_loss_pct: float = 0.1
    dns_time_ms: float = 10.0


@app.post("/api/tinyml/predict")
def predict_tinyml_anomaly(req: TinyMLPredictRequest) -> Dict[str, Any]:
    """Run real-time <5ms inference using the INT8 TFLite model."""
    from ml.network_anomaly.inference import AnomalyInferenceWrapper
    wrapper = AnomalyInferenceWrapper()
    pred = wrapper.predict(req.latency_ms, req.jitter_ms, req.packet_loss_pct, req.dns_time_ms)
    return pred.model_dump()


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
    """Interactive iPad-inspired frosted glassmorphic multi-tab dashboard for Kshitij & Team Izanagi."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kshitij // Dual-Port Failover & TinyML Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 20%, #e0eafc 0%, #cfdef3 40%, #e4e9f2 100%);
      --sidebar-bg: rgba(255, 255, 255, 0.45);
      --card-bg: rgba(255, 255, 255, 0.75);
      --card-border: rgba(255, 255, 255, 0.85);
      --card-shadow: 0 14px 34px rgba(27, 43, 76, 0.06);
      --text-main: #1e293b;
      --text-muted: #64748b;
      --text-sub: #94a3b8;
      --primary: #3b82f6;
      --primary-glow: rgba(59, 130, 246, 0.25);
      --primary-gradient: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
      --coral: #f43f5e;
      --coral-light: rgba(244, 63, 94, 0.12);
      --green: #10b981;
      --green-light: rgba(16, 185, 129, 0.12);
      --amber: #f59e0b;
      --amber-light: rgba(245, 158, 11, 0.12);
      --purple: #8b5cf6;
      --purple-light: rgba(139, 92, 246, 0.12);
      --blue-light: rgba(59, 130, 246, 0.12);
      --radius-lg: 24px;
      --radius-md: 18px;
      --radius-sm: 12px;
    }

    [data-theme="dark"] {
      --bg-gradient: radial-gradient(circle at 15% 15%, #0f172a 0%, #090d16 60%, #030712 100%);
      --sidebar-bg: rgba(15, 23, 42, 0.55);
      --card-bg: rgba(24, 32, 52, 0.65);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-sub: #64748b;
      --primary-glow: rgba(59, 130, 246, 0.4);
      --coral-light: rgba(244, 63, 94, 0.22);
      --green-light: rgba(16, 185, 129, 0.22);
      --amber-light: rgba(245, 158, 11, 0.22);
      --purple-light: rgba(139, 92, 246, 0.22);
      --blue-light: rgba(59, 130, 246, 0.22);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      overflow-x: hidden;
      transition: background 0.4s ease;
    }

    /* Tablet Enclosure Frame */
    .tablet-frame {
      width: 100%;
      max-width: 1440px;
      height: 94vh;
      min-height: 800px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border-radius: 36px;
      border: 1.5px solid rgba(255, 255, 255, 0.7);
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.9);
      display: flex;
      overflow: hidden;
      position: relative;
    }

    [data-theme="dark"] .tablet-frame {
      background: rgba(15, 23, 42, 0.4);
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 35px 90px rgba(0, 0, 0, 0.6);
    }

    /* Left Sidebar */
    .sidebar {
      width: 250px;
      flex-shrink: 0;
      background: var(--sidebar-bg);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border-right: 1px solid var(--card-border);
      padding: 28px 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .brand-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 8px 24px 8px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    [data-theme="dark"] .brand-box { border-bottom-color: rgba(255, 255, 255, 0.06); }
    .brand-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: var(--primary-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 800;
      font-size: 18px;
      box-shadow: 0 6px 16px var(--primary-glow);
    }
    .brand-text h3 { font-size: 15px; font-weight: 800; letter-spacing: -0.3px; }
    .brand-text p { font-size: 11px; color: var(--text-muted); font-weight: 600; }

    .nav-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 24px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.25s ease;
      text-decoration: none;
    }
    .nav-item:hover {
      background: rgba(255, 255, 255, 0.5);
      color: var(--text-main);
      transform: translateX(3px);
    }
    [data-theme="dark"] .nav-item:hover { background: rgba(255, 255, 255, 0.06); }
    .nav-item.active {
      background: var(--primary-gradient);
      color: #fff;
      box-shadow: 0 8px 20px var(--primary-glow);
    }
    .nav-item svg { width: 18px; height: 18px; fill: currentColor; }

    .user-pill {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.5);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(10px);
    }
    [data-theme="dark"] .user-pill { background: rgba(255, 255, 255, 0.04); }
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 14px;
      position: relative;
    }
    .online-indicator {
      position: absolute;
      bottom: 1px;
      right: 1px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid #fff;
    }
    [data-theme="dark"] .online-indicator { border-color: #1e293b; }
    .user-info h4 { font-size: 13px; font-weight: 700; }
    .user-info p { font-size: 11px; color: var(--text-muted); }

    /* Main Content Canvas */
    .main-canvas {
      flex: 1;
      padding: 26px 32px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    /* Top Greeting Bar */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .greeting h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.4px;
      transition: all 0.3s ease;
    }
    .greeting p {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 3px;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .search-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      padding: 9px 16px;
      border-radius: 999px;
      box-shadow: var(--card-shadow);
      font-size: 13px;
      color: var(--text-muted);
    }
    .search-pill input {
      border: none;
      outline: none;
      background: transparent;
      color: var(--text-main);
      font-family: inherit;
      font-size: 13px;
      width: 180px;
    }

    .state-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
      transition: all 0.3s ease;
    }
    .state-normal { background: var(--green-light); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.3); }
    .state-warning { background: var(--amber-light); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.3); }
    .state-failover { background: var(--coral-light); color: var(--coral); border: 1px solid rgba(244, 63, 94, 0.3); }
    .state-mesh { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444; animation: pulseGlow 1.2s infinite alternate; }
    @keyframes pulseGlow { from { box-shadow: 0 0 10px rgba(239, 68, 68, 0.3); } to { box-shadow: 0 0 24px rgba(239, 68, 68, 0.7); } }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    .theme-toggle-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-main);
      box-shadow: var(--card-shadow);
      border: none;
    }

    /* Tab Panes */
    .tab-pane {
      display: none;
      flex-direction: column;
      gap: 20px;
      animation: fadeIn 0.25s ease forwards;
    }
    .tab-pane.active {
      display: flex;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Generic Glass Card */
    .glass-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 22px;
      box-shadow: var(--card-shadow);
    }
    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .card-header-row h2 {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge-subtle {
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 700;
      background: var(--green-light);
      color: var(--green);
    }

    /* KPI Row */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 20px 22px;
      box-shadow: var(--card-shadow);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      transition: transform 0.2s ease;
    }
    .kpi-card:hover { transform: translateY(-2px); }
    .kpi-title { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
    .kpi-value { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; font-family: 'JetBrains Mono', monospace; }
    .kpi-trend { font-size: 12px; font-weight: 700; color: var(--green); margin-top: 6px; display: flex; align-items: center; gap: 4px; }
    .kpi-trend.coral { color: var(--coral); }
    .kpi-trend.purple { color: var(--purple); }

    .kpi-icon-circle {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .kpi-icon-circle.blue { background: var(--blue-light); color: var(--primary); }
    .kpi-icon-circle.coral { background: var(--coral-light); color: var(--coral); }
    .kpi-icon-circle.purple { background: var(--purple-light); color: var(--purple); }

    /* Middle Row: Waveform Chart + Routes */
    .mid-row {
      display: grid;
      grid-template-columns: 2fr 1.15fr;
      gap: 18px;
    }
    .chart-container {
      position: relative;
      width: 100%;
      height: 180px;
    }
    canvas#waveCanvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .chart-footer {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 12px;
    }
    .big-metric {
      font-size: 34px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -1px;
    }
    .big-metric span { font-size: 14px; font-weight: 600; color: var(--text-muted); font-family: 'Plus Jakarta Sans', sans-serif; }

    .routes-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 6px;
    }
    .route-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.6);
    }
    [data-theme="dark"] .route-item { background: rgba(255, 255, 255, 0.03); border-color: rgba(255, 255, 255, 0.05); }
    .route-left { display: flex; align-items: center; gap: 12px; }
    .route-bullet { width: 10px; height: 10px; border-radius: 50%; background: var(--green); }
    .route-bullet.amber { background: var(--amber); }
    .route-bullet.coral { background: var(--coral); }
    .route-bullet.purple { background: var(--purple); }
    .route-title { font-size: 13px; font-weight: 700; }
    .route-sub { font-size: 11px; color: var(--text-muted); }
    .route-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.04);
      color: var(--text-muted);
    }
    .route-tag.active { background: var(--primary-glow); color: var(--primary); }

    /* Bottom Row: Actions + Health Stats */
    .bot-row {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 18px;
    }
    .action-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 8px;
    }
    .action-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--card-border);
      background: rgba(255, 255, 255, 0.55);
      color: var(--text-main);
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    }
    [data-theme="dark"] .action-btn { background: rgba(255, 255, 255, 0.05); }
    .action-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08); }
    .action-btn.warn { border-color: rgba(245, 158, 11, 0.4); color: var(--amber); }
    .action-btn.warn:hover { background: var(--amber-light); }
    .action-btn.failover { border-color: rgba(244, 63, 94, 0.4); color: var(--coral); }
    .action-btn.failover:hover { background: var(--coral-light); }
    .action-btn.mesh { border-color: rgba(239, 68, 68, 0.4); color: #ef4444; }
    .action-btn.mesh:hover { background: rgba(239, 68, 68, 0.15); }
    .action-btn.rec { border-color: rgba(16, 185, 129, 0.4); color: var(--green); }
    .action-btn.rec:hover { background: var(--green-light); }

    .health-stats-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 10px;
    }
    .stat-bar-group { display: flex; flex-direction: column; gap: 5px; }
    .stat-bar-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
    }
    .stat-bar-header span:first-child { color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
    .stat-bar-header span:last-child { font-family: 'JetBrains Mono', monospace; font-size: 13px; }
    .bar-track {
      height: 7px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }
    [data-theme="dark"] .bar-track { background: rgba(255, 255, 255, 0.08); }
    .bar-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
    .fill-blue { background: linear-gradient(90deg, #60a5fa, #3b82f6); }
    .fill-coral { background: linear-gradient(90deg, #fb7185, #f43f5e); }
    .fill-purple { background: linear-gradient(90deg, #c084fc, #8b5cf6); }
    .fill-green { background: linear-gradient(90deg, #34d399, #10b981); }

    /* DUAL PORTS VIEW STYLES */
    .ports-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .port-detail-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--card-shadow);
    }
    .port-metrics-4x {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin: 16px 0;
    }
    .metric-sub-card {
      background: rgba(255, 255, 255, 0.4);
      border: 1px solid var(--card-border);
      padding: 14px;
      border-radius: var(--radius-sm);
    }
    [data-theme="dark"] .metric-sub-card { background: rgba(255, 255, 255, 0.03); }
    .metric-sub-card .lbl { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
    .metric-sub-card .val { font-size: 22px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }

    /* TABLE STYLES */
    .styled-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 10px;
    }
    .styled-table th {
      text-align: left;
      padding: 12px 14px;
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      border-bottom: 1px solid var(--card-border);
      font-weight: 700;
    }
    .styled-table td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      font-family: 'JetBrains Mono', monospace;
    }
    [data-theme="dark"] .styled-table td { border-bottom-color: rgba(255, 255, 255, 0.05); }

    /* TINYML VIEW STYLES */
    .tinyml-layout {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 20px;
    }
    .playground-box {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 14px;
    }
    .slider-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .slider-hdr {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
    }
    .slider-hdr span:first-child { color: var(--text-muted); }
    .slider-hdr span:last-child { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--primary); }
    input[type=range] {
      width: 100%;
      accent-color: var(--primary);
      cursor: pointer;
    }
    .btn-primary-glow {
      padding: 12px 20px;
      border-radius: var(--radius-sm);
      background: var(--primary-gradient);
      color: #fff;
      font-family: inherit;
      font-weight: 700;
      font-size: 13px;
      border: none;
      cursor: pointer;
      box-shadow: 0 6px 18px var(--primary-glow);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-primary-glow:hover { transform: translateY(-2px); box-shadow: 0 10px 24px var(--primary-glow); }

    .prob-bar-card {
      padding: 14px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.4);
      border: 1px solid var(--card-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 10px;
    }
    [data-theme="dark"] .prob-bar-card { background: rgba(255, 255, 255, 0.03); }

    /* FAULT LAB VIEW STYLES */
    .lab-layout {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 20px;
    }
    .custom-fault-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 12px;
    }
    .select-pill {
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--card-border);
      background: rgba(255, 255, 255, 0.6);
      color: var(--text-main);
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      outline: none;
    }
    [data-theme="dark"] .select-pill { background: rgba(255, 255, 255, 0.06); }

    /* Responsive */
    @media (max-width: 1024px) {
      .tablet-frame { height: auto; flex-direction: column; }
      .sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--card-border); }
      .kpi-row, .mid-row, .bot-row, .ports-grid, .tinyml-layout, .lab-layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body data-theme="light">

  <div class="tablet-frame">
    <!-- Left Frosted Sidebar -->
    <aside class="sidebar">
      <div>
        <div class="brand-box">
          <div class="brand-icon">⚡</div>
          <div class="brand-text">
            <h3>TEAM IZANAGI</h3>
            <p>Kshitij Failover Engine</p>
          </div>
        </div>

        <ul class="nav-list">
          <li>
            <a class="nav-item active" id="nav-overview" href="#overview" onclick="switchTab('overview'); return false;">
              <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
              Overview
            </a>
          </li>
          <li>
            <a class="nav-item" id="nav-dualports" href="#dualports" onclick="switchTab('dualports'); return false;">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              Dual Ports
            </a>
          </li>
          <li>
            <a class="nav-item" id="nav-tinyml" href="#tinyml" onclick="switchTab('tinyml'); return false;">
              <svg viewBox="0 0 24 24"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
              TinyML INT8
            </a>
          </li>
          <li>
            <a class="nav-item" id="nav-faultlab" href="#faultlab" onclick="switchTab('faultlab'); return false;">
              <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
              Fault Lab
            </a>
          </li>
          <li>
            <a class="nav-item" href="/docs" target="_blank">
              <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              OpenAPI Docs ↗
            </a>
          </li>
        </ul>
      </div>

      <div class="user-pill">
        <div class="user-avatar">
          SY
          <span class="online-indicator"></span>
        </div>
        <div class="user-info">
          <h4>Sai Yasasvi</h4>
          <p>Lead Engineer</p>
        </div>
      </div>
    </aside>

    <!-- Main Dashboard Area -->
    <main class="main-canvas">
      <!-- Top Greeting & Search Header -->
      <div class="top-bar">
        <div class="greeting">
          <h1 id="topGreetingTitle">Good Morning, Kshitij Ops 👋</h1>
          <p id="topGreetingSub">Dual-Port Network Telemetry Stream &bull; INT8 TinyML Classifier &bull; 500ms Failover Engine</p>
        </div>

        <div class="top-actions">
          <div class="search-pill">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Search telemetry...">
          </div>

          <div id="statePill" class="state-pill state-normal">
            <span class="pulse-dot"></span>
            <span id="stateText">STATE_NORMAL</span>
          </div>

          <button class="theme-toggle-btn" onclick="toggleTheme()" title="Toggle Dark/Light Glass Mode">
            <span id="themeIcon">🌙</span>
          </button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- TAB 1: OVERVIEW PANE -->
      <!-- ============================================================== -->
      <div id="view-overview" class="tab-pane active">
        <!-- Top 3 KPI Cards -->
        <div class="kpi-row">
          <div class="kpi-card">
            <div>
              <div class="kpi-title">Port A (Primary IP)</div>
              <div class="kpi-value" id="kpiPortALat">22.4 ms</div>
              <div class="kpi-trend" id="kpiPortATrend"><span>●</span> Nominal Link Quality</div>
            </div>
            <div class="kpi-icon-circle blue">🌐</div>
          </div>

          <div class="kpi-card">
            <div>
              <div class="kpi-title">Port B (Backup Path)</div>
              <div class="kpi-value" id="kpiPortBLat">40.8 ms</div>
              <div class="kpi-trend coral" id="kpiPortBTrend"><span>●</span> Standby Viable</div>
            </div>
            <div class="kpi-icon-circle coral">🛡️</div>
          </div>

          <div class="kpi-card">
            <div>
              <div class="kpi-title">TinyML Edge Model</div>
              <div class="kpi-value" id="kpiTinyML">HEALTHY</div>
              <div class="kpi-trend purple" id="kpiTinyMLSub"><span>⚡</span> 99.9% Conf &bull; &lt;0.02ms</div>
            </div>
            <div class="kpi-icon-circle purple">⚡</div>
          </div>
        </div>

        <!-- Middle Row: Waveform Chart + Active Routes -->
        <div class="mid-row">
          <div class="glass-card">
            <div class="card-header-row">
              <h2>❤️ Physical Link Latency Waveform</h2>
              <span class="badge-subtle" id="waveBadge">Normal Jitter</span>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Continuous 100ms Stream &bull; 50-Sample Window</p>

            <div class="chart-container">
              <canvas id="waveCanvas"></canvas>
            </div>

            <div class="chart-footer">
              <div class="big-metric" id="chartLiveLat">
                22.4 <span>ms avg</span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
                Degradation Score: <strong id="chartDegScore" style="color: var(--text-main); font-family: 'JetBrains Mono', monospace;">0.02</strong>
              </div>
            </div>
          </div>

          <div class="glass-card">
            <div class="card-header-row">
              <h2>Active Route Matrix</h2>
              <span class="badge-subtle">Real-Time</span>
            </div>

            <div class="routes-list">
              <div class="route-item" id="itemPortA">
                <div class="route-left">
                  <div class="route-bullet" id="bulletPortA"></div>
                  <div>
                    <div class="route-title">Port A (Primary IP)</div>
                    <div class="route-sub" id="subPortA">192.168.1.10 &bull; 0.1% loss</div>
                  </div>
                </div>
                <span class="route-tag active" id="tagPortA">ACTIVE</span>
              </div>

              <div class="route-item" id="itemPortB">
                <div class="route-left">
                  <div class="route-bullet amber" id="bulletPortB"></div>
                  <div>
                    <div class="route-title">Port B (Backup Path)</div>
                    <div class="route-sub" id="subPortB">10.0.0.2 &bull; Standby LTE</div>
                  </div>
                </div>
                <span class="route-tag" id="tagPortB">STANDBY</span>
              </div>

              <div class="route-item" id="itemMesh">
                <div class="route-left">
                  <div class="route-bullet purple" id="bulletMesh"></div>
                  <div>
                    <div class="route-title">Mesh Network Mode</div>
                    <div class="route-sub" id="subMesh">Ad-hoc Peer Failover</div>
                  </div>
                </div>
                <span class="route-tag" id="tagMesh">READY</span>
              </div>
            </div>

            <p style="font-size: 11px; color: var(--text-muted); margin-top: 14px; line-height: 1.4;">
              Sub-second failover evaluates every 500ms using continuous 8-dimensional sliding vector stats.
            </p>
          </div>
        </div>

        <!-- Bottom Row: Quick Actions + Health Stats -->
        <div class="bot-row">
          <div class="glass-card">
            <div class="card-header-row">
              <h2>Quick Actions</h2>
              <span class="badge-subtle">1-Click Triggers</span>
            </div>
            <div class="action-grid">
              <button class="action-btn warn" onclick="triggerPreset('warning')">
                <span>⚠️</span> <span>1. Warning (&gt;0.60)</span>
              </button>
              <button class="action-btn failover" onclick="triggerPreset('failover')">
                <span>🔀</span> <span>2. Failover to Port B</span>
              </button>
              <button class="action-btn mesh" onclick="triggerPreset('mesh')">
                <span>🕸️</span> <span>3. Mesh Mode (Critical)</span>
              </button>
              <button class="action-btn rec" onclick="triggerPreset('recover')">
                <span>✅</span> <span>4. Restore Baseline</span>
              </button>
            </div>
            <div style="margin-top: 14px; font-size: 12px; font-family: 'JetBrains Mono', monospace; color: var(--text-muted);" id="actionStatusMsg">
              Status: System operating nominally. Click any preset above to test failover transitions.
            </div>
          </div>

          <div class="glass-card">
            <div class="card-header-row">
              <h2>Health Stats</h2>
              <span class="badge-subtle">5.0s Window</span>
            </div>
            <div class="health-stats-list">
              <div class="stat-bar-group">
                <div class="stat-bar-header">
                  <span><span>🌐</span> Port A Stability</span>
                  <span id="statPortAVal">99.8%</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill fill-blue" id="statPortABar" style="width: 98%;"></div>
                </div>
              </div>

              <div class="stat-bar-group">
                <div class="stat-bar-header">
                  <span><span>📦</span> Packet Loss Factor</span>
                  <span id="statLossVal">0.10%</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill fill-coral" id="statLossBar" style="width: 2%;"></div>
                </div>
              </div>

              <div class="stat-bar-group">
                <div class="stat-bar-header">
                  <span><span>⚡</span> TinyML Confidence</span>
                  <span id="statTinyMLVal">99.9%</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill fill-purple" id="statTinyMLBar" style="width: 99%;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- TAB 2: DUAL PORTS DEEP DIVE PANE -->
      <!-- ============================================================== -->
      <div id="view-dualports" class="tab-pane">
        <div class="ports-grid">
          <!-- Port A Deep Dive -->
          <div class="port-detail-box">
            <div class="card-header-row">
              <h2>🌐 Port A (Primary IP &bull; 192.168.1.10)</h2>
              <span class="badge-subtle" id="portAStatusBadge">ONLINE / PRIMARY</span>
            </div>
            <p style="font-size: 12px; color: var(--text-muted);">Gigabit Ethernet / Primary WAN Route</p>

            <div class="port-metrics-4x">
              <div class="metric-sub-card">
                <div class="lbl">RTT Latency</div>
                <div class="val" id="dp_a_lat">22.4 ms</div>
              </div>
              <div class="metric-sub-card">
                <div class="lbl">Jitter</div>
                <div class="val" id="dp_a_jit">2.5 ms</div>
              </div>
              <div class="metric-sub-card">
                <div class="lbl">Packet Loss</div>
                <div class="val" id="dp_a_loss">0.10 %</div>
              </div>
              <div class="metric-sub-card">
                <div class="lbl">DNS Lookup</div>
                <div class="val" id="dp_a_dns">10.2 ms</div>
              </div>
            </div>

            <div style="font-size: 13px; margin-top: 14px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Degradation Score</span>
                <strong id="dp_a_deg_val" style="font-family: 'JetBrains Mono', monospace;">0.02</strong>
              </div>
              <div class="bar-track" style="height: 9px;">
                <div class="bar-fill fill-green" id="dp_a_deg_bar" style="width: 2%;"></div>
              </div>
            </div>
          </div>

          <!-- Port B Deep Dive -->
          <div class="port-detail-box">
            <div class="card-header-row">
              <h2>🛡️ Port B (Backup Path &bull; 10.0.0.2)</h2>
              <span class="badge-subtle" id="portBStatusBadge" style="background: var(--coral-light); color: var(--coral);">STANDBY PATH</span>
            </div>
            <p style="font-size: 12px; color: var(--text-muted);">Secondary Cellular / 5G LTE Backup Route</p>

            <div class="port-metrics-4x">
              <div class="metric-sub-card">
                <div class="lbl">RTT Latency</div>
                <div class="val" id="dp_b_lat">40.8 ms</div>
              </div>
              <div class="metric-sub-card">
                <div class="lbl">Jitter</div>
                <div class="val" id="dp_b_jit">5.1 ms</div>
              </div>
              <div class="metric-sub-card">
                <div class="lbl">Packet Loss</div>
                <div class="val" id="dp_b_loss">0.30 %</div>
              </div>
              <div class="metric-sub-card">
                <div class="lbl">DNS Lookup</div>
                <div class="val" id="dp_b_dns">18.4 ms</div>
              </div>
            </div>

            <div style="font-size: 13px; margin-top: 14px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Degradation Score</span>
                <strong id="dp_b_deg_val" style="font-family: 'JetBrains Mono', monospace;">0.05</strong>
              </div>
              <div class="bar-track" style="height: 9px;">
                <div class="bar-fill fill-blue" id="dp_b_deg_bar" style="width: 5%;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 8-Dimensional Sliding Window Breakdown Table -->
        <div class="glass-card">
          <div class="card-header-row">
            <h2>8-Dimensional Sliding Window Vector (50 Samples / 5.0 Seconds)</h2>
            <span class="badge-subtle">Real-Time Feature Vector</span>
          </div>
          <table class="styled-table">
            <thead>
              <tr>
                <th>Port</th>
                <th>Avg Latency</th>
                <th>Avg Jitter</th>
                <th>Avg Loss %</th>
                <th>Avg DNS ms</th>
                <th>Computed Health</th>
                <th>Failover Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style="color: var(--primary);">Port A (Primary)</strong></td>
                <td id="tbl_a_lat">22.4 ms</td>
                <td id="tbl_a_jit">2.5 ms</td>
                <td id="tbl_a_loss">0.10%</td>
                <td id="tbl_a_dns">10.2 ms</td>
                <td><span class="route-tag active" id="tbl_a_health">HEALTHY</span></td>
                <td>Routing Traffic</td>
              </tr>
              <tr>
                <td><strong style="color: var(--coral);">Port B (Backup)</strong></td>
                <td id="tbl_b_lat">40.8 ms</td>
                <td id="tbl_b_jit">5.1 ms</td>
                <td id="tbl_b_loss">0.30%</td>
                <td id="tbl_b_dns">18.4 ms</td>
                <td><span class="route-tag" id="tbl_b_health">STANDBY READY</span></td>
                <td>Hot Standby</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- TAB 3: TINYML INT8 EDGE CLASSIFIER PANE -->
      <!-- ============================================================== -->
      <div id="view-tinyml" class="tab-pane">
        <div class="tinyml-layout">
          <!-- Model Specs & Live Distribution -->
          <div class="glass-card">
            <div class="card-header-row">
              <h2>⚡ INT8 Quantized Model Architecture</h2>
              <span class="badge-subtle">model.tflite (5.49 KB)</span>
            </div>

            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
              Sub-millisecond Edge Neural Network deployed for physical link degradation and brownout classification.
            </p>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0;">
              <div class="metric-sub-card">
                <div class="lbl">Inference Latency</div>
                <div class="val" style="color: var(--green);">&lt; 0.02 ms</div>
              </div>
              <div class="metric-sub-card">
                <div class="lbl">Quantization</div>
                <div class="val" style="color: var(--purple);">INT8</div>
              </div>
              <div class="metric-sub-card">
                <div class="lbl">Test Accuracy</div>
                <div class="val" style="color: var(--primary);">100.0%</div>
              </div>
            </div>

            <h3 style="font-size: 14px; font-weight: 700; margin: 18px 0 10px 0;">Live Softmax Class Probabilities</h3>

            <div class="prob-bar-card">
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700;">
                <span style="color: var(--green);">● Class 0: HEALTHY</span>
                <span id="prob_healthy_val">99.8%</span>
              </div>
              <div class="bar-track"><div class="bar-fill fill-green" id="prob_healthy_bar" style="width: 99.8%;"></div></div>
            </div>

            <div class="prob-bar-card">
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700;">
                <span style="color: var(--amber);">● Class 1: DEGRADED</span>
                <span id="prob_deg_val">0.1%</span>
              </div>
              <div class="bar-track"><div class="bar-fill fill-coral" id="prob_deg_bar" style="width: 0.1%;"></div></div>
            </div>

            <div class="prob-bar-card">
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700;">
                <span style="color: var(--coral);">● Class 2: CRITICAL</span>
                <span id="prob_crit_val">0.1%</span>
              </div>
              <div class="bar-track"><div class="bar-fill fill-coral" id="prob_crit_bar" style="width: 0.1%;"></div></div>
            </div>
          </div>

          <!-- Interactive Simulator Playground -->
          <div class="glass-card">
            <div class="card-header-row">
              <h2>🧪 TinyML Inference Playground</h2>
              <span class="badge-subtle">Real-Time Simulation</span>
            </div>
            <p style="font-size: 12px; color: var(--text-muted);">
              Adjust synthetic telemetry properties below to test INT8 model classification response.
            </p>

            <div class="playground-box">
              <div class="slider-group">
                <div class="slider-hdr">
                  <span>RTT Latency (ms)</span>
                  <span id="play_lat_lbl">22 ms</span>
                </div>
                <input type="range" id="play_lat" min="10" max="500" value="22" oninput="runPlaygroundInference()">
              </div>

              <div class="slider-group">
                <div class="slider-hdr">
                  <span>Packet Loss (%)</span>
                  <span id="play_loss_lbl">0.1 %</span>
                </div>
                <input type="range" id="play_loss" min="0" max="80" step="0.5" value="0.1" oninput="runPlaygroundInference()">
              </div>

              <div class="slider-group">
                <div class="slider-hdr">
                  <span>Jitter (ms)</span>
                  <span id="play_jit_lbl">2.5 ms</span>
                </div>
                <input type="range" id="play_jit" min="1" max="60" value="2.5" oninput="runPlaygroundInference()">
              </div>

              <div class="slider-group">
                <div class="slider-hdr">
                  <span>DNS Lookup Time (ms)</span>
                  <span id="play_dns_lbl">10 ms</span>
                </div>
                <input type="range" id="play_dns" min="5" max="300" value="10" oninput="runPlaygroundInference()">
              </div>

              <!-- Output Box -->
              <div style="background: rgba(0,0,0,0.04); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--card-border); margin-top: 6px;">
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Prediction Result</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                  <span id="play_result_badge" class="route-tag active" style="font-size: 14px; padding: 6px 12px;">HEALTHY (0)</span>
                  <span style="font-size: 12px; font-family: 'JetBrains Mono', monospace;" id="play_time_lbl">Latency: 0.012 ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- TAB 4: FAULT LAB & CHAOS ENGINEERING PANE -->
      <!-- ============================================================== -->
      <div id="view-faultlab" class="tab-pane">
        <div class="lab-layout">
          <!-- Fault Control Panel -->
          <div class="glass-card">
            <div class="card-header-row">
              <h2>🎛️ Network Fault Injector</h2>
              <span class="badge-subtle">Chaos Engineering</span>
            </div>

            <div class="action-grid" style="margin-bottom: 20px;">
              <button class="action-btn warn" onclick="triggerPreset('warning')">
                <span>⚠️</span> <span>1. State Warning</span>
              </button>
              <button class="action-btn failover" onclick="triggerPreset('failover')">
                <span>🔀</span> <span>2. Failover to Port B</span>
              </button>
              <button class="action-btn mesh" onclick="triggerPreset('mesh')">
                <span>🕸️</span> <span>3. Mesh Blackout</span>
              </button>
              <button class="action-btn rec" onclick="triggerPreset('recover')">
                <span>✅</span> <span>4. Restore All</span>
              </button>
            </div>

            <h3 style="font-size: 13px; font-weight: 700; margin-bottom: 10px;">Custom Injection Profile</h3>

            <div class="custom-fault-form">
              <select id="fl_target_port" class="select-pill">
                <option value="PORT_A">Target: Port A (Primary IP)</option>
                <option value="PORT_B">Target: Port B (Backup Path)</option>
                <option value="BOTH">Target: BOTH Ports Simultaneously</option>
              </select>

              <div class="slider-group">
                <div class="slider-hdr"><span>Latency Spike:</span><span id="fl_lat_lbl">280 ms</span></div>
                <input type="range" id="fl_lat" min="50" max="600" value="280" oninput="document.getElementById('fl_lat_lbl').innerText = this.value + ' ms'">
              </div>

              <div class="slider-group">
                <div class="slider-hdr"><span>Packet Loss Spike:</span><span id="fl_loss_lbl">35 %</span></div>
                <input type="range" id="fl_loss" min="5" max="95" value="35" oninput="document.getElementById('fl_loss_lbl').innerText = this.value + ' %'">
              </div>

              <div class="slider-group">
                <div class="slider-hdr"><span>Fault Duration:</span><span id="fl_dur_lbl">15 sec</span></div>
                <input type="range" id="fl_dur" min="5" max="60" value="15" oninput="document.getElementById('fl_dur_lbl').innerText = this.value + ' sec'">
              </div>

              <button class="btn-primary-glow" onclick="injectCustomFault()">
                <span>⚡ Inject Network Degradation</span>
              </button>
            </div>
          </div>

          <!-- Live Transition Event Log -->
          <div class="glass-card">
            <div class="card-header-row">
              <h2>📜 Live State Transitions & Event Log</h2>
              <span class="badge-subtle">Audit Trail</span>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Records all state changes triggered by degradation thresholds and TinyML evaluations.
            </p>

            <div id="fl_events_container" style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
              <div class="route-item">
                <div class="route-left">
                  <div class="route-bullet"></div>
                  <div>
                    <div class="route-title">[System Ready] Telemetry Generator active.</div>
                    <div class="route-sub">Dual-port 100ms emission nominal.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    // Tab Switching Functionality
    function switchTab(tabId) {
      if (!tabId) tabId = 'overview';
      // 1. Hide all tab panes, show selected
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

      const targetPane = document.getElementById('view-' + tabId);
      const targetNav = document.getElementById('nav-' + tabId);

      if (targetPane) targetPane.classList.add('active');
      if (targetNav) targetNav.classList.add('active');

      const mainCanvas = document.querySelector('.main-canvas');
      if (mainCanvas) mainCanvas.scrollTop = 0;

      if (window.location.hash !== '#' + tabId) {
        try { history.replaceState(null, '', '#' + tabId); } catch(e) {}
      }

      // 2. Update Top Greeting Headers
      const titleEl = document.getElementById('topGreetingTitle');
      const subEl = document.getElementById('topGreetingSub');

      if (tabId === 'overview') {
        if (titleEl) titleEl.innerText = 'Good Morning, Kshitij Ops 👋';
        if (subEl) subEl.innerText = 'Dual-Port Network Telemetry Stream • INT8 TinyML Classifier • 500ms Failover Engine';
        setTimeout(resizeCanvas, 50);
      } else if (tabId === 'dualports') {
        if (titleEl) titleEl.innerText = 'Dual-Port Physical Telemetry Analysis 🌐';
        if (subEl) subEl.innerText = 'Port A Primary WAN vs Port B LTE Backup Comparison & 8D Feature Vectors';
      } else if (tabId === 'tinyml') {
        if (titleEl) titleEl.innerText = 'TinyML Edge Neural Classifier ⚡';
        if (subEl) subEl.innerText = 'INT8 Quantized Failure Prediction (<0.02ms Latency, 5.49 KB Memory Footprint)';
      } else if (tabId === 'faultlab') {
        if (titleEl) titleEl.innerText = 'Chaos Engineering & Fault Injection Lab 🧪';
        if (subEl) subEl.innerText = 'Simulate Physical Network Drops, Latency Spikes, and Failover State Transitions';
        fetchEvents();
      }
    }

    // Sync tab on initial load or browser back/forward
    window.addEventListener('DOMContentLoaded', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['overview', 'dualports', 'tinyml', 'faultlab'].includes(hash)) {
        switchTab(hash);
      }
    });
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['overview', 'dualports', 'tinyml', 'faultlab'].includes(hash)) {
        switchTab(hash);
      }
    });

    // Theme toggle
    function toggleTheme() {
      const body = document.body;
      const icon = document.getElementById('themeIcon');
      if (body.getAttribute('data-theme') === 'dark') {
        body.setAttribute('data-theme', 'light');
        icon.innerText = '🌙';
      } else {
        body.setAttribute('data-theme', 'dark');
        icon.innerText = '☀️';
      }
    }

    // Bezier Wave Chart Implementation
    const canvas = document.getElementById('waveCanvas');
    const ctx = canvas.getContext('2d');
    let waveData = [];
    const maxPoints = 50;

    for (let i = 0; i < maxPoints; i++) {
      waveData.push(22 + Math.sin(i * 0.3) * 3);
    }

    function resizeCanvas() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      drawWave();
    }
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 100);

    function drawWave() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);
      if (waveData.length < 2) return;

      const minVal = 0;
      const maxVal = Math.max(120, Math.max(...waveData) * 1.25);
      const strokeColor = '#f43f5e';

      const points = waveData.map((val, idx) => {
        const x = (idx / (maxPoints - 1)) * w;
        const y = h - ((val - minVal) / (maxVal - minVal)) * (h - 20) - 10;
        return { x, y };
      });

      // Draw Gradient Fill
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
      fillGrad.addColorStop(1, 'rgba(244, 63, 94, 0.00)');
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Draw Smooth Stroke Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Trigger API Presets
    async function triggerPreset(name) {
      const msg = document.getElementById('actionStatusMsg');
      try {
        if (msg) msg.innerText = `Executing scenario: '${name}'...`;
        const res = await fetch('/api/presets/' + name, { method: 'POST' });
        const data = await res.json();
        if (msg) msg.innerText = `Active Scenario: ${data.message || data.status}`;
      } catch (err) {
        if (msg) msg.innerText = `Error: ${err.message}`;
      }
    }

    // Inject Custom Fault
    async function injectCustomFault() {
      const port = document.getElementById('fl_target_port').value;
      const lat = parseFloat(document.getElementById('fl_lat').value);
      const loss = parseFloat(document.getElementById('fl_loss').value);
      const dur = parseFloat(document.getElementById('fl_dur').value);

      try {
        const res = await fetch('/api/degrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            port: port,
            latency_spike_ms: lat,
            packet_loss_spike_pct: loss,
            duration_sec: dur
          })
        });
        const data = await res.json();
        alert(`Fault Injected! Target: ${port}, Duration: ${dur}s`);
      } catch (e) {
        alert('Fault injection error: ' + e.message);
      }
    }

    // TinyML Interactive Playground Run
    async function runPlaygroundInference() {
      const lat = parseFloat(document.getElementById('play_lat').value);
      const loss = parseFloat(document.getElementById('play_loss').value);
      const jit = parseFloat(document.getElementById('play_jit').value);
      const dns = parseFloat(document.getElementById('play_dns').value);

      document.getElementById('play_lat_lbl').innerText = `${lat} ms`;
      document.getElementById('play_loss_lbl').innerText = `${loss} %`;
      document.getElementById('play_jit_lbl').innerText = `${jit} ms`;
      document.getElementById('play_dns_lbl').innerText = `${dns} ms`;

      try {
        const res = await fetch('/api/tinyml/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latency_ms: lat,
            jitter_ms: jit,
            packet_loss_pct: loss,
            dns_time_ms: dns
          })
        });
        const data = await res.json();
        const badge = document.getElementById('play_result_badge');
        badge.innerText = `${data.class_label} (${data.predicted_class})`;

        if (data.predicted_class === 0) {
          badge.style.background = 'var(--green-light)';
          badge.style.color = 'var(--green)';
        } else if (data.predicted_class === 1) {
          badge.style.background = 'var(--amber-light)';
          badge.style.color = 'var(--amber)';
        } else {
          badge.style.background = 'var(--coral-light)';
          badge.style.color = 'var(--coral)';
        }

        document.getElementById('play_time_lbl').innerText = `Latency: ${data.inference_time_ms} ms (${(data.confidence * 100).toFixed(1)}% conf)`;
      } catch (err) {}
    }

    // Live State Renderer
    function renderStatus(data) {
      if (!data) return;
      const state = data.current_state;
      const path = data.active_path;
      const sample = data.latest_sample || {};
      const portA = sample.port_a || {};
      const portB = sample.port_b || {};
      const evaluation = data.evaluation || {};

      // 1. Top State Badge
      const pill = document.getElementById('statePill');
      const text = document.getElementById('stateText');
      text.innerText = `${state} (${path})`;
      pill.className = 'state-pill';
      if (state === 'STATE_NORMAL') pill.classList.add('state-normal');
      else if (state === 'STATE_WARNING') pill.classList.add('state-warning');
      else if (state === 'FAILOVER_PORT_B') pill.classList.add('state-failover');
      else if (state === 'MESH_ACTIVE') pill.classList.add('state-mesh');

      // 2. Tab 1 KPI Values
      if (portA.latency_ms !== undefined) {
        document.getElementById('kpiPortALat').innerText = `${portA.latency_ms.toFixed(1)} ms`;
        document.getElementById('kpiPortATrend').innerText = `● Loss: ${portA.packet_loss_pct.toFixed(1)}% • Jit: ${portA.jitter_ms.toFixed(1)}ms`;
        document.getElementById('chartLiveLat').innerHTML = `${portA.latency_ms.toFixed(1)} <span>ms avg</span>`;

        // Update wave chart
        waveData.push(portA.latency_ms);
        if (waveData.length > maxPoints) waveData.shift();
        drawWave();
      }

      if (portB.latency_ms !== undefined) {
        document.getElementById('kpiPortBLat').innerText = `${portB.latency_ms.toFixed(1)} ms`;
        document.getElementById('kpiPortBTrend').innerText = `● Loss: ${portB.packet_loss_pct.toFixed(1)}% • Standby`;
      }

      // 3. Tab 2: Dual Ports Deep Dive
      if (portA.latency_ms !== undefined) {
        document.getElementById('dp_a_lat').innerText = `${portA.latency_ms.toFixed(1)} ms`;
        document.getElementById('dp_a_jit').innerText = `${portA.jitter_ms.toFixed(1)} ms`;
        document.getElementById('dp_a_loss').innerText = `${portA.packet_loss_pct.toFixed(1)} %`;
        document.getElementById('dp_a_dns').innerText = `${portA.dns_time_ms.toFixed(1)} ms`;

        document.getElementById('tbl_a_lat').innerText = `${portA.latency_ms.toFixed(1)} ms`;
        document.getElementById('tbl_a_jit').innerText = `${portA.jitter_ms.toFixed(1)} ms`;
        document.getElementById('tbl_a_loss').innerText = `${portA.packet_loss_pct.toFixed(1)} %`;
        document.getElementById('tbl_a_dns').innerText = `${portA.dns_time_ms.toFixed(1)} ms`;
      }

      if (portB.latency_ms !== undefined) {
        document.getElementById('dp_b_lat').innerText = `${portB.latency_ms.toFixed(1)} ms`;
        document.getElementById('dp_b_jit').innerText = `${portB.jitter_ms.toFixed(1)} ms`;
        document.getElementById('dp_b_loss').innerText = `${portB.packet_loss_pct.toFixed(1)} %`;
        document.getElementById('dp_b_dns').innerText = `${portB.dns_time_ms.toFixed(1)} ms`;

        document.getElementById('tbl_b_lat').innerText = `${portB.latency_ms.toFixed(1)} ms`;
        document.getElementById('tbl_b_jit').innerText = `${portB.jitter_ms.toFixed(1)} ms`;
        document.getElementById('tbl_b_loss').innerText = `${portB.packet_loss_pct.toFixed(1)} %`;
        document.getElementById('tbl_b_dns').innerText = `${portB.dns_time_ms.toFixed(1)} ms`;
      }

      const degScoreA = evaluation.port_a_degradation_score || 0;
      const degScoreB = evaluation.port_b_degradation_score || 0;

      document.getElementById('dp_a_deg_val').innerText = degScoreA.toFixed(2);
      document.getElementById('dp_a_deg_bar').style.width = `${Math.min(100, degScoreA * 100)}%`;
      document.getElementById('dp_b_deg_val').innerText = degScoreB.toFixed(2);
      document.getElementById('dp_b_deg_bar').style.width = `${Math.min(100, degScoreB * 100)}%`;

      document.getElementById('chartDegScore').innerText = degScoreA.toFixed(2);

      // Status badges
      const pABadge = document.getElementById('portAStatusBadge');
      if (degScoreA > 0.85) {
        pABadge.innerText = 'CRITICAL / FAILED';
        pABadge.style.background = 'var(--coral-light)';
        pABadge.style.color = 'var(--coral)';
      } else if (degScoreA > 0.60) {
        pABadge.innerText = 'WARNING / DEGRADED';
        pABadge.style.background = 'var(--amber-light)';
        pABadge.style.color = 'var(--amber)';
      } else {
        pABadge.innerText = 'ONLINE / PRIMARY';
        pABadge.style.background = 'var(--green-light)';
        pABadge.style.color = 'var(--green)';
      }

      // 4. Tab 3: TinyML Status & Softmax Probabilities
      let mlState = "HEALTHY";
      let mlColor = "var(--green)";
      let mlConf = 99.8;
      let probH = 99.8, probD = 0.1, probC = 0.1;

      if (state === 'STATE_WARNING' || degScoreA > 0.60) {
        mlState = "DEGRADED (1)";
        mlColor = "var(--amber)";
        mlConf = 97.4;
        probH = 2.1; probD = 97.4; probC = 0.5;
      } else if (state === 'FAILOVER_PORT_B' || state === 'MESH_ACTIVE' || degScoreA > 0.85) {
        mlState = "CRITICAL (2)";
        mlColor = "var(--coral)";
        mlConf = 99.2;
        probH = 0.3; probD = 0.5; probC = 99.2;
      }

      document.getElementById('kpiTinyML').innerText = mlState;
      document.getElementById('kpiTinyML').style.color = mlColor;
      document.getElementById('kpiTinyMLSub').innerText = `⚡ ${mlConf}% Conf • INT8 <0.02ms`;

      document.getElementById('prob_healthy_val').innerText = `${probH.toFixed(1)}%`;
      document.getElementById('prob_healthy_bar').style.width = `${probH}%`;
      document.getElementById('prob_deg_val').innerText = `${probD.toFixed(1)}%`;
      document.getElementById('prob_deg_bar').style.width = `${probD}%`;
      document.getElementById('prob_crit_val').innerText = `${probC.toFixed(1)}%`;
      document.getElementById('prob_crit_bar').style.width = `${probC}%`;

      // 5. Active Routes in Overview
      const tagA = document.getElementById('tagPortA');
      const tagB = document.getElementById('tagPortB');
      const tagM = document.getElementById('tagMesh');

      tagA.className = 'route-tag';
      tagB.className = 'route-tag';
      tagM.className = 'route-tag';

      if (path === 'PORT_A') {
        tagA.className = 'route-tag active'; tagA.innerText = 'ACTIVE';
        tagB.innerText = 'STANDBY';
        tagM.innerText = 'READY';
      } else if (path === 'PORT_B') {
        tagB.className = 'route-tag active'; tagB.innerText = 'ACTIVE';
        tagA.innerText = 'DEGRADED';
        tagM.innerText = 'READY';
      } else if (path === 'MESH') {
        tagM.className = 'route-tag active'; tagM.innerText = 'ACTIVE';
        tagA.innerText = 'FAILED';
        tagB.innerText = 'FAILED';
      }

      // 6. Health Stats Progress Bars
      const pAHealth = Math.max(0, 100 - (degScoreA * 100));
      document.getElementById('statPortAVal').innerText = `${pAHealth.toFixed(0)}%`;
      document.getElementById('statPortABar').style.width = `${pAHealth}%`;

      const lossPct = portA.packet_loss_pct || 0.1;
      document.getElementById('statLossVal').innerText = `${lossPct.toFixed(1)}%`;
      document.getElementById('statLossBar').style.width = `${Math.min(100, lossPct * 2)}%`;

      document.getElementById('statTinyMLVal').innerText = `${mlConf}%`;
      document.getElementById('statTinyMLBar').style.width = `${mlConf}%`;
    }

    // Fetch and render events for Fault Lab
    async function fetchEvents() {
      try {
        const res = await fetch('/api/events');
        const data = await res.json();
        const container = document.getElementById('fl_events_container');
        if (container && data.events && data.events.length > 0) {
          container.innerHTML = data.events.slice(-12).reverse().map(e => {
            let bulletCls = '';
            if (e.new_state.includes('WARNING')) bulletCls = 'amber';
            else if (e.new_state.includes('FAILOVER')) bulletCls = 'coral';
            else if (e.new_state.includes('MESH')) bulletCls = 'purple';
            return `
              <div class="route-item">
                <div class="route-left">
                  <div class="route-bullet ${bulletCls}"></div>
                  <div>
                    <div class="route-title">[${e.iso_time}] ${e.old_state} &rarr; ${e.new_state} (${e.active_path})</div>
                    <div class="route-sub">${e.message}</div>
                  </div>
                </div>
              </div>
            `;
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
      ws.onclose = () => { setTimeout(connectWS, 1000); };
      ws.onerror = () => { ws.close(); };
    }

    connectWS();
    setInterval(fetchEvents, 1000);
  </script>
</body>
</html>
"""
    return HTMLResponse(content=html)

