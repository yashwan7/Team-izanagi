import React from 'react';
import { 
  Heart, Wind, Clock, ShieldCheck, ShieldAlert, 
  Activity, Eye, ChevronRight
} from 'lucide-react';

export default function HarmRankedQueue({ patients = [], selectedPatientId, onSelectPatient }) {
  const redCount = patients.filter(p => p.triage_badge === 'RED').length;
  const yellowCount = patients.filter(p => p.triage_badge === 'YELLOW').length;
  const greenCount = patients.filter(p => p.triage_badge === 'GREEN').length;

  return (
    <div className="flex flex-col h-full nm-flat rounded-2xl border border-white/[0.04] font-mono select-none text-[#F8FAFC] overflow-hidden">
      
      {/* Hospital ED Tracking Board Header */}
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 nm-convex rounded-xl border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs md:text-sm font-bold text-[#F8FAFC] uppercase tracking-wider m-0 flex items-center gap-2">
              EMERGENCY TRIAGE BOARD &bull; HARM-RANKED QUEUE
              <span className="w-2 h-2 rounded-full bg-[#FF334B] animate-pulse shadow-[0_0_8px_#FF334B]" />
            </h2>
            <p className="text-[11px] text-[#94A3B8] m-0 font-sans mt-0.5">
              Delay-aware priority sorting: (Severity &times; Time Sensitivity) / Time to Help
            </p>
          </div>
        </div>

        {/* Triage Summary Badges */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1 nm-alert-inset text-[#FF334B] border border-[#FF334B]/40 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF334B] shadow-[0_0_6px_#FF334B]" />
            RED: <strong className="font-bold">{redCount}</strong>
          </span>
          <span className="px-3 py-1 nm-inset text-[#F8FAFC] border border-white/[0.04] rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            YELLOW: <strong className="font-bold">{yellowCount}</strong>
          </span>
          <span className="px-3 py-1 nm-inset text-[#94A3B8] border border-white/[0.04] rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            GREEN: <strong className="font-bold">{greenCount}</strong>
          </span>
        </div>
      </div>

      {/* Patient Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {patients.length === 0 ? (
          <div className="text-center py-20 text-[#94A3B8] text-xs">
            Awaiting incoming hospital admissions and field telemetry...
          </div>
        ) : (
          patients.map((item) => {
            const p = item.capsule;
            const isSelected = p.patient_id === selectedPatientId;
            const badge = item.triage_badge || 'YELLOW';
            const score = item.priority_score || 0;
            const isAcute = p.time_to_help <= 0.5;
            const isPFC = p.time_to_help >= 24.0;
            const isTampered = p.verification_status === 'TAMPERED';

            const badgeStyles = {
              RED: 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40',
              YELLOW: 'nm-inset text-[#F59E0B] border-[#F59E0B]/30',
              GREEN: 'nm-inset text-[#10B981] border-[#10B981]/30',
              BLACK: 'nm-inset text-[#64748B] border-white/[0.04]',
            }[badge] || 'nm-inset text-[#94A3B8] border-white/[0.04]';

            return (
              <div
                key={p.patient_id}
                onClick={() => onSelectPatient(p.patient_id)}
                className={`p-4 rounded-2xl transition-all cursor-pointer relative border ${
                  isSelected
                    ? 'nm-convex border-[#FF334B]/60 shadow-[0_0_15px_rgba(255,51,75,0.15)] ring-1 ring-[#FF334B]/40'
                    : 'nm-flat border-white/[0.04] hover:border-[#FF334B]/30'
                }`}
              >
                {/* Header: Patient Identification & Triage Level */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#FF334B] nm-alert-inset px-2 py-0.5 rounded-lg border border-[#FF334B]/30">
                        {p.patient_id}
                      </span>
                      <span className="font-bold text-[#F8FAFC] text-sm">
                        {p.patient_name || 'Patient'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-1 font-sans">
                      {p.patient_id === 'PT-101' ? 'Trauma Resus Bay 01 &bull; Dr. Anderson' :
                       p.patient_id === 'PT-204' ? 'Isolated Outpost Field Litter &bull; Medic Charlie' :
                       p.patient_id === 'PT-309' ? 'Neuro Intensive Ward 03 &bull; Dr. Chen' : 'Observation Bay 02'}
                    </div>
                  </div>

                  {/* Priority & Security Badges */}
                  <div className="flex items-center gap-2">
                    {isTampered ? (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold font-mono nm-alert-inset text-[#FF334B] border border-[#FF334B]/50 rounded-lg animate-pulse">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#FF334B]" />
                        TAMPERED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium font-mono text-[#F8FAFC] nm-inset border border-white/[0.04] rounded-lg">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#FF334B]" />
                        VERIFIED
                      </span>
                    )}

                    <span className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded-lg border ${badgeStyles}`}>
                      PRIORITY {score.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Clinical Vital Signs Telemetry Strip */}
                <div className="grid grid-cols-4 gap-2.5 mb-3 nm-inset p-3 rounded-xl border border-white/[0.02] text-xs">
                  {/* Heart Rate */}
                  <div className="flex flex-col">
                    <span className="text-[#94A3B8] text-[10px] flex items-center gap-1 font-semibold uppercase">
                      <Heart className="w-3 h-3 text-[#FF334B]" /> HR
                    </span>
                    <span className={`font-mono font-bold text-sm mt-0.5 ${p.vitals?.heart_rate > 120 ? 'text-[#FF334B]' : 'text-[#F8FAFC]'}`}>
                      {p.vitals?.heart_rate || '--'} <span className="text-[10px] font-normal text-[#64748B]">bpm</span>
                    </span>
                  </div>

                  {/* SpO2 */}
                  <div className="flex flex-col">
                    <span className="text-[#94A3B8] text-[10px] flex items-center gap-1 font-semibold uppercase">
                      <Wind className="w-3 h-3 text-[#38BDF8]" /> SpO2
                    </span>
                    <span className={`font-mono font-bold text-sm mt-0.5 ${p.vitals?.spo2 < 90 ? 'text-[#FF334B]' : 'text-[#F8FAFC]'}`}>
                      {p.vitals?.spo2 || '--'}%
                    </span>
                  </div>

                  {/* NIBP Blood Pressure */}
                  <div className="flex flex-col">
                    <span className="text-[#94A3B8] text-[10px] font-semibold uppercase">NIBP</span>
                    <span className="font-mono font-bold text-[#F8FAFC] text-sm mt-0.5">
                      {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
                    </span>
                  </div>

                  {/* ETA to Definitive Care */}
                  <div className="flex flex-col">
                    <span className="text-[#94A3B8] text-[10px] flex items-center gap-1 font-semibold uppercase">
                      <Clock className="w-3 h-3 text-[#FF334B]" /> Help ETA
                    </span>
                    <span className={`font-mono font-bold text-sm mt-0.5 ${isAcute ? 'text-[#FF334B]' : 'text-[#F8FAFC]'}`}>
                      {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help.toFixed(1)}h`}
                    </span>
                  </div>
                </div>

                {/* Footer Clinical Summary Tags */}
                <div className="flex items-center justify-between gap-2 text-[10px] pt-2 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Clinical Protocol Badge */}
                    {isAcute && (
                      <span className="px-2 py-0.5 nm-alert-inset text-[#FF334B] font-mono text-[9px] font-bold border border-[#FF334B]/30 rounded-md">
                        ACUTE STABILIZATION
                      </span>
                    )}
                    {isPFC && (
                      <span className="px-2 py-0.5 nm-inset text-[#F8FAFC] font-mono text-[9px] font-bold border border-white/[0.04] rounded-md">
                        PROLONGED FIELD CARE
                      </span>
                    )}

                    {/* Eye Gaze Command Tag */}
                    {p.eye_gaze && p.eye_gaze.command && (
                      <span className="px-2 py-0.5 nm-alert-inset text-[#FF334B] font-mono text-[9px] font-bold border border-[#FF334B]/30 rounded-md flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {p.eye_gaze.command}
                      </span>
                    )}

                    {/* Red Flags Tag */}
                    {p.red_flags && p.red_flags.length > 0 && (
                      <span className="px-2 py-0.5 nm-inset text-[#94A3B8] font-mono text-[9px] border border-white/[0.04] rounded-md">
                        {p.red_flags[0].replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-[#94A3B8] hover:text-[#FF334B] transition-colors text-[11px] font-bold">
                    <span>RECORD</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
