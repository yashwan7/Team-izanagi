import React, { useState, useMemo } from 'react';
import { 
  Pill, Search, Building2, CalendarClock, ShoppingCart, 
  Handshake, BarChart3, AlertTriangle, CheckCircle2, 
  ThermometerSnowflake, Filter, Clock, ArrowRight, Plus, 
  Radio, Truck, FileCheck, ShieldCheck, Trash2, RefreshCw, 
  Layers, Lock, Package, Droplets, HeartPulse, Check, X,
  ExternalLink, Sparkles, AlertOctagon, HelpCircle, Phone
} from 'lucide-react';

export default function PharmaceuticalNetwork({ 
  pharmacyData, 
  onPharmacyAction,
  patients = [],
  dispatchData = null,
  onSelectPatient = null
}) {
  const [activeSubTab, setActiveSubTab] = useState('finder'); // 'finder' | 'depots' | 'batches' | 'reservations' | 'partners' | 'analytics'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [coldChainOnly, setColdChainOnly] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  
  // Reservation Modal State
  const [reserveModalMed, setReserveModalMed] = useState(null);
  const [reserveQty, setReserveQty] = useState(2);
  const [reserveTarget, setReserveTarget] = useState('Ambulance MEDEVAC-01 (PT-101)');
  const [reserveDepot, setReserveDepot] = useState('PHARM-FST-01');
  const [reserveUrgency, setReserveUrgency] = useState('EMERGENCY_STAT');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Procurement Modal State
  const [isProcureModalOpen, setIsProcureModalOpen] = useState(false);
  const [procureMedId, setProcureMedId] = useState('MED-TXA-01');
  const [procureQty, setProcureQty] = useState(100);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferMedId, setTransferMedId] = useState('MED-BLD-04');
  const [transferSrcDepot, setTransferSrcDepot] = useState('PHARM-BASE-02');
  const [transferDstDepot, setTransferDstDepot] = useState('PHARM-FST-01');
  const [transferQty, setTransferQty] = useState(5);

  const showNotification = (msg) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  const data = useMemo(() => {
    if (pharmacyData && pharmacyData.medicines && pharmacyData.medicines.length > 0) {
      return pharmacyData;
    }
    // Fallback baseline
    return {
      system_status: "OPERATIONAL",
      total_skus: 9,
      total_inventory_units: 3968,
      cold_chain_compliance_pct: 99.2,
      low_stock_critical_count: 2,
      active_reservations_count: 4,
      medicines: [],
      depots: [],
      batches: [],
      reservations: [],
      partners: []
    };
  }, [pharmacyData]);

  // Categories list
  const categories = [
    { id: 'ALL', label: 'All Meds' },
    { id: 'HEMOSTATIC', label: 'Hemostatics & Blood' },
    { id: 'RESUSCITATION', label: 'Resuscitation' },
    { id: 'ANESTHETIC', label: 'Anesthetics' },
    { id: 'ANALGESIC', label: 'Analgesics' },
    { id: 'ANTIBIOTIC', label: 'Antibiotics' },
    { id: 'IV_FLUIDS', label: 'IV Fluids' },
    { id: 'ANTIDOTE', label: 'Antidotes' }
  ];

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return (data.medicines || []).filter(med => {
      const matchSearch = 
        med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.generic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.med_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = selectedCategory === 'ALL' || med.category === selectedCategory;
      const matchColdChain = !coldChainOnly || med.is_cold_chain;
      const matchCritical = !criticalOnly || med.stock_available <= med.min_threshold;

      return matchSearch && matchCategory && matchColdChain && matchCritical;
    });
  }, [data.medicines, searchQuery, selectedCategory, coldChainOnly, criticalOnly]);

  const handleExecuteReservation = () => {
    if (!reserveModalMed) return;
    if (onPharmacyAction) {
      onPharmacyAction({
        action: 'CREATE_RESERVATION',
        med_id: reserveModalMed.med_id,
        quantity: parseInt(reserveQty) || 1,
        reserved_for: reserveTarget,
        depot_id: reserveDepot,
        urgency: reserveUrgency
      });
    }
    showNotification(`Reserved ${reserveQty} units of ${reserveModalMed.name} for ${reserveTarget}`);
    setReserveModalMed(null);
  };

  const handleExecuteProcure = () => {
    if (onPharmacyAction) {
      onPharmacyAction({
        action: 'PROCURE_STOCK',
        med_id: procureMedId,
        quantity: parseInt(procureQty) || 50,
        depot_id: 'PHARM-FST-01'
      });
    }
    showNotification(`Generated Urgent PO for ${procureQty} units of ${procureMedId}`);
    setIsProcureModalOpen(false);
  };

  const handleExecuteTransfer = () => {
    if (onPharmacyAction) {
      onPharmacyAction({
        action: 'TRANSFER_STOCK',
        med_id: transferMedId,
        quantity: parseInt(transferQty) || 5,
        depot_id: transferSrcDepot,
        target_depot_id: transferDstDepot,
        urgency: 'URGENT'
      });
    }
    showNotification(`Stock transfer dispatched: ${transferQty} units -> ${transferDstDepot}`);
    setIsTransferModalOpen(false);
  };

  const handleQuarantineBatch = (batchId, medName) => {
    if (onPharmacyAction) {
      onPharmacyAction({
        action: 'QUARANTINE_BATCH',
        batch_id: batchId
      });
    }
    showNotification(`Batch ${batchId} (${medName}) quarantined successfully`);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* ================= HEADER & STATUS BANNER ================= */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -top-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-500/20 backdrop-blur-md rounded-2xl border border-blue-400/30 text-blue-300">
                <Pill className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight">Tactical Pharmaceutical Network</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE RX MESH
                  </span>
                </div>
                <p className="text-xs text-blue-200/80">
                  Regional field depots, cold-chain telemetry, FEFO batch tracking, and emergency reservation routing
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15">
              <div className="text-[10px] text-blue-200/70 uppercase tracking-wider font-semibold">Total Stock Units</div>
              <div className="text-base font-bold text-white">{data.total_inventory_units.toLocaleString()}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15">
              <div className="text-[10px] text-blue-200/70 uppercase tracking-wider font-semibold">Cold Chain Integrity</div>
              <div className="text-base font-bold text-cyan-300 flex items-center gap-1">
                <ThermometerSnowflake className="w-3.5 h-3.5" />
                {data.cold_chain_compliance_pct}%
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15">
              <div className="text-[10px] text-blue-200/70 uppercase tracking-wider font-semibold">Stockout Risk</div>
              <div className={`text-base font-bold ${data.low_stock_critical_count > 0 ? 'text-rose-400' : 'text-emerald-300'}`}>
                {data.low_stock_critical_count} SKUs
              </div>
            </div>

            <button
              onClick={() => setIsProcureModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Surge Procure</span>
            </button>
          </div>
        </div>

        {/* Action success alert */}
        {actionSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl text-xs text-emerald-200 flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* ================= INTERNAL NAVIGATION TABS ================= */}
      <div className="bg-white rounded-3xl p-2 border border-slate-200/80 shadow-xs flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {[
          { id: 'finder', label: 'Medicine Finder', icon: Search, count: data.medicines.length },
          { id: 'depots', label: 'Nearby Pharmacies', icon: Building2, count: data.depots.length },
          { id: 'batches', label: 'Batch & Expiry Tracker', icon: CalendarClock, count: data.batches.length },
          { id: 'reservations', label: 'Reservations & Procurement', icon: ShoppingCart, count: data.reservations.length },
          { id: 'partners', label: 'Pharmacy Partners', icon: Handshake, count: data.partners.length },
          { id: 'analytics', label: 'Inventory Analytics', icon: BarChart3 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: MEDICINE FINDER ================= */}
      {activeSubTab === 'finder' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medication, generic name, indication, or class..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setColdChainOnly(!coldChainOnly)}
                  className={`px-3 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    coldChainOnly
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ThermometerSnowflake className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Cold Chain Only</span>
                </button>

                <button
                  onClick={() => setCriticalOnly(!criticalOnly)}
                  className={`px-3 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    criticalOnly
                      ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Critical Stockout Risk</span>
                </button>

                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-3 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                >
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Transfer Stock</span>
                </button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === c.id
                      ? 'bg-slate-900 text-white shadow-xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Medicines Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMedicines.map(med => {
              const isLow = med.stock_available <= med.min_threshold;
              const availPct = Math.round((med.stock_available / (med.stock_total || 1)) * 100);

              return (
                <div 
                  key={med.med_id}
                  className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 font-bold">{med.med_id}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                            med.category === 'HEMOSTATIC' ? 'bg-rose-100 text-rose-800' :
                            med.category === 'RESUSCITATION' ? 'bg-amber-100 text-amber-800' :
                            med.category === 'ANESTHETIC' ? 'bg-purple-100 text-purple-800' :
                            med.category === 'ANALGESIC' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {med.category}
                          </span>
                        </div>
                        <h2 className="text-sm font-bold text-slate-900 mt-1 leading-snug">{med.name}</h2>
                        <p className="text-xs text-slate-500 font-medium italic">{med.generic_name}</p>
                      </div>

                      {med.is_cold_chain && (
                        <div className="p-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 shrink-0" title="Cold chain required">
                          <ThermometerSnowflake className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Form & Dosage */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-xs text-slate-700">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Presentation:</span>
                        <strong className="text-slate-800">{med.form}</strong>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-2">
                        <span className="text-slate-400 font-medium">Standard Dose: </span>
                        {med.dosage}
                      </div>
                    </div>

                    {/* Stock Level Bar */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-600 flex items-center gap-1">
                          Available: 
                          <strong className={isLow ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
                            {med.stock_available} {med.unit}
                          </strong>
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Reserved: {med.stock_reserved}
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isLow ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${availPct}%` }}
                        />
                        <div 
                          className="h-full bg-amber-400/80 transition-all"
                          style={{ width: `${Math.round((med.stock_reserved / (med.stock_total || 1)) * 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Threshold: {med.min_threshold}</span>
                        <span>Total: {med.stock_total}</span>
                      </div>
                    </div>

                    {/* Storage & Schedule */}
                    <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {med.temperature_requirement}
                      </span>
                      <span className="font-semibold text-slate-700">{med.schedule}</span>
                    </div>

                    {/* Active Alternatives */}
                    {med.active_substitutes && med.active_substitutes.length > 0 && (
                      <div className="mt-2 text-[10px] text-slate-500">
                        <span className="text-slate-400">Substitutes: </span>
                        {med.active_substitutes.join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setReserveModalMed(med);
                        setReserveQty(2);
                      }}
                      className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Reserve Stock</span>
                    </button>

                    <button
                      onClick={() => {
                        setProcureMedId(med.med_id);
                        setProcureQty(50);
                        setIsProcureModalOpen(true);
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                      title="Procure more stock"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMedicines.length === 0 && (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-3">
              <Pill className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-slate-700 font-bold text-sm">No medications match your filter</div>
              <p className="text-slate-400 text-xs">Try clearing search query or adjusting cold chain and risk filters.</p>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: NEARBY PHARMACIES & DEPOTS ================= */}
      {activeSubTab === 'depots' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.depots.map(depot => {
              const isColdOk = depot.cold_storage_temp_c >= 2.0 && depot.cold_storage_temp_c <= 6.0;

              return (
                <div 
                  key={depot.depot_id}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 font-bold">{depot.depot_id}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                            {depot.status}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 leading-snug">{depot.name}</h2>
                        <p className="text-xs text-slate-500">{depot.location}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-blue-600">{depot.distance_km} km</div>
                      <div className="text-[11px] text-slate-400 font-medium">~{depot.travel_time_mins} mins transit</div>
                    </div>
                  </div>

                  {/* Operational Telemetry Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium uppercase">Depot Type</div>
                      <div className="font-semibold text-slate-800 truncate text-[11px] mt-0.5">{depot.depot_type}</div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium uppercase">Cold Vault</div>
                      <div className={`font-semibold truncate text-[11px] mt-0.5 flex items-center gap-1 ${
                        isColdOk ? 'text-cyan-700' : 'text-amber-700'
                      }`}>
                        <ThermometerSnowflake className="w-3 h-3" />
                        {depot.cold_storage_temp_c}°C ({depot.cold_chain_status.split('_')[0]})
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium uppercase">Total Units</div>
                      <div className="font-semibold text-slate-800 text-[11px] mt-0.5">{depot.inventory_count.toLocaleString()}</div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium uppercase">Radio VHF</div>
                      <div className="font-semibold text-emerald-700 text-[11px] mt-0.5 flex items-center gap-1">
                        <Radio className="w-3 h-3" />
                        {depot.contact_vhf.split('/')[0]}
                      </div>
                    </div>
                  </div>

                  {/* Pharmacist & Contact */}
                  <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-slate-400 text-[11px]">Officer: </span>
                      <strong className="text-slate-800">{depot.pharmacist_in_charge}</strong>
                    </div>

                    <button
                      onClick={() => {
                        setTransferDstDepot(depot.depot_id);
                        setIsTransferModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Request Transfer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 3: BATCH & EXPIRY TRACKER ================= */}
      {activeSubTab === 'batches' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">FEFO (First-Expired, First-Out) Priority Registry</h2>
              <p className="text-xs text-slate-500">
                Automated rotation schedule ensuring medication lots closest to expiration are allocated first
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                FEFO Algorithm Active
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-semibold uppercase">
                  <th className="py-3 px-3">Batch / Lot ID</th>
                  <th className="py-3 px-3">Medication</th>
                  <th className="py-3 px-3">Manufacturer</th>
                  <th className="py-3 px-3">Expiry Date</th>
                  <th className="py-3 px-3">Runway Status</th>
                  <th className="py-3 px-3">Quantity</th>
                  <th className="py-3 px-3">Depot Location</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.batches.map(batch => {
                  const isExpired = batch.days_until_expiry < 0;
                  const isCritical = batch.days_until_expiry >= 0 && batch.days_until_expiry <= 30;
                  const isNear = batch.days_until_expiry > 30 && batch.days_until_expiry <= 90;
                  const isQuarantined = batch.status === 'QUARANTINED';

                  return (
                    <tr key={batch.batch_id} className={`hover:bg-slate-50/80 transition-colors ${
                      isQuarantined ? 'bg-rose-50/40' : ''
                    }`}>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                        {batch.batch_id}
                      </td>
                      <td className="py-3.5 px-3 text-slate-900 font-bold">
                        {batch.med_name}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                        {batch.manufacturer}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-700">
                        {batch.expiry_date}
                      </td>
                      <td className="py-3.5 px-3">
                        {isQuarantined ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            QUARANTINED
                          </span>
                        ) : isExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            EXPIRED ({Math.abs(batch.days_until_expiry)}d ago)
                          </span>
                        ) : isCritical ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 animate-pulse">
                            CRITICAL ({batch.days_until_expiry}d left)
                          </span>
                        ) : isNear ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            WARNING ({batch.days_until_expiry}d left)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            STABLE ({batch.days_until_expiry}d left)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                        {batch.quantity}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px]">
                        {batch.location_depot_id}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {!isQuarantined ? (
                          <button
                            onClick={() => handleQuarantineBatch(batch.batch_id, batch.med_name)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all"
                            title="Quarantine batch if temperature breach or contamination"
                          >
                            Quarantine
                          </button>
                        ) : (
                          <span className="text-[11px] text-rose-600 font-semibold">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: RESERVATIONS & PROCUREMENT ================= */}
      {activeSubTab === 'reservations' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Stock Reservations & Dispatch Orders</h2>
              <p className="text-xs text-slate-500">Live allocation for ambulances en-route, trauma resuscitation bays, and emergency surgical teams</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsProcureModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Requisition</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.reservations.map(res => {
              const isStat = res.urgency === 'EMERGENCY_STAT';

              return (
                <div 
                  key={res.order_id}
                  className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">{res.order_id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isStat ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {res.urgency}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700">
                          {res.status}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{res.med_name}</h3>
                      <p className="text-xs text-slate-500">{res.reserved_for}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-bold text-blue-600">{res.quantity}</span>
                      <span className="text-xs text-slate-400 block font-normal">units allocated</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Target Depot:</span>
                      <strong className="text-slate-800 font-mono text-[11px]">{res.destination_depot_id}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Requester:</span>
                      <strong className="text-slate-800 text-[11px] truncate block">{res.requester}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2 font-mono">
                    <span>Logged: {res.timestamp}</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Chain of Custody Verified
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 5: PHARMACY PARTNERS ================= */}
      {activeSubTab === 'partners' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.partners.map(partner => (
              <div 
                key={partner.partner_id}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{partner.partner_id}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {partner.mesh_api_status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">{partner.name}</h3>
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">{partner.tier}</p>

                  <div className="mt-4 bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Cold Chain SLA:</span>
                      <strong className="text-cyan-700">{partner.compliance_score}%</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Avg Delivery SLA:</span>
                      <strong className="text-slate-800">{partner.avg_fulfillment_mins} mins</strong>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Authorized Supplies:</span>
                    <div className="flex flex-wrap gap-1">
                      {partner.authorized_stock_types.map((type, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <span className="text-slate-400 text-[11px]">Director: </span>
                  <strong className="text-slate-800">{partner.contact_officer}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 6: INVENTORY ANALYTICS ================= */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase">Total Tracked SKUs</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{data.medicines.length}</div>
              <p className="text-[11px] text-slate-500 mt-1">Across 4 regional depots</p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase">Cold-Chain Assurance</div>
              <div className="text-2xl font-bold text-cyan-600 mt-1">{data.cold_chain_compliance_pct}%</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Zero excursions past 72h</p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase">Stockout Warning Items</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">{data.low_stock_critical_count}</div>
              <p className="text-[11px] text-rose-500 font-medium mt-1">Below minimum surge reserve</p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase">24h Burn-Rate Forecast</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">14.2%</div>
              <p className="text-[11px] text-slate-500 mt-1">Expected 6.4 days reserve</p>
            </div>
          </div>

          {/* Stock Distribution by Category */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Therapeutic Class Allocation & Stock Health</h3>
            
            <div className="space-y-3">
              {[
                { label: 'Hemostatics & Blood Products', count: 498, max: 600, color: 'bg-rose-500' },
                { label: 'Resuscitation & Epinephrine', count: 320, max: 400, color: 'bg-amber-500' },
                { label: 'Anesthetics (Ketamine HCl)', count: 180, max: 250, color: 'bg-purple-500' },
                { label: 'Analgesics (Morphine Sulfate)', count: 210, max: 300, color: 'bg-indigo-500' },
                { label: 'Trauma Antibiotics (Cefazolin)', count: 620, max: 800, color: 'bg-blue-500' },
                { label: 'Resuscitation IV Fluids', count: 1815, max: 2000, color: 'bg-emerald-500' }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{item.label}</span>
                    <span className="font-mono text-slate-500 font-bold">{item.count} / {item.max} units</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${Math.round((item.count / item.max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESERVE STOCK ================= */}
      {reserveModalMed && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <ShoppingCart className="w-4 h-4" />
                <span>Reserve Medication for Patient / Ambulance</span>
              </div>
              <button 
                onClick={() => setReserveModalMed(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-1">
              <h3 className="text-sm font-bold text-slate-900">{reserveModalMed.name}</h3>
              <p className="text-xs text-slate-500">{reserveModalMed.form}</p>
              <div className="text-xs font-semibold text-emerald-700 pt-1">
                Available in Stock: {reserveModalMed.stock_available} {reserveModalMed.unit}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Reservation Quantity:</label>
                <input
                  type="number"
                  min="1"
                  max={reserveModalMed.stock_available}
                  value={reserveQty}
                  onChange={(e) => setReserveQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Reserve For (Patient or Unit):</label>
                <input
                  type="text"
                  value={reserveTarget}
                  onChange={(e) => setReserveTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="e.g. Ambulance MEDEVAC-01 or Patient PT-101"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Fulfillment Depot:</label>
                <select
                  value={reserveDepot}
                  onChange={(e) => setReserveDepot(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {data.depots.map(d => (
                    <option key={d.depot_id} value={d.depot_id}>{d.name} ({d.distance_km}km)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Urgency Level:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['EMERGENCY_STAT', 'URGENT', 'ROUTINE'].map(urg => (
                    <button
                      key={urg}
                      type="button"
                      onClick={() => setReserveUrgency(urg)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        reserveUrgency === urg
                          ? urg === 'EMERGENCY_STAT' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {urg.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setReserveModalMed(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReservation}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all"
              >
                Confirm Allocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SURGE PROCURE ================= */}
      {isProcureModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <Plus className="w-4 h-4" />
                <span>Urgent Surge Stock Procurement</span>
              </div>
              <button 
                onClick={() => setIsProcureModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Select Medication SKU:</label>
                <select
                  value={procureMedId}
                  onChange={(e) => setProcureMedId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {data.medicines.map(m => (
                    <option key={m.med_id} value={m.med_id}>{m.name} ({m.stock_available} avail)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Procurement Units:</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  step="10"
                  value={procureQty}
                  onChange={(e) => setProcureQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-[11px] text-blue-800">
                Surge purchase order will automatically route to Tier-1 Defense Logistics & Partner depots with fast-track SLA delivery.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsProcureModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteProcure}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all"
              >
                Dispatch Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TRANSFER STOCK ================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <Truck className="w-4 h-4" />
                <span>Inter-Depot Stock Transfer</span>
              </div>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Medication to Transfer:</label>
                <select
                  value={transferMedId}
                  onChange={(e) => setTransferMedId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {data.medicines.map(m => (
                    <option key={m.med_id} value={m.med_id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Source Depot:</label>
                <select
                  value={transferSrcDepot}
                  onChange={(e) => setTransferSrcDepot(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {data.depots.map(d => (
                    <option key={d.depot_id} value={d.depot_id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Destination Depot:</label>
                <select
                  value={transferDstDepot}
                  onChange={(e) => setTransferDstDepot(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {data.depots.map(d => (
                    <option key={d.depot_id} value={d.depot_id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Transfer Units:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTransfer}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all"
              >
                Dispatch Transfer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
