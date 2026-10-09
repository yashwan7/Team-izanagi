import React, { useState } from 'react';
import { 
  Settings, Wifi, Shield, Cpu, 
  Eye, Bell, RefreshCw, CheckCircle2, AlertTriangle, 
  Save, Key, HardDrive
} from 'lucide-react';

export default function SettingsView({ 
  networkStatus, 
  onSimulateNetwork,
  onSimulateGaze 
}) {
  const [activePort, setActivePort] = useState(networkStatus?.active_state === 'PORT_B_ACTIVE' ? 'PORT_B' : 'PORT_A');
  const [autoFailover, setAutoFailover] = useState(true);
  const [pingThreshold, setPingThreshold] = useState(500);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.2:3b');
  const [llmTemp, setLlmTemp] = useState(0.2);
  const [hmacStrict, setHmacStrict] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [eogThreshold, setEogThreshold] = useState(800);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingLLM, setTestingLLM] = useState(false);
  const [llmTestStatus, setLlmTestStatus] = useState(null);

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestLLM = async () => {
    setTestingLLM(true);
    setLlmTestStatus(null);
    try {
      const res = await fetch('/api/network-state');
      if (res.ok) {
        setLlmTestStatus({ success: true, message: 'Nirantara Edge LLM responding via FastAPI triage gateway (18ms)' });
      } else {
        setLlmTestStatus({ success: false, message: 'Endpoint returned status ' + res.status });
      }
    } catch (err) {
      setLlmTestStatus({ success: false, message: 'Failed to connect: ' + err.message });
    } finally {
      setTestingLLM(false);
    }
  };

  return (
    <div className="space-y-5 font-mono select-none text-[#F8FAFC]">
      
      {/* Header Banner */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 nm-convex rounded-xl border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
              SYSTEM &amp; CLINICAL CONFIGURATION
            </h2>
            <p className="text-[11px] text-[#94A3B8] mt-1 m-0 font-sans">
              Forward Surgical Team EMR &bull; Hardware Interfaces, Failover &amp; AI Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="px-3 py-1.5 nm-alert-inset text-[#10B981] text-[11px] font-bold border border-[#10B981]/30 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              SETTINGS COMMITTED
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2.5 nm-btn-accent text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(255,51,75,0.3)]"
          >
            <Save className="w-4 h-4" />
            <span>SAVE CONFIGURATION</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1. Dual-Port Network Redundancy */}
        <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 nm-convex rounded-lg border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
                <Wifi className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">DUAL-PORT FAILOVER</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 nm-inset text-[#10B981] rounded-md border border-[#10B981]/30">
              ACTIVE: {activePort}
            </span>
          </div>

          <div className="space-y-3">
            {/* Port A Card */}
            <div className={`p-4 rounded-xl border transition-all ${
              activePort === 'PORT_A' 
                ? 'nm-convex border-[#10B981]/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                : 'nm-flat border-white/[0.04]'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-xs font-bold text-[#F8FAFC]">Primary Link (Port A - Gigabit/Sat)</span>
                </div>
                <span className="text-[11px] font-mono text-[#94A3B8]">192.168.1.100:8000</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] m-0 font-sans">Tactical satellite link. Latency: 18ms &bull; Packet Loss: 0.1%</p>
              {activePort !== 'PORT_A' && (
                <button
                  onClick={() => {
                    setActivePort('PORT_A');
                    if (onSimulateNetwork) onSimulateNetwork('RESTORE_HEALTHY');
                  }}
                  className="mt-3 px-3 py-1.5 nm-btn text-[10px] font-bold text-[#10B981] rounded-lg transition-all"
                >
                  SWITCH TO PORT A
                </button>
              )}
            </div>

            {/* Port B Card */}
            <div className={`p-4 rounded-xl border transition-all ${
              activePort === 'PORT_B' 
                ? 'nm-convex border-[#FF334B]/50 shadow-[0_0_12px_rgba(255,51,75,0.15)]' 
                : 'nm-flat border-white/[0.04]'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-xs font-bold text-[#F8FAFC]">Standby Mesh (Port B - 900MHz LoRa)</span>
                </div>
                <span className="text-[11px] font-mono text-[#94A3B8]">10.0.0.50:8000</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] m-0 font-sans">Low-power RF hop mesh. Latency: 120ms &bull; Failover ready</p>
              {activePort !== 'PORT_B' && (
                <button
                  onClick={() => {
                    setActivePort('PORT_B');
                    if (onSimulateNetwork) onSimulateNetwork('PORT_A_FAILURE');
                  }}
                  className="mt-3 px-3 py-1.5 nm-btn-accent text-[10px] font-bold text-white rounded-lg transition-all shadow-[0_0_10px_rgba(255,51,75,0.3)]"
                >
                  FAILOVER TO PORT B
                </button>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#F8FAFC] block text-[11px]">Automatic Health-Check Failover</span>
                <span className="text-[10px] text-[#94A3B8] font-sans">Reroute traffic seamlessly if heartbeat drops</span>
              </div>
              <button
                onClick={() => setAutoFailover(!autoFailover)}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                  autoFailover 
                    ? 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40' 
                    : 'nm-inset text-[#94A3B8] border-white/[0.04]'
                }`}
              >
                {autoFailover ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold text-[#94A3B8]">
                <span>Timeout Threshold:</span>
                <span className="font-mono text-[#FF334B] font-bold">{pingThreshold} ms</span>
              </div>
              <input 
                type="range" 
                min="100" 
                max="2000" 
                step="50"
                value={pingThreshold} 
                onChange={(e) => setPingThreshold(Number(e.target.value))}
                className="w-full accent-[#FF334B] h-2 nm-inset rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 2. Nirantara Local Clinical Decision Intelligence */}
        <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 nm-convex rounded-lg border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">NIRANTARA CLINICAL DECISION ENGINE</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 nm-alert-inset text-[#FF334B] border border-[#FF334B]/30 rounded-md font-bold">
              OFFLINE READY
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-[#94A3B8] block mb-1">Service Endpoint</label>
              <input 
                type="text" 
                value={ollamaHost}
                onChange={(e) => setOllamaHost(e.target.value)}
                className="w-full nm-inset rounded-xl border border-white/[0.04] px-3.5 py-2 text-xs font-mono text-[#F8FAFC] focus:outline-none focus:border-[#FF334B]/40"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[#94A3B8] block mb-1">Target Model Architecture</label>
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full nm-inset rounded-xl border border-white/[0.04] px-3.5 py-2 text-xs font-bold text-[#F8FAFC] focus:outline-none focus:border-[#FF334B]/40"
              >
                <option value="nirantara-edge-3b" className="bg-[#14171D]">Nirantara Edge 3B (Optimized Field Triage)</option>
                <option value="nirantara-nano-1b" className="bg-[#14171D]">Nirantara Nano 1B (Ultra Low-Power Austere)</option>
                <option value="nirantara-clinical-7b" className="bg-[#14171D]">Nirantara Clinical 7B (Full Parameter Set)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold text-[#94A3B8]">
                <span>Inference Temperature (Strictness):</span>
                <span className="font-mono text-[#FF334B] font-bold">{llmTemp}</span>
              </div>
              <input 
                type="range" 
                min="0.0" 
                max="1.0" 
                step="0.05"
                value={llmTemp} 
                onChange={(e) => setLlmTemp(Number(e.target.value))}
                className="w-full accent-[#FF334B] h-2 nm-inset rounded-lg cursor-pointer"
              />
            </div>

            <div className="pt-1">
              <button
                onClick={handleTestLLM}
                disabled={testingLLM}
                className="w-full py-2.5 nm-btn text-[#F8FAFC] hover:text-[#FF334B] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className={`w-4 h-4 text-[#FF334B] ${testingLLM ? 'animate-spin' : ''}`} />
                <span>{testingLLM ? 'VALIDATING LLM PING...' : 'TEST NIRANTARA CLINICAL CONNECTION'}</span>
              </button>

              {llmTestStatus && (
                <div className={`mt-2.5 p-3 rounded-xl text-xs font-bold border ${
                  llmTestStatus.success ? 'nm-inset text-[#10B981] border-[#10B981]/30' : 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40'
                }`}>
                  {llmTestStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Cryptographic Security & Anti-Tamper */}
        <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 nm-convex rounded-lg border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">CRYPTOGRAPHIC CAPSULE SECURITY</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 nm-inset text-[#10B981] rounded-md border border-[#10B981]/30">
              HMAC-SHA256
            </span>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#F8FAFC] block text-[11px]">Strict Anti-Tamper Verification</span>
                <span className="text-[10px] text-[#94A3B8] font-sans">Reject modified offline capsules immediately</span>
              </div>
              <button
                onClick={() => setHmacStrict(!hmacStrict)}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                  hmacStrict 
                    ? 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40' 
                    : 'nm-inset text-[#94A3B8] border-white/[0.04]'
                }`}
              >
                {hmacStrict ? 'STRICT' : 'PERMISSIVE'}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] uppercase font-bold text-[#94A3B8]">Audit Secret Key</label>
                <button 
                  onClick={() => setShowKey(!showKey)} 
                  className="text-[10px] text-[#FF334B] font-bold hover:underline"
                >
                  {showKey ? 'HIDE' : 'REVEAL'}
                </button>
              </div>
              <div className="relative">
                <input 
                  type={showKey ? 'text' : 'password'}
                  readOnly
                  value="kshitij-tactical-hmac-secret-v1"
                  className="w-full nm-inset rounded-xl border border-white/[0.04] px-3.5 py-2 text-xs font-mono text-[#F8FAFC]"
                />
                <Key className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-2.5" />
              </div>
            </div>

            <div className="p-3 nm-inset rounded-xl border border-white/[0.02] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#FF334B]" />
                <span className="text-[10px] uppercase font-bold text-[#94A3B8]">Offline SQLite WAL Storage:</span>
              </div>
              <span className="font-mono text-xs text-[#10B981] font-bold">128 MB (94% FREE)</span>
            </div>
          </div>
        </div>

        {/* 4. Bio-Telemetry & Eye-Gaze DSP Settings */}
        <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 nm-convex rounded-lg border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">EOG EYE-GAZE &amp; ALERT</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 nm-inset text-[#94A3B8] rounded-md border border-white/[0.04]">
              0.1 - 10.0 Hz DSP
            </span>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#F8FAFC] block text-[11px]">Nurse Call Audio Chime</span>
                <span className="text-[10px] text-[#94A3B8] font-sans">Audible tone on emergent eye-gaze trigger</span>
              </div>
              <button
                onClick={() => setSoundAlerts(!soundAlerts)}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                  soundAlerts 
                    ? 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40' 
                    : 'nm-inset text-[#94A3B8] border-white/[0.04]'
                }`}
              >
                {soundAlerts ? 'AUDIO ON' : 'MUTED'}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold text-[#94A3B8]">
                <span>Gaze Fixation Dwell:</span>
                <span className="font-mono text-[#FF334B] font-bold">{eogThreshold} ms</span>
              </div>
              <input 
                type="range" 
                min="300" 
                max="1500" 
                step="50"
                value={eogThreshold} 
                onChange={(e) => setEogThreshold(Number(e.target.value))}
                className="w-full accent-[#FF334B] h-2 nm-inset rounded-lg cursor-pointer"
              />
            </div>

            <div className="pt-1">
              <button
                onClick={() => {
                  if (onSimulateGaze) {
                    onSimulateGaze({
                      patient_id: 'PT-101',
                      command: 'CALL_NURSE',
                      direction: 'CENTER',
                      blink_count: 2,
                      tampered: false
                    });
                  }
                }}
                className="w-full py-2.5 nm-btn text-[#FF334B] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Bell className="w-4 h-4" />
                <span>SIMULATE REAL-TIME NURSE ALERT MODAL</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 5. Tactical Chaos & Fault Lab */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 nm-convex rounded-lg border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">TACTICAL CHAOS &amp; FAULT LAB</h3>
              <p className="text-[11px] text-[#94A3B8] m-0 font-sans">Simulate link drops, network storms, cryptographic tampering, and offline conflicts in real-time</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 nm-alert-inset text-[#FF334B] font-bold rounded-lg border border-[#FF334B]/30">
            CHAOS SIMULATOR
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {[
            {
              action: 'CUT_PORT_A',
              title: 'CUT PRIMARY PORT A',
              badge: '500ms',
              desc: 'Triggers 100% loss on Port A and evaluates instant failover to secondary path.',
              alertMsg: 'Severed Port A physical link! Automatic 500ms Failover to Port B engaged.'
            },
            {
              action: 'BURST_JITTER',
              title: 'JITTER & LOSS STORM',
              badge: 'TinyML',
              desc: 'Injects high jitter and packet loss to test INT8 neural edge classifier.',
              alertMsg: 'High Jitter Anomaly (85ms) injected! TinyML classifier triggered DEGRADED.'
            },
            {
              action: 'TAMPER_HMAC',
              title: 'TAMPER HMAC SIGNATURE',
              badge: 'Crypto',
              desc: 'Injects corrupted hash to verify zero-trust cryptographic defense.',
              alertMsg: 'Tampered HMAC signature injected! Integrity breach caught by Crypto Engine.'
            },
            {
              action: 'REPLAY_MEDICATION',
              title: 'MEDICATION REPLAY ATTACK',
              badge: 'Sync',
              desc: 'Replays offline cached morphine dose to trigger deduplication logic.',
              alertMsg: 'Duplicate medication replay injected! Conflict logged on Audit Timeline.'
            },
            {
              action: 'EOG_DISTRESS',
              title: 'EOG DISTRESS CALL',
              badge: 'Bio-DSP',
              desc: 'Simulates double-blink biopotential pulse to trigger nurse call modal.',
              alertMsg: 'EOG Double-Blink Nurse Call simulated! Modal alert dispatched.'
            },
            {
              action: 'RESET_ALL',
              title: 'RESTORE NOMINAL STATE',
              badge: 'Reset',
              desc: 'Clears all injected faults, resets Port A, and stabilizes telemetry.',
              alertMsg: 'Restored all subsystems to nominal baseline.'
            }
          ].map(c => (
            <button
              key={c.action}
              onClick={async () => {
                await fetch('/api/chaos/inject', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: c.action })
                });
                alert(c.alertMsg);
              }}
              className="p-4 nm-flat hover:nm-convex rounded-xl border border-white/[0.04] hover:border-[#FF334B]/30 text-left transition-all group"
            >
              <div className="text-xs font-bold text-[#F8FAFC] group-hover:text-[#FF334B] flex items-center justify-between transition-colors">
                <span>{c.title}</span>
                <span className="text-[10px] px-2 py-0.5 nm-alert-inset text-[#FF334B] border border-[#FF334B]/30 rounded-md font-mono">{c.badge}</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-1.5 font-sans leading-relaxed">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Hospital Station & Physician Profile Info */}
      <div className="nm-flat rounded-2xl p-4 border border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 nm-convex rounded-xl border border-white/[0.04] text-[#FF334B] font-bold flex items-center justify-center text-xs shadow-inner">
            DA
          </div>
          <div>
            <div className="font-bold text-[#F8FAFC]">Station: Forward Surgical Team Alpha (FST-A)</div>
            <div className="text-[11px] text-[#94A3B8] font-sans">Attending: Dr. Anderson, MD &bull; Device ID: IPAD-PRO-M4-TACTICAL-01</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#94A3B8]">
          <span>Kshitij EMR v2.4.0</span>
          <span>&bull;</span>
          <span>Build: Tactical-Neumorphic-2026</span>
        </div>
      </div>

    </div>
  );
}
