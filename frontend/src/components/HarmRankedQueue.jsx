import React from 'react';
import { ShieldCheck, ShieldAlert, Heart, Wind, Clock, Eye, AlertCircle, ChevronRight, Activity } from 'lucide-react';

export default function HarmRankedQueue({ patients = [], selectedPatientId, onSelectPatient }) {
  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
          <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase m-0">
            Harm-Ranked Triage Queue
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>Auto-Sorted by Priority Score</span>
        </div>
      </div>

      {/* Patient Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {patients.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono text-xs">
            Awaiting incoming telemetry streams...
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
              RED: 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-rose-500/10',
              YELLOW: 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/10',
              GREEN: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-500/10',
              BLACK: 'bg-slate-700/40 text-slate-400 border-slate-600',
            }[badge] || 'bg-slate-800 text-slate-300 border-slate-700';

            return (
              <div
                key={p.patient_id}
                onClick={() => onSelectPatient(p.patient_id)}
                className={`relative p-3.5 rounded-xl border transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-500/80 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                    : 'bg-slate-950/60 border-slate-800/90 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                {/* Left Priority Score Bar */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-200 tracking-wide">
                      {p.patient_id}
                    </span>
                    <span className="text-slate-400 text-xs font-medium">
                      &bull; {p.patient_name || 'Operative'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Security Badge */}
                    {isTampered ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/60 radar-alert">
                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                        TAMPERED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        HMAC OK
                      </span>
                    )}

                    {/* Harm Priority Badge */}
                    <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border shadow-sm ${badgeStyles}`}>
                      SCORE: {score.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-4 gap-2 mb-2.5 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 text-xs font-mono">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[10px] flex items-center gap-1">
                      <Heart className="w-2.5 h-2.5 text-rose-400" /> HR
                    </span>
                    <span className={`font-bold ${p.vitals?.heart_rate > 120 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {p.vitals?.heart_rate || '--'} <span className="text-[10px] text-slate-500">bpm</span>
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[10px] flex items-center gap-1">
                      <Wind className="w-2.5 h-2.5 text-cyan-400" /> SpO2
                    </span>
                    <span className={`font-bold ${p.vitals?.spo2 < 90 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {p.vitals?.spo2 || '--'}%
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[10px]">BP</span>
                    <span className="font-bold text-slate-200">
                      {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[10px] flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-amber-400" /> ETA Help
                    </span>
                    <span className={`font-bold ${isAcute ? 'text-rose-400' : isPFC ? 'text-purple-400' : 'text-slate-200'}`}>
                      {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help.toFixed(1)}h`}
                    </span>
                  </div>
                </div>

                {/* Footer Pills & Alerts */}
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Protocol Mode Pill */}
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
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] border border-cyan-500/40 flex items-center gap-1">
                        <Eye className="w-2.5 h-2.5" />
                        {p.eye_gaze.command}
                      </span>
                    )}
                    {/* Fall Detected */}
                    {p.vitals?.fall_detected && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono text-[10px] border border-orange-500/40">
                        FALL DETECTED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-slate-500 group-hover:text-cyan-400 transition-colors">
                    <span className="text-[10px] font-mono mr-1">Inspect</span>
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
