import React from 'react';
import { 
  Eye, ShieldAlert, ShieldCheck, CheckCircle2, 
  X, BellRing, Droplets, HeartPulse, User, Hospital, AlertTriangle 
} from 'lucide-react';

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
          title: 'EMERGENCY NURSE CALL (CODE ASSIST)',
          desc: 'Patient executed 2 rapid blinks via EOG biopotential electrodes requesting immediate bedside response.',
          color: 'rose',
          icon: BellRing,
          actionLabel: 'Dispatch Floor Nurse Immediately'
        };
      case 'PAIN':
        return {
          title: 'ACUTE PAIN DISTRESS SIGNAL',
          desc: 'Patient executed 3 blinks indicating breakthrough pain or clinical deterioration.',
          color: 'amber',
          icon: HeartPulse,
          actionLabel: 'Notify Attending & Administer Analgesia'
        };
      case 'WATER':
        return {
          title: 'HYDRATION & CAREGIVER REQUEST',
          desc: 'Patient signaled GAZE LEFT + 1 blink requesting oral rehydration / nursing assistance.',
          color: 'sky',
          icon: Droplets,
          actionLabel: 'Deploy Nursing Assistant'
        };
      case 'BATHROOM':
        return {
          title: 'MOBILITY & POSITIONING ASSISTANCE',
          desc: 'Patient signaled GAZE RIGHT + 1 blink requesting hygiene / lateral turning support.',
          color: 'purple',
          icon: User,
          actionLabel: 'Deploy Patient Care Technician'
        };
      default:
        return {
          title: `PATIENT SIGNAL: ${cmd}`,
          desc: 'EOG DSP biometric trigger detected.',
          color: 'sky',
          icon: Eye,
          actionLabel: 'Acknowledge Call'
        };
    }
  };

  const config = getCommandConfig(command);
  const CmdIcon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all bg-[#0a1224] ${
        isTampered 
          ? 'border-rose-500/80 shadow-rose-900/40 emergency-beacon-alert' 
          : 'border-sky-500/50 shadow-sky-950/60'
      }`}>

        {/* Hospital Header Banner */}
        <div className={`px-5 py-3.5 flex items-center justify-between border-b ${
          isTampered ? 'bg-rose-950/80 border-rose-800' : 'bg-[#0d1830] border-[#1b284a]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-md ${
              isTampered ? 'bg-rose-600 text-white animate-bounce' : 'bg-sky-600/30 text-sky-400 border border-sky-400/40'
            }`}>
              <CmdIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
                HOSPITAL NURSE CALL SYSTEM · EOG BIOPOTENTIAL
              </span>
              <h3 className="text-sm md:text-base font-bold text-white m-0">
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

          {/* Cryptographic Security Status */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            isTampered 
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-200' 
              : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
          }`}>
            {isTampered ? (
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wide">
                  DEVICE SECURITY: {verification_status}
                </span>
              </div>
              <p className="text-xs mt-1 text-slate-300 leading-relaxed">
                {isTampered 
                  ? 'SECURITY ALERT: HMAC-SHA256 signature verification failed! The incoming packet hash does not match expected cryptographic key. Quarantine command pending manual clinical authentication.' 
                  : 'Hardware Authentication Verified. Biopotential sensor stream cryptographically signed and confirmed authentic.'}
              </p>
            </div>
          </div>

          {/* Patient Details Strip */}
          <div className="bg-[#080e1c] rounded-xl p-3.5 border border-[#1b284a] text-xs space-y-2">
            <div className="flex justify-between items-center border-b border-[#1b284a] pb-2">
              <span className="text-slate-400">Patient / Unit:</span>
              <span className="font-bold text-white">{patient_id} &bull; {patient_name || 'Patient'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#1b284a] pb-2">
              <span className="text-slate-400">DSP Signal Vector:</span>
              <span className="text-sky-400 font-mono font-semibold">
                {blinkCount} Blink(s) &bull; Direction: {direction}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Definitive Evacuation Window:</span>
              <span className="text-amber-400 font-mono font-semibold">
                {time_to_help < 1 ? `${Math.round(time_to_help * 60)} minutes` : `${time_to_help} hours`}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 italic">
            {config.desc}
          </p>

        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 bg-[#080e1c] border-t border-[#1b284a] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Dismiss Call
          </button>
          
          <button
            onClick={() => {
              if (onDispatch) onDispatch(alert);
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
              isTampered
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30'
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
