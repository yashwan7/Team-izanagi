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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-150">
      <div className={`relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all bg-white ${
        isTampered 
          ? 'border-rose-300 ring-4 ring-rose-500/20' 
          : 'border-slate-100'
      }`}>

        {/* Hospital Header Banner */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isTampered ? 'bg-rose-50/80 border-rose-200' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${
              isTampered ? 'bg-rose-600 text-white animate-bounce' : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
              <CmdIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold">
                HOSPITAL NURSE CALL SYSTEM &bull; EOG BIOPOTENTIAL
              </span>
              <h3 className="text-sm md:text-base font-bold text-slate-800 m-0">
                {config.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">

          {/* Cryptographic Security Status */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
            isTampered 
              ? 'bg-rose-50 border-rose-200 text-rose-900' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            {isTampered ? (
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wide">
                  DEVICE SECURITY: {verification_status}
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed opacity-90 m-0">
                {isTampered 
                  ? 'SECURITY ALERT: HMAC-SHA256 signature verification failed! The incoming packet hash does not match expected cryptographic key. Quarantine command pending manual clinical authentication.' 
                  : 'Hardware Authentication Verified. Biopotential sensor stream cryptographically signed and confirmed authentic.'}
              </p>
            </div>
          </div>

          {/* Patient Details Strip */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs space-y-2.5">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Patient / Unit:</span>
              <span className="font-bold text-slate-800">{patient_id} &bull; {patient_name || 'Patient'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">DSP Signal Vector:</span>
              <span className="text-blue-600 font-mono font-bold">
                {blinkCount} Blink(s) &bull; Direction: {direction}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Definitive Evacuation Window:</span>
              <span className="text-slate-800 font-bold font-mono">
                {time_to_help < 1 ? `${Math.round(time_to_help * 60)} mins` : `${time_to_help} hrs`}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/50 p-3 rounded-xl border border-blue-100 m-0">
            {config.desc}
          </p>

          {/* Action Dispatch Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                if (onDispatch) onDispatch(alert);
                onClose();
              }}
              className={`px-5 py-2.5 rounded-full text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all ${
                isTampered ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{config.actionLabel}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
