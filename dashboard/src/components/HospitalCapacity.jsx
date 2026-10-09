import React, { useState } from 'react';
import { 
  Building2, Activity, Heart, Wind, ShieldAlert, ShieldCheck, 
  AlertTriangle, RefreshCw, Plus, Minus, Send, Plane, 
  Droplet, Pill, Boxes, Clock, CheckCircle2, BedDouble, 
  Stethoscope, User, ChevronRight, Sparkles 
} from 'lucide-react';

export default function HospitalCapacity({ 
  capacityData, 
  onUpdateCapacity, 
  onSelectPatient, 
  patients = [] 
}) {
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(false);
  const [resupplySent, setResupplySent] = useState(false);

  // Fallback defaults if capacityData is loading
  const data = capacityData || {
    facility_name: "Forward Surgical Team Alpha (FST-A)",
    operational_status: "SURGE_ELEVATED",
    occupancy_pct: 78.5,
    rationing_mode: false,
    resupply_drone_eta_mins: 45,
    bed_units: [
      { unit_id: "ICU-CC", unit_name: "Intensive Care & Resuscitation", category: "ICU", total_beds: 12, occupied_beds: 10, ventilators_total: 10, ventilators_active: 8, critical_reserve: 2 },
      { unit_id: "TRAUMA-BAY", unit_name: "Acute Trauma Resuscitation Bays", category: "TRAUMA_RESUS", total_beds: 6, occupied_beds: 5, ventilators_total: 6, ventilators_active: 4, critical_reserve: 1 },
      { unit_id: "STEP-DOWN", unit_name: "Intermediate & Step-Down Ward", category: "STEP_DOWN", total_beds: 24, occupied_beds: 18, ventilators_total: 4, ventilators_active: 2, critical_reserve: 4 },
      { unit_id: "AUSTERE-LITTER", unit_name: "Austere Surge & Field Holding Litters", category: "AUSTERE_SURGE", total_beds: 30, occupied_beds: 22, ventilators_total: 2, ventilators_active: 1, critical_reserve: 6 },
    ],
    critical_resources: [
      { resource_id: "O2-LIQUID", name: "Medical Oxygen (LOX & Concentrators)", category: "OXYGEN", current_level: 860.0, max_capacity: 1200.0, unit: "Liters", burn_rate_per_hour: 48.0, hours_remaining: 17.9, status: "NOMINAL" },
      { resource_id: "BLOOD-ONEG", name: "O-Negative Packed RBCs (Universal)", category: "BLOOD_BANK", current_level: 7.0, max_capacity: 20.0, unit: "Units", burn_rate_per_hour: 0.8, hours_remaining: 8.75, status: "CRITICAL_RATIONING" },
      { resource_id: "BLOOD-OPOS", name: "O-Positive Packed RBCs", category: "BLOOD_BANK", current_level: 14.0, max_capacity: 25.0, unit: "Units", burn_rate_per_hour: 0.5, hours_remaining: 28.0, status: "NOMINAL" },
      { resource_id: "BLOOD-PLASMA", name: "Fresh Frozen Plasma & Platelets", category: "BLOOD_BANK", current_level: 11.0, max_capacity: 24.0, unit: "Units", burn_rate_per_hour: 0.6, hours_remaining: 18.3, status: "ELEVATED_BURN" },
      { resource_id: "MED-TXA", name: "Tranexamic Acid (TXA 1g IV)", category: "MEDICATIONS", current_level: 28.0, max_capacity: 50.0, unit: "Vials", burn_rate_per_hour: 1.2, hours_remaining: 23.3, status: "NOMINAL" },
      { resource_id: "MED-KETAMINE", name: "Ketamine HCL (50mg/mL)", category: "MEDICATIONS", current_level: 62.0, max_capacity: 100.0, unit: "Vials", burn_rate_per_hour: 2.0, hours_remaining: 31.0, status: "NOMINAL" },
      { resource_id: "MED-MORPHINE", name: "Morphine Sulfate (10mg/mL)", category: "MEDICATIONS", current_level: 38.0, max_capacity: 80.0, unit: "Ampules", burn_rate_per_hour: 1.5, hours_remaining: 25.3, status: "NOMINAL" },
      { resource_id: "FLUID-LR", name: "Ringer's Lactate Crystalloid", category: "IV_FLUIDS", current_level: 115.0, max_capacity: 200.0, unit: "Liters", burn_rate_per_hour: 4.5, hours_remaining: 25.5, status: "NOMINAL" },
      { resource_id: "SURG-MARCH", name: "MARCH Hemorrhage Trauma Packs", category: "SURGICAL_KITS", current_level: 18.0, max_capacity: 30.0, unit: "Kits", burn_rate_per_hour: 0.9, hours_remaining: 20.0, status: "NOMINAL" },
      { resource_id: "SURG-CHEST", name: "Thoracostomy & Chest Tube Kits", category: "SURGICAL_KITS", current_level: 8.0, max_capacity: 15.0, unit: "Kits", burn_rate_per_hour: 0.4, hours_remaining: 20.0, status: "NOMINAL" }
    ]
  };

  const totalBeds = data.bed_units.reduce((acc, u) => acc + u.total_beds, 0);
  const totalOccupied = data.bed_units.reduce((acc, u) => acc + u.occupied_beds, 0);
  const totalVentilators = data.bed_units.reduce((acc, u) => acc + u.ventilators_total, 0);
  const activeVentilators = data.bed_units.reduce((acc, u) => acc + u.ventilators_active, 0);

  const handleBedAdjust = async (unitId, delta) => {
    if (!onUpdateCapacity) return;
    setActionLoading(true);
    try {
      await onUpdateCapacity({
        action: 'REALLOCATE_BED',
        unit_id: unitId,
        delta: delta
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRationing = async () => {
    if (!onUpdateCapacity) return;
    setActionLoading(true);
    try {
      await onUpdateCapacity({
        action: 'TOGGLE_RATIONING'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestResupply = async () => {
    if (!onUpdateCapacity) return;
    setResupplySent(true);
    try {
      await onUpdateCapacity({
        action: 'REQUEST_RESUPPLY'
      });
    } finally {
      setTimeout(() => setResupplySent(false), 4000);
    }
  };

  const filteredResources = selectedFilter === 'ALL'
    ? data.critical_resources
    : data.critical_resources.filter(r => r.category === selectedFilter);

  // Map patient capsules to Trauma Bay slots for live roster
  const bays = [
    { bayNumber: 1, name: "Bay 01", patient: patients[0]?.capsule || { patient_id: "PT-101", patient_name: "Sgt. Marcus Vance" }, status: "OCCUPIED_CRITICAL", badge: "RED" },
    { bayNumber: 2, name: "Bay 02", patient: patients[1]?.capsule || { patient_id: "PT-204", patient_name: "Cpl. Elena Rostova" }, status: "OCCUPIED_ACUTE", badge: "YELLOW" },
    { bayNumber: 3, name: "Bay 03", patient: patients[2]?.capsule || { patient_id: "PT-309", patient_name: "Pvt. David Okafor" }, status: "OCCUPIED_CRITICAL", badge: "RED" },
    { bayNumber: 4, name: "Bay 04", patient: patients[3]?.capsule || { patient_id: "PT-412", patient_name: "Lt. Sarah Jenkins" }, status: "OCCUPIED_STABLE", badge: "YELLOW" },
    { bayNumber: 5, name: "Bay 05", patient: null, status: "STANDBY_STERILE", badge: null },
    { bayNumber: 6, name: "Bay 06", patient: null, status: "STANDBY_STERILE", badge: null },
  ];

  return (
    <div className="space-y-6">

      {/* ================= HEADER CONTROL BANNER ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 m-0 tracking-tight">
                Live Hospital Capacity & Resource Allocation
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                data.occupancy_pct >= 85 
                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                  : data.occupancy_pct >= 70 
                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {data.occupancy_pct}% LOAD
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 m-0">
              {data.facility_name} &bull; Operational Status: <strong>{data.operational_status}</strong> &bull; Nirantara PFC Delay-Aware Logistics
            </p>
          </div>
        </div>

        {/* Global Emergency Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Austere PFC Rationing Mode Button */}
          <button
            onClick={handleToggleRationing}
            disabled={actionLoading}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 shadow-xs ${
              data.rationing_mode
                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
            }`}
            title="Toggle Delay-Aware Resource Rationing Protocol (PFC) to reduce burn rates by 35%"
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${data.rationing_mode ? 'animate-pulse' : ''}`} />
            <span>{data.rationing_mode ? 'PFC Rationing Active (35% Conserved)' : 'Enable PFC Rationing'}</span>
          </button>

          {/* Aerial Drone Resupply Request */}
          <button
            onClick={handleRequestResupply}
            disabled={resupplySent}
            className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            title="Dispatch emergency aerial resupply drone for O-Neg blood, LOX, and trauma packs"
          >
            <Plane className={`w-3.5 h-3.5 ${resupplySent ? 'animate-spin' : ''}`} />
            <span>{resupplySent ? 'Drone Dispatched (ETA 25m)' : 'Dispatch Drone Resupply'}</span>
          </button>
        </div>
      </div>

      {/* ================= TOP 4 EXECUTIVE METRICS CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Hospital Beds */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Bed Occupancy</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {totalOccupied} <span className="text-sm font-semibold text-slate-400">/ {totalBeds}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  data.occupancy_pct >= 85 ? 'bg-rose-500' : data.occupancy_pct >= 70 ? 'bg-amber-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, data.occupancy_pct)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
              <span>Available Beds: <strong>{totalBeds - totalOccupied}</strong></span>
              <span>Surge: <strong>+{data.bed_units.find(u => u.category === 'AUSTERE_SURGE')?.total_beds || 30}</strong></span>
            </div>
          </div>
        </div>

        {/* Metric 2: Ventilators Deployed */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ICU Mechanical Ventilators</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Wind className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {activeVentilators} <span className="text-sm font-semibold text-slate-400">/ {totalVentilators}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className="h-full rounded-full bg-sky-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (activeVentilators / (totalVentilators || 1)) * 100)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
              <span>Ready Spares: <strong>{totalVentilators - activeVentilators}</strong></span>
              <span className="text-emerald-600 font-semibold">100% Operational</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Medical Oxygen LOX */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Liquid Oxygen (LOX) Reserve</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-slate-800 tracking-tight">
              860 <span className="text-sm font-semibold text-slate-400">/ 1,200 L</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: '71.6%' }} />
            </div>
            <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
              <span>Burn: <strong>48 L/hr</strong></span>
              <span className="text-purple-700 font-bold">~17.9h Endurance</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Blood Bank Universal O-Neg */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">O-Neg Blood (Universal PRBC)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Droplet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-rose-600 tracking-tight flex items-center justify-between">
              <span>7 Units</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 uppercase">
                Critical
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: '35%' }} />
            </div>
            <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
              <span>Min Safe Par: <strong>12 Units</strong></span>
              <span>Drone: <strong>+10 Units</strong></span>
            </div>
          </div>
        </div>

      </div>

      {/* ================= BED UNITS CAPACITY MANAGEMENT ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-800 m-0">
              Ward & Care Unit Real-Time Bed Allocations
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 m-0">
              Interactive bedside admitting steppers &bull; Critical reserve limits synchronized across mesh
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Automated sync with Field Triage Queue
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.bed_units.map((unit) => {
            const occPct = Math.round((unit.occupied_beds / (unit.total_beds || 1)) * 100);
            const isFull = unit.occupied_beds >= unit.total_beds;
            const isNearFull = occPct >= 80;

            return (
              <div 
                key={unit.unit_id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                      {unit.unit_id}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 mt-1 m-0">
                      {unit.unit_name}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isNearFull 
                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {occPct}%
                  </span>
                </div>

                {/* Occupancy Stepper */}
                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Beds In Use</span>
                    <div className="text-lg font-extrabold text-slate-800 leading-tight">
                      {unit.occupied_beds} <span className="text-xs font-normal text-slate-400">/ {unit.total_beds}</span>
                    </div>
                  </div>

                  {/* Steppers */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleBedAdjust(unit.unit_id, -1)}
                      disabled={unit.occupied_beds <= 0 || actionLoading}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition-all disabled:opacity-40"
                      title="Discharge / Vacate 1 bed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleBedAdjust(unit.unit_id, 1)}
                      disabled={isFull || actionLoading}
                      className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold transition-all disabled:opacity-40 shadow-xs"
                      title="Admit / Assign 1 bed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Unit Details */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div className="p-2 rounded-lg bg-white border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Ventilators</span>
                    <strong className="text-slate-700">{unit.ventilators_active}/{unit.ventilators_total}</strong> Active
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Critical Reserve</span>
                    <strong className="text-slate-700">{unit.critical_reserve}</strong> Standby
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= TRAUMA BAY ROSTER & PATIENT BED MAPPING ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-800 m-0">
              Trauma Resuscitation Bays &bull; Live Bed Roster
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 m-0">
              Direct patient-to-bay tracking &bull; Click any patient to open their detailed clinical chart
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              2 Immediate Resus
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              2 Bays Ready
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {bays.map((bay) => {
            const hasPatient = bay.patient !== null;

            return (
              <div
                key={bay.bayNumber}
                onClick={() => {
                  if (hasPatient && onSelectPatient) {
                    onSelectPatient(bay.patient.patient_id);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all ${
                  hasPatient
                    ? 'bg-slate-50/70 border-slate-200/80 hover:bg-blue-50/40 hover:border-blue-300 cursor-pointer shadow-xs group'
                    : 'bg-emerald-50/30 border-emerald-100 text-slate-500'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-700 font-mono">
                      {bay.name}
                    </span>
                    {bay.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        bay.badge === 'RED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {bay.badge} PRIORITY
                      </span>
                    )}
                  </div>
                  <span className={`w-2 h-2 rounded-full ${hasPatient ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                </div>

                {hasPatient ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-slate-800 font-semibold group-hover:text-blue-600 transition-colors">
                        {bay.patient.patient_name || 'Admitted Operative'}
                      </strong>
                      <span className="font-mono text-[10px] text-slate-400">{bay.patient.patient_id}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Vital Telemetry: Active</span>
                      <span className="text-blue-600 font-medium flex items-center gap-0.5 text-[10px]">
                        Open Chart <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs text-emerald-700 font-semibold">
                    VACANT &bull; Ready for Medevac
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= CRITICAL CONSUMABLES & STOCK MATRIX ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-800 m-0">
              Austere Medical Stock & Critical Consumables Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 m-0">
              Live burn-rate tracking &bull; Projected depletion hours calculated via delay-aware formula
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'OXYGEN', 'BLOOD_BANK', 'MEDICATIONS', 'IV_FLUIDS', 'SURGICAL_KITS'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  selectedFilter === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Resources Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((res) => {
            const pct = Math.round((res.current_level / (res.max_capacity || 1)) * 100);
            const isCrit = res.status === 'CRITICAL_RATIONING' || res.hours_remaining < 12;
            const isWarn = res.status === 'ELEVATED_BURN' || res.hours_remaining < 24;

            return (
              <div 
                key={res.resource_id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                      {res.category.replace(/_/g, ' ')}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 m-0 mt-0.5">
                      {res.name}
                    </h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                    isCrit 
                      ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' 
                      : isWarn 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {res.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Progress Bar & Numerical Readout */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800 text-sm">
                      {res.current_level} <span className="text-xs font-normal text-slate-400">/ {res.max_capacity} {res.unit}</span>
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCrit ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Burn Rate & Time Remaining Bar */}
                <div className="p-2.5 rounded-xl bg-white border border-slate-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Burn: <strong>{res.burn_rate_per_hour} {res.unit}/hr</strong></span>
                  </div>
                  <div className={`font-bold font-mono ${isCrit ? 'text-rose-600' : isWarn ? 'text-amber-600' : 'text-slate-700'}`}>
                    ~{res.hours_remaining}h left
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
