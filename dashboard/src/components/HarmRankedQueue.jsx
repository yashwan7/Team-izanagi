import React from 'react';
import { 
  Heart, Wind, Clock, ShieldCheck, ShieldAlert, 
  Activity, Eye, ChevronRight, AlertOctagon, User 
} from 'lucide-react';

export default function HarmRankedQueue({ patients = [], selectedPatientId, onSelectPatient }) {
  const redCount = patients.filter(p => p.triage_badge === 'RED').length;
  const yellowCount = patients.filter(p => p.triage_badge === 'YELLOW').length;
  const greenCount = patients.filter(p => p.triage_badge === 'GREEN').length;

  return (
    <div className="flex flex-col h-full bg-[#0b1328] border border-[#1b284a] rounded-xl overflow-hidden shadow-xl">
      
      {/* Hospital ED Tracking Board Header */}
      <div className="px-4 py-3 bg-[#080d1c] border-b border-[#1b284a] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h2 className="text-xs md:text-sm font-bold text-white tracking-wider uppercase m-0">
            Emergency Triage Board · Harm-Ranked Queue
          </h2>
        </div>

        {/* Triage Summary Badges */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-500/40 font-bold">
            RED: {redCount}
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/40 font-bold">
            YELLOW: {yellowCount}
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-bold">
            GREEN: {greenCount}
          </span>
        </div>
      </div>

      {/* Patient Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {patients.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
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
              RED: 'bg-rose-950/50 text-rose-300 border-rose-500/60 shadow-sm shadow-rose-900/20',
              YELLOW: 'bg-amber-950/50 text-amber-300 border-amber-500/60 shadow-sm shadow-amber-900/20',
              GREEN: 'bg-emerald-950/50 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-900/20',
              BLACK: 'bg-slate-900 text-slate-400 border-slate-700',
            }[badge] || 'bg-slate-900 text-slate-300 border-slate-700';

            return (
              <div
                key={p.patient_id}
                onClick={() => onSelectPatient(p.patient_id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                  isSelected
                    ? 'bg-[#101c38] border-sky-500 shadow-md shadow-sky-500/10 ring-1 ring-sky-500/40'
                    : 'bg-[#0d162d] border-[#1b284a] hover:bg-[#101b36] hover:border-slate-700'
                }`}
              >
                {/* Header: Patient Identification & Triage Level */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60">
                        {p.patient_id}
                      </span>
                      <span className="font-semibold text-white text-xs">
                        {p.patient_name || 'Operative / Patient'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {p.patient_id === 'PT-101' ? 'Trauma Resus Bay 01' :
                       p.patient_id === 'PT-204' ? 'Isolated Outpost Field Litter' :
                       p.patient_id === 'PT-309' ? 'Neuro Intensive Ward 03' : 'Observation Bay 02'}
                    </div>
                  </div>

                  {/* Priority & Security Badges */}
                  <div className="flex items-center gap-1.5">
                    {isTampered ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/60 emergency-beacon-alert">
                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                        TAMPERED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        AUTH OK
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${badgeStyles}`}>
                      PRIORITY: {score.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Clinical Vital Signs Telemetry Strip */}
                <div className="grid grid-cols-4 gap-2 mb-2 bg-[#090f20] p-2 rounded-lg border border-[#1b284a]/80 text-xs">
                  {/* Heart Rate */}
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                      <Heart className="w-2.5 h-2.5 text-rose-400" /> HR
                    </span>
                    <span className={`font-mono font-bold ${p.vitals?.heart_rate > 120 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {p.vitals?.heart_rate || '--'} <span className="text-[10px] font-normal text-slate-500">bpm</span>
                    </span>
                  </div>

                  {/* SpO2 */}
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                      <Wind className="w-2.5 h-2.5 text-cyan-400" /> SpO2
                    </span>
                    <span className={`font-mono font-bold ${p.vitals?.spo2 < 90 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {p.vitals?.spo2 || '--'}%
                    </span>
                  </div>

                  {/* NIBP Blood Pressure */}
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px]">NIBP</span>
                    <span className="font-mono font-bold text-slate-200">
                      {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
                    </span>
                  </div>

                  {/* ETA to Definitive Care */}
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-amber-400" /> Help ETA
                    </span>
                    <span className={`font-mono font-bold ${isAcute ? 'text-rose-400' : isPFC ? 'text-purple-400' : 'text-slate-200'}`}>
                      {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help.toFixed(1)}h`}
                    </span>
                  </div>
                </div>

                {/* Footer Clinical Summary Tags */}
                <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-[#1b284a]/60">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Clinical Protocol Badge */}
                    {isAcute && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono text-[10px] border border-rose-500/30">
                        ⚡ ACUTE STABILIZATION
                      </span>
                    )}
                    {isPFC && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono text-[10px] border border-purple-500/30">
                        🛡 PROLONGED FIELD CARE
                      </span>
                    )}

                    {/* Eye Gaze Command Tag */}
                    {p.eye_gaze && p.eye_gaze.command && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] border border-sky-500/40 flex items-center gap-1">
                        <Eye className="w-2.5 h-2.5" />
                        {p.eye_gaze.command}
                      </span>
                    )}

                    {/* Red Flags Pill */}
                    {p.red_flags && p.red_flags.length > 0 && (
                      <span className="text-[10px] text-rose-400 font-mono">
                        {p.red_flags[0].replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-slate-400 group-hover:text-sky-400 transition-colors text-[10px]">
                    <span className="mr-0.5">Chart</span>
                    <ChevronRight className="w-3.5 h-3.5" />
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
