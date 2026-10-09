import React, { useState } from 'react';
import { 
  Users, Search, ShieldCheck, ShieldAlert, 
  Heart, Wind, Clock, ChevronRight, 
  FileText
} from 'lucide-react';

export default function PatientsRegistry({ 
  patients = [], 
  selectedPatientId, 
  onSelectPatient,
  onOpenChart 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBadge, setFilterBadge] = useState('ALL');

  const filteredPatients = patients.filter(item => {
    const p = item.capsule;
    const matchesSearch = 
      p.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.red_flags?.some(f => f.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter = 
      filterBadge === 'ALL' || item.triage_badge === filterBadge;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-5 font-mono select-none text-[#F8FAFC]">
      
      {/* Top Header & Search/Filter Controls */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 nm-convex rounded-xl border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-wider m-0">PATIENT DIRECTORY &amp; RECORDS</h2>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1 m-0 font-sans">
            Field Bio-Capsule Registry &bull; {patients.length} admitted patient nodes
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by ID, name, diagnosis..."
              className="w-full nm-inset rounded-xl text-xs text-[#F8FAFC] placeholder-[#64748B] pl-9 pr-3.5 py-2 border border-white/[0.04] focus:outline-none focus:border-[#FF334B]/40"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center nm-inset rounded-xl p-1 border border-white/[0.04] text-xs">
            {['ALL', 'RED', 'YELLOW', 'GREEN'].map(category => (
              <button
                key={category}
                onClick={() => setFilterBadge(category)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                  filterBadge === category
                    ? 'nm-btn-accent text-white shadow-[0_0_12px_rgba(255,51,75,0.4)]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Patient Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPatients.length === 0 ? (
          <div className="col-span-2 nm-flat rounded-2xl p-10 text-center text-[#94A3B8] text-xs border border-white/[0.04]">
            No patient records found matching filter criteria.
          </div>
        ) : (
          filteredPatients.map((item, idx) => {
            const p = item.capsule;
            const isSelected = p.patient_id === selectedPatientId;
            const isTampered = p.verification_status === 'TAMPERED';
            const badge = item.triage_badge;

            const badgeStyles = {
              RED: 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40',
              YELLOW: 'nm-inset text-[#F59E0B] border-[#F59E0B]/30',
              GREEN: 'nm-inset text-[#10B981] border-[#10B981]/30',
            }[badge] || 'nm-inset text-[#94A3B8] border-white/[0.04]';

            const wards = [
              'Trauma Resus Bay 01',
              'Isolated Field Litter A',
              'Neuro Intensive Ward 03',
              'Observation Bay 02'
            ];
            const ward = wards[idx % wards.length];

            return (
              <div
                key={p.patient_id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isSelected 
                    ? 'nm-convex border-[#FF334B]/60 shadow-[0_0_15px_rgba(255,51,75,0.15)] ring-1 ring-[#FF334B]/40' 
                    : 'nm-flat border-white/[0.04] hover:border-[#FF334B]/30'
                }`}
              >
                <div>
                  {/* Top Strip */}
                  <div className="flex items-start justify-between gap-3 mb-3 border-b border-white/[0.04] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 nm-convex rounded-xl border border-white/[0.04] text-[#FF334B] flex items-center justify-center font-bold text-xs shadow-inner">
                        {p.patient_name ? p.patient_name.split(' ').map(n=>n[0]).join('').slice(0,2) : 'PT'}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#F8FAFC] m-0">{p.patient_name}</h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] mt-1 font-sans">
                          <span className="font-mono text-[#FF334B] font-bold">{p.patient_id}</span>
                          <span>&bull;</span>
                          <span>{ward}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isTampered ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold nm-alert-inset text-[#FF334B] border border-[#FF334B]/40 rounded-lg animate-pulse">
                          <ShieldAlert className="w-3 h-3 text-[#FF334B]" />
                          TAMPERED
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold nm-inset text-[#F8FAFC] border border-white/[0.04] rounded-lg">
                          <ShieldCheck className="w-3 h-3 text-[#FF334B]" />
                          AUTH OK
                        </span>
                      )}

                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg border ${badgeStyles}`}>
                        {badge} ({item.priority_score.toFixed(1)})
                      </span>
                    </div>
                  </div>

                  {/* Vitals Summary Strip */}
                  <div className="grid grid-cols-4 gap-2 nm-inset p-3 rounded-xl border border-white/[0.02] text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-[#94A3B8] uppercase flex items-center gap-1">
                        <Heart className="w-3 h-3 text-[#FF334B]" /> HR
                      </span>
                      <span className="font-bold text-[#F8FAFC] text-xs mt-0.5 block">{p.vitals?.heart_rate || '--'} bpm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#94A3B8] uppercase flex items-center gap-1">
                        <Wind className="w-3 h-3 text-[#38BDF8]" /> SpO2
                      </span>
                      <span className={`font-bold text-xs mt-0.5 block ${p.vitals?.spo2 < 90 ? 'text-[#FF334B]' : 'text-[#F8FAFC]'}`}>
                        {p.vitals?.spo2 || '--'}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#94A3B8] uppercase">BP</span>
                      <span className="font-bold text-[#F8FAFC] text-xs mt-0.5 block">
                        {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#94A3B8] uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#FF334B]" /> Help ETA
                      </span>
                      <span className="font-bold text-[#FF334B] text-xs mt-0.5 block">
                        {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help}h`}
                      </span>
                    </div>
                  </div>

                  {/* Red Flags & Diagnosis */}
                  <div className="mb-4">
                    <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                      DIAGNOSIS &amp; RED FLAGS:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.red_flags && p.red_flags.length > 0 ? (
                        p.red_flags.map((flag, i) => (
                          <span key={i} className="px-2 py-0.5 text-[10px] font-medium nm-inset text-[#94A3B8] border border-white/[0.04] rounded-md">
                            {flag.replace(/_/g, ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-[#64748B] italic">No active red flags recorded</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 pt-3 border-t border-white/[0.04]">
                  <button
                    onClick={() => {
                      onSelectPatient(p.patient_id);
                      if (onOpenChart) onOpenChart(p.patient_id);
                    }}
                    className="flex-1 py-2 nm-btn text-[#F8FAFC] hover:text-[#FF334B] rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#FF334B]" />
                    <span>OPEN EMR CHART</span>
                  </button>

                  <button
                    onClick={() => onSelectPatient(p.patient_id)}
                    className="px-4 py-2 nm-btn-accent text-white text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all shadow-[0_0_12px_rgba(255,51,75,0.3)]"
                  >
                    <span>INSPECT</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
