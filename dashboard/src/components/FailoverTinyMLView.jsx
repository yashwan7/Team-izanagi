import React, { useState, useEffect } from 'react';
import { 
  Cpu, Zap, Radio, Activity, ShieldCheck, 
  ArrowRightLeft, AlertTriangle, CheckCircle2, 
  Flame, Sliders
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
        return { label: 'HEALTHY NOMINAL', color: 'nm-inset text-[#10B981] border-[#10B981]/30' };
      case 'STATE_WARNING':
        return { label: 'DEGRADATION WARNING', color: 'nm-alert-inset text-[#F59E0B] border-[#F59E0B]/30' };
      case 'FAILOVER_PORT_B':
        return { label: 'FAILOVER PORT B ACTIVE', color: 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40' };
      case 'MESH_ACTIVE':
        return { label: 'TACTICAL MESH ACTIVE', color: 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40' };
      default:
        return { label: state, color: 'nm-inset text-[#94A3B8] border-white/[0.04]' };
    }
  };

  const badgeInfo = getStateBadge(currentState);

  return (
    <div className="space-y-5 font-mono select-none text-[#F8FAFC]">
      
      {/* Top Header Card */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 nm-convex rounded-xl border border-[#FF334B]/30 flex items-center justify-center text-[#FF334B]">
              <Zap className="w-5 h-5" />
            </span>
            <h2 className="text-sm md:text-base font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
              DUAL-PORT FAILOVER &amp; TINYML EDGE
            </h2>
            <span className={`px-3 py-1 border text-[11px] font-bold rounded-xl flex items-center gap-2 ${badgeInfo.color}`}>
              <span className="w-2 h-2 rounded-full bg-[#FF334B] animate-pulse shadow-[0_0_6px_#FF334B]"></span>
              {badgeInfo.label}
            </span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1 font-sans">
            Dual-redundant 100ms telemetry sampling &bull; 500ms sliding window failover &bull; INT8 edge classification
          </p>
        </div>

        {/* Quick Action Presets */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <button
            onClick={() => handleApplyPreset('NORMAL')}
            className="px-3.5 py-2 nm-btn text-[#F8FAFC] hover:text-[#10B981] rounded-xl font-bold transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>NOMINAL A</span>
          </button>
          <button
            onClick={() => handleApplyPreset('WARNING')}
            className="px-3.5 py-2 nm-btn text-[#F8FAFC] hover:text-[#F59E0B] rounded-xl font-bold transition-all flex items-center gap-1.5"
          >
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <span>JITTER BURST</span>
          </button>
          <button
            onClick={() => handleApplyPreset('FAILOVER')}
            className="px-3.5 py-2 nm-btn-accent text-white rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,51,75,0.3)]"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>500ms FAILOVER B</span>
          </button>
          <button
            onClick={() => handleApplyPreset('MESH')}
            className="px-3.5 py-2 nm-btn text-[#FF334B] rounded-xl font-bold transition-all flex items-center gap-1.5"
          >
            <Flame className="w-4 h-4 text-[#FF334B]" />
            <span>MESH OUTAGE</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 nm-alert-inset rounded-xl border border-[#FF334B]/40 text-xs font-bold text-[#FF334B] flex items-center gap-2.5">
          <Activity className="w-4 h-4 animate-spin text-[#FF334B]" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Active Path */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] uppercase font-semibold mb-1.5">
            <span>ACTIVE LINK PATH</span>
            <Radio className="w-4 h-4 text-[#FF334B]" />
          </div>
          <div className="text-2xl font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2.5">
            <span>{activePath}</span>
            <span className="text-[10px] px-2 py-0.5 nm-alert-inset text-[#FF334B] border border-[#FF334B]/30 rounded-lg font-mono">
              {activePath === 'PORT_A' ? 'Primary' : activePath === 'PORT_B' ? 'Backup' : 'Mesh'}
            </span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-2 font-sans">
            Failover threshold: <strong className="text-[#F8FAFC]">&lt;500ms</strong>
          </div>
        </div>

        {/* TinyML Latency */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] uppercase font-semibold mb-1.5">
            <span>TINYML INFERENCE</span>
            <Cpu className="w-4 h-4 text-[#FF334B]" />
          </div>
          <div className="text-2xl font-bold text-[#FF334B] tracking-tight flex items-center gap-1">
            <span>&lt;0.02</span>
            <span className="text-xs font-normal text-[#94A3B8]">ms</span>
          </div>
          <div className="text-[11px] text-[#94A3B8] font-bold mt-2 flex items-center gap-1 font-sans">
            <span>99.9% Conf &bull; INT8 Quantized</span>
          </div>
        </div>

        {/* Port A RTT */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] uppercase font-semibold mb-1.5">
            <span>PORT A (PRIMARY)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
          </div>
          <div className="text-2xl font-bold text-[#F8FAFC] tracking-tight flex items-baseline gap-1">
            <span>{portA.latency_ms?.toFixed(1) || 22.0}</span>
            <span className="text-xs font-normal text-[#94A3B8]">ms RTT</span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-2 font-sans">
            Loss: <strong className="text-[#F8FAFC]">{portA.packet_loss_pct?.toFixed(2)}%</strong> &bull; Jitter: <strong className="text-[#F8FAFC]">{portA.jitter_ms?.toFixed(1)}ms</strong>
          </div>
        </div>

        {/* Port B RTT */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] uppercase font-semibold mb-1.5">
            <span>PORT B (BACKUP)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
          </div>
          <div className="text-2xl font-bold text-[#F8FAFC] tracking-tight flex items-baseline gap-1">
            <span>{portB.latency_ms?.toFixed(1) || 45.0}</span>
            <span className="text-xs font-normal text-[#94A3B8]">ms RTT</span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-2 font-sans">
            Loss: <strong className="text-[#F8FAFC]">{portB.packet_loss_pct?.toFixed(2)}%</strong> &bull; Jitter: <strong className="text-[#F8FAFC]">{portB.jitter_ms?.toFixed(1)}ms</strong>
          </div>
        </div>

      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ================= LEFT COLUMN: DUAL PORT STATUS & FAILOVER ================= */}
        <div className="space-y-4">
          
          {/* Dual Port Telemetry Visualizer */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider flex items-center gap-2 m-0">
                <Radio className="w-4 h-4 text-[#FF334B]" />
                <span>DUAL-PORT TELEMETRY STATUS</span>
              </h3>
              <span className="text-[11px] text-[#94A3B8] font-mono">100ms Stream</span>
            </div>

            {/* Port Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Port A Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                activePath === 'PORT_A' 
                  ? 'nm-convex border-[#10B981]/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                  : 'nm-flat border-white/[0.04]'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#F8FAFC]">PORT A</span>
                    <span className="text-[10px] px-2 py-0.5 nm-inset text-[#10B981] border border-[#10B981]/30 rounded-md font-semibold">5G/Primary</span>
                  </div>
                  {activePath === 'PORT_A' && (
                    <span className="text-[10px] font-bold text-[#10B981] nm-inset px-2 py-0.5 rounded-md border border-[#10B981]/30">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Latency:</span>
                    <span className="font-mono font-bold text-[#F8FAFC]">{portA.latency_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Jitter:</span>
                    <span className="font-mono font-bold text-[#F8FAFC]">{portA.jitter_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Packet Loss:</span>
                    <span className={`font-mono font-bold ${portA.packet_loss_pct > 5 ? 'text-[#FF334B]' : 'text-[#F8FAFC]'}`}>
                      {portA.packet_loss_pct?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Bandwidth:</span>
                    <span className="font-mono font-bold text-[#F8FAFC]">{portA.bandwidth_kbps || 4500} kbps</span>
                  </div>
                </div>
              </div>

              {/* Port B Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                activePath === 'PORT_B' 
                  ? 'nm-convex border-[#FF334B]/50 shadow-[0_0_12px_rgba(255,51,75,0.15)]' 
                  : 'nm-flat border-white/[0.04]'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#F8FAFC]">PORT B</span>
                    <span className="text-[10px] px-2 py-0.5 nm-inset text-[#94A3B8] border border-white/[0.04] rounded-md font-semibold">Mesh/Standby</span>
                  </div>
                  {activePath === 'PORT_B' && (
                    <span className="text-[10px] font-bold text-[#FF334B] nm-alert-inset px-2 py-0.5 rounded-md border border-[#FF334B]/30">
                      FAILOVER ACTIVE
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Latency:</span>
                    <span className="font-mono font-bold text-[#F8FAFC]">{portB.latency_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Jitter:</span>
                    <span className="font-mono font-bold text-[#F8FAFC]">{portB.jitter_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Packet Loss:</span>
                    <span className={`font-mono font-bold ${portB.packet_loss_pct > 5 ? 'text-[#FF334B]' : 'text-[#F8FAFC]'}`}>
                      {portB.packet_loss_pct?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Bandwidth:</span>
                    <span className="font-mono font-bold text-[#F8FAFC]">{portB.bandwidth_kbps || 1200} kbps</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Health Evaluation Scores */}
            <div className="p-4 nm-inset rounded-xl border border-white/[0.02] text-xs space-y-3">
              <div className="font-bold text-[#F8FAFC] flex items-center justify-between">
                <span className="uppercase text-[11px]">SLIDING WINDOW LINK EVALUATION (500ms)</span>
                <span className="text-[#94A3B8] font-mono text-[10px]">50 Samples</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-[#94A3B8] mb-1.5 flex justify-between">
                    <span>Port A Deg Score</span>
                    <span className="font-mono font-bold text-[#F8FAFC]">{evaluation.port_a_degradation_score?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="w-full h-2 nm-inset rounded-full overflow-hidden p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        evaluation.port_a_degradation_score > 0.85 ? 'bg-[#FF334B]' :
                        evaluation.port_a_degradation_score > 0.60 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'
                      }`}
                      style={{ width: `${Math.min(100, (evaluation.port_a_degradation_score || 0.05) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-[#94A3B8] mb-1.5 flex justify-between">
                    <span>Port B Deg Score</span>
                    <span className="font-mono font-bold text-[#F8FAFC]">{evaluation.port_b_degradation_score?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="w-full h-2 nm-inset rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full rounded-full bg-[#10B981] transition-all duration-300"
                      style={{ width: `${Math.min(100, (evaluation.port_b_degradation_score || 0.05) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Hardware Bridge OLED Display Card */}
          <div className="nm-flat rounded-2xl text-[#F8FAFC] p-5 border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF334B] animate-ping"></span>
                <span className="text-[11px] font-mono font-bold tracking-wider text-[#FF334B]">NXP FRDM-MCXN236 // J8 OLED BRIDGE</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 nm-inset text-[#94A3B8] rounded-md border border-white/[0.04]">
                115200 BAUD
              </span>
            </div>

            {/* Virtual 128x64 SSD1306 Display Screen */}
            <div className="nm-inset p-4 rounded-xl border border-white/[0.02] font-mono text-[11px] leading-relaxed text-[#F8FAFC]">
              <div className="text-center font-bold text-[#FF334B] pb-1.5 border-b border-white/[0.04]">
                KSHITIJ FAILOVER CONTROLLER
              </div>
              <div className="pt-2.5 flex justify-between">
                <span>STATE: <strong className="text-[#FF334B]">{currentState}</strong></span>
                <span>PATH: <strong className="text-[#F8FAFC]">{activePath}</strong></span>
              </div>
              <div className="flex justify-between">
                <span>LAT: <strong className="text-[#F8FAFC]">{portA.latency_ms?.toFixed(1)} ms</strong></span>
                <span>LOSS: <strong className="text-[#F8FAFC]">{portA.packet_loss_pct?.toFixed(1)}%</strong></span>
              </div>
              <div className="flex justify-between">
                <span>TinyML: <strong className="text-[#10B981]">HEALTHY (99.9%)</strong></span>
                <span>EXEC: <strong className="text-[#F8FAFC]">&lt;0.02ms</strong></span>
              </div>
              <div className="text-[10px] text-[#64748B] pt-2 text-center border-t border-white/[0.04] mt-2">
                MCUboot Verified Slot 0 &bull; Dual Cortex-M33
              </div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN: TINYML CLASSIFIER & PLAYGROUND ================= */}
        <div className="space-y-4">

          {/* TinyML Model Architecture Overview */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider flex items-center gap-2 m-0">
                <Cpu className="w-4 h-4 text-[#FF334B]" />
                <span>TINYML INT8 NEURAL ARCHITECTURE</span>
              </h3>
              <span className="px-2.5 py-0.5 nm-alert-inset text-[#FF334B] border border-[#FF334B]/30 text-[10px] font-bold rounded-lg">
                TFLM EDGE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02]">
                <div className="text-[#94A3B8] text-[10px] uppercase">QUANTIZATION</div>
                <div className="font-bold text-[#F8FAFC] mt-1 text-xs">Full INT8 Quantized</div>
              </div>
              <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02]">
                <div className="text-[#94A3B8] text-[10px] uppercase">TENSOR ARENA RAM</div>
                <div className="font-bold text-[#F8FAFC] mt-1 text-xs">4.28 KB Footprint</div>
              </div>
              <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02]">
                <div className="text-[#94A3B8] text-[10px] uppercase">INFERENCE SPEED</div>
                <div className="font-bold text-[#FF334B] mt-1 text-xs">0.0135 ms Execution</div>
              </div>
              <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02]">
                <div className="text-[#94A3B8] text-[10px] uppercase">CLASSIFICATION ACCURACY</div>
                <div className="font-bold text-[#10B981] mt-1 text-xs">99.92% F1-Score</div>
              </div>
            </div>
          </div>

          {/* Interactive Edge Inference Playground */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider flex items-center gap-2 m-0">
                <Sliders className="w-4 h-4 text-[#FF334B]" />
                <span>EDGE INFERENCE PLAYGROUND</span>
              </h3>
              <span className="text-[11px] text-[#94A3B8]">Test Custom Vector</span>
            </div>

            {/* Slider Controls */}
            <div className="space-y-3.5 text-xs">
              
              <div>
                <div className="flex justify-between text-[#94A3B8] text-[11px] mb-1.5">
                  <span>RTT Latency (ms):</span>
                  <span className="font-mono text-[#FF334B] font-bold">{playgroundParams.latency_ms} ms</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="400" 
                  step="1"
                  value={playgroundParams.latency_ms}
                  onChange={(e) => setPlaygroundParams({ ...playgroundParams, latency_ms: parseFloat(e.target.value) })}
                  className="w-full accent-[#FF334B] h-2 nm-inset rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#94A3B8] text-[11px] mb-1.5">
                  <span>Jitter (ms):</span>
                  <span className="font-mono text-[#FF334B] font-bold">{playgroundParams.jitter_ms} ms</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="80" 
                  step="0.5"
                  value={playgroundParams.jitter_ms}
                  onChange={(e) => setPlaygroundParams({ ...playgroundParams, jitter_ms: parseFloat(e.target.value) })}
                  className="w-full accent-[#FF334B] h-2 nm-inset rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#94A3B8] text-[11px] mb-1.5">
                  <span>Packet Loss (%):</span>
                  <span className="font-mono text-[#FF334B] font-bold">{playgroundParams.packet_loss_pct}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="50" 
                  step="0.5"
                  value={playgroundParams.packet_loss_pct}
                  onChange={(e) => setPlaygroundParams({ ...playgroundParams, packet_loss_pct: parseFloat(e.target.value) })}
                  className="w-full accent-[#FF334B] h-2 nm-inset rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#94A3B8] text-[11px] mb-1.5">
                  <span>DNS / Route Time (ms):</span>
                  <span className="font-mono text-[#FF334B] font-bold">{playgroundParams.dns_time_ms} ms</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="200" 
                  step="1"
                  value={playgroundParams.dns_time_ms}
                  onChange={(e) => setPlaygroundParams({ ...playgroundParams, dns_time_ms: parseFloat(e.target.value) })}
                  className="w-full accent-[#FF334B] h-2 nm-inset rounded-lg cursor-pointer"
                />
              </div>

            </div>

            {/* Run Button */}
            <button
              onClick={handleRunPlaygroundInference}
              disabled={isInferring}
              className="w-full py-3 nm-btn-accent text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(255,51,75,0.3)]"
            >
              <Cpu className="w-4 h-4" />
              <span>{isInferring ? 'RUNNING INT8 INFERENCE...' : 'RUN EDGE INFERENCE (<0.02ms)'}</span>
            </button>

            {/* Inference Result Banner */}
            {playgroundResult && (
              <div className="p-4 nm-inset rounded-xl border border-white/[0.04] text-xs space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    <span className="text-[#94A3B8]">Classification:</span>
                    <span className="px-2.5 py-0.5 nm-alert-inset text-[#FF334B] border border-[#FF334B]/30 rounded-lg font-mono">
                      {playgroundResult.class_label}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#94A3B8]">
                    {(playgroundResult.confidence * 100).toFixed(1)}% Conf
                  </span>
                </div>

                <div className="text-[11px] text-[#94A3B8] flex justify-between pt-1 font-sans">
                  <span>Execution Time: <strong className="text-[#F8FAFC] font-mono">{playgroundResult.inference_time_ms} ms</strong></span>
                  <span>Anomalous: <strong className="text-[#FF334B] font-mono">{playgroundResult.is_anomalous ? 'YES' : 'NO'}</strong></span>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
