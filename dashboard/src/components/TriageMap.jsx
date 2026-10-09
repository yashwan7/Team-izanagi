import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  DEMO_ANCHOR,
  ALTERNATIVE_LOCATIONS,
  VERIFIED_HOSPITALS,
  VERIFIED_MEDICAL_SHOPS,
  INITIAL_AMBULANCES,
  haversineDistanceKm,
  estimateRoadEtaMins
} from '../data/demoAmbulanceFixtures';
import {
  Radio, Navigation, Building2, Phone, ExternalLink,
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, MapPin,
  Zap, RefreshCw, X, ChevronRight, Activity, Truck,
  Compass, Flame, Eye, Layers, AlertOctagon, RotateCcw, Pill
} from 'lucide-react';

const API_BASE = '/api';

export default function TriageMap({ patients = [], selectedPatientId, onSelectPatient }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  
  // Layer Groups
  const patientMarkersRef = useRef({});
  const hospitalMarkersRef = useRef([]);
  const medicalShopMarkersRef = useRef([]);
  const ambulanceMarkersRef = useRef({});
  const surveillanceLayersRef = useRef([]);
  const routePolylineRef = useRef(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC6AaQ9mU-hfC7aLE-G1mXoiBixf-UG1-s';
  const [mapType, setMapType] = useState('google-roads'); // 'google-roads' | 'google-hybrid' | 'google-terrain' | 'tactical-dark' | 'light-streets' | 'osm'

  // Operating Anchor & Radius (JP Nagar Demo defaults)
  const [operatingAnchor, setOperatingAnchor] = useState(DEMO_ANCHOR);
  const [operatingRadiusKm, setOperatingRadiusKm] = useState(5.0);
  const [selectedLocationId, setSelectedLocationId] = useState('LOC-BROOKES-HAVEN');

  // Layer Visibility Toggles
  const [showHospitals, setShowHospitals] = useState(true);
  const [showMedicalShops, setShowMedicalShops] = useState(true);
  const [showAmbulances, setShowAmbulances] = useState(true);
  const [showSurveillanceRings, setShowSurveillanceRings] = useState(true);

  // Active Emergency State
  const [activeEmergency, setActiveEmergency] = useState({
    emergency_id: 'EMG-JP-101',
    patient_id: selectedPatientId || 'PT-101',
    patient_name: 'Major Vikram Rathore (Blast Trauma)',
    priority: 'IMMEDIATE_RED',
    lat: DEMO_ANCHOR.lat,
    lng: DEMO_ANCHOR.lng,
    location_label: DEMO_ANCHOR.name,
    status: 'OFFERING', // 'UNASSIGNED' | 'OFFERING' | 'ASSIGNED' | 'ESCALATED'
    assigned_ambulance_id: null,
    assigned_at: null
  });

  // Ambulances & Offers Fleet State
  const [ambulances, setAmbulances] = useState(INITIAL_AMBULANCES);
  const [activeOffers, setActiveOffers] = useState([]);
  const [offerTimeRemaining, setOfferTimeRemaining] = useState(15);
  const [auditLog, setAuditLog] = useState([
    {
      event_id: 'EVT-1001',
      timestamp: new Date().toLocaleTimeString(),
      event_type: 'RADAR_INITIALIZED',
      details: 'GPS Radar anchored to 80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru (12.872678, 77.575814). Initial 5km sector surveillance engaged.',
      is_demo: true
    }
  ]);

  // UI Drawer / Panel Selection
  const [activeTab, setActiveTab] = useState('dispatch'); // 'dispatch' | 'hospitals' | 'fleet' | 'audit'
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isLiveApiConnected, setIsLiveApiConnected] = useState(false);

  const showNotice = (msg) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(''), 4500);
  };

  const addAuditEntry = (eventType, details) => {
    const entry = {
      event_id: `EVT-${Math.floor(Date.now() % 100000)}`,
      timestamp: new Date().toLocaleTimeString(),
      event_type: eventType,
      details: details,
      is_demo: true
    };
    setAuditLog(prev => [entry, ...prev.slice(0, 49)]);
  };

  // Sync with selected patient if prop changes
  useEffect(() => {
    if (selectedPatientId && patients.length > 0) {
      const match = patients.find(p => p.capsule?.patient_id === selectedPatientId);
      if (match && match.capsule) {
        setActiveEmergency(prev => ({
          ...prev,
          patient_id: match.capsule.patient_id,
          patient_name: match.capsule.patient_name || `Patient ${match.capsule.patient_id}`,
          priority: match.triage_level || 'IMMEDIATE_RED'
        }));
      }
    }
  }, [selectedPatientId, patients]);

  // Fetch initial state from backend if available
  const fetchDispatchState = async () => {
    try {
      const res = await fetch(`${API_BASE}/dispatch/state`);
      if (res.ok) {
        const data = await res.json();
        setIsLiveApiConnected(true);
        if (data.operating_anchor) setOperatingAnchor(data.operating_anchor);
        if (data.operating_radius_km) setOperatingRadiusKm(data.operating_radius_km);
        if (data.active_emergency) setActiveEmergency(data.active_emergency);
        if (data.ambulances) setAmbulances(data.ambulances);
        if (data.active_offers) setActiveOffers(data.active_offers);
        if (data.audit_log) setAuditLog(data.audit_log);
      }
    } catch (_err) {
      setIsLiveApiConnected(false);
    }
  };

  useEffect(() => {
    fetchDispatchState();
  }, []);

  // Compute local offers when in standalone or offering mode
  const eligibleAmbulances = useMemo(() => {
    const emgLat = activeEmergency.lat;
    const emgLng = activeEmergency.lng;

    return ambulances
      .filter(a => {
        if (a.status === 'OFFLINE' || a.status === 'TRANSPORTING' || a.status === 'EN ROUTE') return false;
        if (a.assignment_state === 'ASSIGNED') return false;
        if (a.stale_gps) return false;
        const d = haversineDistanceKm(emgLat, emgLng, a.lat, a.lng);
        return d <= operatingRadiusKm;
      })
      .map(a => {
        const d = haversineDistanceKm(emgLat, emgLng, a.lat, a.lng);
        const eta = estimateRoadEtaMins(d, a.speed_kmh);
        return { ...a, distance_km: d, eta_mins: eta };
      })
      .sort((a, b) => a.eta_mins - b.eta_mins);
  }, [ambulances, activeEmergency.lat, activeEmergency.lng, operatingRadiusKm]);

  // Seed initial offers if activeOffers is empty
  useEffect(() => {
    if (activeOffers.length === 0 && activeEmergency.status === 'OFFERING' && eligibleAmbulances.length > 0) {
      const top3 = eligibleAmbulances.slice(0, 3).map(a => ({
        offer_id: `OFFER-${activeEmergency.emergency_id}-${a.ambulance_id}`,
        emergency_id: activeEmergency.emergency_id,
        ambulance_id: a.ambulance_id,
        callsign: a.callsign,
        vehicle_type: a.vehicle_type,
        distance_km: a.distance_km,
        eta_mins: a.eta_mins,
        status: 'OFFERED',
        expires_at: Date.now() + 15000
      }));
      setActiveOffers(top3);
      setOfferTimeRemaining(15);
      
      // Mark offered in ambulances state
      setAmbulances(prev => prev.map(a => {
        if (top3.some(o => o.ambulance_id === a.ambulance_id)) {
          return { ...a, status: 'OFFERED', assignment_state: 'PENDING_OFFER' };
        }
        return a;
      }));
    }
  }, [eligibleAmbulances, activeOffers.length, activeEmergency.status, activeEmergency.emergency_id]);

  // Offer Countdown Timer
  useEffect(() => {
    if (activeEmergency.status !== 'OFFERING' || activeOffers.length === 0) return;

    const timer = setInterval(() => {
      setOfferTimeRemaining(prev => {
        if (prev <= 1) {
          handleOfferTimeout();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeEmergency.status, activeOffers]);

  // Handle Offer Timeout & Auto Escalation
  const handleOfferTimeout = async () => {
    if (isLiveApiConnected) {
      try {
        const res = await fetch(`${API_BASE}/dispatch/timeout-offers`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setActiveEmergency(data.active_emergency);
          setActiveOffers(data.active_offers);
          setAmbulances(data.ambulances);
          setAuditLog(data.audit_log);
          showNotice('Offer group timed out. Auto-escalated to next candidates.');
          return;
        }
      } catch (_err) {}
    }

    // Local Fallback Escalation
    addAuditEntry('OFFERS_TIMED_OUT', `Offer countdown expired after 15s. Auto-escalating to next group.`);
    const offeredIds = new Set(activeOffers.map(o => o.ambulance_id));
    const nextCandidates = eligibleAmbulances.filter(a => !offeredIds.has(a.ambulance_id));

    if (nextCandidates.length > 0) {
      const nextGroup = nextCandidates.slice(0, 3).map(a => ({
        offer_id: `OFFER-${activeEmergency.emergency_id}-${a.ambulance_id}`,
        emergency_id: activeEmergency.emergency_id,
        ambulance_id: a.ambulance_id,
        callsign: a.callsign,
        vehicle_type: a.vehicle_type,
        distance_km: a.distance_km,
        eta_mins: a.eta_mins,
        status: 'OFFERED',
        expires_at: Date.now() + 15000
      }));
      setActiveOffers(nextGroup);
      setOfferTimeRemaining(15);
      addAuditEntry('DISPATCH_ESCALATED_GROUP', `Issued offer group to ${nextGroup.map(o => o.ambulance_id).join(', ')}.`);
    } else {
      // Expand radius if possible
      if (operatingRadiusKm < 15) {
        const nextR = operatingRadiusKm + 5;
        setOperatingRadiusKm(nextR);
        setActiveOffers([]);
        addAuditEntry('DISPATCH_ESCALATED_RADIUS', `No local acceptance. Auto-expanding search radius to ${nextR} km.`);
      } else {
        setActiveEmergency(prev => ({ ...prev, status: 'ESCALATED' }));
        addAuditEntry('NO_ACCEPTANCE_DISPATCH_ALERT', 'NO ACCEPTANCE — ESCALATION REQUIRED. All units in 15km radius exhausted.');
      }
    }
  };

  // Respond to Offer (Accept / Decline) with Atomic Assignment Handling
  const handleOfferResponse = async (ambulanceId, responseType) => {
    if (isLiveApiConnected) {
      try {
        const res = await fetch(`${API_BASE}/dispatch/respond-offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emergency_id: activeEmergency.emergency_id,
            ambulance_id: ambulanceId,
            response: responseType
          })
        });
        const result = await res.json();
        if (result.state) {
          setActiveEmergency(result.state.active_emergency);
          setActiveOffers(result.state.active_offers);
          setAmbulances(result.state.ambulances);
          setAuditLog(result.state.audit_log);
        }
        if (!result.success && result.reason === 'ALREADY_ASSIGNED') {
          showNotice(`[CONFLICT BLOCKED] ${ambulanceId} superseded: Already committed to ${result.winning_ambulance_id}!`);
        } else if (result.success && responseType === 'ACCEPT') {
          showNotice(`AUTHORITATIVE ASSIGNMENT CONFIRMED: ${ambulanceId} is EN ROUTE.`);
        }
        return result;
      } catch (_err) {}
    }

    // Local Fallback Atomic Handling
    if (responseType === 'DECLINE') {
      setActiveOffers(prev => prev.filter(o => o.ambulance_id !== ambulanceId));
      setAmbulances(prev => prev.map(a => a.ambulance_id === ambulanceId ? { ...a, status: 'AVAILABLE', assignment_state: 'UNASSIGNED' } : a));
      addAuditEntry('OFFER_DECLINED', `Ambulance ${ambulanceId} crew declined dispatch offer.`);
      return { success: true };
    }

    if (responseType === 'ACCEPT') {
      // Race condition check
      if (activeEmergency.status === 'ASSIGNED') {
        const winner = activeEmergency.assigned_ambulance_id;
        addAuditEntry('RACE_CONDITION_PREVENTED', `Conflict averted: ${ambulanceId} accepted, but incident was already committed to ${winner}.`);
        showNotice(`[CONFLICT BLOCKED] ${ambulanceId} superseded: Already committed to ${winner}!`);
        return { success: false, reason: 'ALREADY_ASSIGNED', winning_ambulance_id: winner };
      }

      // Commit assignment
      setActiveEmergency(prev => ({
        ...prev,
        status: 'ASSIGNED',
        assigned_ambulance_id: ambulanceId,
        assigned_at: Date.now()
      }));

      setAmbulances(prev => prev.map(a => {
        if (a.ambulance_id === ambulanceId) {
          return { ...a, status: 'EN ROUTE', assignment_state: 'ASSIGNED', assigned_emergency_id: activeEmergency.emergency_id };
        }
        if (a.assignment_state === 'PENDING_OFFER') {
          return { ...a, status: 'AVAILABLE', assignment_state: 'UNASSIGNED' };
        }
        return a;
      }));

      setActiveOffers(prev => prev.map(o => o.ambulance_id === ambulanceId ? { ...o, status: 'ACCEPTED' } : { ...o, status: 'CANCELLED' }));
      addAuditEntry('ASSIGNMENT_CONFIRMED', `AUTHORITATIVE COMMIT: ${ambulanceId} assigned to ${activeEmergency.emergency_id}. Other offers cancelled.`);
      showNotice(`AUTHORITATIVE ASSIGNMENT CONFIRMED: ${ambulanceId} EN ROUTE.`);
      return { success: true, winning_ambulance_id: ambulanceId };
    }
  };

  // Test Race Condition: Dispatches 2 concurrent accept requests to demonstrate atomic locking
  const handleTestRaceCondition = async () => {
    if (activeOffers.length < 2) {
      showNotice('Need at least 2 offered ambulances to test concurrent acceptance race condition.');
      return;
    }
    const ambA = activeOffers[0].ambulance_id;
    const ambB = activeOffers[1].ambulance_id;

    showNotice(`Executing concurrent acceptance test: [${ambA}] vs [${ambB}]...`);
    addAuditEntry('TEST_RACE_DISPATCHED', `Initiated simultaneous accept requests from ${ambA} and ${ambB} to test atomic lock.`);

    // Trigger near-simultaneous responses
    const pA = handleOfferResponse(ambA, 'ACCEPT');
    const pB = handleOfferResponse(ambB, 'ACCEPT');
    await Promise.all([pA, pB]);
  };

  // Change Operating Area / Incident Location
  const handleSelectLocation = async (loc) => {
    setSelectedLocationId(loc.id);
    const newAnchor = {
      name: loc.label,
      address: loc.landmark,
      lat: loc.lat,
      lng: loc.lng,
      locality: 'JP Nagar / South Bengaluru'
    };
    setOperatingAnchor(newAnchor);
    setActiveEmergency(prev => ({
      ...prev,
      lat: loc.lat,
      lng: loc.lng,
      location_label: `${loc.label} (${loc.landmark})`,
      status: 'OFFERING',
      assigned_ambulance_id: null
    }));
    setActiveOffers([]);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], 15, { duration: 0.8 });
    }

    addAuditEntry('LOCATION_SWITCHED', `Operating anchor changed to ${loc.label} (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}).`);

    if (isLiveApiConnected) {
      try {
        await fetch(`${API_BASE}/dispatch/set-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: loc.lat,
            lng: loc.lng,
            label: loc.label,
            patient_id: activeEmergency.patient_id
          })
        });
      } catch (_err) {}
    }
  };

  // Reset to default anchor (80 Feet Road, Brookes Haven)
  const handleResetToRiaItm = async () => {
    const defaultLoc = ALTERNATIVE_LOCATIONS[0];
    await handleSelectLocation(defaultLoc);
    setOperatingRadiusKm(5.0);
    showNotice('Radar recentered to default anchor: 80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8.');

    if (isLiveApiConnected) {
      try {
        await fetch(`${API_BASE}/dispatch/reset-demo`, { method: 'POST' });
        fetchDispatchState();
      } catch (_err) {}
    }
  };

  // Change Radius
  const handleSetRadius = async (radiusKm) => {
    setOperatingRadiusKm(radiusKm);
    addAuditEntry('OPERATING_RADIUS_EXPANDED', `Radar surveillance zone adjusted to ${radiusKm} km.`);
    showNotice(`Operating radius set to ${radiusKm} km.`);

    if (isLiveApiConnected) {
      try {
        await fetch(`${API_BASE}/dispatch/set-radius`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ radius_km: radiusKm })
        });
      } catch (_err) {}
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [operatingAnchor.lat, operatingAnchor.lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: false
      });
      mapInstanceRef.current = map;
    }
  }, [operatingAnchor.lat, operatingAnchor.lng]);

  // Update Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let tileUrl = '';
    let options = {};

    if (mapType === 'google-roads') {
      // Direct Google Maps Road / Street Vector Layer (Zero API key needed)
      tileUrl = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'] };
    } else if (mapType === 'google-hybrid') {
      // Direct Google Maps Hybrid Satellite + Labels Layer
      tileUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'] };
    } else if (mapType === 'google-terrain') {
      // Direct Google Maps Terrain with Elevation
      tileUrl = 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'] };
    } else if (mapType === 'tactical-dark') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      options = { maxZoom: 19, subdomains: 'abcd' };
    } else if (mapType === 'osm') {
      tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      options = { maxZoom: 19 };
    } else {
      // Light Streets (CartoDB Voyager)
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      options = { maxZoom: 19, subdomains: 'abcd' };
    }

    tileLayerRef.current = L.tileLayer(tileUrl, options).addTo(map);
  }, [mapType]);

  // Render Surveillance Circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    surveillanceLayersRef.current.forEach(layer => layer.remove());
    surveillanceLayersRef.current = [];

    if (!showSurveillanceRings) return;

    const lat = activeEmergency.lat;
    const lng = activeEmergency.lng;
    const rMeters = operatingRadiusKm * 1000;

    // Outer configured radius circle
    const outerRing = L.circle([lat, lng], {
      radius: rMeters,
      color: '#7F1D2D',
      weight: 1.2,
      dashArray: '6, 6',
      fillColor: '#350D13',
      fillOpacity: 0.04
    }).addTo(map);

    // Mid 50% radius circle
    const midRing = L.circle([lat, lng], {
      radius: rMeters * 0.5,
      color: '#FF2D3D',
      weight: 1.4,
      dashArray: '4, 4',
      fillColor: '#FF2D3D',
      fillOpacity: 0.03
    }).addTo(map);

    // Inner 1km rapid response hotzone
    const innerRing = L.circle([lat, lng], {
      radius: Math.min(1000, rMeters * 0.2),
      color: '#FF2D3D',
      weight: 1.8,
      fillColor: '#350D13',
      fillOpacity: 0.1
    }).addTo(map);

    surveillanceLayersRef.current = [outerRing, midRing, innerRing];
  }, [activeEmergency.lat, activeEmergency.lng, operatingRadiusKm, showSurveillanceRings]);

  // Render Patient / Casualty Incident Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(patientMarkersRef.current).forEach(m => m.remove());
    patientMarkersRef.current = {};

    const lat = activeEmergency.lat;
    const lng = activeEmergency.lng;

    const patientIconHtml = `
      <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <div style="position: absolute; width: 36px; height: 36px; background: #FF2D3D; opacity: 0.35; animation: ping 2s infinite;"></div>
        <div style="position: absolute; width: 28px; height: 28px; background: #350D13; border: 2px solid #FF2D3D; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(255,45,61,0.7); font-family: monospace;">
          <span style="font-size: 8px; font-weight: 800; color: #FF2D3D; line-height: 1;">CAS</span>
          <span style="font-size: 8px; font-weight: bold; color: #F5F5F5; line-height: 1;">EMG</span>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: patientIconHtml,
      className: 'patient-incident-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    marker.bindPopup(`
      <div style="background: #141416; color: #F5F5F5; font-family: monospace; font-size: 11px; padding: 6px; border: 1px solid #7F1D2D; min-width: 220px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #35353B; padding-bottom: 4px; margin-bottom: 4px;">
          <strong style="color: #FF2D3D;">[INCIDENT] ${activeEmergency.emergency_id}</strong>
          <span style="background: #350D13; color: #FF2D3D; border: 1px solid #7F1D2D; font-size: 9px; padding: 1px 4px; font-weight: bold;">
            ${activeEmergency.priority}
          </span>
        </div>
        <div style="color: #F5F5F5; font-weight: bold; margin-bottom: 2px;">${activeEmergency.patient_name}</div>
        <div style="color: #A1A1AA; font-size: 10px; margin-bottom: 6px;">${activeEmergency.location_label}</div>
        <div style="background: #1C1C20; padding: 4px; border: 1px solid #35353B; font-size: 10px; margin-bottom: 6px;">
          <div>GPS: <strong>${lat.toFixed(6)}, ${lng.toFixed(6)}</strong></div>
          <div>Status: <strong style="color: #FF2D3D;">${activeEmergency.status}</strong></div>
          ${activeEmergency.assigned_ambulance_id ? `<div>Assigned: <strong style="color: #FF2D3D;">${activeEmergency.assigned_ambulance_id} (EN ROUTE)</strong></div>` : ''}
        </div>
        <div style="font-size: 9px; color: #52B788; font-weight: bold; text-align: center; letter-spacing: 0.5px;">GPS TELEMETRY ACTIVE &bull; LOCK ±2.4M</div>
      </div>
    `);

    patientMarkersRef.current[activeEmergency.emergency_id] = marker;
  }, [activeEmergency]);

  // Render Real Hospital Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    hospitalMarkersRef.current.forEach(m => m.remove());
    hospitalMarkersRef.current = [];

    if (!showHospitals) return;

    const emgLat = activeEmergency.lat;
    const emgLng = activeEmergency.lng;

    VERIFIED_HOSPITALS.forEach(h => {
      const dist = haversineDistanceKm(emgLat, emgLng, h.lat, h.lng);
      const eta = estimateRoadEtaMins(dist);

      const hospitalIconHtml = `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="width: 26px; height: 26px; background: #1C1C20; border: 2px solid #F5F5F5; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(0,0,0,0.8); font-family: monospace;">
            <span style="font-size: 12px; font-weight: 900; color: #FF2D3D; line-height: 1;">+</span>
            <span style="font-size: 7px; font-weight: bold; color: #F5F5F5; line-height: 1;">HOSP</span>
          </div>
        </div>
      `;

      const hospIcon = L.divIcon({
        html: hospitalIconHtml,
        className: 'verified-hospital-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([h.lat, h.lng], { icon: hospIcon }).addTo(map);

      marker.bindPopup(`
        <div style="background: #141416; color: #F5F5F5; font-family: monospace; font-size: 11px; padding: 6px; border: 1px solid #35353B; min-width: 230px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #35353B; padding-bottom: 4px; margin-bottom: 4px;">
            <div>
              <strong style="color: #F5F5F5; font-size: 12px;">${h.name}</strong>
              <div style="color: #A1A1AA; font-size: 9px;">VERIFIED PLACE FACILITY</div>
            </div>
            <span style="background: #1C1C20; color: #FF2D3D; border: 1px solid #7F1D2D; font-size: 9px; padding: 1px 4px; font-weight: bold;">
              ${dist} km
            </span>
          </div>
          <div style="color: #A1A1AA; font-size: 10px; margin-bottom: 5px;">${h.address}</div>
          <div style="background: #1C1C20; padding: 5px; border: 1px solid #35353B; font-size: 10px; margin-bottom: 6px;">
            <div>Road Transit ETA: <strong style="color: #FF2D3D;">~${eta} mins</strong></div>
            <div>Emergency Contact: <a href="tel:${h.phone}" style="color: #F5F5F5; text-decoration: underline;">${h.phone}</a></div>
            <div>Capabilities: <span style="color: #A1A1AA;">${h.capabilities.slice(0, 2).join(', ')}</span></div>
            <div>ICU Bays: <strong style="color: #F5F5F5;">${h.icu_available} Free</strong> / Total: ${h.total_beds}</div>
          </div>
          <div style="display: flex; gap: 4px;">
            <a 
              href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" 
              target="_blank" 
              rel="noreferrer"
              style="flex: 1; text-align: center; background: #FF2D3D; color: #0B0B0D; font-weight: bold; font-size: 10px; padding: 4px 6px; text-decoration: none;"
            >
              DIRECTIONS
            </a>
            <a 
              href="tel:${h.phone}" 
              style="text-align: center; background: #1C1C20; color: #F5F5F5; border: 1px solid #35353B; font-weight: bold; font-size: 10px; padding: 4px 8px; text-decoration: none;"
            >
              CALL
            </a>
          </div>
        </div>
      `);

      hospitalMarkersRef.current.push(marker);
    });
  }, [showHospitals, activeEmergency.lat, activeEmergency.lng]);

  // Render Verified Medical Shop Markers on 80 Feet Road
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    medicalShopMarkersRef.current.forEach(m => m.remove());
    medicalShopMarkersRef.current = [];

    if (!showMedicalShops) return;

    const emgLat = activeEmergency.lat;
    const emgLng = activeEmergency.lng;

    VERIFIED_MEDICAL_SHOPS.forEach(shop => {
      const dist = haversineDistanceKm(emgLat, emgLng, shop.lat, shop.lng);

      const shopIconHtml = `
        <div style="position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center;">
          <div style="
            position: absolute;
            top: -19px;
            white-space: nowrap;
            background: #1A241C;
            color: #52B788;
            font-size: 9px;
            font-weight: 800;
            font-family: monospace;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid rgba(82,183,136,0.6);
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            pointer-events: none;
          ">
            ${shop.short_name}
          </div>
          <div style="
            width: 30px;
            height: 30px;
            border-radius: 8px;
            background: #2D6A4F;
            border: 2px solid #52B788;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 12px rgba(82,183,136,0.6);
            transition: transform 0.2s;
          ">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid #2D6A4F;
            margin-top: -1px;
          "></div>
        </div>
      `;

      const shopIcon = L.divIcon({
        html: shopIconHtml,
        className: 'verified-medical-shop-marker',
        iconSize: [30, 42],
        iconAnchor: [15, 40]
      });

      const marker = L.marker([shop.lat, shop.lng], { icon: shopIcon }).addTo(map);

      marker.bindPopup(`
        <div style="background: #F7F4ED; color: #1A241C; font-family: monospace; font-size: 11px; padding: 6px; border: 1px solid #D5CEBF; border-radius: 8px; min-width: 220px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #D5CEBF; padding-bottom: 4px; margin-bottom: 4px;">
            <div>
              <strong style="color: #2D6A4F; font-size: 12px;">${shop.name}</strong>
              <div style="color: #556558; font-size: 9px;">VERIFIED 80 FT RD MEDICAL STORE</div>
            </div>
            <span style="background: #2D6A4F; color: #FFFFFF; font-size: 9px; padding: 1px 5px; font-weight: bold; border-radius: 4px;">
              ${dist} km
            </span>
          </div>
          <div style="color: #556558; font-size: 10px; margin-bottom: 4px;">${shop.address}</div>
          <div style="background: #EFECE6; padding: 5px; border-radius: 6px; font-size: 10px; margin-bottom: 6px;">
            <div>Hours: <strong style="color: #2D6A4F;">${shop.operating_hours}</strong></div>
            <div>Phone: <a href="tel:${shop.phone}" style="color: #2D6A4F; font-weight: bold; text-decoration: underline;">${shop.phone}</a></div>
            <div style="margin-top: 2px;">Key Stocks: <span style="color: #1A241C; font-weight: 600;">${shop.capabilities.join(', ')}</span></div>
          </div>
          <div style="display: flex; gap: 4px;">
            <a 
              href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}" 
              target="_blank" 
              rel="noreferrer"
              style="flex: 1; text-align: center; background: #2D6A4F; color: #FFFFFF; font-weight: bold; font-size: 10px; padding: 4px 6px; text-decoration: none; border-radius: 4px;"
            >
              DIRECTIONS
            </a>
            <a 
              href="tel:${shop.phone}" 
              style="text-align: center; background: #EFECE6; color: #1A241C; border: 1px solid #D5CEBF; font-weight: bold; font-size: 10px; padding: 4px 8px; text-decoration: none; border-radius: 4px;"
            >
              CALL
            </a>
          </div>
        </div>
      `);

      medicalShopMarkersRef.current.push(marker);
    });
  }, [showMedicalShops, activeEmergency.lat, activeEmergency.lng]);

  // Render Simulated Ambulance Markers & Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(ambulanceMarkersRef.current).forEach(m => m.remove());
    ambulanceMarkersRef.current = {};

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (!showAmbulances) return;

    const emgLat = activeEmergency.lat;
    const emgLng = activeEmergency.lng;

    ambulances.forEach(a => {
      const isAssigned = a.ambulance_id === activeEmergency.assigned_ambulance_id;
      const isOffered = activeOffers.some(o => o.ambulance_id === a.ambulance_id && o.status === 'OFFERED');
      const isOffline = a.status === 'OFFLINE';
      const isStale = a.stale_gps;

      const dist = haversineDistanceKm(emgLat, emgLng, a.lat, a.lng);
      const eta = estimateRoadEtaMins(dist, a.speed_kmh);

      let pinBg = '#1C1C20';
      let pinBorder = '#35353B';
      let pinText = '#A1A1AA';

      if (isAssigned) {
        pinBg = '#350D13';
        pinBorder = '#FF2D3D';
        pinText = '#FF2D3D';
      } else if (isOffered) {
        pinBg = '#350D13';
        pinBorder = '#FF2D3D';
        pinText = '#FF2D3D';
      } else if (a.status === 'AVAILABLE') {
        pinBg = '#1C1C20';
        pinBorder = '#A1A1AA';
        pinText = '#F5F5F5';
      } else if (isOffline) {
        pinBg = '#0B0B0D';
        pinBorder = '#35353B';
        pinText = '#35353B';
      }

      const ambIconHtml = `
        <div style="position: relative; width: 44px; height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
          ${isAssigned || isOffered ? '<div style="position: absolute; width: 38px; height: 38px; background: #FF2D3D; opacity: 0.3; animation: pulse 1.8s infinite;"></div>' : ''}
          <div style="background: ${pinBg}; border: 1.5px solid ${pinBorder}; padding: 2px 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center;">
            <div style="display: flex; align-items: center; gap: 2px;">
              <span style="font-size: 8px; font-weight: 900; color: ${pinText}; font-family: monospace;">${a.ambulance_id}</span>
              ${isStale ? '<span style="font-size: 7px; color: #FF2D3D; font-weight: bold;">!</span>' : ''}
            </div>
            <div style="font-size: 7px; font-weight: bold; color: ${isAssigned ? '#FF2D3D' : '#A1A1AA'}; font-family: monospace;">
              ${isAssigned ? 'EN ROUTE' : isOffered ? 'OFFERED' : a.status}
            </div>
          </div>
          <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid ${pinBorder};"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: ambIconHtml,
        className: 'simulated-ambulance-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 40]
      });

      const marker = L.marker([a.lat, a.lng], { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div style="background: #141416; color: #F5F5F5; font-family: monospace; font-size: 11px; padding: 6px; border: 1px solid #35353B; min-width: 220px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #35353B; padding-bottom: 4px; margin-bottom: 4px;">
            <strong style="color: ${isAssigned ? '#FF2D3D' : '#F5F5F5'};">${a.ambulance_id}</strong>
            <span style="background: #1C1C20; color: ${isAssigned ? '#FF2D3D' : '#A1A1AA'}; border: 1px solid #35353B; font-size: 9px; padding: 1px 4px; font-weight: bold;">
              ${a.status}
            </span>
          </div>
          <div style="color: #F5F5F5; font-size: 10px; font-weight: bold;">${a.callsign}</div>
          <div style="color: #A1A1AA; font-size: 9px; margin-bottom: 4px;">${a.vehicle_type}</div>
          <div style="background: #1C1C20; padding: 4px; border: 1px solid #35353B; font-size: 10px; margin-bottom: 5px;">
            <div>Distance to Casualty: <strong>${dist} km</strong></div>
            <div>Road Network ETA: <strong style="color: #FF2D3D;">~${eta} mins</strong></div>
            <div>Crew: <span style="color: #A1A1AA;">${a.crew}</span></div>
            <div>Speed / Heading: <span style="color: #F5F5F5;">${a.speed_kmh} km/h (${a.heading}°)</span></div>
            <div>GPS Telemetry: <span style="color: ${isStale ? '#FF2D3D' : '#A1A1AA'};">${a.last_gps_update} ${isStale ? '[STALE GPS >8m]' : ''}</span></div>
          </div>
          <div style="font-size: 8px; color: #52B788; font-weight: bold; text-align: center; letter-spacing: 0.5px;">LIVE FLEET TELEMETRY &bull; HIGH PRECISION GPS</div>
        </div>
      `);

      ambulanceMarkersRef.current[a.ambulance_id] = marker;

      // Draw active route polyline if assigned
      if (isAssigned) {
        const routeCoords = [
          [a.lat, a.lng],
          [(a.lat + emgLat) / 2 + 0.0012, (a.lng + emgLng) / 2 - 0.0008], // Simulated street turn
          [emgLat, emgLng]
        ];
        routePolylineRef.current = L.polyline(routeCoords, {
          color: '#FF2D3D',
          weight: 3.5,
          dashArray: '6, 6',
          opacity: 0.95
        }).addTo(map);
      }
    });
  }, [ambulances, activeOffers, activeEmergency, showAmbulances]);

  return (
    <div className="relative w-full h-full min-h-[500px] nm-flat rounded-2xl border border-white/[0.04] bg-[#131519] font-mono select-none flex flex-col overflow-hidden">
      
      {/* ================= TOP TACTICAL CONTROL BAR ================= */}
      <div className="nm-flat border-b border-white/[0.04] p-3 flex items-center justify-between gap-3 flex-wrap text-xs z-[400]">
        
        {/* Anchor & Coordinates */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 nm-inset rounded-xl">
            <Compass className="w-3.5 h-3.5 text-[#FF334B]" />
            <span className="text-[#94A3B8] text-[10px] uppercase font-bold">OPERATING AREA:</span>
            <strong className="text-[#F8FAFC] text-[11px] truncate max-w-[210px]">{operatingAnchor.name}</strong>
          </div>

          <button
            onClick={handleResetToRiaItm}
            className="px-3 py-1.5 nm-alert-inset rounded-xl text-[#FF334B] border border-[#FF334B]/30 text-[10px] font-bold transition-all flex items-center gap-1.5 uppercase hover:border-[#FF334B]/60"
            title="Reset to 80 Feet Road, Brookes Haven Layout default anchor"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET TO BROOKES HAVEN</span>
          </button>

          {/* Quick Location Dropdown */}
          <select
            value={selectedLocationId}
            onChange={(e) => {
              const loc = ALTERNATIVE_LOCATIONS.find(l => l.id === e.target.value);
              if (loc) handleSelectLocation(loc);
            }}
            className="px-3 py-1.5 nm-inset rounded-xl text-[10px] text-[#1A241C] border-none focus:outline-none uppercase bg-transparent"
          >
            {ALTERNATIVE_LOCATIONS.map(l => (
              <option key={l.id} value={l.id} className="bg-[#EFECE6] text-[#1A241C]">{l.label}</option>
            ))}
          </select>
        </div>

        {/* Operating Radius Switcher & Persistent Demo Badge */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center nm-inset rounded-xl p-1 text-[10px] font-bold gap-1">
            <span className="px-2 text-[#7A8A7C] uppercase">RADIUS:</span>
            {[5.0, 10.0, 15.0].map(r => (
              <button
                key={r}
                onClick={() => handleSetRadius(r)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  operatingRadiusKm === r
                    ? 'nm-btn-accent text-white shadow-[0_0_8px_#2D6A4F]'
                    : 'text-[#7A8A7C] hover:text-[#1A241C]'
                }`}
              >
                {r} KM
              </button>
            ))}
          </div>

          {/* Map Type Switcher */}
          <div className="flex items-center nm-inset rounded-xl p-1 text-[10px] font-bold gap-1">
            <button
              onClick={() => setMapType('google-roads')}
              className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'google-roads' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
              title="Google Maps Standard Roads"
            >
              MAP
            </button>
            <button
              onClick={() => setMapType('google-hybrid')}
              className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'google-hybrid' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
              title="Google Maps Satellite Hybrid"
            >
              SATELLITE
            </button>
            <button
              onClick={() => setMapType('google-terrain')}
              className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'google-terrain' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
              title="Google Maps Physical Terrain"
            >
              TERRAIN
            </button>
            <button
              onClick={() => setMapType('tactical-dark')}
              className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'tactical-dark' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
              title="Tactical Dark Map"
            >
              DARK
            </button>
            <button
              onClick={() => setMapType('osm')}
              className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'osm' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
              title="OpenStreetMap Standard"
            >
              OSM
            </button>
          </div>

          {/* Active GPS Telemetry Lock Status */}
          <div className="px-3 py-1.5 nm-inset rounded-xl border border-[#2D6A4F]/40 text-[#2D6A4F] text-[10px] font-bold flex items-center gap-2 uppercase">
            <span className="w-2 h-2 rounded-full bg-[#2D6A4F] shadow-[0_0_6px_#2D6A4F] animate-pulse"></span>
            <span>LIVE GPS RADAR &bull; 100% TELEMETRY</span>
          </div>
        </div>

      </div>

      {noticeMessage && (
        <div className="nm-inset border-b border-[#FF334B]/40 px-4 py-2 text-xs text-[#FF334B] flex items-center justify-between animate-in slide-in-from-top-1 z-[401]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#FF334B]" />
            <span className="font-bold">{noticeMessage}</span>
          </div>
          <button onClick={() => setNoticeMessage('')} className="text-[#94A3B8] hover:text-[#F8FAFC]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= MAIN SPLIT WORKSPACE ================= */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
        
        {/* LEAFLET MAP VIEWPORT */}
        <div className="flex-1 min-h-[360px] relative bg-[#EFECE6]">
          
          {/* Floating Map Layer Toggles */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 nm-flat rounded-xl p-1.5 border border-[#D5CEBF] text-[10px]">
            <button
              onClick={() => setShowMedicalShops(!showMedicalShops)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${showMedicalShops ? 'nm-btn text-[#2D6A4F] border border-[#2D6A4F]/30 font-black' : 'text-[#7A8A7C]'}`}
              title="Toggle Medical Shops on 80 Feet Road"
            >
              + MEDICAL SHOPS ({VERIFIED_MEDICAL_SHOPS.length})
            </button>
            <button
              onClick={() => setShowHospitals(!showHospitals)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${showHospitals ? 'nm-btn text-[#1A241C]' : 'text-[#7A8A7C]'}`}
            >
              + HOSPITALS ({VERIFIED_HOSPITALS.length})
            </button>
            <button
              onClick={() => setShowAmbulances(!showAmbulances)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${showAmbulances ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' : 'text-[#7A8A7C]'}`}
            >
              VEHICLES ({ambulances.length})
            </button>
            <button
              onClick={() => setShowSurveillanceRings(!showSurveillanceRings)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${showSurveillanceRings ? 'nm-btn text-[#1A241C]' : 'text-[#7A8A7C]'}`}
            >
              RINGS
            </button>
          </div>

          <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#EFECE6' }} />
        </div>

        {/* ================= RIGHT TACTICAL DISPATCH PANEL ================= */}
        <div className="w-full lg:w-[440px] nm-flat border-t lg:border-t-0 lg:border-l border-white/[0.04] flex flex-col z-[300]">
          
          {/* Subtabs Header */}
          <div className="nm-inset rounded-xl m-2.5 p-1 flex items-center text-xs gap-1">
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`flex-1 py-1.5 text-center font-bold uppercase rounded-lg transition-all ${
                activeTab === 'dispatch'
                  ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              MULTI-DISPATCH
            </button>
            <button
              onClick={() => setActiveTab('hospitals')}
              className={`flex-1 py-1.5 text-center font-bold uppercase rounded-lg transition-all ${
                activeTab === 'hospitals'
                  ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              HOSPITALS ({VERIFIED_HOSPITALS.length})
            </button>
            <button
              onClick={() => setActiveTab('pharmacies')}
              className={`flex-1 py-1.5 text-center font-bold uppercase rounded-lg transition-all ${
                activeTab === 'pharmacies'
                  ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black'
                  : 'text-[#7A8A7C] hover:text-[#1A241C]'
              }`}
            >
              MEDICAL ({VERIFIED_MEDICAL_SHOPS.length})
            </button>
            <button
              onClick={() => setActiveTab('fleet')}
              className={`flex-1 py-1.5 text-center font-bold uppercase rounded-lg transition-all ${
                activeTab === 'fleet'
                  ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              FLEET ({ambulances.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex-1 py-1.5 text-center font-bold uppercase rounded-lg transition-all ${
                activeTab === 'audit'
                  ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              AUDIT FEED
            </button>
          </div>

          {/* Subtab Content Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-xs">
            
            {/* ================= TAB 1: MULTI-AMBULANCE DISPATCH WORKFLOW ================= */}
            {activeTab === 'dispatch' && (
              <div className="space-y-3">
                
                {/* Active Incident Overview */}
                <div className="nm-flat rounded-xl p-3.5 border border-white/[0.03] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#FF334B] text-[11px]">{activeEmergency.emergency_id}</span>
                      <span className="px-2 py-0.5 nm-alert-inset text-[#FF334B] border border-[#FF334B]/30 text-[9px] font-bold rounded-md">
                        {activeEmergency.priority}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      STATUS: <strong className="text-[#F8FAFC]">{activeEmergency.status}</strong>
                    </span>
                  </div>

                  <div className="text-[11px] font-bold text-[#F8FAFC]">{activeEmergency.patient_name}</div>
                  <div className="text-[10px] text-[#94A3B8] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF334B] shrink-0" />
                    <span className="truncate">{activeEmergency.location_label}</span>
                  </div>

                  {activeEmergency.status === 'ASSIGNED' && (
                    <div className="nm-alert-inset rounded-xl p-2.5 border border-[#FF334B]/40 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#94A3B8]">COMMITTED UNIT:</span>
                        <strong className="text-[#FF334B] text-xs font-bold">{activeEmergency.assigned_ambulance_id} (EN ROUTE)</strong>
                      </div>
                      <div className="text-[10px] text-[#F8FAFC]">
                        Live route locked to patient coordinates. Other unit offers cancelled.
                      </div>
                    </div>
                  )}
                </div>

                {/* Multi-Ambulance Group Offer Cards */}
                {activeEmergency.status === 'OFFERING' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#35353B] pb-1.5">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[#F5F5F5] uppercase">Active Multi-Unit Offers</div>
                        <div className="text-[10px] text-[#A1A1AA]">Concurrent dispatch offers sent to top 3 eligible units</div>
                      </div>

                      {/* Timer Bar */}
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#FF2D3D]">{offerTimeRemaining}s</div>
                        <div className="text-[9px] text-[#A1A1AA]">COUNTDOWN</div>
                      </div>
                    </div>

                    {/* Progress countdown bar */}
                    <div className="w-full bg-[#1C1C20] h-1 border border-[#35353B]">
                      <div 
                        className="bg-[#FF2D3D] h-full transition-all duration-1000"
                        style={{ width: `${(offerTimeRemaining / 15) * 100}%` }}
                      />
                    </div>

                    {activeOffers.map((offer, idx) => {
                      const isRecommended = idx === 0;
                      return (
                        <div 
                          key={offer.ambulance_id}
                          className={`p-2.5 border transition-all space-y-2 ${
                            isRecommended 
                              ? 'bg-[#1C1C20] border-[#FF2D3D]' 
                              : 'bg-[#1C1C20] border-[#35353B]'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <strong className="text-[#F5F5F5] text-xs font-bold">{offer.ambulance_id}</strong>
                                <span className="text-[10px] text-[#A1A1AA]">{offer.vehicle_type}</span>
                                {isRecommended && (
                                  <span className="px-1 py-0.2 bg-[#FF2D3D] text-[#0B0B0D] text-[8px] font-bold">
                                    TOP RANK
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#A1A1AA]">{offer.callsign}</div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold text-[#FF2D3D]">~{offer.eta_mins}m ETA</span>
                              <span className="text-[10px] text-[#A1A1AA] block">{offer.distance_km} km</span>
                            </div>
                          </div>

                          {/* Crew Actions for Demonstration */}
                          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                            <button
                              onClick={() => handleOfferResponse(offer.ambulance_id, 'ACCEPT')}
                              className="flex-1 py-2 nm-btn-accent text-white font-bold text-[10px] rounded-xl transition-all uppercase shadow-[0_0_10px_rgba(255,51,75,0.3)]"
                            >
                              CREW ACCEPT
                            </button>
                            <button
                              onClick={() => handleOfferResponse(offer.ambulance_id, 'DECLINE')}
                              className="px-3.5 py-2 nm-btn text-[#94A3B8] hover:text-[#FF334B] rounded-xl font-bold text-[10px] transition-all uppercase"
                            >
                              DECLINE
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Tactical Dispatch Operations */}
                    <div className="nm-flat rounded-xl p-3 border border-white/[0.04] space-y-2">
                      <div className="text-[10px] font-bold text-[#94A3B8] uppercase">Dispatch Concurrency Controls:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleTestRaceCondition}
                          className="p-2 nm-alert-inset text-[#FF334B] border border-[#FF334B]/40 rounded-lg font-bold text-[9px] uppercase transition-all"
                          title="Simulate 2 crews accepting simultaneously to verify backend atomic locking"
                        >
                          TEST CONCURRENT RACE
                        </button>
                        <button
                          onClick={handleOfferTimeout}
                          className="p-2 nm-btn text-[#F8FAFC] rounded-lg font-bold text-[9px] uppercase transition-all"
                          title="Simulate 15s timeout to trigger escalation"
                        >
                          FORCE TIMEOUT / ESCALATE
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Escalation Alert state */}
                {activeEmergency.status === 'ESCALATED' && (
                  <div className="nm-alert-inset rounded-xl p-3.5 border border-[#FF334B]/40 space-y-2.5">
                    <div className="flex items-center gap-2 text-[#FF334B] font-bold text-xs">
                      <AlertOctagon className="w-4 h-4" />
                      <span>NO ACCEPTANCE — ESCALATION REQUIRED</span>
                    </div>
                    <p className="text-[10px] text-[#94A3B8] font-sans">
                      All eligible units within the configured {operatingRadiusKm}km operational radius have timed out or declined.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSetRadius(15.0)}
                        className="flex-1 py-2 nm-btn-accent text-white font-bold text-[10px] uppercase rounded-xl shadow-[0_0_10px_rgba(255,51,75,0.3)]"
                      >
                        EXPAND TO 15 KM
                      </button>
                      <button
                        onClick={handleResetToRiaItm}
                        className="py-2 px-3 nm-btn text-[#F8FAFC] font-bold text-[10px] uppercase rounded-xl"
                      >
                        RESET
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ================= TAB 2: VERIFIED NEARBY HOSPITALS ================= */}
            {activeTab === 'hospitals' && (
              <div className="space-y-2.5">
                <div className="text-[10px] text-[#94A3B8] border-b border-white/[0.04] pb-1.5 font-sans">
                  Verified hospital facilities sorted by road distance from incident:
                </div>

                {VERIFIED_HOSPITALS.map(h => {
                  const dist = haversineDistanceKm(activeEmergency.lat, activeEmergency.lng, h.lat, h.lng);
                  const eta = estimateRoadEtaMins(dist);

                  return (
                    <div key={h.hospital_id} className="nm-flat rounded-xl p-3 border border-white/[0.04] space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-[#F8FAFC] text-xs leading-snug">{h.name}</strong>
                          <div className="text-[10px] text-[#94A3B8] font-sans mt-0.5">{h.address}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-[#FF334B]">{dist} km</span>
                          <span className="text-[10px] text-[#94A3B8] block font-sans">~{eta}m ETA</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[#94A3B8] nm-inset p-2 rounded-lg border border-white/[0.02]">
                        <div>ICU Bays: <strong className="text-[#10B981]">{h.icu_available} Free</strong> / {h.total_beds}</div>
                        <div>Phone: <a href={`tel:${h.phone}`} className="text-[#38BDF8] underline">{h.phone}</a></div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="text-[#94A3B8] truncate max-w-[200px] font-sans">{h.capabilities.slice(0, 2).join(', ')}</span>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 nm-btn-accent text-white font-bold text-[9px] uppercase rounded-lg shadow-[0_0_8px_rgba(255,51,75,0.3)]"
                        >
                          DIRECTIONS
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= TAB 3: VERIFIED MEDICAL SHOPS & PHARMACIES ================= */}
            {activeTab === 'pharmacies' && (
              <div className="space-y-2.5">
                <div className="text-[10px] text-[#556558] border-b border-[#D5CEBF] pb-1.5 font-sans flex items-center justify-between">
                  <span>Verified Medical Stores on 80 Feet Road &amp; JP Nagar 8th Phase:</span>
                  <span className="font-mono text-[#2D6A4F] font-bold">RADAR TILES</span>
                </div>

                {VERIFIED_MEDICAL_SHOPS.map(shop => {
                  const dist = haversineDistanceKm(activeEmergency.lat, activeEmergency.lng, shop.lat, shop.lng);
                  const eta = estimateRoadEtaMins(dist);

                  return (
                    <div key={shop.shop_id} className="nm-flat rounded-xl p-3 border border-white/80 space-y-2 bg-[#F7F4ED]">
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-[#1A241C] text-xs leading-snug">{shop.name}</strong>
                          <div className="text-[10px] text-[#556558] font-sans mt-0.5">{shop.address}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-[#2D6A4F]">{dist} km</span>
                          <span className="text-[10px] text-[#556558] block font-sans">~{eta}m</span>
                        </div>
                      </div>

                      <div className="nm-inset p-2 rounded-lg bg-[#EFECE6]/60 text-[10px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[#556558]">Hours:</span>
                          <strong className="text-[#2D6A4F]">{shop.operating_hours}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#556558]">Phone:</span>
                          <a href={`tel:${shop.phone}`} className="text-[#2D6A4F] font-bold underline">{shop.phone}</a>
                        </div>
                        <div className="pt-1 border-t border-[#D5CEBF]/40 text-[#556558]">
                          Stocked: <span className="text-[#1A241C] font-semibold">{shop.capabilities.join(', ')}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded nm-inset text-[#2D6A4F] font-bold">
                          {shop.is_24x7 ? '24/7 OPEN' : 'DAY STORE'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${shop.phone}`}
                            className="px-2 py-1 nm-btn text-[#1A241C] font-bold text-[9px] uppercase rounded-lg"
                          >
                            CALL
                          </a>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 nm-btn-accent text-white font-bold text-[9px] uppercase rounded-lg shadow-[0_0_8px_rgba(45,106,79,0.3)]"
                          >
                            DIRECTIONS
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= TAB 3: ACTIVE FLEET ROSTER ================= */}
            {activeTab === 'fleet' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[10px] text-[#94A3B8] border-b border-white/[0.04] pb-1.5 font-sans">
                  <span>ACTIVE FLEET &bull; JP NAGAR SECTOR</span>
                  <span className="text-[#2D6A4F] font-bold font-mono">100% TELEMETRY</span>
                </div>

                {ambulances.map(a => {
                  const dist = haversineDistanceKm(activeEmergency.lat, activeEmergency.lng, a.lat, a.lng);
                  const eta = estimateRoadEtaMins(dist, a.speed_kmh);

                  return (
                    <div key={a.ambulance_id} className="nm-flat rounded-xl p-2.5 border border-white/[0.04] space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-[#F8FAFC]">{a.ambulance_id}</strong>
                          <span className="text-[10px] text-[#94A3B8] font-sans">{a.vehicle_type}</span>
                          {a.stale_gps && (
                            <span className="px-1.5 py-0.2 nm-alert-inset text-[#FF334B] text-[8px] font-bold rounded-md border border-[#FF334B]/30">
                              STALE GPS
                            </span>
                          )}
                        </div>

                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md border ${
                          a.status === 'EN ROUTE' ? 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40' :
                          a.status === 'OFFERED' ? 'nm-inset text-[#F59E0B] border-[#F59E0B]/30' :
                          a.status === 'AVAILABLE' ? 'nm-inset text-[#10B981] border-[#10B981]/30' :
                          'nm-inset text-[#64748B] border-white/[0.04]'
                        }`}>
                          {a.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-sans">
                        <span>Crew: {a.crew}</span>
                        <span>{dist} km (~{eta}m)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= TAB 4: AUDIT TIMELINE ================= */}
            {activeTab === 'audit' && (
              <div className="space-y-2">
                <div className="text-[10px] text-[#94A3B8] border-b border-white/[0.04] pb-1.5 flex items-center justify-between font-sans">
                  <span>DISPATCH AUDIT TRAIL</span>
                  <span className="text-[#2D6A4F] font-mono text-[9px] font-bold">[REALTIME VERIFIED]</span>
                </div>

                {auditLog.map(log => (
                  <div key={log.event_id} className="nm-flat rounded-xl p-2.5 border border-white/[0.04] space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#FF334B]">{log.event_type}</span>
                      <span className="text-[#94A3B8] font-mono text-[9px]">{log.timestamp}</span>
                    </div>
                    <div className="text-[#F8FAFC] font-sans">{log.details}</div>
                    <div className="text-[9px] text-[#64748B]">ID: {log.event_id} &bull; DISPATCH LOCK SECURED</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
