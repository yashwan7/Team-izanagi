import React, { useState } from 'react';
import { 
  Building2, Activity, Wind, ShieldAlert, 
  Plane, Droplet, Clock, BedDouble, 
  ChevronRight, ArrowRight, Minus, Plus 
} from 'lucide-react';

export default function HospitalCapacity({ 
  capacityData, 
  onUpdateCapacity, 
  onSelectPatient, 
  patients = [],
  onNavigateTab,
  bloodBankData 
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
    <div className="space-y-5 font-mono select-none text-[#F8FAFC]">

      {/* ================= HEADER CONTROL BANNER ================= */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 nm-convex rounded-2xl text-[#FF334B] flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-sm md:text-base font-black text-[#F8FAFC] uppercase tracking-wider m-0">
                HOSPITAL CAPACITY &amp; RESOURCE ALLOCATION
              </h2>
              <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-lg ${
                data.occupancy_pct >= 85 
                  ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' 
                  : data.occupancy_pct >= 70 
                  ? 'nm-inset text-[#F59E0B] border border-[#F59E0B]/30' 
                  : 'nm-badge text-[#94A3B8]'
              }`}>
                {data.occupancy_pct}% LOAD
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1 m-0 font-medium">
              {data.facility_name} &bull; Status: <strong className="text-[#FF334B]">{data.operational_status}</strong> &bull; Nirantara PFC Delay-Aware Logistics
            </p>
          </div>
        </div>

        {/* Global Emergency Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Austere PFC Rationing Mode Button */}
          <button
            onClick={handleToggleRationing}
            disabled={actionLoading}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              data.rationing_mode
                ? 'nm-btn-accent text-white shadow-[0_0_15px_#FF334B]'
                : 'nm-inset text-[#FF334B] border border-[#FF334B]/30 hover:border-[#FF334B]'
            }`}
          >
            <ShieldAlert className={`w-4 h-4 ${data.rationing_mode ? 'animate-pulse' : ''}`} />
            <span>{data.rationing_mode ? 'PFC RATIONING ACTIVE (35% SAVED)' : 'ENABLE PFC RATIONING'}</span>
          </button>

          {/* Aerial Drone Resupply Request */}
          <button
            onClick={handleRequestResupply}
            disabled={resupplySent}
            className="px-3.5 py-2 nm-btn rounded-xl text-[#F8FAFC] hover:text-[#FF334B] text-xs font-bold flex items-center gap-2 transition-all"
          >
            <Plane className={`w-4 h-4 ${resupplySent ? 'animate-spin text-[#00E5A3]' : 'text-[#FF334B]'}`} />
            <span>{resupplySent ? 'DRONE DISPATCHED (ETA 25m)' : 'DISPATCH DRONE RESUPPLY'}</span>
          </button>
        </div>
      </div>

      {/* ================= INTEGRATED REGIONAL BLOOD NETWORK STATUS ================= */}
      <div className="nm-flat rounded-2xl border border-[#FF334B]/20 p-4 px-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 nm-alert-inset rounded-xl flex items-center justify-center text-[#FF334B] shrink-0 border border-[#FF334B]/30">
            <Droplet className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2 flex-wrap">
              <span>REGIONAL BLOOD BANK TRANSFUSION NETWORK ACTIVE</span>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-md nm-badge text-[#94A3B8]">
                4 DEPOTS LINKED
              </span>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-md nm-alert-inset text-[#FF334B] border border-[#FF334B]/30">
                O- RESERVE: 42 UNITS
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8] m-0 mt-1 font-medium">
              528 Screened units &bull; 99.6% cold-chain compliance &bull; Rapid dispatch available
            </p>
          </div>
        </div>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('bloodbank')}
            className="px-3.5 py-1.5 nm-btn rounded-xl text-[#FF334B] hover:text-white text-[10px] font-bold flex items-center gap-1.5 transition-all"
          >
            <span>OPEN BLOOD FINDER</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ================= TOP 4 EXECUTIVE METRICS CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Hospital Beds */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-[#94A3B8] font-bold">Total Bed Occupancy</span>
            <div className="w-8 h-8 nm-convex rounded-xl text-[#FF334B] flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#F8FAFC] tracking-tight">
              {totalOccupied} <span className="text-xs text-[#64748B]">/ {totalBeds} BEDS</span>
            </div>
            <div className="w-full nm-inset rounded-full h-2 mt-2 p-0.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#FF334B] ${
                  data.occupancy_pct >= 85 ? 'bg-gradient-to-r from-[#FF334B] to-[#FF6B6B]' : 'bg-gradient-to-r from-[#00E5A3] to-[#5EEAD4]'
                }`}
                style={{ width: `${Math.min(100, data.occupancy_pct)}%` }}
              />
            </div>
            <div className="text-[9px] text-[#94A3B8] mt-2 flex justify-between font-medium">
              <span>Available: <strong className="text-[#F8FAFC]">{totalBeds - totalOccupied}</strong></span>
              <span>Surge: <strong className="text-[#FF334B]">+{data.bed_units.find(u => u.category === 'AUSTERE_SURGE')?.total_beds || 30}</strong></span>
            </div>
          </div>
        </div>

        {/* Metric 2: Ventilators Deployed */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-[#94A3B8] font-bold">ICU Ventilators</span>
            <div className="w-8 h-8 nm-convex rounded-xl text-[#00E5A3] flex items-center justify-center">
              <Wind className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#F8FAFC] tracking-tight">
              {activeVentilators} <span className="text-xs text-[#64748B]">/ {totalVentilators} ACTIVE</span>
            </div>
            <div className="w-full nm-inset rounded-full h-2 mt-2 p-0.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#00E5A3] to-[#5EEAD4] rounded-full transition-all duration-500 shadow-[0_0_8px_#00E5A3]"
                style={{ width: `${Math.min(100, (activeVentilators / (totalVentilators || 1)) * 100)}%` }}
              />
            </div>
            <div className="text-[9px] text-[#94A3B8] mt-2 flex justify-between font-medium">
              <span>Spares: <strong className="text-[#F8FAFC]">{totalVentilators - activeVentilators}</strong></span>
              <span className="text-[#00E5A3] font-bold">100% OPERATIONAL</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Medical Oxygen LOX */}
        <div className="nm-flat rounded-2xl p-4 border border-white/[0.04] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-[#94A3B8] font-bold">LOX Oxygen Reserve</span>
            <div className="w-8 h-8 nm-convex rounded-xl text-[#F59E0B] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#F8FAFC] tracking-tight">
              860 <span className="text-xs text-[#64748B]">/ 1,200 L</span>
            </div>
            <div className="w-full nm-inset rounded-full h-2 mt-2 p-0.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#F59E0B] to-[#FCD34D] rounded-full transition-all duration-500 shadow-[0_0_8px_#F59E0B]" style={{ width: '71.6%' }} />
            </div>
            <div className="text-[9px] text-[#94A3B8] mt-2 flex justify-between font-medium">
              <span>Burn: <strong className="text-[#F8FAFC]">48 L/hr</strong></span>
              <span className="text-[#F59E0B] font-bold">~17.9h Reserve</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Blood Bank Universal O-Neg */}
        <div className="nm-flat rounded-2xl p-4 border border-[#FF334B]/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-[#FF334B] font-bold">O-Neg Blood (Universal)</span>
            <div className="w-8 h-8 nm-alert-inset rounded-xl text-[#FF334B] flex items-center justify-center border border-[#FF334B]/30">
              <Droplet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#FF334B] tracking-tight flex items-center justify-between">
              <span>7 Units</span>
              <span className="text-[9px] font-bold px-2 py-0.5 nm-alert-inset rounded-md text-[#FF334B] border border-[#FF334B]/40 uppercase">
                CRITICAL RATION
              </span>
            </div>
            <div className="w-full nm-inset rounded-full h-2 mt-2 p-0.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#FF334B] to-[#FF6B6B] rounded-full transition-all duration-500 shadow-[0_0_8px_#FF334B]" style={{ width: '35%' }} />
            </div>
            <div className="text-[9px] text-[#94A3B8] mt-2 flex justify-between font-medium">
              <span>Min Par: <strong className="text-[#F8FAFC]">12 Units</strong></span>
              <span>Drone: <strong className="text-[#FF334B]">+{10} Units</strong></span>
            </div>
          </div>
        </div>

      </div>

      {/* ================= BED UNITS CAPACITY MANAGEMENT ================= */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
              CARE UNIT BED ALLOCATIONS &amp; STEPPERS
            </h3>
            <p className="text-[10px] text-[#94A3B8] mt-0.5 m-0 font-medium">
              Interactive bedside admitting steppers &bull; Real-time mesh synchronized
            </p>
          </div>
          <span className="text-[10px] font-mono text-[#94A3B8]">
            Automated sync with Field Triage Queue
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {data.bed_units.map((unit) => {
            const occPct = Math.round((unit.occupied_beds / (unit.total_beds || 1)) * 100);
            const isFull = unit.occupied_beds >= unit.total_beds;
            const isNearFull = occPct >= 80;

            return (
              <div 
                key={unit.unit_id}
                className="p-4 nm-flat rounded-xl border border-white/[0.03] space-y-3 hover:nm-convex transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-[#FF334B] nm-alert-inset px-2 py-0.5 rounded-md border border-[#FF334B]/30">
                      {unit.unit_id}
                    </span>
                    <h4 className="text-xs font-bold text-[#F8FAFC] mt-1.5 m-0">
                      {unit.unit_name}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg ${
                    isNearFull 
                      ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' 
                      : 'nm-badge text-[#94A3B8]'
                  }`}>
                    {occPct}%
                  </span>
                </div>

                {/* Occupancy Stepper */}
                <div className="flex items-center justify-between nm-inset rounded-xl p-2.5">
                  <div>
                    <span className="text-[9px] text-[#94A3B8] block font-bold uppercase">Beds In Use</span>
                    <div className="text-base font-black text-[#F8FAFC] leading-tight mt-0.5">
                      {unit.occupied_beds} <span className="text-xs text-[#64748B]">/ {unit.total_beds}</span>
                    </div>
                  </div>

                  {/* Steppers */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleBedAdjust(unit.unit_id, -1)}
                      disabled={unit.occupied_beds <= 0 || actionLoading}
                      className="w-7 h-7 nm-btn rounded-lg text-[#94A3B8] hover:text-[#FF334B] flex items-center justify-center font-bold disabled:opacity-30 transition-all"
                      title="Discharge 1 bed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleBedAdjust(unit.unit_id, 1)}
                      disabled={isFull || actionLoading}
                      className="w-7 h-7 nm-btn-accent rounded-lg text-white flex items-center justify-center font-bold disabled:opacity-30 transition-all shadow-[0_0_8px_#FF334B]"
                      title="Admit 1 bed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Unit Details */}
                <div className="grid grid-cols-2 gap-2 text-[10px] text-[#94A3B8]">
                  <div className="p-2 nm-inset rounded-lg">
                    <span className="text-[8px] text-[#64748B] block uppercase font-bold">Vents</span>
                    <strong className="text-[#F8FAFC]">{unit.ventilators_active}/{unit.ventilators_total}</strong> Active
                  </div>
                  <div className="p-2 nm-inset rounded-lg">
                    <span className="text-[8px] text-[#64748B] block uppercase font-bold">Reserve</span>
                    <strong className="text-[#FF334B]">{unit.critical_reserve}</strong> Standby
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= TRAUMA BAY ROSTER & PATIENT BED MAPPING ================= */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
              TRAUMA RESUSCITATION BAYS &bull; LIVE ROSTER
            </h3>
            <p className="text-[10px] text-[#94A3B8] mt-0.5 m-0 font-medium">
              Direct patient-to-bay tracking &bull; Click any patient to open detailed chart
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-[#FF334B] font-bold nm-alert-inset px-2.5 py-1 rounded-lg border border-[#FF334B]/30 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-[#FF334B] animate-pulse" />
              2 IMMEDIATE RESUS
            </span>
            <span className="flex items-center gap-1.5 text-[#94A3B8] font-bold nm-badge px-2.5 py-1 rounded-lg text-[10px]">
              <span className="w-2 h-2 rounded-full bg-[#00E5A3]" />
              2 BAYS READY
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                className={`p-4 rounded-xl transition-all ${
                  hasPatient
                    ? 'nm-flat hover:nm-convex border border-white/[0.03] cursor-pointer'
                    : 'nm-inset border-none text-[#64748B]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-[#F8FAFC] font-mono">
                      {bay.name}
                    </span>
                    {bay.badge && (
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                        bay.badge === 'RED' ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' : 'nm-badge text-[#94A3B8]'
                      }`}>
                        {bay.badge} PRIORITY
                      </span>
                    )}
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${hasPatient ? 'bg-[#FF334B] shadow-[0_0_6px_#FF334B] animate-pulse' : 'bg-[#64748B]'}`} />
                </div>

                {hasPatient ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-[#F8FAFC] font-bold">
                        {bay.patient.patient_name || 'Admitted Operative'}
                      </strong>
                      <span className="font-mono text-[10px] text-[#FF334B] font-bold">{bay.patient.patient_id}</span>
                    </div>
                    <div className="text-[10px] text-[#94A3B8] flex items-center justify-between">
                      <span>Telemetry: Active</span>
                      <span className="text-[#FF334B] font-bold flex items-center gap-0.5 text-[9px]">
                        OPEN CHART <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs text-[#64748B] font-medium">
                    VACANT &bull; Ready for Medevac
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= CRITICAL CONSUMABLES & STOCK MATRIX ================= */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
              AUSTERE MEDICAL STOCK &amp; CONSUMABLES MATRIX
            </h3>
            <p className="text-[10px] text-[#94A3B8] mt-0.5 m-0 font-medium">
              Live burn-rate tracking &bull; Projected depletion hours calculated via delay-aware formula
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center nm-inset rounded-xl p-1 text-xs flex-wrap gap-1">
            {['ALL', 'OXYGEN', 'BLOOD_BANK', 'MEDICATIONS', 'IV_FLUIDS', 'SURGICAL_KITS'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  selectedFilter === cat
                    ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {cat.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Resources Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredResources.map((res) => {
            const pct = Math.round((res.current_level / (res.max_capacity || 1)) * 100);
            const isCrit = res.status === 'CRITICAL_RATIONING' || res.hours_remaining < 12;
            const isWarn = res.status === 'ELEVATED_BURN' || res.hours_remaining < 24;

            return (
              <div 
                key={res.resource_id}
                className="p-4 nm-flat rounded-xl border border-white/[0.03] space-y-3 hover:nm-convex transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[8px] font-mono font-bold text-[#94A3B8] uppercase">
                      {res.category.replace(/_/g, ' ')}
                    </span>
                    <h4 className="text-xs font-bold text-[#F8FAFC] m-0 mt-0.5">
                      {res.name}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg shrink-0 ${
                    isCrit 
                      ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' 
                      : isWarn 
                      ? 'nm-inset text-[#F59E0B] border border-[#F59E0B]/30' 
                      : 'nm-badge text-[#94A3B8]'
                  }`}>
                    {res.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Progress Bar & Numerical Readout */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-[#F8FAFC] text-xs">
                      {res.current_level} <span className="text-[10px] text-[#64748B]">/ {res.max_capacity} {res.unit}</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#94A3B8]">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full nm-inset rounded-full h-2 p-0.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCrit ? 'bg-gradient-to-r from-[#FF334B] to-[#FF6B6B] shadow-[0_0_6px_#FF334B]' : isWarn ? 'bg-gradient-to-r from-[#F59E0B] to-[#FCD34D]' : 'bg-gradient-to-r from-[#00E5A3] to-[#5EEAD4]'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Burn Rate & Time Remaining Bar */}
                <div className="p-2.5 nm-inset rounded-xl flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 text-[#94A3B8]">
                    <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                    <span>Burn: <strong className="text-[#F8FAFC]">{res.burn_rate_per_hour} {res.unit}/hr</strong></span>
                  </div>
                  <div className={`font-bold font-mono ${isCrit ? 'text-[#FF334B]' : 'text-[#00E5A3]'}`}>
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
