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
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] overflow-hidden">
      
      {/* Hospital ED Tracking Board Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-800 tracking-tight m-0 flex items-center gap-2">
              Emergency Triage Board &bull; Harm-Ranked Queue
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </h2>
            <p className="text-[11px] text-slate-400 m-0">
              Live delay-aware priority sorting: (Severity &times; Time Sensitivity) / Time to Help
            </p>
          </div>
        </div>

        {/* Triage Summary Badges */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            RED: <strong className="font-extrabold">{redCount}</strong>
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            YELLOW: <strong className="font-extrabold">{yellowCount}</strong>
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            GREEN: <strong className="font-extrabold">{greenCount}</strong>
          </span>
        </div>
      </div>

      {/* Patient Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {patients.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-xs">
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
              RED: 'bg-rose-50 text-rose-700 border-rose-200',
              YELLOW: 'bg-amber-50 text-amber-700 border-amber-200',
              GREEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              BLACK: 'bg-slate-100 text-slate-700 border-slate-300',
            }[badge] || 'bg-slate-100 text-slate-700 border-slate-200';

            return (
              <div
                key={p.patient_id}
                onClick={() => onSelectPatient(p.patient_id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                  isSelected
                    ? 'bg-blue-50/40 border-blue-400 shadow-md ring-2 ring-blue-500/20'
                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Header: Patient Identification & Triage Level */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-lg border border-blue-200">
                        {p.patient_id}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        {p.patient_name || 'Operative / Patient'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {p.patient_id === 'PT-101' ? 'Trauma Resus Bay 01 &bull; Dr. Anderson' :
                       p.patient_id === 'PT-204' ? 'Isolated Outpost Field Litter &bull; Medic Charlie' :
                       p.patient_id === 'PT-309' ? 'Neuro Intensive Ward 03 &bull; Dr. Chen' : 'Observation Bay 02'}
                    </div>
                  </div>

                  {/* Priority & Security Badges */}
                  <div className="flex items-center gap-2">
                    {isTampered ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-300 animate-pulse">
                        <ShieldAlert className="w-3 h-3 text-rose-600" />
                        TAMPERED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono text-emerald-700 bg-emerald-50 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        VERIFIED
                      </span>
                    )}

                    <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold font-mono border ${badgeStyles}`}>
                      PRIORITY {score.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Clinical Vital Signs Telemetry Strip */}
                <div className="grid grid-cols-4 gap-2 mb-2.5 bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs text-xs">
                  {/* Heart Rate */}
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] flex items-center gap-1 font-semibold">
                      <Heart className="w-2.5 h-2.5 text-rose-500" /> HR
                    </span>
                    <span className={`font-mono font-bold text-sm ${p.vitals?.heart_rate > 120 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {p.vitals?.heart_rate || '--'} <span className="text-[10px] font-normal text-slate-400">bpm</span>
                    </span>
                  </div>

                  {/* SpO2 */}
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] flex items-center gap-1 font-semibold">
                      <Wind className="w-2.5 h-2.5 text-sky-500" /> SpO2
                    </span>
                    <span className={`font-mono font-bold text-sm ${p.vitals?.spo2 < 90 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {p.vitals?.spo2 || '--'}%
                    </span>
                  </div>

                  {/* NIBP Blood Pressure */}
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] font-semibold">NIBP</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">
                      {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
                    </span>
                  </div>

                  {/* ETA to Definitive Care */}
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] flex items-center gap-1 font-semibold">
                      <Clock className="w-2.5 h-2.5 text-amber-500" /> Help ETA
                    </span>
                    <span className={`font-mono font-bold text-sm ${isAcute ? 'text-rose-600' : isPFC ? 'text-purple-600' : 'text-slate-800'}`}>
                      {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help.toFixed(1)}h`}
                    </span>
                  </div>
                </div>

                {/* Footer Clinical Summary Tags */}
                <div className="flex items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-slate-200/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Clinical Protocol Badge */}
                    {isAcute && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-mono text-[10px] font-semibold border border-rose-200">
                        ⚡ ACUTE STABILIZATION
                      </span>
                    )}
                    {isPFC && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-mono text-[10px] font-semibold border border-purple-200">
                        🛡 PROLONGED FIELD CARE
                      </span>
                    )}

                    {/* Eye Gaze Command Tag */}
                    {p.eye_gaze && p.eye_gaze.command && (
                      <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-mono text-[10px] font-semibold border border-sky-200 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {p.eye_gaze.command}
                      </span>
                    )}

                    {/* Red Flags Pill */}
                    {p.red_flags && p.red_flags.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px]">
                        {p.red_flags[0].replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-slate-400 group-hover:text-blue-600 transition-colors text-xs font-semibold">
                    <span className="mr-0.5">View Record</span>
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
