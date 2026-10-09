import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, Navigation, Radio, Layers, Truck, Building2, 
  Clock, AlertTriangle, CheckCircle2, Compass, ShieldAlert, 
  ArrowRight, Route, RefreshCw, Wifi, WifiOff, Copy, Check, 
  Activity, ExternalLink, ChevronRight, Fuel, UserCheck, Flame
} from 'lucide-react';

export default function TriageMap({ 
  patients = [], 
  selectedPatientId, 
  onSelectPatient,
  dispatchData,
  onDispatchAction,
  onOpenChart
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef({});
  const circleRef = useRef({});

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC6AaQ9mU-hfC7aLE-G1mXoiBixf-UG1-s';
  const [mapType, setMapType] = useState('google-hybrid'); // 'google-hybrid' | 'google-roads' | 'tactical-dark'
  const [activeViewMode, setActiveViewMode] = useState('split'); // 'split' | 'map-only' | 'fleet-deck'
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState('MEDEVAC-01');
  const [copiedScript, setCopiedScript] = useState(false);
  const [manualGridInput, setManualGridInput] = useState('43R EK 284 195');
  const [actionLoading, setActionLoading] = useState(false);

  // Fallback state if dispatchData not yet loaded
  const data = dispatchData || {
    system_status: "OPERATIONAL",
    gps_satellite_lock: "LOCK_OPTIMAL",
    fallback_protocol_enabled: false,
    ambulances: [
      {
        unit_id: "MEDEVAC-01",
        callsign: "Medic-1 (ALS)",
        type: "ALS",
        status: "TRANSPORTING",
        gps_lat: 28.6150,
        gps_lng: 77.2100,
        heading_deg: 35.0,
        speed_kmh: 54.0,
        crew: "Paramedic Sharma, EMT Nair",
        equipment: ["Transport Vent", "Defibrillator", "TXA", "Whole Blood"],
        assigned_patient_id: "PT-101",
        assigned_hospital_id: "FST-ALPHA",
        battery_or_fuel_pct: 88,
        gps_quality: "HIGH"
      },
      {
        unit_id: "MEDEVAC-02",
        callsign: "Rescue-2 (CCT)",
        type: "CCT",
        status: "DISPATCHED",
        gps_lat: 28.6220,
        gps_lng: 77.2140,
        heading_deg: 110.0,
        speed_kmh: 42.0,
        crew: "Flight Nurse Roy, Paramedic Das",
        equipment: ["Dual IV Pumps", "ECMO Standby", "Burn Debridement Kit"],
        assigned_patient_id: "PT-204",
        assigned_hospital_id: "BASE-HOSP-03",
        battery_or_fuel_pct: 95,
        gps_quality: "HIGH"
      },
      {
        unit_id: "MEDEVAC-03",
        callsign: "Rough-3 (Austere)",
        type: "TACTICAL_4X4",
        status: "AVAILABLE",
        gps_lat: 28.6080,
        gps_lng: 77.2020,
        heading_deg: 0.0,
        speed_kmh: 0.0,
        crew: "Combat Medic Sgt. Khan, Driver Cpl. Joshi",
        equipment: ["MARCH Trauma Kit", "Litter Bracket", "O2 Concentrator"],
        assigned_patient_id: null,
        assigned_hospital_id: null,
        battery_or_fuel_pct: 91,
        gps_quality: "HIGH"
      },
      {
        unit_id: "MEDEVAC-04",
        callsign: "Rapid-4 (BLS)",
        type: "BLS",
        status: "AVAILABLE",
        gps_lat: 28.6320,
        gps_lng: 77.2180,
        heading_deg: 0.0,
        speed_kmh: 0.0,
        crew: "EMT Wilson, EMT Kapoor",
        equipment: ["AED", "Splinting Set", "O2 Therapy"],
        assigned_patient_id: null,
        assigned_hospital_id: null,
        battery_or_fuel_pct: 100,
        gps_quality: "HIGH"
      }
    ],
    hospitals: [
      {
        hospital_id: "FST-ALPHA",
        name: "Forward Surgical Team Alpha (FST-A)",
        gps_lat: 28.6139,
        gps_lng: 77.2090,
        trauma_level: "LEVEL_1",
        icu_beds_free: 2,
        trauma_bays_free: 1,
        total_occupancy_pct: 76.4,
        accepting_status: "ACCEPTING_ALL",
        distance_km: 2.1,
        travel_time_mins: 6,
        delay_factor_mins: 0,
        specialties: ["Damage Control Resus", "Vascular Shunt", "Whole Blood"],
        recommendation_tier: "RECOMMENDED",
        logistics_rationale: "Fastest transit time (<7m) with immediate damage control surgical bay free."
      },
      {
        hospital_id: "BASE-HOSP-03",
        name: "Base General Hospital 3 (Apex Trauma)",
        gps_lat: 28.6380,
        gps_lng: 77.2250,
        trauma_level: "LEVEL_1",
        icu_beds_free: 9,
        trauma_bays_free: 4,
        total_occupancy_pct: 54.0,
        accepting_status: "ACCEPTING_ALL",
        distance_km: 4.8,
        travel_time_mins: 12,
        delay_factor_mins: 0,
        specialties: ["Comprehensive Neurosurgery", "Burn ICU", "Orthopedic Reconstruction"],
        recommendation_tier: "RECOMMENDED",
        logistics_rationale: "Optimal ICU capacity buffer (9 open beds) and specialized burn & trauma center."
      },
      {
        hospital_id: "CIVIL-ZONE-B",
        name: "Cantonment Field Infirmary (Zone Bravo)",
        gps_lat: 28.5950,
        gps_lng: 77.1850,
        trauma_level: "LEVEL_2",
        icu_beds_free: 0,
        trauma_bays_free: 1,
        total_occupancy_pct: 91.5,
        accepting_status: "DIVERT_OVERCAPACITY",
        distance_km: 6.9,
        travel_time_mins: 19,
        delay_factor_mins: 0,
        specialties: ["Basic Resuscitation", "Holding Ward"],
        recommendation_tier: "DIVERT",
        logistics_rationale: "ICU bed capacity exhausted (0 available). Advisory recommends divert to FST-Alpha or Base-3."
      }
    ],
    missions: [
      {
        mission_id: "MSN-2026-081",
        ambulance_id: "MEDEVAC-01",
        patient_id: "PT-101",
        patient_name: "Sgt. Marcus Vance",
        clinical_urgency: "IMMEDIATE_RED",
        recommended_hospital_id: "FST-ALPHA",
        assigned_hospital_id: "FST-ALPHA",
        stage: "TRANSPORTING",
        milestones: {
          dispatched_at: "10:41",
          en_route_at: "10:43",
          on_scene_at: "10:48",
          patient_loaded_at: "10:53",
          hospital_arrived_at: "ETA 11:02"
        },
        route: {
          route_name: "Central Tactical Corridor NH-44",
          status: "NOMINAL",
          estimated_arrival_eta_mins: 7,
          delay_added_mins: 0,
          waypoints: [[28.6189, 77.2050], [28.6170, 77.2075], [28.6150, 77.2100], [28.6139, 77.2090]]
        },
        fallback_active: false,
        routing_advisory: "LOGISTICS ROUTING: Route clear on NH-44. Transit to FST-Alpha optimal due to rapid proximity (<7m) and available emergency resuscitation bay. Clinical urgency handled independently by tactical triage protocol."
      },
      {
        mission_id: "MSN-2026-082",
        ambulance_id: "MEDEVAC-02",
        patient_id: "PT-204",
        patient_name: "Cpl. David Chen",
        clinical_urgency: "DELAYED_YELLOW",
        recommended_hospital_id: "BASE-HOSP-03",
        assigned_hospital_id: "BASE-HOSP-03",
        stage: "DISPATCHED",
        milestones: {
          dispatched_at: "10:52",
          en_route_at: "10:54",
          on_scene_at: "ETA 11:03",
          patient_loaded_at: null,
          hospital_arrived_at: "ETA 11:22"
        },
        route: {
          route_name: "North Ring Express",
          status: "DELAYED_CONGESTION",
          estimated_arrival_eta_mins: 18,
          delay_added_mins: 5,
          route_change_reason: "Congestion at Northern Junction 3 — Rerouted via Ring Expressway (+5 mins)",
          waypoints: [[28.6320, 77.2180], [28.6270, 77.2160], [28.6220, 77.2140], [28.6250, 77.2180], [28.6380, 77.2250]]
        },
        fallback_active: false,
        routing_advisory: "LOGISTICS ROUTING: Base Hospital 3 selected for specialized burn care capability and 9 free ICU beds despite +5m traffic detour. Priority routing approved on express perimeter."
      }
    ]
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.6189, 77.2150],
        zoom: 14,
        zoomControl: true,
        attributionControl: false
      });

      mapInstanceRef.current = map;
    }
  }, []);

  // Update Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

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
      options = { maxZoom: 19, subdomains: 'abcd' };
    }

    tileLayerRef.current = L.tileLayer(tileUrl, options).addTo(map);
  }, [mapType, apiKey]);

  // Update Markers, Polylines, Dead-Reckoning Circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    // Clean old polylines
    Object.values(polylineRef.current).forEach(p => p.remove());
    polylineRef.current = {};

    // Clean old circles
    Object.values(circleRef.current).forEach(c => c.remove());
    circleRef.current = {};

    // 1. Render Patient Markers
    patients.forEach(item => {
      const p = item.capsule;
      const lat = p.gps?.lat || 28.6189;
      const lng = p.gps?.lng || 77.2150;
      const badge = item.triage_badge || 'YELLOW';
      const isSelected = p.patient_id === selectedPatientId;

      const colorMap = {
        RED: '#ef4444',
        YELLOW: '#f59e0b',
        GREEN: '#10b981',
        BLACK: '#6b7280'
      };
      const pinColor = colorMap[badge] || '#f59e0b';

      const iconHtml = `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; width: ${isSelected ? '38px' : '28px'}; height: ${isSelected ? '38px' : '28px'}; border-radius: 50%; background: ${pinColor}; opacity: ${isSelected ? '0.5' : '0.25'}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: ${isSelected ? '26px' : '22px'}; height: ${isSelected ? '26px' : '22px'}; border-radius: 50%; background: #0b1328; border: 2px solid ${pinColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 ${isSelected ? '14px' : '8px'} ${pinColor};">
            <span style="font-size: 9px; font-weight: 800; color: ${pinColor}; font-family: monospace;">${badge[0]}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-triage-pin',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; font-size: 12px; min-width: 200px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: #0f172a; font-size: 13px;">${p.patient_id}</strong>
            <span style="background: ${pinColor}20; color: ${pinColor}; border: 1px solid ${pinColor}50; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 800;">
              ${badge}
            </span>
          </div>
          <div style="font-weight: 600; color: #334155; margin-bottom: 4px;">${p.patient_name || 'Field Patient'}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
            Vitals: HR <strong>${p.vitals?.heart_rate || '--'}</strong> &bull; SpO2 <strong>${p.vitals?.spo2 || '--'}%</strong>
          </div>
          <div style="font-size: 11px; color: #3b82f6; font-weight: 600;">Click to select in CAD deck</div>
        </div>
      `);

      marker.on('click', () => {
        if (onSelectPatient) onSelectPatient(p.patient_id);
      });

      markersRef.current[`patient_${p.patient_id}`] = marker;
    });

    // 2. Render Receiving Hospital Markers
    data.hospitals.forEach(hosp => {
      const isFull = hosp.icu_beds_free === 0;
      const hospBg = isFull ? '#ef4444' : '#2563eb';

      const hospHtml = `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 10px; background: ${hospBg}; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; color: white;">
            <span style="font-size: 14px; font-weight: 900; line-height: 1;">+</span>
            <span style="font-size: 8px; font-weight: 700; line-height: 1; letter-spacing: -0.5px;">${hosp.icu_beds_free} ICU</span>
          </div>
        </div>
      `;

      const hospIcon = L.divIcon({
        html: hospHtml,
        className: 'custom-hosp-pin',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([hosp.gps_lat, hosp.gps_lng], { icon: hospIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; font-size: 12px; min-width: 220px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: #0f172a; font-size: 12px;">${hosp.name}</strong>
            <span style="background: ${isFull ? '#fee2e2' : '#dbeafe'}; color: ${isFull ? '#b91c1c' : '#1d4ed8'}; padding: 1px 6px; border-radius: 999px; font-size: 9px; font-weight: 800;">
              ${hosp.trauma_level}
            </span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
            Distance: <strong>${hosp.distance_km} km</strong> &bull; Travel Time: <strong>${hosp.travel_time_mins} min</strong>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; font-size: 11px; margin-bottom: 6px;">
            <div>ICU Beds Free: <strong style="color: ${isFull ? '#ef4444' : '#16a34a'};">${hosp.icu_beds_free}</strong></div>
            <div>Trauma Bays Free: <strong>${hosp.trauma_bays_free}</strong></div>
            <div>Total Load: <strong>${hosp.total_occupancy_pct}%</strong></div>
          </div>
          <div style="font-size: 10px; color: #64748b; font-style: italic;">
            Logistics: ${hosp.logistics_rationale}
          </div>
        </div>
      `);

      markersRef.current[`hospital_${hosp.hospital_id}`] = marker;
    });

    // 3. Render Ambulances with live heading and siren beacon
    data.ambulances.forEach(amb => {
      const isSelected = amb.unit_id === selectedAmbulanceId;
      const isFallback = amb.gps_quality === 'LOST_DEAD_RECKONING';
      const ambColor = isFallback ? '#f59e0b' : amb.status === 'TRANSPORTING' ? '#ef4444' : amb.status === 'DISPATCHED' ? '#3b82f6' : '#10b981';

      const ambHtml = `
        <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <!-- Siren Flash Beacon -->
          <div style="position: absolute; width: ${isSelected ? '44px' : '34px'}; height: ${isSelected ? '44px' : '34px'}; border-radius: 50%; background: ${ambColor}; opacity: ${isFallback ? '0.6' : '0.35'}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          
          <!-- Vehicle Hull -->
          <div style="position: absolute; width: 30px; height: 30px; border-radius: 8px; background: #0f172a; border: 2px solid ${ambColor}; box-shadow: 0 4px 14px rgba(0,0,0,0.4); display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(${amb.heading_deg || 0}deg);">
            <span style="font-size: 13px;">🚑</span>
          </div>

          <!-- Callsign Tag -->
          <div style="position: absolute; top: -14px; background: #0f172a; color: #ffffff; border: 1px solid ${ambColor}; border-radius: 4px; padding: 0 4px; font-size: 8px; font-weight: 800; font-family: monospace; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            ${amb.callsign.split(' ')[0]}
          </div>
        </div>
      `;

      const ambIcon = L.divIcon({
        html: ambHtml,
        className: 'custom-amb-pin',
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([amb.gps_lat, amb.gps_lng], { icon: ambIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; font-size: 12px; min-width: 220px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: #0f172a; font-size: 13px;">${amb.callsign}</strong>
            <span style="background: ${ambColor}20; color: ${ambColor}; padding: 1px 6px; border-radius: 999px; font-size: 9px; font-weight: 800;">
              ${amb.status}
            </span>
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Crew: <strong>${amb.crew}</strong></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 11px; margin-bottom: 6px;">
            <div>Speed: <strong>${amb.speed_kmh} km/h</strong></div>
            <div>Fuel/Bat: <strong>${amb.battery_or_fuel_pct}%</strong></div>
            <div>GPS: <strong style="color: ${isFallback ? '#d97706' : '#16a34a'};">${amb.gps_quality}</strong></div>
            <div>Assigned: <strong>${amb.assigned_patient_id || 'None'}</strong></div>
          </div>
          <div style="font-size: 10px; color: #94a3b8;">Equipment: ${amb.equipment.join(', ')}</div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedAmbulanceId(amb.unit_id);
      });

      markersRef.current[`amb_${amb.unit_id}`] = marker;

      // 4. Dead Reckoning Circle when GPS is lost
      if (isFallback) {
        const circle = L.circle([amb.gps_lat, amb.gps_lng], {
          radius: 350,
          color: '#f59e0b',
          weight: 2,
          dashArray: '6, 6',
          fillColor: '#fef3c7',
          fillOpacity: 0.25
        }).addTo(map);
        circleRef.current[`dr_${amb.unit_id}`] = circle;
      }
    });

    // 5. Render Mission Route Polylines
    data.missions.forEach(mission => {
      if (mission.route && mission.route.waypoints && mission.route.waypoints.length >= 2) {
        const isDelayed = mission.route.status === 'DELAYED_CONGESTION' || mission.route.status === 'DETOUR_APPLIED';
        const routeColor = isDelayed ? '#f59e0b' : '#3b82f6';

        const poly = L.polyline(mission.route.waypoints, {
          color: routeColor,
          weight: 4,
          opacity: 0.85,
          dashArray: isDelayed ? '8, 8' : undefined
        }).addTo(map);

        poly.bindPopup(`
          <div style="font-family: -apple-system, sans-serif; font-size: 12px; padding: 4px;">
            <strong>${mission.route.route_name}</strong>
            <div style="color: ${isDelayed ? '#d97706' : '#16a34a'}; font-weight: 700; margin-top: 2px;">
              ${mission.route.status} &bull; ETA ${mission.route.estimated_arrival_eta_mins} mins
            </div>
            ${mission.route.route_change_reason ? `<div style="font-size: 11px; color: #ef4444; margin-top: 4px;">${mission.route.route_change_reason}</div>` : ''}
          </div>
        `);

        polylineRef.current[`mission_${mission.mission_id}`] = poly;
      }
    });

  }, [patients, selectedPatientId, data, selectedAmbulanceId, onSelectPatient]);

  // Handler functions
  const handleToggleFallback = async () => {
    if (!onDispatchAction) return;
    setActionLoading(true);
    try {
      await onDispatchAction({
        action: 'TOGGLE_FALLBACK',
        fallback_enabled: !data.fallback_protocol_enabled
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceMilestone = async (mission) => {
    if (!onDispatchAction) return;
    setActionLoading(true);
    const stageFlow = {
      DISPATCHED: 'ON_SCENE',
      ON_SCENE: 'TRANSPORTING',
      TRANSPORTING: 'ARRIVED',
      ARRIVED: 'AVAILABLE'
    };
    const next = stageFlow[mission.stage] || 'ARRIVED';
    try {
      await onDispatchAction({
        action: 'UPDATE_MILESTONE',
        mission_id: mission.mission_id,
        next_stage: next
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInjectDelay = async (mission) => {
    if (!onDispatchAction) return;
    setActionLoading(true);
    try {
      await onDispatchAction({
        action: 'INJECT_ROUTE_DELAY',
        mission_id: mission.mission_id,
        delay_minutes: 6,
        route_change_reason: "Congestion on main artery — Detour via Ring Expressway applied (+6 min)"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignHospital = async (mission, hospitalId) => {
    if (!onDispatchAction) return;
    setActionLoading(true);
    try {
      await onDispatchAction({
        action: 'ASSIGN_DISPATCH',
        ambulance_id: mission.ambulance_id,
        patient_id: mission.patient_id,
        hospital_id: hospitalId
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMGRS = async (mission) => {
    if (!onDispatchAction) return;
    setActionLoading(true);
    try {
      await onDispatchAction({
        action: 'UPDATE_MGRS',
        mission_id: mission.mission_id,
        mgrs_grid: manualGridInput
      });
    } finally {
      setActionLoading(false);
    }
  };

  const copyVhfScript = (mission) => {
    const amb = data.ambulances.find(a => a.unit_id === mission.ambulance_id);
    const hosp = data.hospitals.find(h => h.hospital_id === mission.assigned_hospital_id);
    const script = `DISPATCH-1 TO ${amb?.callsign || 'UNIT'}: GPS BLACKOUT ACTIVE IN SECTOR. PROCEED VIA MGRS GRID ${manualGridInput}. DESTINATION: ${hosp?.name || 'FIELD SURGICAL TEAM'}. ESTIMATED TRANSIT: ${mission.route?.estimated_arrival_eta_mins || 15} MINS. ACKNOWLEDGE VIA VHF FREQ 142.85. OVER.`;
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const activeAmbulance = data.ambulances.find(a => a.unit_id === selectedAmbulanceId) || data.ambulances[0];
  const activeMission = data.missions.find(m => m.ambulance_id === selectedAmbulanceId) || data.missions[0];

  return (
    <div className="space-y-4">

      {/* ================= TOP OPERATIONAL CAD CONTROL BAR ================= */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Section Title & Real-Time Status */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 m-0 tracking-tight">
                Ambulance Coordination & GPS Intelligence
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                data.fallback_protocol_enabled
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {data.fallback_protocol_enabled ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 animate-pulse text-amber-600" />
                    <span>AUSTERE DEAD-RECKONING (MGRS)</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    <span>GPS LOCK: OPTIMAL (14 SVs)</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 m-0">
              Fleet Tracking &bull; Receiving Hospital Capacity Router &bull; Operational CAD Dispatch Console
            </p>
          </div>
        </div>

        {/* Right Controls: View Mode & Fallback Simulator */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* View Mode Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveViewMode('split')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeViewMode === 'split' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Split CAD View
            </button>
            <button
              onClick={() => setActiveViewMode('map-only')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeViewMode === 'map-only' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Expanded Map
            </button>
            <button
              onClick={() => setActiveViewMode('fleet-deck')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeViewMode === 'fleet-deck' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Fleet & Hospital Deck
            </button>
          </div>

          {/* GPS Fallback Toggle Button */}
          <button
            onClick={handleToggleFallback}
            disabled={actionLoading}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-xs ${
              data.fallback_protocol_enabled
                ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
            title="Simulate loss of GPS signal and trigger dead-reckoning / MGRS fallback workflow"
          >
            <Compass className={`w-3.5 h-3.5 ${data.fallback_protocol_enabled ? 'animate-spin' : ''}`} />
            <span>{data.fallback_protocol_enabled ? 'Restore Normal GPS' : 'Simulate GPS Blackout'}</span>
          </button>
        </div>
      </div>

      {/* ================= DISTINCT LOGISTICS ADVISORY BANNER ================= */}
      <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 px-4 flex items-center justify-between gap-3 text-xs text-blue-900 shadow-xs">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <strong className="font-bold">Logistics & Routing Advisory:</strong>
            <span className="text-blue-800 ml-1">
              Hospital routing recommendations are calculated independently from road distance, traffic impedance, and receiving bed capacity. Clinical triage decisions remain autonomous under attending medical officers.
            </span>
          </div>
        </div>
        <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold border border-blue-300">
          INDEPENDENT OF TRIAGE
        </span>
      </div>

      {/* ================= MAIN SPLIT OR EXPANDED WORKSPACE ================= */}
      <div className={`grid gap-4 ${
        activeViewMode === 'split' 
          ? 'grid-cols-1 lg:grid-cols-12' 
          : activeViewMode === 'map-only' 
          ? 'grid-cols-1' 
          : 'hidden'
      }`}>

        {/* ================= LEFT / TOP: INTERACTIVE LEAFLET DISPATCH MAP ================= */}
        <div className={`rounded-3xl overflow-hidden border border-slate-200 shadow-lg relative bg-[#0b1328] ${
          activeViewMode === 'split' ? 'lg:col-span-7 h-[680px]' : 'h-[780px]'
        }`}>
          
          {/* Map Top Floating Overlay HUD */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#080d1c]/90 border border-[#1b284a] backdrop-blur-md text-xs shadow-lg">
            <span className={`w-2 h-2 rounded-full ${data.fallback_protocol_enabled ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-slate-200 font-semibold tracking-wide">
              {data.fallback_protocol_enabled ? 'DEAD-RECKONING RADAR ACTIVE' : 'TACTICAL GPS RADAR'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 font-mono">
              {data.ambulances.length} Units &bull; {data.hospitals.length} Receiving Facilities
            </span>
          </div>

          {/* Map Tile Layer Switcher */}
          <div className="absolute top-3 right-3 z-[400] flex items-center gap-1 bg-[#080d1c]/90 border border-[#1b284a] rounded-xl p-1 backdrop-blur-md text-xs shadow-md">
            <button
              onClick={() => setMapType('google-hybrid')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-semibold ${
                mapType === 'google-hybrid' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🛰️ Satellite
            </button>
            <button
              onClick={() => setMapType('google-roads')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-semibold ${
                mapType === 'google-roads' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🗺️ Roads
            </button>
            <button
              onClick={() => setMapType('tactical-dark')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-semibold ${
                mapType === 'tactical-dark' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🌌 Tactical
            </button>
          </div>

          {/* Map Bottom HUD Pill: Active Corridor */}
          {activeMission && (
            <div className="absolute bottom-4 left-4 right-4 z-[400] bg-[#0b1328]/90 border border-slate-700/80 backdrop-blur-md rounded-2xl p-3 px-4 flex items-center justify-between gap-3 text-xs text-slate-200 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Route className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {activeMission.route?.route_name || 'En Route Corridor'}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>ETA: <strong className="text-sky-400">{activeMission.route?.estimated_arrival_eta_mins} mins</strong></span>
                    <span>&bull;</span>
                    <span className={activeMission.route?.status === 'NOMINAL' ? 'text-emerald-400' : 'text-amber-400'}>
                      {activeMission.route?.status}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleInjectDelay(activeMission)}
                disabled={actionLoading}
                className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate Detour (+6m)</span>
              </button>
            </div>
          )}

          {/* Leaflet Mount Node */}
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* ================= RIGHT: CAD DISPATCH CONTROL CONSOLE ================= */}
        {activeViewMode === 'split' && (
          <div className="lg:col-span-5 space-y-4 max-h-[680px] overflow-y-auto pr-1">

            {/* --- CARD 1: ACTIVE MISSION MILESTONE TRACKER --- */}
            {activeMission ? (
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-4">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-mono text-[10px] text-slate-400 block font-bold">ACTIVE CAD MISSION</span>
                    <h3 className="text-sm font-bold text-slate-800 m-0">
                      {activeMission.mission_id} &bull; {activeMission.patient_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      activeMission.clinical_urgency === 'IMMEDIATE_RED' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {activeMission.clinical_urgency.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => onOpenChart && onOpenChart(activeMission.patient_id)}
                      className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-0.5"
                    >
                      Chart <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Assigned Ambulance and Destination */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Unit Assigned</span>
                    <strong className="text-slate-700 font-bold">{activeAmbulance.callsign}</strong>
                    <span className="text-[10px] text-slate-500 block">{activeAmbulance.type}</span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-blue-50/60 border border-blue-100">
                    <span className="text-[10px] text-blue-500 block">Target Hospital</span>
                    <strong className="text-blue-900 font-bold">
                      {data.hospitals.find(h => h.hospital_id === activeMission.assigned_hospital_id)?.name || 'Field Team'}
                    </strong>
                    <span className="text-[10px] text-blue-600 block">ETA: {activeMission.route?.estimated_arrival_eta_mins} mins</span>
                  </div>
                </div>

                {/* 5-Step Milestone Timeline Progress */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Dispatch Milestones & Timestamps
                  </span>

                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-3 text-xs">
                    
                    {/* Milestone 1: Dispatched */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[8px] font-bold">✓</div>
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-700">1. Unit Dispatched</strong>
                        <span className="font-mono text-[11px] text-slate-500">{activeMission.milestones.dispatched_at || '--:--'}</span>
                      </div>
                    </div>

                    {/* Milestone 2: En Route */}
                    <div className="relative">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold ${
                        activeMission.milestones.en_route_at ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}>
                        {activeMission.milestones.en_route_at ? '✓' : '2'}
                      </div>
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-700">2. En Route to Scene</strong>
                        <span className="font-mono text-[11px] text-slate-500">{activeMission.milestones.en_route_at || '--:--'}</span>
                      </div>
                    </div>

                    {/* Milestone 3: On Scene */}
                    <div className="relative">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold ${
                        activeMission.milestones.on_scene_at ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}>
                        {activeMission.milestones.on_scene_at ? '✓' : '3'}
                      </div>
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-700">3. On Scene with Patient</strong>
                        <span className="font-mono text-[11px] text-slate-500">{activeMission.milestones.on_scene_at || 'Pending'}</span>
                      </div>
                    </div>

                    {/* Milestone 4: Patient Loaded */}
                    <div className="relative">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold ${
                        activeMission.milestones.patient_loaded_at ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}>
                        {activeMission.milestones.patient_loaded_at ? '✓' : '4'}
                      </div>
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-700">4. Patient Loaded & In Transit</strong>
                        <span className="font-mono text-[11px] text-slate-500">{activeMission.milestones.patient_loaded_at || 'Pending'}</span>
                      </div>
                    </div>

                    {/* Milestone 5: Hospital Arrival */}
                    <div className="relative">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold ${
                        activeMission.milestones.hospital_arrived_at?.startsWith('ETA') ? 'bg-blue-500' : activeMission.milestones.hospital_arrived_at ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}>
                        {activeMission.milestones.hospital_arrived_at?.startsWith('ETA') ? '•' : activeMission.milestones.hospital_arrived_at ? '✓' : '5'}
                      </div>
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-700">5. Receiving Hospital Arrival</strong>
                        <span className="font-mono text-[11px] font-bold text-blue-600">{activeMission.milestones.hospital_arrived_at || 'ETA 11:15'}</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Milestone Advance Action Button */}
                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => handleAdvanceMilestone(activeMission)}
                    disabled={actionLoading}
                    className="flex-1 py-2 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Advance Mission Stage ({activeMission.stage})</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 border border-slate-100 text-center text-slate-400 text-xs">
                No active CAD missions. Select an ambulance to begin dispatch.
              </div>
            )}

            {/* --- CARD 2: RECEIVING HOSPITAL CAPACITY SUGGESTIONS --- */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 m-0">
                    Suggested Receiving Hospitals
                  </h4>
                  <p className="text-[10px] text-slate-400 m-0">Ranked by transit time & real-time ICU/resus bay capacity</p>
                </div>
                <span className="text-[10px] font-mono text-slate-500">Live Load</span>
              </div>

              <div className="space-y-2">
                {data.hospitals.map(hosp => {
                  const isAssigned = activeMission && activeMission.assigned_hospital_id === hosp.hospital_id;
                  const isDivert = hosp.recommendation_tier === 'DIVERT' || hosp.icu_beds_free === 0;

                  return (
                    <div 
                      key={hosp.hospital_id}
                      className={`p-3 rounded-2xl border transition-all ${
                        isAssigned 
                          ? 'bg-blue-50/70 border-blue-300 shadow-xs' 
                          : isDivert 
                          ? 'bg-rose-50/50 border-rose-200' 
                          : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-xs text-slate-800 font-bold">{hosp.name}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">({hosp.distance_km} km)</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block mt-0.5 ${
                            isDivert 
                              ? 'bg-rose-100 text-rose-700 border-rose-300' 
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            {hosp.recommendation_tier} &bull; {hosp.travel_time_mins}m Transit
                          </span>
                        </div>

                        {/* Assign Button */}
                        {activeMission && (
                          <button
                            onClick={() => handleAssignHospital(activeMission, hosp.hospital_id)}
                            disabled={isAssigned || actionLoading}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${
                              isAssigned 
                                ? 'bg-blue-600 text-white cursor-default' 
                                : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {isAssigned ? 'Assigned' : 'Select'}
                          </button>
                        )}
                      </div>

                      {/* Capacity metrics */}
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-600 bg-white/80 p-1.5 rounded-xl border border-slate-100">
                        <div>ICU Free: <strong className={hosp.icu_beds_free === 0 ? 'text-rose-600' : 'text-emerald-700'}>{hosp.icu_beds_free}</strong></div>
                        <div>Trauma Bays: <strong>{hosp.trauma_bays_free}</strong></div>
                        <div>Load: <strong>{hosp.total_occupancy_pct}%</strong></div>
                      </div>

                      <p className="text-[10px] text-slate-400 italic mt-1.5 m-0">
                        {hosp.logistics_rationale}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* --- CARD 3: AUSTERE GPS FALLBACK & RADIO SCRIPT WORKFLOW --- */}
            {data.fallback_protocol_enabled && (
              <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Compass className="w-4 h-4 text-amber-600 animate-spin" />
                  <span>Austere GPS Fallback: Dead-Reckoning & MGRS</span>
                </div>

                <p className="text-[11px] text-amber-800 m-0">
                  GPS lock is compromised. Use dead-reckoning vectors and relay manual grid coordinates to crew via tactical radio.
                </p>

                {/* Manual MGRS Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualGridInput}
                    onChange={(e) => setManualGridInput(e.target.value)}
                    placeholder="MGRS Grid (e.g. 43R EK 284 195)"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={() => activeMission && handleUpdateMGRS(activeMission)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-xs"
                  >
                    Update Grid
                  </button>
                </div>

                {/* Synthesized Voice Relay Protocol Script */}
                {activeMission && (
                  <div className="bg-white/90 p-3 rounded-2xl border border-amber-200 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 uppercase">
                      <span>Tactical Voice Relay Protocol Script</span>
                      <button
                        onClick={() => copyVhfScript(activeMission)}
                        className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1"
                      >
                        {copiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedScript ? 'Copied' : 'Copy VHF Script'}</span>
                      </button>
                    </div>

                    <div className="font-mono text-[11px] bg-slate-900 text-emerald-400 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                      "DISPATCH-1 TO {activeAmbulance.callsign}: GPS BLACKOUT CONFIRMED. REROUTE VIA MGRS {manualGridInput}. DESTINATION: {data.hospitals.find(h => h.hospital_id === activeMission.assigned_hospital_id)?.name || 'FST-A'}. ETA {activeMission.route?.estimated_arrival_eta_mins} MINS. OVER."
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ================= BOTTOM FLEET & CAPACITY DECK (Always visible in Deck mode or below Split) ================= */}
      <div className={`bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-5 ${
        activeViewMode === 'map-only' ? 'hidden' : 'block'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-800 m-0">
              Operational Fleet Roster & Real-Time Availability
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 m-0">
              Active Medevac & Critical Care ambulances with telemetry, battery levels, and telemetry lock
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filter Unit:</span>
            {data.ambulances.map(a => (
              <button
                key={a.unit_id}
                onClick={() => setSelectedAmbulanceId(a.unit_id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedAmbulanceId === a.unit_id 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {a.callsign.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Ambulance Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.ambulances.map(amb => {
            const isSelected = amb.unit_id === selectedAmbulanceId;
            const isFallback = amb.gps_quality === 'LOST_DEAD_RECKONING';
            const statusBg = amb.status === 'AVAILABLE' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : amb.status === 'TRANSPORTING' 
              ? 'bg-rose-50 text-rose-700 border-rose-200' 
              : 'bg-blue-50 text-blue-700 border-blue-200';

            return (
              <div 
                key={amb.unit_id}
                onClick={() => setSelectedAmbulanceId(amb.unit_id)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-blue-50/50 border-blue-400 ring-2 ring-blue-500/20 shadow-md' 
                    : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-sm shadow-xs">
                      🚑
                    </div>
                    <div>
                      <strong className="text-xs text-slate-800 font-bold block">{amb.callsign}</strong>
                      <span className="text-[10px] text-slate-400 block font-mono">{amb.unit_id} ({amb.type})</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBg}`}>
                    {amb.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Crew:</span>
                    <strong className="text-slate-700 truncate max-w-[130px]">{amb.crew}</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Telemetry:</span>
                    <strong className="text-slate-700">{amb.speed_kmh} km/h &bull; {amb.heading_deg}°</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">GPS Signal:</span>
                    <strong className={isFallback ? 'text-amber-600 font-bold' : 'text-emerald-600 font-semibold'}>
                      {amb.gps_quality}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Fuel / Battery:</span>
                    <strong className="text-slate-700">{amb.battery_or_fuel_pct}%</strong>
                  </div>
                </div>

                {/* Equipment Pills */}
                <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                  {amb.equipment.slice(0, 3).map((eq, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[9px] text-slate-500 font-medium">
                      {eq}
                    </span>
                  ))}
                  {amb.equipment.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-[9px] text-slate-600 font-bold">
                      +{amb.equipment.length - 3}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
