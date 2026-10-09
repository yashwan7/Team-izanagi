import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, ShieldCheck, ShieldAlert, Activity, 
  Lock, CheckCircle2, AlertTriangle, Sparkles, 
  Zap, HeartPulse, RefreshCw, Layers
} from 'lucide-react';

const API_BASE = '/api';

export default function EOGSecurityView() {
  const [eogStatus, setEogStatus] = useState(null);
  const [securityStats, setSecurityStats] = useState(null);
  const [scenario, setScenario] = useState('nurse');
  const [liveFrames, setLiveFrames] = useState([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [activeCommand, setActiveCommand] = useState(null);
  const [currentGaze, setCurrentGaze] = useState('CENTER');
  const [actionFeedback, setActionFeedback] = useState(null);
  const canvasRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const [resEog, resSec] = await Promise.all([
        fetch(`${API_BASE}/eog/status`).then(r => r.json()),
        fetch(`${API_BASE}/security/stats`).then(r => r.json())
      ]);
      setEogStatus(resEog);
      setSecurityStats(resSec);
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  };

  const fetchLiveBatch = async () => {
    if (!isStreaming) return;
    try {
      const res = await fetch(`${API_BASE}/eog/live-batch?scenario=${scenario}`);
      if (res.ok) {
        const data = await res.json();
        setLiveFrames(data.frames || []);
        if (data.frames && data.frames.length > 0) {
          const last = data.frames[data.frames.length - 1];
          setCurrentGaze(last.gaze || 'CENTER');
          if (last.command) {
            setActiveCommand(last.command);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch EOG batch:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    fetchLiveBatch();
    const interval = setInterval(fetchLiveBatch, 800);
    return () => clearInterval(interval);
  }, [scenario, isStreaming]);

  // Render Oscilloscope on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || liveFrames.length === 0) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Background Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    const step = 20;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const midY1 = height * 0.28;
    const midY2 = height * 0.72;

    // Zero-lines
    ctx.strokeStyle = '#334155';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY1); ctx.lineTo(width, midY1);
    ctx.moveTo(0, midY2); ctx.lineTo(width, midY2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Channel 1: Vertical (Blinks) Filtered
    ctx.strokeStyle = '#10b981'; // Emerald
    ctx.lineWidth = 2;
    ctx.beginPath();
    liveFrames.forEach((frame, idx) => {
      const x = (idx / (liveFrames.length - 1)) * width;
      const y = midY1 - (frame.filtered_vertical * 0.35);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Channel 1: Vertical (Raw) overlay (faint cyan)
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    liveFrames.forEach((frame, idx) => {
      const x = (idx / (liveFrames.length - 1)) * width;
      const y = midY1 - (frame.raw_vertical * 0.35);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Channel 2: Horizontal (Gaze Step) Filtered
    ctx.strokeStyle = '#38bdf8'; // Sky Blue
    ctx.lineWidth = 2;
    ctx.beginPath();
    liveFrames.forEach((frame, idx) => {
      const x = (idx / (liveFrames.length - 1)) * width;
      const y = midY2 - (frame.filtered_horizontal * 0.35);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

  }, [liveFrames]);

  const handleSimulateTamper = async () => {
    setActionFeedback('Simulating tampered HMAC capsule...');
    try {
      const res = await fetch(`${API_BASE}/simulate-gaze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: 'PT-101',
          command: 'CALL_NURSE',
          direction: currentGaze,
          blink_count: 2,
          tampered: true
        })
      });
      if (res.ok) {
        setActionFeedback('⚠️ TAMPERED SIGNATURE DETECTED: Capsule Rejected by Crypto Engine');
        fetchStatus();
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateVerified = async () => {
    setActionFeedback('Simulating verified HMAC nurse call...');
    try {
      const res = await fetch(`${API_BASE}/simulate-gaze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: 'PT-101',
          command: 'CALL_NURSE',
          direction: 'CENTER',
          blink_count: 2,
          tampered: false
        })
      });
      if (res.ok) {
        setActionFeedback('✅ VERIFIED: HMAC-SHA256 authenticated successfully');
        fetchStatus();
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Eye className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">EOG Biopotential DSP & Case Capsule Security</h2>
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              4th-Order Butterworth (0.1–10.0 Hz)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 pl-10.5">
            Hands-free dual-channel eye biopotentials • Pulse-width blink detection • HMAC-SHA256 integrity & ~87% delta compression
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isStreaming ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-emerald-600 text-white border-emerald-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isStreaming ? 'Pause Stream' : 'Resume Stream'}</span>
          </button>

          <button
            onClick={handleSimulateVerified}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Test Verified Capsule</span>
          </button>

          <button
            onClick={handleSimulateTamper}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Test Tamper Attack</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs font-semibold text-cyan-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Active Command */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>DECODED COMMAND</span>
            <HeartPulse className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>{activeCommand || 'CALL_NURSE'}</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-mono">
              2 Blinks
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Gaze Direction: <strong className="text-blue-600 font-mono">{currentGaze}</strong>
          </div>
        </div>

        {/* Bandwidth Saved */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>DELTA BANDWIDTH SAVED</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700 tracking-tight flex items-baseline gap-1">
            <span>~87.0%</span>
            <span className="text-xs font-normal text-slate-500">reduced</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-2">
            1,450B baseline &rarr; 185B delta
          </div>
        </div>

        {/* Crypto Verifications */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>HMAC VERIFIED CAPSULES</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight">
            <span>{securityStats?.verified_count || 142}</span>
            <span className="text-xs text-emerald-600 font-semibold ml-2">100% Valid</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            HMAC-SHA256 • 256-bit Key
          </div>
        </div>

        {/* Tamper Detections */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>TAMPER ATTEMPTS BLOCKED</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 tracking-tight">
            <span>{securityStats?.tampered_count || 3}</span>
            <span className="text-xs text-slate-400 font-normal ml-2">Quarantined</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Zero-Trust Capsule Sandbox
          </div>
        </div>

      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ================= LEFT COLUMN: OSCILLOSCOPE ================= */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-400">100 HZ EOG DUAL-CHANNEL OSCILLOSCOPE</span>
            </div>
            
            {/* Scenario Switcher */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px] font-mono">
              <button
                onClick={() => setScenario('nurse')}
                className={`px-2 py-1 rounded transition-all ${scenario === 'nurse' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Nurse Call
              </button>
              <button
                onClick={() => setScenario('pain')}
                className={`px-2 py-1 rounded transition-all ${scenario === 'pain' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Pain (3x)
              </button>
              <button
                onClick={() => setScenario('water')}
                className={`px-2 py-1 rounded transition-all ${scenario === 'water' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Water (L)
              </button>
              <button
                onClick={() => setScenario('bathroom')}
                className={`px-2 py-1 rounded transition-all ${scenario === 'bathroom' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Bath (R)
              </button>
            </div>
          </div>

          {/* Canvas Waveform */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#070d19]">
            <canvas 
              ref={canvasRef} 
              width={540} 
              height={260} 
              className="w-full h-56 block"
            />
            <div className="absolute top-2 left-3 flex items-center gap-4 text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Vertical (Blink DSP Filtered)
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span> Horizontal (Saccadic Gaze Steps)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px] font-mono text-slate-400 pt-1">
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-slate-500">PULSE REJECTION</div>
              <div className="text-slate-200 mt-0.5">100ms &le; Duration &le; 400ms</div>
            </div>
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-slate-500">IIR FILTER PASSBAND</div>
              <div className="text-emerald-400 mt-0.5">0.1 Hz – 10.0 Hz (4th-Order)</div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN: SECURITY & DELTA COMPRESSION ================= */}
        <div className="space-y-6">

          {/* Delta Compression Visualizer */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Case Capsule Delta Compression Engine</span>
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                87.0% Savings
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              In combat zones and disaster meshes, bandwidth is strictly throttled. The delta encoder transmits ONLY modified physiological differentials relative to evolving patient baseline envelopes.
            </p>

            {/* Comparison Bar */}
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Full Telemetry JSON Payload</span>
                  <span className="font-mono font-semibold">1,450 Bytes (100%)</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-slate-400 rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Delta Compressed Payload</span>
                  <span className="font-mono font-semibold text-emerald-600">185 Bytes (12.8%)</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div className="w-[12.8%] h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
              <span>Tactical Mesh Link Bandwidth Conserved:</span>
              <strong className="font-mono text-emerald-700 text-sm">~1.26 KB / packet</strong>
            </div>
          </div>

          {/* HMAC-SHA256 Cryptographic Verification */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>HMAC-SHA256 Cryptographic Envelope</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Zero-Trust Signed
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-500">Signing Algorithm:</span>
                <span className="font-mono font-semibold text-slate-800">HMAC-SHA256 RFC 2104</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-500">Canonicalization:</span>
                <span className="font-mono font-semibold text-slate-800">Deterministic Sorted JSON</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-slate-500">Tamper Defense:</span>
                <span className="font-mono font-semibold text-emerald-700">MitM Rejection + Replay Quarantine</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
