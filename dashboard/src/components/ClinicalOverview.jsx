import React from 'react';
import { 
  Users, Calendar, FileText, Heart, Activity, 
  Flame, Moon, Footprints, ShieldCheck, ShieldAlert, 
  ChevronRight, ArrowUpRight, Clock, Wind 
} from 'lucide-react';

export default function ClinicalOverview({ 
  patients = [], 
  selectedPatientId, 
  onSelectPatient,
  networkStatus 
}) {
  const activePatientItem = patients.find(p => p.capsule.patient_id === selectedPatientId) || patients[0];
  const p = activePatientItem?.capsule || {
    patient_id: 'PT-101',
    patient_name: 'John Smith',
    vitals: { heart_rate: 72, spo2: 98, systolic_bp: 120, diastolic_bp: 80, respiratory_rate: 16 }
  };

  const hr = p.vitals?.heart_rate || 72;
  const isTachycardic = hr > 100;

  return (
    <div className="space-y-6">
      
      {/* ================= TOP 3 STATS CARDS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Total Patients */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Total Admissions</div>
            <div className="text-3xl font-extrabold text-slate-800 tracking-tight">1,247</div>
            <div className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <span className="font-bold">+12%</span> from last month
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Critical Triage */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Critical Triage (Red)</div>
            <div className="text-3xl font-extrabold text-slate-800 tracking-tight">32</div>
            <div className="text-[11px] font-medium text-rose-500 mt-1 flex items-center gap-1">
              <span className="font-bold">+8%</span> acute cases
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Pending Reconciliations */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Pending Sync & Merges</div>
            <div className="text-3xl font-extrabold text-slate-800 tracking-tight">18</div>
            <div className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <span className="font-bold">100%</span> verified by Nirantara
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* ================= MIDDLE ROW: HEART RATE GRAPH & QUEUE LIST ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Heart Rate / Telemetry Waveform Card (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                </div>
                <span className="text-xs font-bold text-slate-800">Heart Rate Telemetry</span>
                <span className="text-[11px] text-slate-400">&bull; Average bpm</span>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                isTachycardic ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}>
                {isTachycardic ? 'Tachycardia Alert' : 'Normal'}
              </span>
            </div>

            {/* Big Hero HR Number */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-5xl font-black text-slate-900 tracking-tight">
                {hr}
              </span>
              <span className="text-sm font-semibold text-slate-400">bpm</span>
              <span className="text-xs font-medium text-slate-400 ml-4">
                Patient: <strong className="text-slate-700">{p.patient_name} ({p.patient_id})</strong>
              </span>
            </div>
          </div>

          {/* Smooth Curved Wave Area Chart */}
          <div className="relative h-44 w-full flex">
            {/* Y Axis Reference */}
            <div className="flex flex-col justify-between text-[10px] font-semibold text-slate-400 pr-3 select-none">
              <span>120</span>
              <span>90</span>
              <span>60</span>
              <span>30</span>
            </div>

            {/* SVG Wave */}
            <div className="flex-1 relative border-b border-slate-100">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="heartWaveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                    <stop offset="70%" stopColor="#f43f5e" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid guide lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="60" x2="500" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3"/>
                <line x1="0" y1="90" x2="500" y2="90" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3"/>

                {/* Area Fill */}
                <path
                  d="M 0 85 C 40 85 60 70 90 70 C 130 70 150 95 190 95 C 230 95 250 50 280 50 C 310 50 330 75 360 75 C 390 75 420 40 450 40 C 475 40 490 60 500 60 L 500 120 L 0 120 Z"
                  fill="url(#heartWaveGrad)"
                />

                {/* Spline Curve Stroke */}
                <path
                  d="M 0 85 C 40 85 60 70 90 70 C 130 70 150 95 190 95 C 230 95 250 50 280 50 C 310 50 330 75 360 75 C 390 75 420 40 450 40 C 475 40 490 60 500 60"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Pulse Peak Node */}
                <circle cx="280" cy="50" r="4.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
              </svg>

              {/* X Axis Time Labels */}
              <div className="flex justify-between text-[10px] font-semibold text-slate-400 pt-2 select-none">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>12 AM</span>
              </div>
            </div>
          </div>

          {/* Bottom Live Vitals Pill Strip */}
          <div className="grid grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-100 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400">SpO2 Oxygen</span>
              <span className="font-bold text-slate-800 text-sm">{p.vitals?.spo2 || 98}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400">Blood Pressure</span>
              <span className="font-bold text-slate-800 text-sm">{p.vitals?.systolic_bp || 120}/{p.vitals?.diastolic_bp || 80}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400">Resp. Rate</span>
              <span className="font-bold text-slate-800 text-sm">{p.vitals?.respiratory_rate || 16}/min</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400">Evacuation ETA</span>
              <span className="font-bold text-blue-600 text-sm">
                {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)} mins` : `${p.time_to_help} hrs`}
              </span>
            </div>
          </div>

        </div>

        {/* Appointments / Harm-Ranked Queue Card (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-800">Triage Queue</span>
                <span className="text-xs text-slate-400">&bull; Today</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            </div>

            {/* Patient Queue Appointments List */}
            <div className="space-y-3.5">
              {patients.slice(0, 4).map((item, idx) => {
                const pt = item.capsule;
                const isSelected = pt.patient_id === selectedPatientId;
                const times = ['10:00 AM', '11:30 AM', '2:00 PM', '3:30 PM'];
                const timeStr = times[idx] || '4:15 PM';

                const badgeColor = {
                  RED: 'text-rose-600 bg-rose-50 border-rose-200',
                  YELLOW: 'text-amber-600 bg-amber-50 border-amber-200',
                  GREEN: 'text-emerald-600 bg-emerald-50 border-emerald-200'
                }[item.triage_badge] || 'text-slate-600 bg-slate-50 border-slate-200';

                return (
                  <div
                    key={pt.patient_id}
                    onClick={() => onSelectPatient(pt.patient_id)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected ? 'bg-blue-50/70 border border-blue-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-400 w-16">{timeStr}</span>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span className="text-xs font-bold text-slate-800">{pt.patient_name || pt.patient_id}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                      {item.triage_badge}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Link */}
          <button 
            onClick={() => onSelectPatient(selectedPatientId)}
            className="w-full text-center text-xs font-bold text-blue-600 hover:text-blue-700 pt-4 border-t border-slate-100 flex items-center justify-center gap-1"
          >
            <span>View all patients in queue</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

        </div>

      </div>

      {/* ================= BOTTOM ROW: RECENT PATIENTS & SYSTEM TELEMETRY STATS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Admissions Card (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-800">Recent Patients</span>
            <span className="text-xs font-semibold text-blue-600 cursor-pointer hover:underline">View all</span>
          </div>

          <div className="space-y-3.5">
            {patients.map((item, idx) => {
              const pt = item.capsule;
              const isSelected = pt.patient_id === selectedPatientId;
              const dates = ['12 Sep, 2026', '11 Sep, 2026', '10 Sep, 2026', '09 Sep, 2026'];
              const ages = ['45 years · Male', '32 years · Female', '56 years · Male', '29 years · Male'];

              return (
                <div
                  key={pt.patient_id}
                  onClick={() => onSelectPatient(pt.patient_id)}
                  className={`flex items-center justify-between p-2 rounded-2xl cursor-pointer transition-all ${
                    isSelected ? 'bg-blue-50/60 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                      {pt.patient_name ? pt.patient_name.split(' ').map(n=>n[0]).join('').slice(0,2) : 'PT'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{pt.patient_name}</div>
                      <div className="text-[11px] text-slate-400">{ages[idx % ages.length]}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] font-medium text-slate-500">{dates[idx % dates.length]}</div>
                    <div className="text-[10px] font-bold text-blue-600 font-mono">{pt.patient_id}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System & Telemetry Stats Card (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-800">Health & Telemetry Stats</span>
            <span className="text-xs font-semibold text-slate-400">This Week</span>
          </div>

          <div className="space-y-5">
            {/* Stat 1: Port A Uplink Quality */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Footprints className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-slate-700">Port A Link Quality</span>
                </div>
                <span className="font-bold text-slate-800">8,247 <span className="text-slate-400 font-normal">/ 10,000</span></span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: '82%' }}></div>
              </div>
            </div>

            {/* Stat 2: Dual-Port Failover Redundancy */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                    <Flame className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-slate-700">Failover Redundancy</span>
                </div>
                <span className="font-bold text-slate-800">2,340 <span className="text-slate-400 font-normal">/ 3,000</span></span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>

            {/* Stat 3: Device HMAC Security & Delta Sync */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Moon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-slate-700">HMAC Device Security</span>
                </div>
                <span className="font-bold text-slate-800">6.5 <span className="text-slate-400 font-normal">/ 8 hours</span></span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '81%' }}></div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span>Hospital Telemetry Protocol &bull; Dual-Port Active</span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
