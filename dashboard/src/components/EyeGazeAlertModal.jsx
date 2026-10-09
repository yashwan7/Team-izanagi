import React from 'react';
import { 
  Eye, ShieldAlert, ShieldCheck, CheckCircle2, 
  X, BellRing, Droplets, HeartPulse, User 
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
          icon: BellRing,
          actionLabel: 'DISPATCH FLOOR NURSE IMMEDIATELY'
        };
      case 'PAIN':
        return {
          title: 'ACUTE PAIN DISTRESS SIGNAL',
          desc: 'Patient executed 3 blinks indicating breakthrough pain or clinical deterioration.',
          icon: HeartPulse,
          actionLabel: 'NOTIFY ATTENDING & ADMINISTER ANALGESIA'
        };
      case 'WATER':
        return {
          title: 'HYDRATION & CAREGIVER REQUEST',
          desc: 'Patient signaled GAZE LEFT + 1 blink requesting oral rehydration / nursing assistance.',
          icon: Droplets,
          actionLabel: 'DEPLOY NURSING ASSISTANT'
        };
      case 'BATHROOM':
        return {
          title: 'MOBILITY & POSITIONING ASSISTANCE',
          desc: 'Patient signaled GAZE RIGHT + 1 blink requesting hygiene / lateral turning support.',
          icon: User,
          actionLabel: 'DEPLOY PATIENT CARE TECHNICIAN'
        };
      default:
        return {
          title: `PATIENT SIGNAL: ${cmd}`,
          desc: 'EOG DSP biometric trigger detected.',
          icon: Eye,
          actionLabel: 'ACKNOWLEDGE CALL'
        };
    }
  };

  const config = getCommandConfig(command);
  const CmdIcon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md font-mono select-none">
      <div className={`relative w-full max-w-lg nm-flat rounded-3xl border overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] transition-all text-[#F8FAFC] ${
        isTampered 
          ? 'border-[#FF334B]/50 shadow-[0_0_40px_rgba(255,51,75,0.25)]' 
          : 'border-white/[0.04]'
      }`}>

        {/* Header Banner */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${
          isTampered ? 'nm-alert-inset border-[#FF334B]/40' : 'nm-flat border-white/[0.04]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 nm-convex rounded-xl flex items-center justify-center ${
              isTampered ? 'text-[#FF334B]' : 'text-[#FF334B]'
            }`}>
              <CmdIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-mono tracking-wider uppercase text-[#94A3B8] font-bold block">
                NURSE CALL SYSTEM &bull; EOG DSP TELEMETRY
              </span>
              <h3 className="text-xs md:text-sm font-black text-[#F8FAFC] m-0 uppercase tracking-wide">
                {config.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 nm-btn rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-[#FF334B] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          
          {/* Security Status Box */}
          <div className={`p-4 rounded-2xl flex items-start gap-3 ${
            isTampered 
              ? 'nm-alert-inset border border-[#FF334B]/40 text-[#FF334B]' 
              : 'nm-inset border border-[#00E5A3]/30 text-[#00E5A3]'
          }`}>
            {isTampered ? (
              <ShieldAlert className="w-5 h-5 text-[#FF334B] shrink-0 mt-0.5 animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-[#00E5A3] shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-black uppercase tracking-wider">
                {isTampered ? 'CRITICAL SECURITY BREACH: SIGNATURE TAMPERED' : 'HMAC INTEGRITY VERIFIED (AUTHENTIC)'}
              </div>
              <p className="text-[10px] text-[#94A3B8] mt-1 m-0 font-medium leading-relaxed">
                {isTampered 
                  ? 'The SHA-256 HMAC signature received from this bio-capsule failed cryptographic verification. This alert could indicate packet spoofing or wire corruption.' 
                  : 'Hardware cryptographic signature matched the pre-shared sensor key. Signal authenticity confirmed.'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="p-3.5 nm-inset rounded-2xl">
            <p className="text-xs text-[#F8FAFC] m-0 leading-relaxed font-medium">
              {config.desc}
            </p>
          </div>

          {/* Signal Attributes */}
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="nm-inset rounded-xl p-3">
              <span className="text-[9px] text-[#94A3B8] block uppercase font-bold">Casualty</span>
              <strong className="text-[#F8FAFC] text-xs font-bold mt-0.5 block">{patient_id}</strong>
              <span className="text-[10px] text-[#94A3B8] block truncate mt-0.5">{patient_name}</span>
            </div>
            <div className="nm-inset rounded-xl p-3">
              <span className="text-[9px] text-[#94A3B8] block uppercase font-bold">Gaze Vector</span>
              <strong className="text-[#FF334B] text-xs font-mono font-bold mt-0.5 block">{direction}</strong>
              <span className="text-[10px] text-[#94A3B8] block mt-0.5">{blinkCount} blinks</span>
            </div>
            <div className="nm-inset rounded-xl p-3">
              <span className="text-[9px] text-[#94A3B8] block uppercase font-bold">Evacuation ETA</span>
              <strong className="text-[#F8FAFC] text-xs font-mono font-bold mt-0.5 block">
                {time_to_help < 1 ? `${Math.round(time_to_help * 60)}m` : `${time_to_help}h`}
              </strong>
              <span className="text-[10px] text-[#94A3B8] block mt-0.5">Definitive Care</span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="pt-3 border-t border-white/[0.04] flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 nm-btn rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition-all"
            >
              DISMISS
            </button>
            <button
              onClick={() => {
                if (onDispatch) onDispatch(alert);
                onClose();
              }}
              className="px-5 py-2 nm-btn-accent rounded-xl text-white text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_12px_#FF334B]"
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
