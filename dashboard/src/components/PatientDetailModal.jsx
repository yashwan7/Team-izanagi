import React, { useState } from 'react';
import { 
  X, Activity, Heart, Wind, Clock, ShieldCheck, ShieldAlert, 
  BrainCircuit, AlertTriangle, CheckSquare, Pill, Eye, Compass, Send, 
  FileText, User, Thermometer, Stethoscope 
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        
        {/* Hospital Patient Chart Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-slate-800 m-0 font-mono">{p.patient_id}</h2>
                <span className="text-slate-600 text-sm font-semibold">&bull; {p.patient_name || 'Patient'}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                  patient.triage_badge === 'RED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  patient.triage_badge === 'YELLOW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  PRIORITY {patient.priority_score?.toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 m-0">
                Hospital EMR Record &bull; Sector GPS: {p.gps?.lat.toFixed(4)}, {p.gps?.lng.toFixed(4)} &bull; Alt: {p.gps?.altitude || 210}m
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isTampered ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-50 text-rose-700 border border-rose-300 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                TAMPERED
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium font-mono text-emerald-700 bg-emerald-50 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                HMAC VERIFIED
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ICU Telemetry Vitals Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 flex flex-col">
              <span className="text-slate-400 text-xs flex items-center gap-1 font-semibold">
                <Heart className="w-3 h-3 text-rose-500" /> Heart Rate
              </span>
              <span className="text-xl font-bold font-mono text-slate-800 mt-1">
                {p.vitals?.heart_rate || '--'} <span className="text-xs text-slate-400 font-normal">bpm</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Norm: 60-100</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 flex flex-col">
              <span className="text-slate-400 text-xs flex items-center gap-1 font-semibold">
                <Wind className="w-3 h-3 text-sky-500" /> SpO2 O2
              </span>
              <span className={`text-xl font-bold font-mono mt-1 ${p.vitals?.spo2 < 90 ? 'text-rose-600' : 'text-slate-800'}`}>
                {p.vitals?.spo2 || '--'}%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Norm: &gt;95%</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 flex flex-col">
              <span className="text-slate-400 text-xs font-semibold">Blood Pressure</span>
              <span className="text-xl font-bold font-mono text-slate-800 mt-1">
                {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">mmHg</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 flex flex-col">
              <span className="text-slate-400 text-xs font-semibold">Resp. Rate</span>
              <span className="text-xl font-bold font-mono text-slate-800 mt-1">
                {p.vitals?.respiratory_rate || '--'} <span className="text-xs text-slate-400 font-normal">/min</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Norm: 12-20</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 flex flex-col">
              <span className="text-slate-400 text-xs flex items-center gap-1 font-semibold">
                <Clock className="w-3 h-3 text-amber-500" /> Evac ETA
              </span>
              <span className="text-xl font-bold font-mono text-amber-600 mt-1">
                {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help}h`}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Definitive Care</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 flex flex-col">
              <span className="text-slate-400 text-xs font-semibold">Trauma Fall</span>
              <span className={`text-sm font-bold font-mono mt-2 ${p.vitals?.fall_detected ? 'text-rose-600' : 'text-emerald-600'}`}>
                {p.vitals?.fall_detected ? 'FALL DETECTED' : 'NORMAL'}
              </span>
            </div>
          </div>

          {/* Clinical Decision Support (CDSS) - Ollama Llama 3.2 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-purple-600" />
                <h3 className="text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wider m-0">
                  Clinical Decision Support (Ollama Llama 3.2:3b Triage Service)
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                PROTOCOL: {evaluation?.protocol_mode || (isAcute ? 'ACUTE_STABILIZATION' : isPFC ? 'PROLONGED_FIELD_CARE' : 'TACTICAL_STANDARD')}
              </span>
            </div>

            {/* Clinical Summary */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[11px] font-mono text-blue-700 uppercase tracking-wider mb-1 font-semibold">
                Clinical Diagnosis & Triage Assessment:
              </div>
              <p className="text-xs md:text-sm text-slate-700 leading-relaxed m-0">
                {evaluation?.clinical_summary || 'Evaluating patient physiological status...'}
              </p>
            </div>

            {/* Clinical Action Steps */}
            <div>
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                Prescribed Clinical Action Plan:
              </div>
              <div className="space-y-2">
                {evaluation?.action_steps?.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold font-mono shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prolonged Field Care Specifics */}
            {(isPFC || (evaluation?.rationing_guidelines && evaluation.rationing_guidelines.length > 0)) && (
              <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200 space-y-2">
                <div className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  Prolonged Field Care (PFC) & Resource Rationing Guidelines (Help Delay: {p.time_to_help}h):
                </div>
                <ul className="text-xs text-purple-800 space-y-1 pl-4 list-disc">
                  {evaluation?.rationing_guidelines?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Red Flag Escalation Triggers */}
            {evaluation?.red_flag_triggers && evaluation.red_flag_triggers.length > 0 && (
              <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-200 space-y-2">
                <div className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Red-Flag Clinical Escalation Triggers:
                </div>
                <ul className="text-xs text-rose-800 space-y-1 pl-4 list-disc">
                  {evaluation.red_flag_triggers.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Interactive Medical Sensor Simulator Sandbox */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase font-mono m-0">
                  Biometric Sensor Simulator (EOG & RFID HMAC Stream)
                </h4>
              </div>
              <span className="text-[10px] text-slate-500">
                Emit simulated biopotential trigger to this patient chart
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={gazeCmd}
                onChange={(e) => setGazeCmd(e.target.value)}
                className="bg-white border border-slate-200 text-xs text-slate-700 rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-400"
              >
                <option value="CALL_NURSE">CALL_NURSE (2 Blinks)</option>
                <option value="PAIN">PAIN (3 Blinks)</option>
                <option value="WATER">WATER (Look Left + 1 Blink)</option>
                <option value="BATHROOM">BATHROOM (Look Right + 1 Blink)</option>
              </select>

              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tamperCheckbox}
                  onChange={(e) => setTamperCheckbox(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-0"
                />
                <span className={tamperCheckbox ? 'text-rose-600 font-bold' : ''}>
                  Simulate Cryptographic Tampering (Bad HMAC)
                </span>
              </label>

              <button
                onClick={handleTriggerGaze}
                disabled={triggeringGaze}
                className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ml-auto"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{triggeringGaze ? 'Emitting...' : 'Dispatch Signal'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
