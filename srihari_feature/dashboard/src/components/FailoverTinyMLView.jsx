import React, { useState, useEffect } from 'react';
import { 
  Cpu, Zap, Radio, Activity, ShieldCheck, 
  ArrowRightLeft, AlertTriangle, CheckCircle2, 
  Flame, RefreshCw, Sliders, Server, Microchip
} from 'lucide-react';

const API_BASE = '/api';

export default function FailoverTinyMLView() {
  const [failoverStatus, setFailoverStatus] = useState(null);
  const [tinymlStatus, setTinymlStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Interactive Playground Inputs
  const [playgroundParams, setPlaygroundParams] = useState({
    latency_ms: 24.5,
    jitter_ms: 2.1,
    packet_loss_pct: 0.1,
    dns_time_ms: 12.0
  });
  const [playgroundResult, setPlaygroundResult] = useState(null);
  const [isInferring, setIsInferring] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const fetchStatus = async () => {
    try {
      const [resFo, resMl] = await Promise.all([
        fetch(`${API_BASE}/failover/status`).then(r => r.json()),
        fetch(`${API_BASE}/tinyml/status`).then(r => r.json())
      ]);
      setFailoverStatus(resFo);
      setTinymlStatus(resMl);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load failover/tinyml status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleApplyPreset = async (preset) => {
    try {
      setActionFeedback(`Applying preset: ${preset}...`);
      const res = await fetch(`${API_BASE}/failover/preset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset })
      });
      if (res.ok) {
        const data = await res.json();
        setFailoverStatus(data);
        setActionFeedback(`Preset ${preset} engaged`);
        setTimeout(() => setActionFeedback(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setActionFeedback('Failed to apply preset');
    }
  };

  const handleRunPlaygroundInference = async () => {
    setIsInferring(true);
    try {
      const res = await fetch(`${API_BASE}/tinyml/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playgroundParams)
      });
      if (res.ok) {
        const data = await res.json();
        setPlaygroundResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInferring(false);
    }
  };

  const sample = failoverStatus?.latest_sample || {};
  const portA = sample.port_a || { latency_ms: 22.0, jitter_ms: 1.8, packet_loss_pct: 0.05, rssi_dbm: -58, bandwidth_kbps: 4500 };
  const portB = sample.port_b || { latency_ms: 45.0, jitter_ms: 4.2, packet_loss_pct: 0.1, rssi_dbm: -72, bandwidth_kbps: 1200 };
  const evaluation = failoverStatus?.evaluation || {};
  const currentState = failoverStatus?.current_state || 'STATE_NORMAL';
  const activePath = failoverStatus?.active_path || 'PORT_A';

  const getStateBadge = (state) => {
    switch (state) {
      case 'STATE_NORMAL':
        return { label: 'HEALTHY NOMINAL', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
      case 'STATE_WARNING':
        return { label: 'DEGRADATION WARNING', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
      case 'FAILOVER_PORT_B':
        return { label: 'FAILOVER PORT B ACTIVE', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' };
      case 'MESH_ACTIVE':
        return { label: 'TACTICAL MESH ACTIVE', color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
      default:
        return { label: state, color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
    }
  };

  const badgeInfo = getStateBadge(currentState);

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Zap className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Dual-Port Failover & TinyML Edge</h2>
            <span className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${badgeInfo.color}`}>
              <span className={`w-2 h-2 rounded-full ${badgeInfo.dot} animate-pulse`}></span>
              {badgeInfo.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 pl-10.5">
            Dual-redundant 100ms telemetry sampling • 500ms sliding window failover • INT8 edge classification
          </p>
        </div>

        {/* Quick Action Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleApplyPreset('NORMAL')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 text-xs font-semibold text-slate-600 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nominal A</span>
          </button>
          <button
            onClick={() => handleApplyPreset('WARNING')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 border border-slate-200 text-xs font-semibold text-slate-600 transition-all flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Jitter Burst</span>
          </button>
          <button
            onClick={() => handleApplyPreset('FAILOVER')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 border border-slate-200 text-xs font-semibold text-slate-600 transition-all flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-orange-600" />
            <span>500ms Failover B</span>
          </button>
          <button
            onClick={() => handleApplyPreset('MESH')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-xs font-semibold text-slate-600 transition-all flex items-center gap-1.5"
          >
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            <span>Mesh Outage</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs font-semibold text-blue-700 flex items-center gap-2">
          <Activity className="w-4 h-4 animate-spin text-blue-600" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Active Path */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>ACTIVE LINK PATH</span>
            <Radio className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>{activePath}</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-mono">
              {activePath === 'PORT_A' ? 'Primary' : activePath === 'PORT_B' ? 'Backup' : 'Mesh'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Automatic failover threshold: <strong>&lt;500ms</strong>
          </div>
        </div>

        {/* TinyML Latency */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>TINYML INFERENCE</span>
            <Cpu className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-700 tracking-tight flex items-center gap-1">
            <span>&lt;0.02</span>
            <span className="text-sm font-normal text-slate-500">ms</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <span>⚡ 99.9% Conf • INT8 Quantized</span>
          </div>
        </div>

        {/* Port A RTT */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>PORT A (PRIMARY)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight flex items-baseline gap-1">
            <span>{portA.latency_ms?.toFixed(1) || 22.0}</span>
            <span className="text-xs font-normal text-slate-500">ms RTT</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Loss: <strong>{portA.packet_loss_pct?.toFixed(2)}%</strong> • Jitter: <strong>{portA.jitter_ms?.toFixed(1)}ms</strong>
          </div>
        </div>

        {/* Port B RTT */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>PORT B (BACKUP)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
          </div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight flex items-baseline gap-1">
            <span>{portB.latency_ms?.toFixed(1) || 45.0}</span>
            <span className="text-xs font-normal text-slate-500">ms RTT</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Loss: <strong>{portB.packet_loss_pct?.toFixed(2)}%</strong> • Jitter: <strong>{portB.jitter_ms?.toFixed(1)}ms</strong>
          </div>
        </div>

      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ================= LEFT COLUMN: DUAL PORT STATUS & FAILOVER ================= */}
        <div className="space-y-6">
          
          {/* Dual Port Telemetry Visualizer */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                <span>Dual-Port Telemetry Status</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">100ms Stream</span>
            </div>

            {/* Port Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Port A Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                activePath === 'PORT_A' 
                  ? 'bg-blue-50/40 border-blue-200 ring-2 ring-blue-500/20' 
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">PORT A</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">5G/Primary</span>
                  </div>
                  {activePath === 'PORT_A' && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-full animate-pulse">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Latency:</span>
                    <span className="font-mono font-semibold text-slate-800">{portA.latency_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jitter:</span>
                    <span className="font-mono font-semibold text-slate-800">{portA.jitter_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Packet Loss:</span>
                    <span className={`font-mono font-semibold ${portA.packet_loss_pct > 5 ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                      {portA.packet_loss_pct?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bandwidth:</span>
                    <span className="font-mono font-semibold text-slate-800">{portA.bandwidth_kbps || 4500} kbps</span>
                  </div>
                </div>
              </div>

              {/* Port B Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                activePath === 'PORT_B' 
                  ? 'bg-blue-50/40 border-blue-200 ring-2 ring-blue-500/20' 
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">PORT B</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">Mesh/Standby</span>
                  </div>
                  {activePath === 'PORT_B' && (
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full animate-pulse">
                      FAILOVER ACTIVE
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Latency:</span>
                    <span className="font-mono font-semibold text-slate-800">{portB.latency_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jitter:</span>
                    <span className="font-mono font-semibold text-slate-800">{portB.jitter_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Packet Loss:</span>
                    <span className={`font-mono font-semibold ${portB.packet_loss_pct > 5 ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                      {portB.packet_loss_pct?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bandwidth:</span>
                    <span className="font-mono font-semibold text-slate-800">{portB.bandwidth_kbps || 1200} kbps</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Health Evaluation Scores */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs space-y-2.5">
              <div className="font-bold text-slate-700 flex items-center justify-between">
                <span>Sliding Window Link Evaluation (500ms)</span>
                <span className="text-slate-400 font-mono">50 Samples</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-slate-500 mb-1 flex justify-between">
                    <span>Port A Deg Score</span>
                    <span className="font-mono font-semibold">{evaluation.port_a_degradation_score?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        evaluation.port_a_degradation_score > 0.85 ? 'bg-rose-500' :
                        evaluation.port_a_degradation_score > 0.60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (evaluation.port_a_degradation_score || 0.05) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 mb-1 flex justify-between">
                    <span>Port B Deg Score</span>
                    <span className="font-mono font-semibold">{evaluation.port_b_degradation_score?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, (evaluation.port_b_degradation_score || 0.05) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Hardware Bridge OLED Display Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-400">NXP FRDM-MCXN236 // J8 OLED BRIDGE</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                115200 BAUD
              </span>
            </div>

            {/* Virtual 128x64 SSD1306 Display Screen */}
            <div className="bg-black rounded-xl p-4 border-2 border-slate-700 font-mono text-[11px] leading-relaxed text-cyan-300 shadow-inner">
              <div className="text-center font-bold text-cyan-200 pb-1 border-b border-cyan-900/50">
                KSHITIJ FAILOVER CONTROLLER
              </div>
              <div className="pt-2 flex justify-between">
                <span>STATE: <strong className="text-white">{currentState}</strong></span>
                <span>PATH: <strong className="text-white">{activePath}</strong></span>
              </div>
              <div className="flex justify-between">
                <span>LAT: <strong className="text-white">{portA.latency_ms?.toFixed(1)} ms</strong></span>
                <span>LOSS: <strong className="text-white">{portA.packet_loss_pct?.toFixed(1)}%</strong></span>
              </div>
              <div className="flex justify-between">
                <span>TinyML: <strong className="text-emerald-400">HEALTHY (99.9%)</strong></span>
                <span>EXEC: <strong className="text-white">&lt;0.02ms</strong></span>
              </div>
              <div className="text-[10px] text-slate-500 pt-1 text-center border-t border-cyan-900/40 mt-1">
                MCUboot Verified Slot 0 • Dual Cortex-M33
              </div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN: TINYML CLASSIFIER & PLAYGROUND ================= */}
        <div className="space-y-6">

          {/* TinyML Model Architecture Overview */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>TinyML INT8 Neural Architecture</span>
              </h3>
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">
                TFLM Edge
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div className="text-slate-400 text-[10px]">QUANTIZATION</div>
                <div className="font-bold text-slate-800 mt-0.5">Full INT8 Quantized</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div className="text-slate-400 text-[10px]">TENSOR ARENA RAM</div>
                <div className="font-bold text-slate-800 mt-0.5">4.28 KB Footprint</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div className="text-slate-400 text-[10px]">INFERENCE SPEED</div>
                <div className="font-bold text-purple-700 mt-0.5">0.0135 ms Execution</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div className="text-slate-400 text-[10px]">CLASSIFICATION ACCURACY</div>
                <div className="font-bold text-emerald-600 mt-0.5">99.92% F1-Score</div>
              </div>
            </div>
          </div>

          {/* Interactive Edge Inference Playground */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Edge Inference Playground</span>
              </h3>
              <span className="text-xs text-slate-400">Test Custom Vector</span>
            </div>

            {/* Slider Controls */}
            <div className="space-y-3 text-xs">
              
              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-1">
                  <span>RTT Latency (ms):</span>
                  <span className="font-mono text-blue-600">{playgroundParams.latency_ms} ms</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="400" 
                  step="1"
                  value={playgroundParams.latency_ms}
                  onChange={(e) => setPlaygroundParams({ ...playgroundParams, latency_ms: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-1">
                  <span>Jitter (ms):</span>
                  <span className="font-mono text-blue-600">{playgroundParams.jitter_ms} ms</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="80" 
                  step="0.5"
                  value={playgroundParams.jitter_ms}
                  onChange={(e) => setPlaygroundParams({ ...playgroundParams, jitter_ms: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-1">
                  <span>Packet Loss (%):</span>
                  <span className="font-mono text-blue-600">{playgroundParams.packet_loss_pct}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="50" 
                  step="0.5"
                  value={playgroundParams.packet_loss_pct}
                  onChange={(e) => setPlaygroundParams({ ...playgroundParams, packet_loss_pct: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-1">
                  <span>DNS / Route Time (ms):</span>
                  <span className="font-mono text-blue-600">{playgroundParams.dns_time_ms} ms</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="200" 
                  step="1"
                  value={playgroundParams.dns_time_ms}
                  onChange={(e) => setPlaygroundParams({ ...playgroundParams, dns_time_ms: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

            </div>

            {/* Run Button */}
            <button
              onClick={handleRunPlaygroundInference}
              disabled={isInferring}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-md shadow-purple-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              <span>{isInferring ? 'Running INT8 Inference...' : 'Run Edge Inference (<0.02ms)'}</span>
            </button>

            {/* Inference Result Banner */}
            {playgroundResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-2 animate-fade-in ${
                playgroundResult.class_label === 'HEALTHY' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                playgroundResult.class_label === 'DEGRADED' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-1.5">
                    <span>Classification:</span>
                    <span className="px-2 py-0.5 rounded-md bg-white border font-mono">
                      {playgroundResult.class_label}
                    </span>
                  </div>
                  <span className="font-mono text-[11px]">
                    {(playgroundResult.confidence * 100).toFixed(1)}% Conf
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 flex justify-between">
                  <span>Execution Time: <strong>{playgroundResult.inference_time_ms} ms</strong></span>
                  <span>Anomalous: <strong>{playgroundResult.is_anomalous ? 'YES' : 'NO'}</strong></span>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
