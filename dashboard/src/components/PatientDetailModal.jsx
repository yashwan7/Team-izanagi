import React, { useState } from 'react';
import { 
  X, Activity, Heart, Wind, Clock, ShieldCheck, ShieldAlert, 
  BrainCircuit, AlertTriangle, CheckSquare, Pill, Eye, Compass, Send
} from 'lucide-react';

export default function PatientDetailModal({ 
  patient, 
  onClose, 
  onSimulateGaze, 
  onReevaluateTriage 
}) {
  if (!patient) return null;

  const p = patient.capsule;
  const evaluation = patient.evaluation;
  const [triggeringGaze, setTriggeringGaze] = useState(false);
  const [tamperCheckbox, setTamperCheckbox] = useState(false);
  const [gazeCmd, setGazeCmd] = useState('CALL_NURSE');

  const isAcute = p.time_to_help <= 0.5;
  const isPFC = p.time_to_help >= 24.0;
  const isTampered = p.verification_status === 'TAMPERED';

  const handleTriggerGaze = async () => {
    setTriggeringGaze(true);
    try {
      await onSimulateGaze({
        patient_id: p.patient_id,
        command: gazeCmd,
        direction: gazeCmd === 'WATER' ? 'LEFT' : gazeCmd === 'BATHROOM' ? 'RIGHT' : 'CENTER',
        blink_count: gazeCmd === 'PAIN' ? 3 : 2,
        tampered: tamperCheckbox
      });
    } finally {
      setTriggeringGaze(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white m-0 font-mono">{p.patient_id}</h2>
                <span className="text-slate-400 text-sm">&bull; {p.patient_name || 'Operative'}</span>
                <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border ${
                  patient.triage_badge === 'RED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                  patient.triage_badge === 'YELLOW' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  PRIORITY: {patient.priority_score?.toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Sector GPS: {p.gps?.lat.toFixed(4)}, {p.gps?.lng.toFixed(4)} &bull; Alt: {p.gps?.altitude || 210}m
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isTampered ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 radar-alert">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                TAMPERED
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                HMAC VERIFIED
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Vitals Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col font-mono">
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-400" /> Heart Rate
              </span>
              <span className="text-xl font-bold text-white mt-1">
                {p.vitals?.heart_rate || '--'} <span className="text-xs text-slate-400 font-normal">bpm</span>
              </span>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col font-mono">
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Wind className="w-3 h-3 text-cyan-400" /> SpO2
              </span>
              <span className={`text-xl font-bold mt-1 ${p.vitals?.spo2 < 90 ? 'text-rose-400' : 'text-white'}`}>
                {p.vitals?.spo2 || '--'}%
              </span>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col font-mono">
              <span className="text-slate-400 text-xs">Blood Pressure</span>
              <span className="text-xl font-bold text-white mt-1">
                {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
              </span>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col font-mono">
              <span className="text-slate-400 text-xs">Respiratory Rate</span>
              <span className="text-xl font-bold text-white mt-1">
                {p.vitals?.respiratory_rate || '--'} <span className="text-xs text-slate-400 font-normal">/min</span>
              </span>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col font-mono">
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> Time To Help
              </span>
              <span className="text-xl font-bold text-amber-300 mt-1">
                {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help}h`}
              </span>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col font-mono">
              <span className="text-slate-400 text-xs">Fall Status</span>
              <span className={`text-sm font-bold mt-2 ${p.vitals?.fall_detected ? 'text-rose-400' : 'text-emerald-400'}`}>
                {p.vitals?.fall_detected ? 'FALL DETECTED' : 'STABLE'}
              </span>
            </div>
          </div>

          {/* Delay-Aware Clinical Triage Engine Output */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-2xl border border-cyan-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider m-0">
                  Delay-Aware Clinical Triage Decision (Ollama Llama 3.2:3b)
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                PROTOCOL: {evaluation?.protocol_mode || (isAcute ? 'ACUTE_STABILIZATION' : isPFC ? 'PROLONGED_FIELD_CARE' : 'TACTICAL_STANDARD')}
              </span>
            </div>

            {/* Clinical Summary */}
            <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
              <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
                Clinical Diagnosis & Urgency Justification:
              </div>
              <p className="text-sm text-slate-200 leading-relaxed m-0">
                {evaluation?.clinical_summary || 'Evaluating patient physiological status...'}
              </p>
            </div>

            {/* Action Steps */}
            <div>
              <div className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                Action Steps:
              </div>
              <div className="space-y-2">
                {evaluation?.action_steps?.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold font-mono shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prolonged Field Care Specifics (if >=24h) */}
            {(isPFC || (evaluation?.rationing_guidelines && evaluation.rationing_guidelines.length > 0)) && (
              <div className="p-3.5 bg-purple-950/30 rounded-xl border border-purple-500/30 space-y-2">
                <div className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  Austere Supply Rationing & Prolonged Field Care Guidelines (Help ETA: {p.time_to_help}h):
                </div>
                <ul className="text-xs text-purple-200 space-y-1 pl-4 list-disc">
                  {evaluation?.rationing_guidelines?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Red Flag Escalation Triggers */}
            {evaluation?.red_flag_triggers && evaluation.red_flag_triggers.length > 0 && (
              <div className="p-3.5 bg-rose-950/30 rounded-xl border border-rose-500/30 space-y-2">
                <div className="text-xs font-mono font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Red-Flag Escalation Triggers:
                </div>
                <ul className="text-xs text-rose-200 space-y-1 pl-4 list-disc">
                  {evaluation.red_flag_triggers.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Interactive Simulation Sandbox for Presentations */}
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase font-mono m-0">
                  Live Hardware Simulation (Developer 2 EOG & RFID HMAC Stream)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Emit simulated DSP biopotential command to this patient
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={gazeCmd}
                onChange={(e) => setGazeCmd(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="CALL_NURSE">CALL_NURSE (2 Blinks)</option>
                <option value="PAIN">PAIN (3 Blinks)</option>
                <option value="WATER">WATER (Look Left + 1 Blink)</option>
                <option value="BATHROOM">BATHROOM (Look Right + 1 Blink)</option>
              </select>

              <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tamperCheckbox}
                  onChange={(e) => setTamperCheckbox(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className={tamperCheckbox ? 'text-rose-400 font-bold' : ''}>
                  Simulate Cryptographic Tampering (Bad HMAC)
                </span>
              </label>

              <button
                onClick={handleTriggerGaze}
                disabled={triggeringGaze}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all ml-auto"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{triggeringGaze ? 'Emitting...' : 'Dispatch Gaze Event'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
