import React, { useState } from 'react';
import { 
  Users, Search, Filter, ShieldCheck, ShieldAlert, 
  Heart, Wind, Clock, ChevronRight, Stethoscope, 
  UserCheck, AlertCircle, Plus, FileText, PhoneCall 
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
    <div className="space-y-6">
      
      {/* Top Header & Search/Filter Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 m-0">Patient Directory & Medical Records</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 m-0">
            Comprehensive hospital patient registry &bull; {patients.length} admitted records
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, diagnosis..."
              className="w-full bg-slate-50 text-xs text-slate-700 placeholder-slate-400 rounded-full pl-9 pr-4 py-2 border border-slate-200 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-full text-xs">
            {['ALL', 'RED', 'YELLOW', 'GREEN'].map(category => (
              <button
                key={category}
                onClick={() => setFilterBadge(category)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                  filterBadge === category
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Patient Directory Table / Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredPatients.length === 0 ? (
          <div className="col-span-2 bg-white rounded-3xl p-12 text-center text-slate-400 text-xs border border-slate-100">
            No patient records found matching your filter criteria.
          </div>
        ) : (
          filteredPatients.map((item, idx) => {
            const p = item.capsule;
            const isSelected = p.patient_id === selectedPatientId;
            const isTampered = p.verification_status === 'TAMPERED';
            const badge = item.triage_badge;

            const badgeStyles = {
              RED: 'bg-rose-50 text-rose-600 border-rose-200',
              YELLOW: 'bg-amber-50 text-amber-700 border-amber-200',
              GREEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            }[badge] || 'bg-slate-50 text-slate-600 border-slate-200';

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
                className={`bg-white rounded-3xl p-5 border transition-all shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] ${
                  isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100'
                }`}
              >
                {/* Top Strip */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-100 to-indigo-100 text-blue-700 flex items-center justify-center font-bold text-sm shadow-inner">
                      {p.patient_name ? p.patient_name.split(' ').map(n=>n[0]).join('').slice(0,2) : 'PT'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 m-0">{p.patient_name}</h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono font-semibold text-blue-600">{p.patient_id}</span>
                        <span>&bull;</span>
                        <span>{ward}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Security Badge */}
                    {isTampered ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
                        <ShieldAlert className="w-3 h-3 text-rose-500" />
                        TAMPERED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        AUTH OK
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyles}`}>
                      {badge} (Score: {item.priority_score.toFixed(1)})
                    </span>
                  </div>
                </div>

                {/* Vitals Summary Strip */}
                <div className="grid grid-cols-4 gap-2 bg-slate-50/70 p-2.5 rounded-2xl border border-slate-100 text-xs mb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Heart className="w-2.5 h-2.5 text-rose-500" /> HR
                    </span>
                    <span className="font-bold text-slate-800 text-xs">{p.vitals?.heart_rate || '--'} bpm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Wind className="w-2.5 h-2.5 text-blue-500" /> SpO2
                    </span>
                    <span className={`font-bold text-xs ${p.vitals?.spo2 < 90 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {p.vitals?.spo2 || '--'}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold">BP</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-amber-500" /> Help ETA
                    </span>
                    <span className="font-bold text-blue-600 text-xs">
                      {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)}m` : `${p.time_to_help}h`}
                    </span>
                  </div>
                </div>

                {/* Red Flags & Primary Diagnosis */}
                <div className="mb-4">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Clinical Diagnosis & Red Flags:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.red_flags && p.red_flags.length > 0 ? (
                      p.red_flags.map((flag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {flag.replace(/_/g, ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No acute red flags recorded</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      onSelectPatient(p.patient_id);
                      if (onOpenChart) onOpenChart(p.patient_id);
                    }}
                    className="flex-1 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open EMR Chart</span>
                  </button>

                  <button
                    onClick={() => onSelectPatient(p.patient_id)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>Inspect</span>
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
