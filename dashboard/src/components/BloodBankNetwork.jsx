import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { 
  Droplet, Search, Building2, CalendarClock, ShoppingCart, 
  Truck, ShieldCheck, BarChart3, FileText, AlertTriangle, 
  CheckCircle2, Clock, MapPin, Radio, Phone, UserCheck, 
  ThermometerSnowflake, X, Plus, Filter, ArrowRight, 
  AlertOctagon, Check, Layers, Lock, ShieldAlert, Sparkles,
  ExternalLink, ChevronRight, Activity, HeartPulse
} from 'lucide-react';

export default function BloodBankNetwork({ 
  bloodBankData, 
  onBloodBankAction,
  patients = [],
  onSelectPatient = null
}) {
  const [activeSubTab, setActiveSubTab] = useState('finder'); // 'finder' | 'banks' | 'inventory' | 'requests' | 'transfers' | 'partners' | 'analytics' | 'audit'
  
  // Finder Filters
  const [searchAbo, setSearchAbo] = useState('ALL');
  const [searchRh, setSearchRh] = useState('ALL');
  const [searchComponent, setSearchComponent] = useState('ALL');
  const [searchRadiusKm, setSearchRadiusKm] = useState(25);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [recipientAbo, setRecipientAbo] = useState('O-');

  // Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqPatientId, setReqPatientId] = useState('PT-101');
  const [reqPatientAlias, setReqPatientAlias] = useState('Patient PT-101 (Massive Hemorrhage)');
  const [reqAbo, setReqAbo] = useState('O');
  const [reqRh, setReqRh] = useState('NEGATIVE');
  const [reqComponent, setReqComponent] = useState('PRBC');
  const [reqUnits, setReqUnits] = useState(2);
  const [reqUrgency, setReqUrgency] = useState('EMERGENCY_STAT');
  const [reqIndication, setReqIndication] = useState('Massive Hemorrhage Protocol activated following severe blast trauma.');
  const [reqTargetBank, setReqTargetBank] = useState('BB-AFTC-01');
  const [actionNotice, setActionNotice] = useState('');

  // Partner Portal Persona Toggle
  const [partnerPersona, setPartnerPersona] = useState('HOSPITAL_USER'); // 'HOSPITAL_USER' | 'BLOOD_BANK_OFFICER'

  // Leaflet Map Ref
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const showNotice = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), 4500);
  };

  const data = useMemo(() => {
    if (bloodBankData && bloodBankData.facilities && bloodBankData.facilities.length > 0) {
      return bloodBankData;
    }
    return {
      system_status: "OPERATIONAL",
      total_registered_banks: 4,
      total_available_released_units: 528,
      total_o_negative_emergency_units: 42,
      active_requests_count: 3,
      pending_reservations_count: 2,
      units_near_expiry_count: 5,
      units_quarantined_count: 2,
      in_transit_transfers_count: 1,
      cold_chain_compliance_pct: 99.6,
      facilities: [],
      inventory: [],
      requests: [],
      transfers: [],
      audit_log: []
    };
  }, [bloodBankData]);

  // Compatibility Helper Matrix
  const compatibilityInfo = useMemo(() => {
    // Red cell compatibility
    const redCellMap = {
      'O-': ['O-'],
      'O+': ['O-', 'O+'],
      'A-': ['O-', 'A-'],
      'A+': ['O-', 'O+', 'A-', 'A+'],
      'B-': ['O-', 'B-'],
      'B+': ['O-', 'O+', 'B-', 'B+'],
      'AB-': ['O-', 'A-', 'B-', 'AB-'],
      'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
    };

    // Plasma compatibility (Inverse)
    const plasmaMap = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+']
    };

    return {
      redCells: redCellMap[recipientAbo] || ['O-'],
      plasma: plasmaMap[recipientAbo] || ['AB+']
    };
  }, [recipientAbo]);

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    return (data.inventory || []).filter(unit => {
      const matchAbo = searchAbo === 'ALL' || unit.abo === searchAbo;
      const matchRh = searchRh === 'ALL' || unit.rh === searchRh;
      const matchComp = searchComponent === 'ALL' || unit.component_type === searchComponent;
      const matchStatus = !onlyAvailable || (unit.status === 'AVAILABLE_RELEASED' && unit.days_until_expiry > 0);
      
      // Radius match based on facility distance
      const facility = data.facilities.find(f => f.bank_id === unit.bank_id);
      const matchRadius = facility ? facility.distance_km <= searchRadiusKm : true;

      return matchAbo && matchRh && matchComp && matchStatus && matchRadius;
    });
  }, [data.inventory, data.facilities, searchAbo, searchRh, searchComponent, searchRadiusKm, onlyAvailable]);

  // Leaflet Map Initialization for 'banks' view
  useEffect(() => {
    if (activeSubTab !== 'banks' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.6150, 77.2180],
        zoom: 12,
        zoomControl: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 18
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // FST Hospital Anchor
    const hospIcon = L.divIcon({
      className: 'hosp-marker',
      html: `
        <div style="background: #1e3a8a; color: white; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          FST-A
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    const hospMarker = L.marker([28.6150, 77.2100], { icon: hospIcon })
      .bindPopup('<b>FST Alpha Forward Base</b><br>Requesting Surgical Facility')
      .addTo(map);
    markersRef.current.push(hospMarker);

    // Blood Banks
    data.facilities.forEach(facility => {
      const isAftc = facility.bank_id === 'BB-AFTC-01';
      const icon = L.divIcon({
        className: 'bb-marker',
        html: `
          <div style="background: ${isAftc ? '#dc2626' : '#2563eb'}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([facility.lat, facility.lng], { icon })
        .bindPopup(`
          <div style="font-family: -apple-system, sans-serif; font-size: 12px; padding: 4px;">
            <strong style="color: #1e3a8a;">${facility.name}</strong>
            <div style="color: #64748b; margin-top: 2px;">${facility.distance_km} km &bull; ~${facility.travel_time_mins} mins transit</div>
            <div style="color: #16a34a; font-weight: bold; margin-top: 4px;">Stocked: ${facility.available_units_count} available units</div>
          </div>
        `)
        .addTo(map);

      markersRef.current.push(marker);
    });

    return () => {
      // Map stays attached or unmounts cleanly
    };
  }, [activeSubTab, data.facilities]);

  const handleCreateRequest = () => {
    if (onBloodBankAction) {
      onBloodBankAction({
        action: 'CREATE_REQUEST',
        patient_id: reqPatientId,
        patient_name_or_alias: reqPatientAlias,
        abo: reqAbo,
        rh: reqRh,
        component_type: reqComponent,
        units_requested: parseInt(reqUnits) || 1,
        urgency: reqUrgency,
        clinical_indication: reqIndication,
        bank_id: reqTargetBank,
        destination_facility: 'Forward Surgical Team Alpha (FST-A)',
        actor_name: 'Maj. Dr. A. Sharma (Trauma Lead)'
      });
    }
    showNotice(`Emergency request submitted for ${reqUnits} units of ${reqAbo}${reqRh === 'NEGATIVE' ? '-' : '+'} ${reqComponent}`);
    setIsRequestModalOpen(false);
  };

  const handleAcceptRequest = (requestId) => {
    if (onBloodBankAction) {
      onBloodBankAction({
        action: 'ACCEPT_REQUEST',
        request_id: requestId,
        actor_name: 'Col. R. K. Mukherjee (AFTC Depot)'
      });
    }
    showNotice(`Request ${requestId} accepted. Units locked for pre-transfusion cross-matching.`);
  };

  const handleDispatchTransfer = (requestId) => {
    if (onBloodBankAction) {
      onBloodBankAction({
        action: 'DISPATCH_TRANSFER',
        request_id: requestId,
        actor_name: 'Tactical Cold-Chain Courier Alpha'
      });
    }
    showNotice(`Transfer dispatched under temperature-monitored cold container.`);
  };

  const handleConfirmReceipt = (transferId) => {
    if (onBloodBankAction) {
      onBloodBankAction({
        action: 'CONFIRM_RECEIPT',
        transfer_id: transferId,
        actor_name: 'FST Alpha Receiving Officer',
        reason_or_notes: 'Temperature confirmed 3.4°C upon arrival. Chain-of-custody sealed.'
      });
    }
    showNotice(`Receipt confirmed for transfer ${transferId}. Component ready for compatibility lock.`);
  };

  const handleQuarantineUnit = (unitId) => {
    if (onBloodBankAction) {
      onBloodBankAction({
        action: 'QUARANTINE_UNIT',
        unit_id: unitId,
        actor_name: 'Transfusion Safety Officer',
        reason_or_notes: 'Temperature excursion audit review'
      });
    }
    showNotice(`Unit ${unitId} placed in quarantine.`);
  };

  return (
    <div className="space-y-6 pb-14 animate-in fade-in duration-300">
      
      {/* ================= 1. SAFETY PROTOCOL & MANDATORY SAFEGUARD ================= */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-blue-950 text-white rounded-3xl p-5 border border-rose-800/40 shadow-xl relative overflow-hidden">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-rose-500/20 backdrop-blur-md rounded-2xl border border-rose-400/30 text-rose-300 shrink-0 mt-0.5">
            <AlertOctagon className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-rose-500/30 text-rose-200 border border-rose-400/40">
                CLINICAL PROTOCOL SAFEGUARD
              </span>
              <span className="text-xs text-rose-200/80 font-semibold">
                ISBT-128 Traceable Network
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              <strong>Mandatory Safety Principle:</strong> An inventory or database match does <em>NOT</em> establish compatibility. 
              Pre-transfusion laboratory cross-matching, bedside 2-person patient verification, clinical authorization, and component verification are mandatory. 
              Red-cell (PRBC/Whole Blood) and plasma (FFP) follow inverse compatibility rules.
            </p>
          </div>
        </div>
      </div>

      {/* ================= 2. HEADER & SUMMARY METRIC TILES ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <Droplet className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Blood Bank & Transfusion Network</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ONLINE 24/7
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Regional blood availability, unit-level ISBT-128 tracking, cold-chain transport, and emergency damage-control transfusion dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Emergency Blood Request</span>
            </button>

            <button
              onClick={() => setPartnerPersona(partnerPersona === 'HOSPITAL_USER' ? 'BLOOD_BANK_OFFICER' : 'HOSPITAL_USER')}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                partnerPersona === 'BLOOD_BANK_OFFICER'
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>Persona: {partnerPersona === 'BLOOD_BANK_OFFICER' ? 'Blood Bank Officer' : 'Hospital Clinician'}</span>
            </button>
          </div>
        </div>

        {/* 6 Tactical Top Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Verified Banks</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{data.total_registered_banks} Facilities</div>
            <div className="text-[10px] text-emerald-600 font-medium">All 24/7 Accredited</div>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Available</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{data.total_available_released_units} Units</div>
            <div className="text-[10px] text-slate-500">Screened & Released</div>
          </div>

          <div className="bg-rose-50/80 p-3.5 rounded-2xl border border-rose-200/80">
            <div className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider">O-Neg Reserve</div>
            <div className="text-lg font-bold text-rose-700 mt-0.5">{data.total_o_negative_emergency_units} Units</div>
            <div className="text-[10px] text-rose-600 font-bold">Universal Red Cells</div>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Requests</div>
            <div className="text-lg font-bold text-blue-700 mt-0.5">{data.active_requests_count} Active</div>
            <div className="text-[10px] text-blue-600 font-medium">1 In Transit Courier</div>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Near Expiry (&lt;72h)</div>
            <div className="text-lg font-bold text-amber-700 mt-0.5">{data.units_near_expiry_count} Units</div>
            <div className="text-[10px] text-amber-600 font-medium">FEFO Priority Flag</div>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cold Chain Vault</div>
            <div className="text-lg font-bold text-cyan-700 mt-0.5">{data.cold_chain_compliance_pct}%</div>
            <div className="text-[10px] text-cyan-600 font-medium">0 Excursions Past 72h</div>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 animate-in slide-in-from-top-1 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* ================= 3. 8-TAB INTERNAL NAVIGATION BAR ================= */}
      <div className="bg-white rounded-3xl p-2 border border-slate-200/80 shadow-xs flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {[
          { id: 'finder', label: 'Blood Inventory Finder', icon: Search, count: data.inventory.filter(u => u.status === 'AVAILABLE_RELEASED').length },
          { id: 'banks', label: 'Nearby Blood Banks & Map', icon: Building2, count: data.facilities.length },
          { id: 'inventory', label: 'Component Inventory & Expiry', icon: CalendarClock, count: data.inventory.length },
          { id: 'requests', label: 'Requests & Reservations', icon: ShoppingCart, count: data.requests.length },
          { id: 'transfers', label: 'Transfers & Logistics', icon: Truck, count: data.transfers.length },
          { id: 'partners', label: 'Partner Portal', icon: ShieldCheck, count: data.facilities.length },
          { id: 'analytics', label: 'Inventory Analytics', icon: BarChart3 },
          { id: 'audit', label: 'Audit & Traceability', icon: FileText, count: data.audit_log.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
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

      {/* ================= 4. TAB 1: BLOOD INVENTORY FINDER ================= */}
      {activeSubTab === 'finder' && (
        <div className="space-y-5">
          {/* Filters & Recipient Compatibility Matrix */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800">Target Recipient Compatibility Guidance</span>
                <p className="text-[11px] text-slate-500">
                  Select casualty's blood group to inspect immunologically compatible red cell and plasma components.
                </p>
              </div>

              {/* Patient Blood Group Selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 font-semibold">Casualty Group:</span>
                {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(bg => (
                  <button
                    key={bg}
                    onClick={() => setRecipientAbo(bg)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                      recipientAbo === bg
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Compatibility Callout */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="p-1 rounded-lg bg-rose-100 text-rose-700 font-bold text-[10px] shrink-0 mt-0.5">RED CELLS</span>
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Compatible PRBC / Whole Blood Donors:</div>
                  <div className="font-mono font-bold text-slate-800 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {compatibilityInfo.redCells.map((rc, i) => (
                      <span key={i} className="px-1.5 py-0.2 bg-white rounded border border-slate-200 text-rose-700">{rc}</span>
                    ))}
                    {recipientAbo === 'O-' && <span className="text-[10px] text-rose-600 italic">(O- Only)</span>}
                    {recipientAbo === 'AB+' && <span className="text-[10px] text-emerald-600 italic">(Universal Recipient)</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="p-1 rounded-lg bg-blue-100 text-blue-700 font-bold text-[10px] shrink-0 mt-0.5">PLASMA</span>
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Compatible FFP / Cryo Donors:</div>
                  <div className="font-mono font-bold text-slate-800 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {compatibilityInfo.plasma.map((pl, i) => (
                      <span key={i} className="px-1.5 py-0.2 bg-white rounded border border-slate-200 text-blue-700">{pl}</span>
                    ))}
                    {recipientAbo === 'AB+' && <span className="text-[10px] text-blue-600 italic">(AB+ Only)</span>}
                    {recipientAbo === 'O-' && <span className="text-[10px] text-emerald-600 italic">(Universal Plasma Recipient)</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 pt-1 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">ABO Group:</label>
                <select
                  value={searchAbo}
                  onChange={(e) => setSearchAbo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="ALL">All Groups</option>
                  <option value="O">O Group</option>
                  <option value="A">A Group</option>
                  <option value="B">B Group</option>
                  <option value="AB">AB Group</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Rh(D) Factor:</label>
                <select
                  value={searchRh}
                  onChange={(e) => setSearchRh(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="ALL">All Rh(D)</option>
                  <option value="POSITIVE">Positive (+)</option>
                  <option value="NEGATIVE">Negative (-)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Component Type:</label>
                <select
                  value={searchComponent}
                  onChange={(e) => setSearchComponent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="ALL">All Components</option>
                  <option value="PRBC">Packed Red Cells (PRBC)</option>
                  <option value="WHOLE_BLOOD">Whole Blood (LTOWB)</option>
                  <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                  <option value="PLATELETS">Platelet Concentrate (SDP)</option>
                  <option value="CRYOPRECIPITATE">Cryoprecipitate (AHF)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Search Radius:</label>
                <select
                  value={searchRadiusKm}
                  onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value={5}>Within 5 km</option>
                  <option value={10}>Within 10 km</option>
                  <option value={25}>Within 25 km</option>
                  <option value={50}>Within 50 km</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setOnlyAvailable(!onlyAvailable)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    onlyAvailable
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Available Only</span>
                </button>
              </div>
            </div>
          </div>

          {/* Matching Units Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInventory.map(unit => {
              const facility = data.facilities.find(f => f.bank_id === unit.bank_id);
              const isUrgentShelf = unit.days_until_expiry <= 3;

              return (
                <div 
                  key={unit.unit_id}
                  className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 font-mono font-bold text-base flex items-center justify-center border border-rose-200 shrink-0">
                          {unit.blood_group_display}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 leading-snug">{unit.component_name}</h3>
                          <span className="font-mono text-[10px] text-slate-400 font-semibold">{unit.unit_id}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        unit.status === 'AVAILABLE_RELEASED' ? 'bg-emerald-100 text-emerald-800' :
                        unit.status === 'RESERVED' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {unit.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Facility & Travel */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Source Depot:</span>
                        <strong className="text-slate-800 truncate max-w-[180px]">{unit.bank_name}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Distance / ETA:</span>
                        <strong className="text-blue-700">{facility?.distance_km || 2.4} km (~{facility?.travel_time_mins || 6}m)</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Volume:</span>
                        <strong className="text-slate-800">{unit.volume_ml} ml</strong>
                      </div>
                    </div>

                    {/* Expiry & Storage */}
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Shelf Life Expiry:</span>
                        <span className={`font-mono font-bold ${isUrgentShelf ? 'text-amber-700' : 'text-slate-700'}`}>
                          {unit.expiry_date} ({unit.days_until_expiry}d left)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Storage Temp:</span>
                        <span className="font-semibold text-cyan-700 flex items-center gap-1">
                          <ThermometerSnowflake className="w-3 h-3" />
                          {unit.storage_temp_current}°C
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 pt-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Serology & NAT Screen Negative
                      </div>
                    </div>

                    {/* Special Attributes */}
                    {unit.special_attributes && unit.special_attributes.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {unit.special_attributes.map((attr, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-semibold">
                            {attr}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      disabled={!unit.can_reserve}
                      onClick={() => {
                        setReqAbo(unit.abo);
                        setReqRh(unit.rh);
                        setReqComponent(unit.component_type);
                        setReqTargetBank(unit.bank_id);
                        setIsRequestModalOpen(true);
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        unit.can_reserve
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{unit.can_reserve ? 'Request / Reserve Unit' : 'Unavailable for Reservation'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredInventory.length === 0 && (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-3">
              <Droplet className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-slate-700 font-bold text-sm">No blood units match your search filters</div>
              <p className="text-slate-400 text-xs">Try expanding your search radius or selecting alternative compatible blood components.</p>
            </div>
          )}
        </div>
      )}

      {/* ================= 5. TAB 2: NEARBY BLOOD BANKS & MAP ================= */}
      {activeSubTab === 'banks' && (
        <div className="space-y-5">
          {/* Map Container */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Regional Blood Bank Geographic Dispatch Radar</h3>
                <p className="text-xs text-slate-500">Live coordinates of Level-1 transfusion depots and trauma center blood reserves</p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
                Center: FST Alpha Hospital Anchor
              </span>
            </div>

            <div 
              ref={mapContainerRef}
              className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-inner z-0"
            />
          </div>

          {/* Facilities Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.facilities.map(facility => (
              <div 
                key={facility.bank_id}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">{facility.bank_id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                          {facility.operating_status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">{facility.name}</h3>
                      <p className="text-xs text-slate-500">{facility.address}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-rose-600">{facility.distance_km} km</div>
                    <div className="text-[11px] text-slate-400">~{facility.travel_time_mins} mins</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium uppercase">Total Stock</div>
                    <div className="font-semibold text-slate-800 text-[11px] mt-0.5">{facility.available_units_count} Units</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium uppercase">Cold Chain</div>
                    <div className="font-semibold text-cyan-700 text-[11px] mt-0.5">{facility.cold_storage_status}</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium uppercase">Courier Dispatch</div>
                    <div className="font-semibold text-emerald-700 text-[11px] mt-0.5">
                      {facility.transport_available ? 'Available' : 'Walk-In Only'}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-medium uppercase">Radio VHF</div>
                    <div className="font-semibold text-slate-800 text-[11px] mt-0.5 truncate">{facility.contact_vhf}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-slate-400 text-[11px]">Director: </span>
                    <strong className="text-slate-800">{facility.director}</strong>
                  </div>

                  <button
                    onClick={() => {
                      setReqTargetBank(facility.bank_id);
                      setIsRequestModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Request</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 6. TAB 3: COMPONENT INVENTORY & EXPIRY (FEFO) ================= */}
      {activeSubTab === 'inventory' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Unit-Level FEFO (First-Expired, First-Out) Tracking</h3>
              <p className="text-xs text-slate-500">Individual ISBT-128 barcoded component records with live temperature telemetry</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              FEFO Safe Rotation Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-semibold uppercase">
                  <th className="py-3 px-3">Unit Barcode</th>
                  <th className="py-3 px-3">Group</th>
                  <th className="py-3 px-3">Component Type</th>
                  <th className="py-3 px-3">Collection</th>
                  <th className="py-3 px-3">Expiry Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Temp</th>
                  <th className="py-3 px-3">Depot</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.inventory.map(unit => {
                  const isExpired = unit.days_until_expiry < 0;
                  const isCritical = unit.days_until_expiry >= 0 && unit.days_until_expiry <= 3;

                  return (
                    <tr key={unit.unit_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{unit.unit_id}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200">
                          {unit.blood_group_display}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{unit.component_name}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{unit.collection_date}</td>
                      <td className="py-3 px-3 font-mono text-slate-700">{unit.expiry_date}</td>
                      <td className="py-3 px-3">
                        {isExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">EXPIRED</span>
                        ) : unit.status === 'QUARANTINED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">QUARANTINED</span>
                        ) : isCritical ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                            EXP IN {unit.days_until_expiry}d
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {unit.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-cyan-700">{unit.storage_temp_current}°C</td>
                      <td className="py-3 px-3 text-slate-500 text-[11px] font-mono">{unit.bank_id}</td>
                      <td className="py-3 px-3 text-right">
                        {unit.status !== 'QUARANTINED' && unit.status !== 'EXPIRED' && (
                          <button
                            onClick={() => handleQuarantineUnit(unit.unit_id)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all"
                          >
                            Quarantine
                          </button>
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

      {/* ================= 7. TAB 4: REQUESTS & RESERVATIONS WORKFLOW ================= */}
      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Emergency Blood Component Requests & Reservations</h3>
              <p className="text-xs text-slate-500">Real-time status transitions from hospital order to crossmatch locking</p>
            </div>
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Request</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.requests.map(order => {
              const isStat = order.urgency === 'EMERGENCY_STAT';

              return (
                <div 
                  key={order.request_id}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">{order.request_id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isStat ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.urgency}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700">
                          {order.status}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{order.patient_name_or_alias}</h3>
                      <p className="text-xs text-slate-500 italic mt-0.5">{order.clinical_indication}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-bold text-rose-600">{order.units_requested} Units</span>
                      <span className="text-xs text-slate-400 block font-mono font-bold">
                        {order.requested_abo}{order.requested_rh === 'NEGATIVE' ? '-' : '+'} {order.component_type}
                      </span>
                    </div>
                  </div>

                  {/* Allocated Units */}
                  {order.allocated_unit_ids && order.allocated_unit_ids.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                      <span className="text-slate-400 text-[10px] block font-semibold uppercase">Locked ISBT Units:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1 font-mono text-[11px] font-bold text-slate-800">
                        {order.allocated_unit_ids.map((uid, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white rounded border border-slate-200 text-rose-700">
                            {uid}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions based on state */}
                  <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                    <span className="text-slate-400 text-[11px]">Target: <strong>{order.target_blood_bank_name}</strong></span>

                    <div className="flex items-center gap-2">
                      {order.status === 'SUBMITTED' && (
                        <button
                          onClick={() => handleAcceptRequest(order.request_id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                        >
                          Accept & Lock Units
                        </button>
                      )}

                      {order.status === 'ACCEPTED_RESERVED' && (
                        <button
                          onClick={() => handleDispatchTransfer(order.request_id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Dispatch Courier</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 8. TAB 5: TRANSFERS & LOGISTICS ================= */}
      {activeSubTab === 'transfers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.transfers.map(trf => (
              <div 
                key={trf.transfer_id}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400 font-bold">{trf.transfer_id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800">
                        {trf.transfer_status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{trf.component_type} Transit</h3>
                    <p className="text-xs text-slate-500">{trf.source_name} &rarr; {trf.destination_name}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-cyan-600 flex items-center gap-1 justify-end">
                      <ThermometerSnowflake className="w-4 h-4" />
                      {trf.current_transit_temp_c}°C
                    </span>
                    <span className="text-[11px] text-slate-400 block">{trf.transport_container_id}</span>
                  </div>
                </div>

                {/* Chain of Custody Timeline */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Chain of Custody Checkpoints:</span>
                  {trf.chain_of_custody_events.map((evt, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] text-slate-700">
                      <span>&bull; {evt.event}</span>
                      <span className="font-mono text-cyan-700 font-bold">{evt.temp}</span>
                    </div>
                  ))}
                </div>

                {/* Confirm receipt */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Courier: <strong>{trf.courier_callsign}</strong></span>

                  {trf.transfer_status !== 'DELIVERED_RECEIVED' ? (
                    <button
                      onClick={() => handleConfirmReceipt(trf.transfer_id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Delivery & Receipt</span>
                    </button>
                  ) : (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Delivered & Verified
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 9. TAB 6: PARTNER PORTAL ================= */}
      {activeSubTab === 'partners' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Blood Bank Partner Credentialed Portal</h3>
              <p className="text-xs text-slate-500">Role-isolated interface for registered blood banks to manage stock and verify releases</p>
            </div>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-200">
              Role: {partnerPersona === 'BLOOD_BANK_OFFICER' ? 'Blood Bank Officer (AFTC)' : 'Hospital Clinician'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.facilities.map(fac => (
              <div key={fac.bank_id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <strong className="text-slate-900">{fac.name}</strong>
                  <span className="font-mono text-slate-400 text-[10px]">{fac.bank_id}</span>
                </div>
                <div className="text-[11px] text-slate-600">License: {fac.license_accreditation}</div>
                <div className="text-[11px] text-slate-600">Director: {fac.director}</div>
                <div className="text-[11px] text-slate-600">Contact: {fac.contact_phone}</div>
                <div className="text-emerald-700 font-semibold pt-1 text-[11px]">&bull; Stock Sync Freshness: {fac.last_inventory_sync}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 10. TAB 7: INVENTORY ANALYTICS ================= */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase">Total Units Stocked</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{data.total_available_released_units}</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Across 4 verified depots</p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase">O-Negative Critical Reserve</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">{data.total_o_negative_emergency_units}</div>
              <p className="text-[11px] text-rose-500 font-medium mt-1">Universal Emergency Red Cells</p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase">Cold-Chain Compliance</div>
              <div className="text-2xl font-bold text-cyan-600 mt-1">{data.cold_chain_compliance_pct}%</div>
              <p className="text-[11px] text-cyan-700 font-semibold mt-1">Continuous logger telemetry</p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase">Wastage / Expiry Rate</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">1.2%</div>
              <p className="text-[11px] text-slate-500 mt-1">FEFO rotation optimized</p>
            </div>
          </div>

          {/* Blood Group Distribution Progress Bars */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">ABO & Rh(D) Blood Group Inventory Distribution</h3>
            
            <div className="space-y-3">
              {[
                { group: 'O Negative (Universal Red Cell)', count: 42, max: 60, color: 'bg-rose-600' },
                { group: 'O Positive', count: 180, max: 200, color: 'bg-red-500' },
                { group: 'A Positive', count: 120, max: 150, color: 'bg-blue-500' },
                { group: 'A Negative', count: 25, max: 40, color: 'bg-indigo-500' },
                { group: 'B Positive', count: 110, max: 140, color: 'bg-purple-500' },
                { group: 'B Negative', count: 18, max: 30, color: 'bg-pink-500' },
                { group: 'AB Positive (Universal Plasma)', count: 28, max: 40, color: 'bg-emerald-500' },
                { group: 'AB Negative', count: 5, max: 15, color: 'bg-slate-500' }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{item.group}</span>
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

      {/* ================= 11. TAB 8: AUDIT & TRACEABILITY ================= */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Immutable Chain-of-Custody & Transfusion Audit Trail</h3>
              <p className="text-xs text-slate-500">Cryptographically signed logs for every request, unit reservation, dispatch, and receipt event</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-mono font-bold">
              DEMO ENVIRONMENT — SYNTHETIC CLINICAL RECORDS
            </span>
          </div>

          <div className="space-y-3">
            {data.audit_log.map(entry => (
              <div 
                key={entry.audit_id}
                className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{entry.audit_id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800">
                      {entry.event_type}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{entry.timestamp}</span>
                </div>

                <p className="text-slate-800 font-medium">{entry.details}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200/60 pt-1.5">
                  <span>Actor: <strong className="text-slate-600">{entry.actor}</strong> ({entry.facility})</span>
                  <span className="font-mono text-[10px] text-slate-400">{entry.digital_signature_hash}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 12. EMERGENCY REQUEST MODAL ================= */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <Droplet className="w-5 h-5 fill-current" />
                <span>Emergency Blood Component Request Form</span>
              </div>
              <button 
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Casualty / Patient:</label>
                  <input
                    type="text"
                    value={reqPatientAlias}
                    onChange={(e) => setReqPatientAlias(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Component Needed:</label>
                  <select
                    value={reqComponent}
                    onChange={(e) => setReqComponent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                    <option value="WHOLE_BLOOD">Whole Blood (Low Titer O-Neg)</option>
                    <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                    <option value="PLATELETS">Platelets (SDP)</option>
                    <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">ABO Group:</label>
                  <select
                    value={reqAbo}
                    onChange={(e) => setReqAbo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="O">O</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Rh(D):</label>
                  <select
                    value={reqRh}
                    onChange={(e) => setReqRh(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="NEGATIVE">Negative (-)</option>
                    <option value="POSITIVE">Positive (+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Units (Units):</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={reqUnits}
                    onChange={(e) => setReqUnits(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Target Blood Bank Facility:</label>
                <select
                  value={reqTargetBank}
                  onChange={(e) => setReqTargetBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  {data.facilities.map(f => (
                    <option key={f.bank_id} value={f.bank_id}>{f.name} ({f.distance_km} km)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Clinical Indication:</label>
                <textarea
                  rows="2"
                  value={reqIndication}
                  onChange={(e) => setReqIndication(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed font-medium">
                <strong>Mandatory Safety Acknowledgment:</strong> I certify that compatibility testing samples will be verified with receiving blood bank, and 2-person bedside identification will precede component administration.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRequest}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs shadow-md transition-all"
              >
                Submit Emergency Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
