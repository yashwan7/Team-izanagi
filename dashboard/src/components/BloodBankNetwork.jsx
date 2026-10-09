import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import DEFAULT_BLOOD_BANK_DATA from '../data/mockBloodBankData.json';
import { 
  Droplet, Search, Building2, CalendarClock, ShoppingCart, 
  Truck, ShieldCheck, BarChart3, FileText, 
  CheckCircle2, UserCheck, 
  ThermometerSnowflake, X, Plus, 
  AlertOctagon
} from 'lucide-react';

export default function BloodBankNetwork({ 
  bloodBankData, 
  onBloodBankAction,
  patients: _patients = [],
  onSelectPatient: _onSelectPatient = null
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

  // Local data state initialized with default synthetic data and updated with live prop
  const [localData, setLocalData] = useState(() => {
    if (bloodBankData && bloodBankData.facilities && bloodBankData.facilities.length > 0) {
      return bloodBankData;
    }
    return DEFAULT_BLOOD_BANK_DATA;
  });

  useEffect(() => {
    if (bloodBankData && bloodBankData.facilities && bloodBankData.facilities.length > 0) {
      setLocalData(bloodBankData);
    }
  }, [bloodBankData]);

  const data = localData;

  // Leaflet Map Ref & Google Maps API Integration
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC6AaQ9mU-hfC7aLE-G1mXoiBixf-UG1-s';
  const [mapType, setMapType] = useState('tactical-dark'); // 'tactical-dark' | 'google-hybrid' | 'google-roads'
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);

  const showNotice = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), 4500);
  };

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

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    return data.inventory.filter(unit => {
      if (searchAbo !== 'ALL' && unit.abo !== searchAbo) return false;
      if (searchRh !== 'ALL' && unit.rh !== searchRh) return false;
      if (searchComponent !== 'ALL' && unit.component_type !== searchComponent) return false;
      if (onlyAvailable && unit.status !== 'AVAILABLE_RELEASED') return false;

      const facility = data.facilities.find(f => f.bank_id === unit.bank_id);
      if (facility && facility.distance_km > searchRadiusKm) return false;

      return true;
    });
  }, [data.inventory, data.facilities, searchAbo, searchRh, searchComponent, onlyAvailable, searchRadiusKm]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (activeSubTab !== 'banks' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.6150, 77.2180],
        zoom: 12,
        zoomControl: true
      });
      mapInstanceRef.current = map;
    }
  }, [activeSubTab]);

  // Update Tile Layer when mapType or subtab changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || activeSubTab !== 'banks') return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let tileUrl = '';
    let options = {};

    if (mapType === 'google-hybrid') {
      tileUrl = `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${apiKey}`;
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'] };
    } else if (mapType === 'google-roads') {
      tileUrl = `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${apiKey}`;
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'] };
    } else {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      options = { maxZoom: 18, subdomains: 'abcd' };
    }

    tileLayerRef.current = L.tileLayer(tileUrl, options).addTo(map);
  }, [mapType, activeSubTab, apiKey]);

  useEffect(() => {
    if (activeSubTab !== 'banks' || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // FST Hospital Anchor
    const hospIcon = L.divIcon({
      className: 'hosp-marker',
      html: `
        <div style="background: #350D13; color: #FF2D3D; width: 34px; height: 34px; border-radius: 0px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 1px solid #FF2D3D; box-shadow: 0 4px 12px rgba(0,0,0,0.8); font-family: monospace;">
          FST-A
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    const hospMarker = L.marker([28.6150, 77.2100], { icon: hospIcon })
      .bindPopup(`
        <div style="background: #141416; color: #F5F5F5; font-family: monospace; font-size: 11px; padding: 4px; border: 1px solid #35353B;">
          <strong style="color: #FF2D3D;">FST Alpha Forward Base</strong><br>
          <span style="color: #A1A1AA;">Requesting Surgical Facility Anchor</span>
        </div>
      `)
      .addTo(map);
    markersRef.current.push(hospMarker);

    // Blood Banks
    data.facilities.forEach(facility => {
      const isAftc = facility.bank_id === 'BB-AFTC-01';
      const icon = L.divIcon({
        className: 'bb-marker',
        html: `
          <div style="background: ${isAftc ? '#FF2D3D' : '#1C1C20'}; color: ${isAftc ? '#0B0B0D' : '#F5F5F5'}; width: 32px; height: 32px; border-radius: 0px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 1px solid ${isAftc ? '#FF2D3D' : '#35353B'}; box-shadow: 0 4px 10px rgba(0,0,0,0.6);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([facility.lat, facility.lng], { icon })
        .bindPopup(`
          <div style="background: #141416; color: #F5F5F5; font-family: monospace; font-size: 11px; padding: 6px; border: 1px solid #35353B; min-width: 180px;">
            <strong style="color: #FF2D3D;">${facility.name}</strong>
            <div style="color: #A1A1AA; margin-top: 3px;">${facility.distance_km} km &bull; ~${facility.travel_time_mins}m transit</div>
            <div style="color: #F5F5F5; font-weight: bold; margin-top: 4px; border-top: 1px solid #35353B; pt: 3px;">Stocked: ${facility.available_units_count} available units</div>
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
    const reqId = `REQ-BLD-${Math.floor(Date.now() % 10000)}`;
    const targetBank = data.facilities.find(f => f.bank_id === reqTargetBank) || data.facilities[0];
    const newReq = {
      request_id: reqId,
      timestamp: 'Just now',
      patient_id: reqPatientId,
      patient_name_or_alias: reqPatientAlias,
      patient_blood_group: `${reqAbo}${reqRh === 'NEGATIVE' ? '-' : '+'}`,
      requested_abo: reqAbo,
      requested_rh: reqRh,
      component_type: reqComponent,
      units_requested: parseInt(reqUnits) || 1,
      units_allocated: 0,
      urgency: reqUrgency,
      clinical_indication: reqIndication,
      requesting_hospital: 'Forward Surgical Team Alpha (FST-A)',
      target_blood_bank_id: targetBank?.bank_id || 'BB-AFTC-01',
      target_blood_bank_name: targetBank?.name || 'Armed Forces Transfusion Centre',
      status: 'SUBMITTED',
      authorized_clinician: 'Maj. Dr. A. Sharma (Trauma Lead)',
      allocated_unit_ids: [],
      clinical_safeguard_acknowledged: true
    };
    const newAudit = {
      audit_id: `AUD-BLD-${Math.floor(Date.now() % 10000)}`,
      timestamp: 'Just now',
      event_type: 'REQUEST_SUBMITTED',
      request_id: reqId,
      actor: 'Maj. Dr. A. Sharma (Trauma Lead)',
      facility: targetBank?.name || 'Armed Forces Transfusion Centre',
      details: `Submitted request for ${reqUnits} unit(s) of ${reqComponent} (${reqAbo}${reqRh === 'NEGATIVE' ? '-' : '+'}) for ${reqPatientAlias}. Urgency: ${reqUrgency}.`,
      digital_signature_hash: `sha256:7fa${Math.random().toString(36).substring(2, 10)}`
    };

    setLocalData(prev => ({
      ...prev,
      requests: [newReq, ...prev.requests],
      active_requests_count: (prev.active_requests_count || 0) + 1,
      audit_log: [newAudit, ...prev.audit_log]
    }));

    if (onBloodBankAction) {
      onBloodBankAction({
        action: 'CREATE_REQUEST',
        payload: newReq
      });
    }

    setIsRequestModalOpen(false);
    showNotice(`Emergency request ${reqId} dispatched to ${targetBank?.name || 'Target Bank'}.`);
  };

  const handleAcceptRequest = (requestId) => {
    const req = data.requests.find(r => r.request_id === requestId);
    if (!req) return;

    const availableMatches = data.inventory.filter(u => 
      u.status === 'AVAILABLE_RELEASED' &&
      u.abo === req.requested_abo &&
      u.rh === req.requested_rh &&
      u.component_type === req.component_type
    ).slice(0, req.units_requested);

    const allocatedIds = availableMatches.map(u => u.unit_id);

    setLocalData(prev => {
      const updatedRequests = prev.requests.map(r => {
        if (r.request_id === requestId) {
          return {
            ...r,
            status: 'ACCEPTED_RESERVED',
            units_allocated: allocatedIds.length,
            allocated_unit_ids: allocatedIds
          };
        }
        return r;
      });

      const updatedInventory = prev.inventory.map(u => {
        if (allocatedIds.includes(u.unit_id)) {
          return {
            ...u,
            status: 'RESERVED',
            can_reserve: false
          };
        }
        return u;
      });

      const auditEntry = {
        audit_id: `AUD-BLD-${Math.floor(Date.now() % 10000)}`,
        timestamp: 'Just now',
        event_type: 'REQUEST_ACCEPTED_RESERVED',
        request_id: requestId,
        actor: 'Armed Forces Transfusion Centre Officer',
        facility: req.target_blood_bank_name,
        details: `Accepted order. Locked ${allocatedIds.length} ISBT units [${allocatedIds.join(', ')}] in cold-room reserve.`,
        digital_signature_hash: `sha256:90b${Math.random().toString(36).substring(2, 10)}`
      };

      return {
        ...prev,
        requests: updatedRequests,
        inventory: updatedInventory,
        total_available_released_units: Math.max(0, (prev.total_available_released_units || 0) - allocatedIds.length),
        audit_log: [auditEntry, ...prev.audit_log]
      };
    });

    if (onBloodBankAction) {
      onBloodBankAction({
        action: 'ACCEPT_REQUEST',
        request_id: requestId,
        allocated_unit_ids: allocatedIds,
        actor_name: 'Armed Forces Transfusion Centre Officer'
      });
    }

    showNotice(`Request ${requestId} accepted. Units reserved in depot.`);
  };

  const handleDispatchTransfer = (requestId) => {
    const req = data.requests.find(r => r.request_id === requestId);
    if (!req) return;

    const transferId = `TRF-LOG-${Math.floor(Date.now() % 10000)}`;
    const newTransfer = {
      transfer_id: transferId,
      request_id: requestId,
      source_bank_id: req.target_blood_bank_id,
      source_name: req.target_blood_bank_name,
      destination_facility_id: 'HOSP-FST-01',
      destination_name: req.requesting_hospital,
      component_type: req.component_type,
      units_count: req.units_allocated || req.units_requested,
      allocated_units: req.allocated_unit_ids || ['ISBT-99120'],
      transfer_status: 'DISPATCHED_IN_TRANSIT',
      dispatch_timestamp: 'Just now',
      estimated_arrival_timestamp: 'In 18 mins',
      courier_type: 'DEDICATED_COLD_CHAIN_COURIER',
      courier_callsign: 'Apex Rapid Courier 04',
      transport_container_id: 'COOL-BOX-CREDO-09',
      current_transit_temp_c: 3.2,
      temp_status: 'NORMAL',
      chain_of_custody_events: [
        { event: 'Packed & Sealed with Calibrated Logger', timestamp: '10 mins ago', actor: 'Depot Bio-tech', temp: '3.1°C' },
        { event: 'Courier Custody Handover Signed', timestamp: '5 mins ago', actor: 'Apex Courier 04', temp: '3.2°C' }
      ]
    };

    setLocalData(prev => {
      const updatedRequests = prev.requests.map(r => {
        if (r.request_id === requestId) {
          return { ...r, status: 'DISPATCHED_IN_TRANSIT' };
        }
        return r;
      });

      const auditEntry = {
        audit_id: `AUD-BLD-${Math.floor(Date.now() % 10000)}`,
        timestamp: 'Just now',
        event_type: 'TRANSFER_DISPATCHED',
        request_id: requestId,
        actor: 'Apex Rapid Courier 04',
        facility: req.target_blood_bank_name,
        details: `Dispatched cold-chain transfer ${transferId} under Credo Box COOL-BOX-CREDO-09 (3.2°C).`,
        digital_signature_hash: `sha256:44c${Math.random().toString(36).substring(2, 10)}`
      };

      return {
        ...prev,
        requests: updatedRequests,
        transfers: [newTransfer, ...prev.transfers],
        in_transit_transfers_count: (prev.in_transit_transfers_count || 0) + 1,
        audit_log: [auditEntry, ...prev.audit_log]
      };
    });

    if (onBloodBankAction) {
      onBloodBankAction({
        action: 'DISPATCH_TRANSFER',
        transfer_payload: newTransfer
      });
    }

    showNotice(`Courier dispatched for request ${requestId} with cold-chain box.`);
  };

  const handleConfirmReceipt = (transferId) => {
    const transfer = data.transfers.find(t => t.transfer_id === transferId);
    if (!transfer) return;

    setLocalData(prev => {
      const updatedTransfers = prev.transfers.map(t => {
        if (t.transfer_id === transferId) {
          return {
            ...t,
            transfer_status: 'DELIVERED_RECEIVED',
            actual_arrival_timestamp: 'Arrived & Verified',
            receipt_confirmed_by: 'FST Alpha Receiving Officer',
            receipt_notes: 'Temperature confirmed 3.4°C upon arrival. Chain-of-custody sealed.'
          };
        }
        return t;
      });

      const updatedInventory = prev.inventory.map(u => {
        if (transfer.allocated_units.includes(u.unit_id)) {
          return { ...u, status: 'RECEIVED' };
        }
        return u;
      });

      const updatedRequests = prev.requests.map(r => {
        if (r.request_id === transfer.request_id) {
          return { ...r, status: 'RECEIVED' };
        }
        return r;
      });

      const auditEntry = {
        audit_id: `AUD-BLD-${Math.floor(Date.now() % 10000)}`,
        timestamp: 'Just now',
        event_type: 'RECEIPT_ACKNOWLEDGED',
        request_id: transfer.request_id,
        actor: 'FST Alpha Receiving Officer',
        facility: transfer.destination_name,
        details: `Confirmed delivery of units [${transfer.allocated_units.join(', ')}]. Cold-chain integrity intact at 3.4°C.`,
        digital_signature_hash: `sha256:88e${Math.random().toString(36).substring(2, 10)}`
      };

      return {
        ...prev,
        transfers: updatedTransfers,
        inventory: updatedInventory,
        requests: updatedRequests,
        in_transit_transfers_count: Math.max(0, (prev.in_transit_transfers_count || 1) - 1),
        audit_log: [auditEntry, ...prev.audit_log]
      };
    });

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
    setLocalData(prev => {
      const updatedInventory = prev.inventory.map(u => {
        if (u.unit_id === unitId) {
          return { ...u, status: 'QUARANTINED', can_reserve: false, storage_excursion_detected: true };
        }
        return u;
      });
      const auditEntry = {
        audit_id: `AUD-BLD-${Math.floor(Date.now() % 10000)}`,
        timestamp: 'Just now',
        event_type: 'UNIT_QUARANTINED',
        unit_id: unitId,
        actor: 'Transfusion Safety Officer',
        facility: 'Regional Depot',
        details: `Unit ${unitId} placed in quarantine. Reason: Temperature excursion audit review.`,
        digital_signature_hash: `sha256:99a${Math.random().toString(36).substring(2, 10)}`
      };
      return {
        ...prev,
        inventory: updatedInventory,
        units_quarantined_count: (prev.units_quarantined_count || 0) + 1,
        total_available_released_units: Math.max(0, (prev.total_available_released_units || 1) - 1),
        audit_log: [auditEntry, ...prev.audit_log]
      };
    });

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
    <div className="space-y-5 pb-14 font-mono text-[#F8FAFC] animate-in fade-in duration-200">
      
      {/* ================= 1. SAFETY PROTOCOL & MANDATORY SAFEGUARD ================= */}
      <div className="nm-alert-inset rounded-2xl p-5 border border-[#FF334B]/40 relative overflow-hidden">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 nm-convex rounded-xl text-[#FF334B] flex items-center justify-center shrink-0 mt-0.5">
            <AlertOctagon className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-black tracking-widest px-2 py-0.5 rounded-md bg-[#FF334B] text-[#FFFFFF] shadow-[0_0_8px_#FF334B]">
                CLINICAL PROTOCOL SAFEGUARD
              </span>
              <span className="text-xs text-[#F8FAFC] font-bold">
                ISBT-128 TRACEABLE NETWORK
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              <strong className="text-[#F8FAFC]">Mandatory Safety Principle:</strong> An inventory or database match does <em>NOT</em> establish compatibility. 
              Pre-transfusion laboratory cross-matching, bedside 2-person patient verification, clinical authorization, and component verification are mandatory. 
              Red-cell (PRBC/Whole Blood) and plasma (FFP) follow inverse compatibility rules.
            </p>
          </div>
        </div>
      </div>

      {/* ================= 2. HEADER & SUMMARY METRIC TILES ================= */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 nm-convex rounded-2xl text-[#FF334B] flex items-center justify-center shrink-0">
              <Droplet className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base font-black text-[#F8FAFC] tracking-tight uppercase m-0">Blood Bank &amp; Transfusion Network</h1>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-md nm-alert-inset text-[#FF334B] border border-[#FF334B]/30">
                  ONLINE 24/7
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-1 m-0 font-medium">
                Regional blood availability, unit-level ISBT-128 tracking, cold-chain transport, and emergency damage-control transfusion dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="px-4 py-2 nm-btn-accent rounded-xl text-white text-xs font-bold flex items-center gap-2 transition-all uppercase shadow-[0_0_12px_#FF334B]"
            >
              <Plus className="w-4 h-4" />
              <span>Emergency Blood Request</span>
            </button>

            <button
              onClick={() => setPartnerPersona(partnerPersona === 'HOSPITAL_USER' ? 'BLOOD_BANK_OFFICER' : 'HOSPITAL_USER')}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 uppercase ${
                partnerPersona === 'BLOOD_BANK_OFFICER'
                  ? 'nm-alert-inset border-[#FF334B]/40 text-[#FF334B]'
                  : 'nm-btn text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              <UserCheck className="w-4 h-4 text-[#FF334B]" />
              <span>Persona: {partnerPersona === 'BLOOD_BANK_OFFICER' ? 'Blood Bank Officer' : 'Hospital Clinician'}</span>
            </button>
          </div>
        </div>

        {/* 6 Tactical Top Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="nm-flat rounded-xl p-3.5 border border-white/[0.03]">
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Verified Banks</div>
            <div className="text-base font-black text-[#F8FAFC] mt-1">{data.total_registered_banks} Facilities</div>
            <div className="text-[10px] text-[#94A3B8] mt-0.5">24/7 Accredited</div>
          </div>

          <div className="nm-flat rounded-xl p-3.5 border border-white/[0.03]">
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Total Available</div>
            <div className="text-base font-black text-[#F8FAFC] mt-1">{data.total_available_released_units} Units</div>
            <div className="text-[10px] text-[#00E5A3] mt-0.5 font-bold">Screened &amp; Released</div>
          </div>

          <div className="nm-flat rounded-xl p-3.5 border border-[#FF334B]/30">
            <div className="text-[10px] font-bold text-[#FF334B] uppercase tracking-wider">O-Neg Reserve</div>
            <div className="text-base font-black text-[#FF334B] mt-1">{data.total_o_negative_emergency_units} Units</div>
            <div className="text-[10px] text-[#94A3B8] mt-0.5">Universal Red Cells</div>
          </div>

          <div className="nm-flat rounded-xl p-3.5 border border-white/[0.03]">
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Active Requests</div>
            <div className="text-base font-black text-[#F8FAFC] mt-1">{data.active_requests_count} Active</div>
            <div className="text-[10px] text-[#FF334B] mt-0.5 font-bold">1 In Transit Courier</div>
          </div>

          <div className="nm-flat rounded-xl p-3.5 border border-white/[0.03]">
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Near Expiry (&lt;72h)</div>
            <div className="text-base font-black text-[#F59E0B] mt-1">{data.units_near_expiry_count} Units</div>
            <div className="text-[10px] text-[#94A3B8] mt-0.5">FEFO Priority Flag</div>
          </div>

          <div className="nm-flat rounded-xl p-3.5 border border-white/[0.03]">
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Cold Chain Vault</div>
            <div className="text-base font-black text-[#00E5A3] mt-1">{data.cold_chain_compliance_pct}%</div>
            <div className="text-[10px] text-[#94A3B8] mt-0.5">0 Excursions Past 72h</div>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3 nm-inset rounded-xl border border-[#FF334B]/40 text-xs text-[#FF334B] flex items-center gap-2.5 animate-in slide-in-from-top-1 font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#FF334B] shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* ================= 3. 8-TAB INTERNAL NAVIGATION BAR ================= */}
      <div className="nm-inset rounded-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
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
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap uppercase ${
                isActive
                  ? 'nm-btn-accent text-white shadow-[0_0_12px_#FF334B]'
                  : 'nm-btn text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#64748B]'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-white/20 text-white' : 'nm-badge text-[#94A3B8]'
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
        <div className="space-y-4">
          {/* Filters & Recipient Compatibility Matrix */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">Target Recipient Compatibility Guidance</span>
                <p className="text-[11px] text-[#94A3B8]">
                  Select casualty blood group to inspect immunologically compatible red cell and plasma components.
                </p>
              </div>

              {/* Patient Blood Group Selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[#94A3B8] font-semibold">Casualty Group:</span>
                {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(bg => (
                  <button
                    key={bg}
                    onClick={() => setRecipientAbo(bg)}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded-xl transition-all ${
                      recipientAbo === bg
                        ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40 shadow-[0_0_8px_rgba(255,51,75,0.2)]'
                        : 'nm-btn text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Compatibility Callout */}
            <div className="nm-inset rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 nm-alert-inset border border-[#FF334B]/30 text-[#FF334B] font-bold text-[10px] rounded-md shrink-0 mt-0.5">
                  RED CELLS
                </span>
                <div>
                  <div className="text-[11px] text-[#94A3B8]">Compatible PRBC / Whole Blood Donors:</div>
                  <div className="font-mono font-bold text-[#F8FAFC] mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {compatibilityInfo.redCells.map((rc, i) => (
                      <span key={i} className="px-2 py-0.5 nm-btn rounded-md text-[#FF334B]">{rc}</span>
                    ))}
                    {recipientAbo === 'O-' && <span className="text-[10px] text-[#FF334B] italic">(O- Only)</span>}
                    {recipientAbo === 'AB+' && <span className="text-[10px] text-[#00E5A3] italic">(Universal Recipient)</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 nm-badge text-[#F8FAFC] font-bold text-[10px] rounded-md shrink-0 mt-0.5">
                  PLASMA
                </span>
                <div>
                  <div className="text-[11px] text-[#94A3B8]">Compatible FFP / Cryo Donors:</div>
                  <div className="font-mono font-bold text-[#F8FAFC] mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {compatibilityInfo.plasma.map((pl, i) => (
                      <span key={i} className="px-2 py-0.5 nm-btn rounded-md text-[#F8FAFC]">{pl}</span>
                    ))}
                    {recipientAbo === 'AB+' && <span className="text-[10px] text-[#FF334B] italic">(AB+ Only)</span>}
                    {recipientAbo === 'O-' && <span className="text-[10px] text-[#00E5A3] italic">(Universal Plasma Recipient)</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1 text-xs">
              <div>
                <label className="text-[10px] text-[#94A3B8] font-bold block mb-1 uppercase">ABO Group:</label>
                <select
                  value={searchAbo}
                  onChange={(e) => setSearchAbo(e.target.value)}
                  className="w-full px-3 py-2 nm-inset rounded-xl text-xs font-bold text-[#F8FAFC] border-none focus:outline-none"
                >
                  <option value="ALL" className="bg-[#181B22]">All Groups</option>
                  <option value="O" className="bg-[#181B22]">O Group</option>
                  <option value="A" className="bg-[#181B22]">A Group</option>
                  <option value="B" className="bg-[#181B22]">B Group</option>
                  <option value="AB" className="bg-[#181B22]">AB Group</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#94A3B8] font-bold block mb-1 uppercase">Rh(D) Factor:</label>
                <select
                  value={searchRh}
                  onChange={(e) => setSearchRh(e.target.value)}
                  className="w-full px-3 py-2 nm-inset rounded-xl text-xs font-bold text-[#F8FAFC] border-none focus:outline-none"
                >
                  <option value="ALL" className="bg-[#181B22]">All Rh(D)</option>
                  <option value="POSITIVE" className="bg-[#181B22]">Positive (+)</option>
                  <option value="NEGATIVE" className="bg-[#181B22]">Negative (-)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#A1A1AA] font-semibold block mb-1 uppercase">Component Type:</label>
                <select
                  value={searchComponent}
                  onChange={(e) => setSearchComponent(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
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
                <label className="text-[10px] text-[#A1A1AA] font-semibold block mb-1 uppercase">Search Radius:</label>
                <select
                  value={searchRadiusKm}
                  onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
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
                  className={`w-full py-1.5 px-2.5 text-xs font-bold border transition-all flex items-center justify-center gap-1.5 uppercase ${
                    onlyAvailable
                      ? 'bg-[#350D13] border-[#FF2D3D] text-[#FF2D3D]'
                      : 'bg-[#1C1C20] border-[#35353B] text-[#A1A1AA]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Available Only</span>
                </button>
              </div>
            </div>
          </div>

          {/* Matching Units Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredInventory.map(unit => {
              const facility = data.facilities.find(f => f.bank_id === unit.bank_id);
              const isUrgentShelf = unit.days_until_expiry <= 3;

              return (
                <div 
                  key={unit.unit_id}
                  className="bg-[#141416] p-4 border border-[#35353B] flex flex-col justify-between space-y-3"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-9 h-9 bg-[#1C1C20] text-[#FF2D3D] font-mono font-bold text-sm flex items-center justify-center border border-[#7F1D2D] shrink-0">
                          {unit.blood_group_display}
                        </span>
                        <div>
                          <h3 className="text-xs font-bold text-[#F5F5F5] leading-snug uppercase">{unit.component_name}</h3>
                          <span className="font-mono text-[10px] text-[#A1A1AA]">{unit.unit_id}</span>
                        </div>
                      </div>

                      <span className={`px-1.5 py-0.5 text-[9px] font-bold border ${
                        unit.status === 'AVAILABLE_RELEASED' ? 'bg-[#1C1C20] text-[#F5F5F5] border-[#35353B]' :
                        unit.status === 'RESERVED' ? 'bg-[#350D13] text-[#FF2D3D] border-[#7F1D2D]' :
                        'bg-[#350D13] text-[#FF2D3D] border-[#FF2D3D]'
                      }`}>
                        {unit.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Facility & Travel */}
                    <div className="bg-[#1C1C20] p-2.5 border border-[#35353B] space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#A1A1AA]">Source Depot:</span>
                        <strong className="text-[#F5F5F5] truncate max-w-[180px]">{unit.bank_name}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#A1A1AA]">Distance / ETA:</span>
                        <strong className="text-[#FF2D3D]">{facility?.distance_km || 2.4} km (~{facility?.travel_time_mins || 6}m)</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#A1A1AA]">Volume:</span>
                        <strong className="text-[#F5F5F5]">{unit.volume_ml} ml</strong>
                      </div>
                    </div>

                    {/* Expiry & Storage */}
                    <div className="mt-2.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#A1A1AA]">Shelf Expiry:</span>
                        <span className={`font-mono font-bold ${isUrgentShelf ? 'text-[#FF2D3D]' : 'text-[#F5F5F5]'}`}>
                          {unit.expiry_date} ({unit.days_until_expiry}d left)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#A1A1AA]">Storage Temp:</span>
                        <span className="font-semibold text-[#F5F5F5] flex items-center gap-1">
                          <ThermometerSnowflake className="w-3 h-3 text-[#FF2D3D]" />
                          {unit.storage_temp_current}°C
                        </span>
                      </div>
                      <div className="text-[10px] text-[#A1A1AA] flex items-center gap-1 pt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-[#FF2D3D]" />
                        Serology & NAT Screen Negative
                      </div>
                    </div>

                    {/* Special Attributes */}
                    {unit.special_attributes && unit.special_attributes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {unit.special_attributes.map((attr, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-[#1C1C20] border border-[#35353B] text-[#A1A1AA] text-[9px] font-semibold">
                            {attr}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-[#35353B]">
                    <button
                      disabled={!unit.can_reserve}
                      onClick={() => {
                        setReqAbo(unit.abo);
                        setReqRh(unit.rh);
                        setReqComponent(unit.component_type);
                        setReqTargetBank(unit.bank_id);
                        setIsRequestModalOpen(true);
                      }}
                      className={`w-full py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 uppercase ${
                        unit.can_reserve
                          ? 'bg-[#FF2D3D] hover:bg-[#FF2D3D]/90 text-[#0B0B0D]'
                          : 'bg-[#1C1C20] text-[#A1A1AA]/50 border border-[#35353B] cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{unit.can_reserve ? 'Request / Reserve Unit' : 'Unavailable'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredInventory.length === 0 && (
            <div className="bg-[#141416] p-10 text-center border border-[#35353B] space-y-2">
              <Droplet className="w-8 h-8 text-[#A1A1AA] mx-auto" />
              <div className="text-[#F5F5F5] font-bold text-xs uppercase">No blood units match current search filters</div>
              <p className="text-[#A1A1AA] text-[11px]">Expand search radius or select alternative compatible components.</p>
            </div>
          )}
        </div>
      )}

      {/* ================= 5. TAB 2: NEARBY BLOOD BANKS & MAP ================= */}
      {activeSubTab === 'banks' && (
        <div className="space-y-4">
          {/* Map Container */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#F8FAFC] uppercase">Regional Blood Bank Geographic Dispatch Radar</h3>
                <p className="text-[11px] text-[#94A3B8]">Live coordinates of Level-1 transfusion depots and trauma center blood reserves</p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex nm-inset rounded-xl p-1 text-[10px] font-bold">
                  <button
                    onClick={() => setMapType('tactical-dark')}
                    className={`px-3 py-1 rounded-lg transition-all ${mapType === 'tactical-dark' ? 'nm-btn-accent text-white shadow-[0_0_10px_rgba(255,51,75,0.4)]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
                  >
                    DARK
                  </button>
                  <button
                    onClick={() => setMapType('google-hybrid')}
                    className={`px-3 py-1 rounded-lg transition-all ${mapType === 'google-hybrid' ? 'nm-btn-accent text-white shadow-[0_0_10px_rgba(255,51,75,0.4)]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
                  >
                    GOOGLE HYBRID
                  </button>
                  <button
                    onClick={() => setMapType('google-roads')}
                    className={`px-3 py-1 rounded-lg transition-all ${mapType === 'google-roads' ? 'nm-btn-accent text-white shadow-[0_0_10px_rgba(255,51,75,0.4)]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
                  >
                    GOOGLE ROADS
                  </button>
                </div>
                <span className="px-3 py-1 nm-alert-inset text-[#FF334B] text-[10px] font-bold rounded-xl border border-[#FF334B]/30">
                  CENTER: FST ALPHA
                </span>
              </div>
            </div>

            <div 
              ref={mapContainerRef}
              className="w-full h-80 nm-inset rounded-2xl border border-white/[0.04] overflow-hidden z-0"
            />
          </div>

          {/* Facilities Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.facilities.map(facility => (
              <div 
                key={facility.bank_id}
                className="bg-[#141416] p-4 border border-[#35353B] space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1C1C20] text-[#FF2D3D] flex items-center justify-center border border-[#7F1D2D] shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#A1A1AA] font-bold">{facility.bank_id}</span>
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#1C1C20] text-[#F5F5F5] border border-[#35353B]">
                          {facility.operating_status}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-[#F5F5F5] leading-snug mt-0.5 uppercase">{facility.name}</h3>
                      <p className="text-[11px] text-[#A1A1AA]">{facility.address}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#FF2D3D]">{facility.distance_km} km</div>
                    <div className="text-[10px] text-[#A1A1AA]">~{facility.travel_time_mins} mins</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-[#1C1C20] p-2 border border-[#35353B]">
                    <div className="text-[9px] text-[#A1A1AA] uppercase">Total Stock</div>
                    <div className="font-semibold text-[#F5F5F5] text-[11px] mt-0.5">{facility.available_units_count} Units</div>
                  </div>

                  <div className="bg-[#1C1C20] p-2 border border-[#35353B]">
                    <div className="text-[9px] text-[#A1A1AA] uppercase">Cold Chain</div>
                    <div className="font-semibold text-[#F5F5F5] text-[11px] mt-0.5">{facility.cold_storage_status}</div>
                  </div>

                  <div className="bg-[#1C1C20] p-2 border border-[#35353B]">
                    <div className="text-[9px] text-[#A1A1AA] uppercase">Courier Dispatch</div>
                    <div className="font-semibold text-[#FF2D3D] text-[11px] mt-0.5">
                      {facility.transport_available ? 'Available' : 'Walk-In Only'}
                    </div>
                  </div>

                  <div className="bg-[#1C1C20] p-2 border border-[#35353B]">
                    <div className="text-[9px] text-[#A1A1AA] uppercase">Radio VHF</div>
                    <div className="font-semibold text-[#F5F5F5] text-[11px] mt-0.5 truncate">{facility.contact_vhf}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-[#35353B] pt-2.5">
                  <div>
                    <span className="text-[#A1A1AA] text-[10px]">DIRECTOR: </span>
                    <strong className="text-[#F5F5F5] text-[11px]">{facility.director}</strong>
                  </div>

                  <button
                    onClick={() => {
                      setReqTargetBank(facility.bank_id);
                      setIsRequestModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-[#FF2D3D] hover:bg-[#FF2D3D]/90 text-[#0B0B0D] text-xs font-bold transition-all flex items-center gap-1 uppercase"
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
        <div className="bg-[#141416] p-4 border border-[#35353B] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-bold text-[#F5F5F5] uppercase">Unit-Level FEFO (First-Expired, First-Out) Tracking</h3>
              <p className="text-[11px] text-[#A1A1AA]">Individual ISBT-128 barcoded component records with live temperature telemetry</p>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#1C1C20] text-[#FF2D3D] border border-[#7F1D2D]">
              FEFO ROTATION ACTIVE
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#35353B] text-[#A1A1AA] text-[10px] uppercase">
                  <th className="py-2.5 px-3">Unit Barcode</th>
                  <th className="py-2.5 px-3">Group</th>
                  <th className="py-2.5 px-3">Component Type</th>
                  <th className="py-2.5 px-3">Collection</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Temp</th>
                  <th className="py-2.5 px-3">Depot</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#35353B] text-xs">
                {data.inventory.map(unit => {
                  const isExpired = unit.days_until_expiry < 0;
                  const isCritical = unit.days_until_expiry >= 0 && unit.days_until_expiry <= 3;

                  return (
                    <tr key={unit.unit_id} className="hover:bg-[#1C1C20] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#F5F5F5]">{unit.unit_id}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 font-mono font-bold text-xs bg-[#1C1C20] text-[#FF2D3D] border border-[#7F1D2D]">
                          {unit.blood_group_display}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#F5F5F5]">{unit.component_name}</td>
                      <td className="py-2.5 px-3 text-[#A1A1AA] font-mono text-[10px]">{unit.collection_date}</td>
                      <td className="py-2.5 px-3 font-mono text-[#F5F5F5]">{unit.expiry_date}</td>
                      <td className="py-2.5 px-3">
                        {isExpired ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#1C1C20] text-[#A1A1AA] border border-[#35353B]">EXPIRED</span>
                        ) : unit.status === 'QUARANTINED' ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#350D13] text-[#FF2D3D] border border-[#FF2D3D]">QUARANTINED</span>
                        ) : isCritical ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#350D13] text-[#FF2D3D] border border-[#7F1D2D] animate-pulse">
                            EXP IN {unit.days_until_expiry}d
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#1C1C20] text-[#F5F5F5] border border-[#35353B]">
                            {unit.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#F5F5F5]">{unit.storage_temp_current}°C</td>
                      <td className="py-2.5 px-3 text-[#A1A1AA] text-[10px] font-mono">{unit.bank_id}</td>
                      <td className="py-2.5 px-3 text-right">
                        {unit.status !== 'QUARANTINED' && unit.status !== 'EXPIRED' && (
                          <button
                            onClick={() => handleQuarantineUnit(unit.unit_id)}
                            className="px-2 py-1 text-[10px] font-bold bg-[#350D13] hover:bg-[#7F1D2D] text-[#FF2D3D] border border-[#7F1D2D] transition-all uppercase"
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
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-bold text-[#F5F5F5] uppercase">Emergency Blood Component Requests & Reservations</h3>
              <p className="text-[11px] text-[#A1A1AA]">Real-time status transitions from hospital order to crossmatch locking</p>
            </div>
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="px-3 py-1.5 bg-[#FF2D3D] hover:bg-[#FF2D3D]/90 text-[#0B0B0D] text-xs font-bold flex items-center gap-1.5 uppercase"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Request</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.requests.map(order => {
              const isStat = order.urgency === 'EMERGENCY_STAT';

              return (
                <div 
                  key={order.request_id}
                  className="bg-[#141416] p-4 border border-[#35353B] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-[#A1A1AA] font-bold">{order.request_id}</span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-bold border ${
                          isStat ? 'bg-[#350D13] text-[#FF2D3D] border-[#FF2D3D]' : 'bg-[#1C1C20] text-[#A1A1AA] border-[#35353B]'
                        }`}>
                          {order.urgency}
                        </span>
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#1C1C20] text-[#F5F5F5] border border-[#35353B]">
                          {order.status}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-[#F5F5F5] mt-1 uppercase">{order.patient_name_or_alias}</h3>
                      <p className="text-[11px] text-[#A1A1AA] italic mt-0.5">{order.clinical_indication}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-bold text-[#FF2D3D]">{order.units_requested} Units</span>
                      <span className="text-[10px] text-[#A1A1AA] block font-mono font-bold">
                        {order.requested_abo}{order.requested_rh === 'NEGATIVE' ? '-' : '+'} {order.component_type}
                      </span>
                    </div>
                  </div>

                  {/* Allocated Units */}
                  {order.allocated_unit_ids && order.allocated_unit_ids.length > 0 && (
                    <div className="bg-[#1C1C20] p-2.5 border border-[#35353B] text-xs">
                      <span className="text-[#A1A1AA] text-[9px] block uppercase font-semibold">Locked ISBT Units:</span>
                      <div className="flex flex-wrap gap-1 mt-1 font-mono text-[10px] font-bold">
                        {order.allocated_unit_ids.map((uid, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-[#141416] border border-[#7F1D2D] text-[#FF2D3D]">
                            {uid}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions based on state */}
                  <div className="flex items-center justify-between text-xs border-t border-[#35353B] pt-2.5">
                    <span className="text-[#A1A1AA] text-[10px]">TARGET: <strong className="text-[#F5F5F5]">{order.target_blood_bank_name}</strong></span>

                    <div className="flex items-center gap-1.5">
                      {order.status === 'SUBMITTED' && (
                        <button
                          onClick={() => handleAcceptRequest(order.request_id)}
                          className="px-2.5 py-1 bg-[#FF2D3D] hover:bg-[#FF2D3D]/90 text-[#0B0B0D] text-[11px] font-bold transition-all uppercase"
                        >
                          Accept & Lock Units
                        </button>
                      )}

                      {order.status === 'ACCEPTED_RESERVED' && (
                        <button
                          onClick={() => handleDispatchTransfer(order.request_id)}
                          className="px-2.5 py-1 bg-[#1C1C20] hover:bg-[#350D13] text-[#FF2D3D] border border-[#7F1D2D] text-[11px] font-bold transition-all flex items-center gap-1 uppercase"
                        >
                          <Truck className="w-3 h-3" />
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
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.transfers.map(trf => (
              <div 
                key={trf.transfer_id}
                className="bg-[#141416] p-4 border border-[#35353B] space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-[#A1A1AA] font-bold">{trf.transfer_id}</span>
                      <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#1C1C20] text-[#FF2D3D] border border-[#7F1D2D]">
                        {trf.transfer_status}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-[#F5F5F5] mt-1 uppercase">{trf.component_type} Transit</h3>
                    <p className="text-[11px] text-[#A1A1AA]">{trf.source_name} &rarr; {trf.destination_name}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#F5F5F5] flex items-center gap-1 justify-end">
                      <ThermometerSnowflake className="w-3.5 h-3.5 text-[#FF2D3D]" />
                      {trf.current_transit_temp_c}°C
                    </span>
                    <span className="text-[10px] text-[#A1A1AA] block">{trf.transport_container_id}</span>
                  </div>
                </div>

                {/* Chain of Custody Timeline */}
                <div className="bg-[#1C1C20] p-3 border border-[#35353B] space-y-1.5 text-xs">
                  <span className="text-[9px] text-[#A1A1AA] font-semibold uppercase tracking-wider block">Chain of Custody Checkpoints:</span>
                  {trf.chain_of_custody_events.map((evt, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] text-[#F5F5F5]">
                      <span>&bull; {evt.event}</span>
                      <span className="font-mono text-[#FF2D3D] font-bold">{evt.temp}</span>
                    </div>
                  ))}
                </div>

                {/* Confirm receipt */}
                <div className="border-t border-[#35353B] pt-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#A1A1AA] text-[10px]">COURIER: <strong className="text-[#F5F5F5]">{trf.courier_callsign}</strong></span>

                  {trf.transfer_status !== 'DELIVERED_RECEIVED' ? (
                    <button
                      onClick={() => handleConfirmReceipt(trf.transfer_id)}
                      className="px-3 py-1 bg-[#FF2D3D] hover:bg-[#FF2D3D]/90 text-[#0B0B0D] text-[11px] font-bold transition-all flex items-center gap-1 uppercase"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Receipt</span>
                    </button>
                  ) : (
                    <span className="text-[#FF2D3D] font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF2D3D]" />
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
        <div className="bg-[#141416] p-4 border border-[#35353B] space-y-4">
          <div className="flex items-center justify-between border-b border-[#35353B] pb-3">
            <div>
              <h3 className="text-xs font-bold text-[#F5F5F5] uppercase">Blood Bank Partner Credentialed Portal</h3>
              <p className="text-[11px] text-[#A1A1AA]">Role-isolated interface for registered blood banks to manage stock and verify releases</p>
            </div>
            <span className="px-2 py-0.5 bg-[#1C1C20] text-[#FF2D3D] text-[10px] font-bold border border-[#7F1D2D]">
              ROLE: {partnerPersona === 'BLOOD_BANK_OFFICER' ? 'Blood Bank Officer (AFTC)' : 'Hospital Clinician'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.facilities.map(fac => (
              <div key={fac.bank_id} className="bg-[#1C1C20] p-3 border border-[#35353B] space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <strong className="text-[#F5F5F5] text-xs uppercase">{fac.name}</strong>
                  <span className="font-mono text-[#A1A1AA] text-[10px]">{fac.bank_id}</span>
                </div>
                <div className="text-[11px] text-[#A1A1AA]">License: {fac.license_accreditation}</div>
                <div className="text-[11px] text-[#A1A1AA]">Director: {fac.director}</div>
                <div className="text-[11px] text-[#A1A1AA]">Contact: {fac.contact_phone}</div>
                <div className="text-[#FF2D3D] font-semibold pt-1 text-[10px]">&bull; Stock Sync Freshness: {fac.last_inventory_sync}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 10. TAB 7: INVENTORY ANALYTICS ================= */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#141416] p-3 border border-[#35353B]">
              <div className="text-[10px] text-[#A1A1AA] uppercase">Total Units Stocked</div>
              <div className="text-xl font-bold text-[#F5F5F5] mt-1">{data.total_available_released_units}</div>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">Across 4 verified depots</p>
            </div>

            <div className="bg-[#350D13] p-3 border border-[#7F1D2D]">
              <div className="text-[10px] text-[#FF2D3D] uppercase">O-Negative Critical Reserve</div>
              <div className="text-xl font-bold text-[#FF2D3D] mt-1">{data.total_o_negative_emergency_units}</div>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">Universal Emergency Red Cells</p>
            </div>

            <div className="bg-[#141416] p-3 border border-[#35353B]">
              <div className="text-[10px] text-[#A1A1AA] uppercase">Cold-Chain Compliance</div>
              <div className="text-xl font-bold text-[#F5F5F5] mt-1">{data.cold_chain_compliance_pct}%</div>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">Continuous logger telemetry</p>
            </div>

            <div className="bg-[#141416] p-3 border border-[#35353B]">
              <div className="text-[10px] text-[#A1A1AA] uppercase">Wastage / Expiry Rate</div>
              <div className="text-xl font-bold text-[#F5F5F5] mt-1">1.2%</div>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">FEFO rotation optimized</p>
            </div>
          </div>

          {/* Blood Group Distribution Progress Bars */}
          <div className="bg-[#141416] p-4 border border-[#35353B] space-y-3">
            <h3 className="text-xs font-bold text-[#F5F5F5] uppercase">ABO & Rh(D) Blood Group Inventory Distribution</h3>
            
            <div className="space-y-2.5">
              {[
                { group: 'O Negative (Universal Red Cell)', count: 42, max: 60, color: 'bg-[#FF2D3D]' },
                { group: 'O Positive', count: 180, max: 200, color: 'bg-[#FF2D3D]/80' },
                { group: 'A Positive', count: 120, max: 150, color: 'bg-[#A1A1AA]' },
                { group: 'A Negative', count: 25, max: 40, color: 'bg-[#7F1D2D]' },
                { group: 'B Positive', count: 110, max: 140, color: 'bg-[#A1A1AA]/80' },
                { group: 'B Negative', count: 18, max: 30, color: 'bg-[#7F1D2D]' },
                { group: 'AB Positive (Universal Plasma)', count: 28, max: 40, color: 'bg-[#FF2D3D]' },
                { group: 'AB Negative', count: 5, max: 15, color: 'bg-[#35353B]' }
              ].map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#F5F5F5] text-[11px]">{item.group}</span>
                    <span className="font-mono text-[#A1A1AA] font-bold text-[10px]">{item.count} / {item.max} units</span>
                  </div>
                  <div className="w-full bg-[#1C1C20] h-1.5 border border-[#35353B]">
                    <div 
                      className={`h-full ${item.color} transition-all`}
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
        <div className="bg-[#141416] p-4 border border-[#35353B] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-bold text-[#F5F5F5] uppercase">Immutable Chain-of-Custody & Transfusion Audit Trail</h3>
              <p className="text-[11px] text-[#A1A1AA]">Cryptographically signed logs for every request, unit reservation, dispatch, and receipt event</p>
            </div>
            <span className="px-2 py-0.5 bg-[#1C1C20] text-[#A1A1AA] text-[10px] font-mono border border-[#35353B]">
              DEMO ENVIRONMENT — SYNTHETIC CLINICAL RECORDS
            </span>
          </div>

          <div className="space-y-2">
            {data.audit_log.map(entry => (
              <div 
                key={entry.audit_id}
                className="bg-[#1C1C20] p-3 border border-[#35353B] space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#A1A1AA] font-bold">{entry.audit_id}</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#141416] text-[#FF2D3D] border border-[#7F1D2D]">
                      {entry.event_type}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#A1A1AA]">{entry.timestamp}</span>
                </div>

                <p className="text-[#F5F5F5] font-medium text-[11px]">{entry.details}</p>

                <div className="flex items-center justify-between text-[10px] text-[#A1A1AA] border-t border-[#35353B] pt-1">
                  <span>ACTOR: <strong className="text-[#F5F5F5]">{entry.actor}</strong> ({entry.facility})</span>
                  <span className="font-mono text-[9px] text-[#A1A1AA]">{entry.digital_signature_hash}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 12. EMERGENCY REQUEST MODAL ================= */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B0B0D]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#141416] p-5 max-w-lg w-full border border-[#35353B] space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#35353B] pb-2.5">
              <div className="flex items-center gap-2 text-[#FF2D3D] font-bold text-xs uppercase">
                <Droplet className="w-4 h-4 fill-current" />
                <span>Emergency Blood Component Request Form</span>
              </div>
              <button 
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1 text-[#A1A1AA] hover:text-[#F5F5F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#A1A1AA] text-[10px] font-semibold block mb-1 uppercase">Casualty / Patient:</label>
                  <input
                    type="text"
                    value={reqPatientAlias}
                    onChange={(e) => setReqPatientAlias(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
                  />
                </div>
                <div>
                  <label className="text-[#A1A1AA] text-[10px] font-semibold block mb-1 uppercase">Component Needed:</label>
                  <select
                    value={reqComponent}
                    onChange={(e) => setReqComponent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
                  >
                    <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                    <option value="WHOLE_BLOOD">Whole Blood (Low Titer O-Neg)</option>
                    <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                    <option value="PLATELETS">Platelets (SDP)</option>
                    <option value="CRYOPRECIPITATE">Cryoprecipitate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[#A1A1AA] text-[10px] font-semibold block mb-1 uppercase">ABO Group:</label>
                  <select
                    value={reqAbo}
                    onChange={(e) => setReqAbo(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs font-mono font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
                  >
                    <option value="O">O</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#A1A1AA] text-[10px] font-semibold block mb-1 uppercase">Rh(D):</label>
                  <select
                    value={reqRh}
                    onChange={(e) => setReqRh(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs font-mono font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
                  >
                    <option value="NEGATIVE">Negative (-)</option>
                    <option value="POSITIVE">Positive (+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#A1A1AA] text-[10px] font-semibold block mb-1 uppercase">Units (Units):</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={reqUnits}
                    onChange={(e) => setReqUnits(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs font-mono font-bold text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#A1A1AA] text-[10px] font-semibold block mb-1 uppercase">Target Facility:</label>
                <select
                  value={reqTargetBank}
                  onChange={(e) => setReqTargetBank(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
                >
                  {data.facilities.map(f => (
                    <option key={f.bank_id} value={f.bank_id}>{f.name} ({f.distance_km} km)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#A1A1AA] text-[10px] font-semibold block mb-1 uppercase">Clinical Indication:</label>
                <textarea
                  rows="2"
                  value={reqIndication}
                  onChange={(e) => setReqIndication(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#1C1C20] border border-[#35353B] text-xs text-[#F5F5F5] focus:outline-none focus:border-[#FF2D3D]"
                />
              </div>

              <div className="p-2.5 bg-[#350D13] border border-[#7F1D2D] text-[10px] text-[#A1A1AA] leading-relaxed">
                <strong className="text-[#FF2D3D]">Mandatory Safety Acknowledgment:</strong> Compatibility testing samples will be verified with receiving blood bank, and 2-person bedside identification will precede component administration.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#35353B]">
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="flex-1 py-2 border border-[#35353B] text-[#A1A1AA] font-bold text-xs hover:bg-[#1C1C20] uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRequest}
                className="flex-1 py-2 bg-[#FF2D3D] hover:bg-[#FF2D3D]/90 text-[#0B0B0D] font-bold text-xs uppercase"
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
