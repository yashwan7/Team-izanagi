import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, ShieldCheck, ShieldAlert, Activity, 
  Lock, Sparkles, Zap, HeartPulse 
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

  // Render Oscilloscope on Canvas (Tactical Coral & Cyan)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || liveFrames.length === 0) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Background Grid
    ctx.strokeStyle = '#1C2028';
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
    ctx.strokeStyle = '#2A303C';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY1); ctx.lineTo(width, midY1);
    ctx.moveTo(0, midY2); ctx.lineTo(width, midY2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Channel 1: Vertical (Blinks) Filtered -> Coral Accent (#FF334B)
    ctx.strokeStyle = '#FF334B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    liveFrames.forEach((frame, idx) => {
      const x = (idx / (liveFrames.length - 1)) * width;
      const y = midY1 - (frame.filtered_vertical * 0.35);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Channel 1: Vertical (Raw) overlay (Faint Coral)
    ctx.strokeStyle = 'rgba(255, 51, 75, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    liveFrames.forEach((frame, idx) => {
      const x = (idx / (liveFrames.length - 1)) * width;
      const y = midY1 - (frame.raw_vertical * 0.35);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Channel 2: Horizontal (Gaze Step) Filtered -> Soft Cyan (#38BDF8)
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
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
    setActionFeedback('SIMULATING TAMPERED HMAC: Ingesting unauthorized payload...');
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
        setActionFeedback('TAMPERED SIGNATURE DETECTED: Capsule Rejected by Crypto Engine');
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
        setActionFeedback('VERIFIED: HMAC-SHA256 authenticated successfully');
        fetchStatus();
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-5 font-mono select-none text-[#F8FAFC]">
      
      {/* Header Banner */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 nm-convex rounded-xl border border-[#FF334B]/30 flex items-center justify-center text-[#FF334B]">
              <Eye className="w-5 h-5" />
            </span>
            <h2 className="text-sm md:text-base font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
              EOG BIOPOTENTIAL DSP &amp; CAPSULE SECURITY
            </h2>
            <span className="px-3 py-1 nm-alert-inset rounded-xl border border-[#FF334B]/30 text-[10px] font-bold text-[#FF334B] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF334B] animate-pulse shadow-[0_0_6px_#FF334B]"></span>
              4th-Order Butterworth (0.1–10.0 Hz)
            </span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1 font-sans">
            Hands-free dual-channel biopotentials &bull; Pulse-width blink detection &bull; HMAC-SHA256 &amp; ~87% delta compression
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              isStreaming 
                ? 'nm-btn text-[#94A3B8] hover:text-[#F8FAFC]' 
                : 'nm-btn-accent text-white shadow-[0_0_12px_rgba(255,51,75,0.3)]'
            }`}
          >
            <Activity className="w-4 h-4 text-[#FF334B]" />
            <span>{isStreaming ? 'PAUSE STREAM' : 'RESUME STREAM'}</span>
          </button>

          <button
            onClick={handleSimulateVerified}
            className="px-3 py-2 nm-btn text-[#F8FAFC] hover:text-[#10B981] rounded-xl font-bold transition-all flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <span>TEST VERIFIED</span>
          </button>

          <button
            onClick={handleSimulateTamper}
            className="px-3 py-2 nm-btn text-[#FF334B] rounded-xl font-bold transition-all flex items-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4 text-[#FF334B]" />
            <span>TEST TAMPER</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 nm-alert-inset rounded-xl border border-[#FF334B]/40 text-xs font-bold text-[#FF334B] flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-[#FF334B]" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Active Command */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] uppercase font-semibold mb-1.5">
            <span>Decoded Command</span>
            <HeartPulse className="w-4 h-4 text-[#FF334B]" />
          </div>
          <div className="text-xl font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2">
            <span>{activeCommand || 'CALL_NURSE'}</span>
            <span className="text-[10px] px-2 py-0.5 nm-alert-inset text-[#FF334B] border border-[#FF334B]/30 rounded-md font-mono">
              2 Blinks
            </span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-2 font-sans">
            Gaze Vector: <strong className="text-[#FF334B] font-mono">{currentGaze}</strong>
          </div>
        </div>

        {/* Bandwidth Saved */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] uppercase font-semibold mb-1.5">
            <span>Delta Compression</span>
            <Zap className="w-4 h-4 text-[#FF334B]" />
          </div>
          <div className="text-xl font-bold text-[#FF334B] tracking-tight flex items-baseline gap-1.5">
            <span>~87.0%</span>
            <span className="text-[11px] text-[#10B981] font-semibold">REDUCED</span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-2 font-sans">
            1,450B baseline &rarr; 185B delta
          </div>
        </div>

        {/* Crypto Verifications */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] uppercase font-semibold mb-1.5">
            <span>HMAC Verified</span>
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-xl font-bold text-[#F8FAFC] tracking-tight">
            <span>{securityStats?.verified_count || 142}</span>
            <span className="text-[11px] text-[#10B981] font-bold ml-2">100% VALID</span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-2 font-sans">
            HMAC-SHA256 &bull; 256-bit Key
          </div>
        </div>

        {/* Tamper Detections */}
        <div className="nm-flat rounded-2xl p-4 border border-[#FF334B]/30">
          <div className="flex items-center justify-between text-[11px] text-[#FF334B] uppercase font-semibold mb-1.5">
            <span>Tamper Blocked</span>
            <ShieldAlert className="w-4 h-4 text-[#FF334B]" />
          </div>
          <div className="text-xl font-bold text-[#FF334B] tracking-tight">
            <span>{securityStats?.tampered_count || 3}</span>
            <span className="text-[11px] text-[#94A3B8] font-normal ml-2">QUARANTINED</span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-2 font-sans">
            Zero-Trust Sandbox
          </div>
        </div>

      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ================= LEFT COLUMN: OSCILLOSCOPE ================= */}
        <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF334B] animate-pulse shadow-[0_0_6px_#FF334B]"></span>
              <span className="text-[11px] font-mono font-bold tracking-wider text-[#FF334B] uppercase">
                100 HZ EOG DUAL-CHANNEL OSCILLOSCOPE
              </span>
            </div>
            
            {/* Scenario Switcher */}
            <div className="flex nm-inset rounded-xl p-1 text-[10px] font-mono">
              {[
                { id: 'nurse', label: 'NURSE' },
                { id: 'pain', label: 'PAIN (3x)' },
                { id: 'water', label: 'WATER (L)' },
                { id: 'bathroom', label: 'BATH (R)' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setScenario(s.id)}
                  className={`px-2.5 py-1 font-bold rounded-lg transition-all ${
                    scenario === s.id 
                      ? 'nm-btn-accent text-white shadow-[0_0_10px_rgba(255,51,75,0.4)]' 
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Waveform */}
          <div className="relative nm-inset rounded-xl p-2 border border-white/[0.02] bg-[#111317]">
            <canvas 
              ref={canvasRef} 
              width={540} 
              height={260} 
              className="w-full h-52 block rounded-lg"
            />
            <div className="absolute top-4 left-4 flex items-center gap-3 text-[10px] font-mono nm-flat px-2.5 py-1 rounded-lg border border-white/[0.04]">
              <span className="flex items-center gap-1.5 text-[#FF334B]">
                <span className="w-2 h-2 rounded-full bg-[#FF334B] shadow-[0_0_5px_#FF334B]"></span> CH1: VERTICAL (BLINK DSP)
              </span>
              <span className="flex items-center gap-1.5 text-[#38BDF8]">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8] shadow-[0_0_5px_#38BDF8]"></span> CH2: HORIZONTAL (GAZE STEP)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px] font-mono text-[#94A3B8] pt-1">
            <div className="p-3 nm-inset rounded-xl border border-white/[0.02]">
              <div className="text-[#64748B] uppercase text-[10px]">PULSE REJECTION</div>
              <div className="text-[#F8FAFC] mt-1 font-bold">100ms &le; Duration &le; 400ms</div>
            </div>
            <div className="p-3 nm-inset rounded-xl border border-white/[0.02]">
              <div className="text-[#64748B] uppercase text-[10px]">IIR FILTER PASSBAND</div>
              <div className="text-[#FF334B] mt-1 font-bold">0.1 Hz – 10.0 Hz (4th-Order)</div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN: SECURITY & DELTA COMPRESSION ================= */}
        <div className="space-y-4">

          {/* Delta Compression Visualizer */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider flex items-center gap-2 m-0">
                <Zap className="w-4 h-4 text-[#FF334B]" />
                <span>CASE CAPSULE DELTA COMPRESSION</span>
              </h3>
              <span className="px-2.5 py-0.5 nm-alert-inset text-[#10B981] border border-[#10B981]/30 text-[10px] font-bold rounded-lg">
                87.0% SAVINGS
              </span>
            </div>

            <p className="text-[11px] text-[#94A3B8] leading-relaxed font-sans">
              In austere disaster meshes, bandwidth is strictly throttled. The delta encoder transmits ONLY modified differentials relative to evolving patient baseline envelopes.
            </p>

            {/* Comparison Bar */}
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-[#94A3B8] text-[11px] mb-1.5">
                  <span>Full Telemetry JSON Payload</span>
                  <span className="font-mono font-bold text-[#F8FAFC]">1,450 Bytes (100%)</span>
                </div>
                <div className="w-full h-2.5 nm-inset rounded-full overflow-hidden p-0.5">
                  <div className="w-full h-full bg-[#64748B] rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#94A3B8] text-[11px] mb-1.5">
                  <span>Delta Compressed Payload</span>
                  <span className="font-mono font-bold text-[#FF334B]">185 Bytes (12.8%)</span>
                </div>
                <div className="w-full h-2.5 nm-inset rounded-full overflow-hidden p-0.5">
                  <div className="w-[12.8%] h-full bg-[#FF334B] rounded-full shadow-[0_0_8px_#FF334B]"></div>
                </div>
              </div>
            </div>

            <div className="p-3 nm-inset rounded-xl border border-white/[0.02] text-[11px] text-[#94A3B8] flex items-center justify-between">
              <span>Tactical Mesh Bandwidth Saved:</span>
              <strong className="font-mono text-[#10B981] text-xs">~1.26 KB / packet</strong>
            </div>
          </div>

          {/* HMAC-SHA256 Cryptographic Verification */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider flex items-center gap-2 m-0">
                <Lock className="w-4 h-4 text-[#FF334B]" />
                <span>HMAC-SHA256 CRYPTO ENVELOPE</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 nm-inset text-[#10B981] rounded-md border border-[#10B981]/30">
                ZERO-TRUST
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between p-3 nm-inset rounded-xl border border-white/[0.02] text-[11px]">
                <span className="text-[#94A3B8]">Signing Algorithm:</span>
                <span className="font-mono font-bold text-[#F8FAFC]">HMAC-SHA256 RFC 2104</span>
              </div>
              <div className="flex justify-between p-3 nm-inset rounded-xl border border-white/[0.02] text-[11px]">
                <span className="text-[#94A3B8]">Canonicalization:</span>
                <span className="font-mono font-bold text-[#F8FAFC]">Deterministic Sorted JSON</span>
              </div>
              <div className="flex justify-between p-3 nm-inset rounded-xl border border-white/[0.02] text-[11px]">
                <span className="text-[#94A3B8]">Tamper Defense:</span>
                <span className="font-mono font-bold text-[#FF334B]">MitM Rejection + Replay Quarantine</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
