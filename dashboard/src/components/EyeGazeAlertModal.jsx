import React from 'react';
import { Eye, ShieldAlert, ShieldCheck, AlertOctagon, CheckCircle2, X, BellRing, Droplets, HeartPulse, User } from 'lucide-react';

export default function EyeGazeAlertModal({ alert, onClose, onDispatch }) {
  if (!alert) return null;

  const { patient_id, patient_name, eye_gaze, verification_status, time_to_help } = alert;
  const isTampered = verification_status === 'TAMPERED';
  const command = eye_gaze?.command || 'ALERT';
  const direction = eye_gaze?.direction || 'CENTER';
  const blinkCount = eye_gaze?.blink_count || 1;

  const getCommandConfig = (cmd) => {
    switch (cmd) {
      case 'CALL_NURSE':
        return {
          title: 'CALL NURSE (EMERGENCY)',
          desc: 'Patient executed 2 blinks in 1.5s requesting immediate medical personnel bedside.',
          color: 'rose',
          icon: BellRing,
          actionLabel: 'Dispatch Trauma Medic Bedside'
        };
      case 'PAIN':
        return {
          title: 'SEVERE PAIN DISTRESS',
          desc: 'Patient executed 3 blinks indicating severe acute pain or physiological spike.',
          color: 'amber',
          icon: HeartPulse,
          actionLabel: 'Administer Analgesic Protocol'
        };
      case 'WATER':
        return {
          title: 'HYDRATION REQUEST (WATER)',
          desc: 'Patient looked LEFT + 1 blink requesting oral hydration / moist swabs.',
          color: 'cyan',
          icon: Droplets,
          actionLabel: 'Deploy Caregiver with Hydration'
        };
      case 'BATHROOM':
        return {
          title: 'ASSISTANCE / BATHROOM',
          desc: 'Patient looked RIGHT + 1 blink requesting hygiene / position change assistance.',
          color: 'purple',
          icon: User,
          actionLabel: 'Deploy Nursing Assistant'
        };
      default:
        return {
          title: `EYE-GAZE: ${cmd}`,
          desc: 'EOG DSP biopotential trigger detected.',
          color: 'blue',
          icon: Eye,
          actionLabel: 'Acknowledge Command'
        };
    }
  };

  const config = getCommandConfig(command);
  const CmdIcon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all bg-slate-950 ${
        isTampered ? 'border-rose-500/80 shadow-rose-500/20 radar-alert' : 'border-cyan-500/50 shadow-cyan-500/20'
      }`}>

        {/* Top Banner */}
        <div className={`px-5 py-3.5 flex items-center justify-between border-b ${
          isTampered ? 'bg-rose-950/80 border-rose-800' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isTampered ? 'bg-rose-600 text-white animate-bounce' : 'bg-cyan-500/20 text-cyan-400'
            }`}>
              <CmdIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">
                EOG BIOPOTENTIAL REAL-TIME EVENT
              </span>
              <h3 className="text-base font-bold text-white m-0">
                {config.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">

          {/* Security Status Card */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            isTampered 
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' 
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}>
            {isTampered ? (
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wide">
                  HMAC-SHA256 INTEGRITY: {verification_status}
                </span>
              </div>
              <p className="text-xs mt-1 text-slate-300 leading-relaxed">
                {isTampered 
                  ? 'CRITICAL SECURITY BREACH: Payload signature mismatch! The biopotential capsule data has been tampered with or corrupted over transit. Require physical biometric re-authentication.' 
                  : 'Cryptographic HMAC verified. Origin hardware biopotential stream authenticated and untampered.'}
              </p>
            </div>
          </div>

          {/* Patient Details */}
          <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800/80 font-mono text-xs space-y-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-400">Patient Origin:</span>
              <span className="font-bold text-slate-200">{patient_id} ({patient_name || 'Operative'})</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-400">DSP Signal Features:</span>
              <span className="text-cyan-400 font-semibold">{blinkCount} Blink(s) &bull; Direction: {direction}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">ETA to Definitive Help:</span>
              <span className="text-amber-400 font-semibold">
                {time_to_help < 1 ? `${Math.round(time_to_help * 60)} mins` : `${time_to_help} hours`}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 italic">
            {config.desc}
          </p>

        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 bg-slate-900/80 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Dismiss Alert
          </button>
          
          <button
            onClick={() => {
              if (onDispatch) onDispatch(alert);
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 shadow-lg transition-all ${
              isTampered
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isTampered ? 'Quarantine & Override' : config.actionLabel}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
