import React, { useState } from 'react';
import { 
  X, Heart, Wind, Clock, ShieldCheck, ShieldAlert, 
  BrainCircuit, AlertTriangle, CheckSquare, Eye, Send, 
  Stethoscope, Droplet
} from 'lucide-react';

export default function PatientDetailModal({ 
  patient, 
  onClose, 
  onSimulateGaze, 
  onReevaluateTriage,
  onRequestBlood
}) {
  const [triggeringGaze, setTriggeringGaze] = useState(false);
  const [tamperCheckbox, setTamperCheckbox] = useState(false);
  const [gazeCmd, setGazeCmd] = useState('CALL_NURSE');

  if (!patient) return null;

  const p = patient.capsule;
  const evaluation = patient.evaluation;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono select-none">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col nm-flat rounded-3xl border border-white/[0.04] text-[#F8FAFC] shadow-[0_20px_70px_rgba(0,0,0,0.85)] overflow-hidden">
        
        {/* Hospital Patient Chart Header */}
        <div className="px-6 py-4 nm-flat border-b border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 nm-convex rounded-xl flex items-center justify-center text-[#FF334B]">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-sm md:text-base font-black text-[#F8FAFC] m-0 font-mono">{p.patient_id}</h2>
                <span className="text-[#94A3B8] text-xs font-semibold">&bull; {p.patient_name || 'Patient'}</span>
                <span className={`px-2 py-0.5 text-[9px] font-bold font-mono rounded-md ${
                  patient.triage_badge === 'RED' ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' :
                  patient.triage_badge === 'YELLOW' ? 'nm-inset text-[#F59E0B] border border-[#F59E0B]/30' :
                  'nm-badge text-[#94A3B8]'
                }`}>
                  PRIORITY {patient.priority_score?.toFixed(1)}
                </span>
              </div>
              <p className="text-[10px] text-[#94A3B8] mt-1 m-0 font-medium">
                Hospital EMR Record &bull; Sector GPS: {p.gps?.lat.toFixed(4)}, {p.gps?.lng.toFixed(4)} &bull; Alt: {p.gps?.altitude || 210}m
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isTampered ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-mono nm-alert-inset rounded-xl text-[#FF334B] border border-[#FF334B]/40 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 text-[#FF334B]" />
                TAMPERED
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-mono text-[#00E5A3] nm-inset rounded-xl border border-[#00E5A3]/30">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00E5A3]" />
                HMAC VERIFIED
              </span>
            )}
            {onRequestBlood && (
              <button
                onClick={() => onRequestBlood(p.patient_id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold font-mono text-[#FF334B] nm-btn rounded-xl hover:text-white transition-all"
                title="Initiate regional blood availability search for this casualty"
              >
                <Droplet className="w-3.5 h-3.5 fill-current" />
                <span>FIND BLOOD UNIT</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 nm-btn rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-[#FF334B] transition-all ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ICU Telemetry Vitals Sunken Wells Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="nm-inset rounded-xl p-3.5 flex flex-col">
              <span className="text-[#94A3B8] text-[10px] flex items-center gap-1.5 font-bold uppercase">
                <Heart className="w-3.5 h-3.5 text-[#FF334B]" /> HR
              </span>
              <span className="text-xl font-black font-mono text-[#F8FAFC] mt-1.5">
                {p.vitals?.heart_rate || '--'} <span className="text-[10px] text-[#64748B] font-normal">bpm</span>
              </span>
              <span className="text-[9px] text-[#64748B] mt-0.5">Norm: 60-100</span>
            </div>

            <div className="nm-inset rounded-xl p-3.5 flex flex-col">
              <span className="text-[#94A3B8] text-[10px] flex items-center gap-1.5 font-bold uppercase">
                <Wind className="w-3.5 h-3.5 text-[#00E5A3]" /> SpO2 O2
              </span>
              <span className={`text-xl font-black font-mono mt-1.5 ${p.vitals?.spo2 < 90 ? 'text-[#FF334B]' : 'text-[#F8FAFC]'}`}>
                {p.vitals?.spo2 || '--'}%
              </span>
              <span className="text-[9px] text-[#64748B] mt-0.5">Norm: &gt;95%</span>
            </div>

            <div className="nm-inset rounded-xl p-3.5 flex flex-col">
              <span className="text-[#94A3B8] text-[10px] font-bold uppercase">Blood Pressure</span>
              <span className="text-xl font-black font-mono text-[#F8FAFC] mt-1.5">
                {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
              </span>
              <span className="text-[9px] text-[#64748B] mt-0.5">mmHg</span>
            </div>

            <div className="nm-inset rounded-xl p-3.5 flex flex-col">
              <span className="text-[#94A3B8] text-[10px] font-bold uppercase">Resp. Rate</span>
              <span className="text-xl font-black font-mono text-[#F8FAFC] mt-1.5">
                {p.vitals?.respiratory_rate || '--'} <span className="text-[10px] text-[#64748B] font-normal">/min</span>
              </span>
              <span className="text-[9px] text-[#64748B] mt-0.5">Norm: 12-20</span>
            </div>

            <div className="nm-alert-inset rounded-xl p-3.5 flex flex-col border border-[#FF334B]/30">
              <span className="text-[#FF334B] text-[10px] flex items-center gap-1.5 font-bold uppercase">
                <Clock className="w-3.5 h-3.5 text-[#FF334B]" /> Evac ETA
              </span>
              <span className="text-xl font-black font-mono text-[#FF334B] mt-1.5">
                {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help}h`}
              </span>
              <span className="text-[9px] text-[#94A3B8] mt-0.5">Definitive Care</span>
            </div>

            <div className="nm-inset rounded-xl p-3.5 flex flex-col">
              <span className="text-[#94A3B8] text-[10px] font-bold uppercase">Trauma Fall</span>
              <span className={`text-xs font-bold font-mono mt-2.5 ${p.vitals?.fall_detected ? 'text-[#FF334B]' : 'text-[#00E5A3]'}`}>
                {p.vitals?.fall_detected ? 'FALL DETECTED' : 'NOMINAL'}
              </span>
            </div>
          </div>

          {/* Clinical Decision Support (CDSS) - Nirantara Edge LLM */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2.5">
                <BrainCircuit className="w-4 h-4 text-[#FF334B]" />
                <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
                  CLINICAL DECISION SUPPORT &bull; NIRANTARA EDGE LLM
                </h3>
              </div>
              <span className="px-2.5 py-1 text-[9px] font-mono font-bold rounded-lg nm-alert-inset text-[#FF334B] border border-[#FF334B]/30">
                PROTOCOL: {evaluation?.protocol_mode || (isAcute ? 'ACUTE_STABILIZATION' : isPFC ? 'PROLONGED_FIELD_CARE' : 'TACTICAL_STANDARD')}
              </span>
            </div>

            {/* Clinical Summary */}
            <div className="p-4 nm-inset rounded-xl">
              <div className="text-[10px] font-mono text-[#FF334B] uppercase tracking-wider mb-1 font-bold">
                CLINICAL DIAGNOSIS &amp; TRIAGE ASSESSMENT:
              </div>
              <p className="text-xs text-[#F8FAFC] leading-relaxed m-0 font-medium">
                {evaluation?.clinical_summary || 'Evaluating patient physiological status...'}
              </p>
            </div>

            {/* Clinical Action Steps */}
            <div>
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2.5 flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-[#FF334B]" />
                PRESCRIBED CLINICAL ACTION PLAN:
              </div>
              <div className="space-y-2">
                {evaluation?.action_steps?.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 nm-inset rounded-xl text-xs text-[#F8FAFC]">
                    <span className="w-5 h-5 nm-convex rounded-md text-[#FF334B] flex items-center justify-center text-[10px] font-bold font-mono shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prolonged Field Care Specifics */}
            {(isPFC || (evaluation?.rationing_guidelines && evaluation.rationing_guidelines.length > 0)) && (
              <div className="p-4 nm-alert-inset rounded-xl border border-[#FF334B]/30 space-y-2">
                <div className="text-[10px] font-bold text-[#FF334B] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  PROLONGED FIELD CARE &amp; RATIONING (DELAY: {p.time_to_help}h):
                </div>
                <ul className="text-xs text-[#94A3B8] space-y-1.5 pl-4 list-disc font-medium">
                  {evaluation?.rationing_guidelines?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Red Flag Escalation Triggers */}
            {evaluation?.red_flag_triggers && evaluation.red_flag_triggers.length > 0 && (
              <div className="p-4 nm-alert-inset rounded-xl border border-[#FF334B]/40 space-y-2">
                <div className="text-[10px] font-bold text-[#FF334B] uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  RED-FLAG CLINICAL ESCALATION TRIGGERS:
                </div>
                <ul className="text-xs text-[#F8FAFC] space-y-1.5 pl-4 list-disc font-medium">
                  {evaluation.red_flag_triggers.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Interactive Medical Sensor Simulator Sandbox */}
          <div className="p-4 nm-flat rounded-2xl border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#FF334B]" />
                <h4 className="text-xs font-bold text-[#F8FAFC] uppercase font-mono m-0">
                  BIOMETRIC SENSOR SIMULATOR (EOG &amp; RFID HMAC STREAM)
                </h4>
              </div>
              <span className="text-[9px] text-[#94A3B8]">
                Emit simulated biopotential trigger to this patient chart
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={gazeCmd}
                onChange={(e) => setGazeCmd(e.target.value)}
                className="nm-inset rounded-xl text-xs text-[#F8FAFC] px-3.5 py-2 border-none focus:outline-none"
              >
                <option value="CALL_NURSE" className="bg-[#181B22]">CALL_NURSE (2 Blinks)</option>
                <option value="PAIN" className="bg-[#181B22]">PAIN (3 Blinks)</option>
                <option value="WATER" className="bg-[#181B22]">WATER (Look Left + 1 Blink)</option>
                <option value="BATHROOM" className="bg-[#181B22]">BATHROOM (Look Right + 1 Blink)</option>
              </select>

              <label className="flex items-center gap-2 text-xs text-[#94A3B8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={tamperCheckbox}
                  onChange={(e) => setTamperCheckbox(e.target.checked)}
                  className="accent-[#FF334B] rounded"
                />
                <span className={tamperCheckbox ? 'text-[#FF334B] font-bold' : ''}>
                  Simulate Cryptographic Tampering (Bad HMAC)
                </span>
              </label>

              <button
                onClick={handleTriggerGaze}
                disabled={triggeringGaze}
                className="px-4 py-2 nm-btn-accent rounded-xl text-white text-xs font-bold flex items-center gap-2 transition-all ml-auto shadow-[0_0_12px_#FF334B]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{triggeringGaze ? 'EMITTING...' : 'DISPATCH SIGNAL'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
