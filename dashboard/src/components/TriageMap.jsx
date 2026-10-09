import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Radio, Layers } from 'lucide-react';

export default function TriageMap({ patients = [], selectedPatientId, onSelectPatient }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef({});

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC6AaQ9mU-hfC7aLE-G1mXoiBixf-UG1-s';
  const [mapType, setMapType] = useState('google-hybrid'); // 'google-hybrid' | 'google-roads' | 'tactical-dark'

  // Focal Tracking Coordinates
  const FOCAL_LAT = 12.871773;
  const FOCAL_LNG = 77.576856;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [FOCAL_LAT, FOCAL_LNG],
        zoom: 16,
        zoomControl: true,
        attributionControl: false
      });

      mapInstanceRef.current = map;
    }
  }, []);

  // Update Tile Layer when mapType or apiKey changes
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
      options = {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3']
      };
    } else if (mapType === 'google-roads') {
      tileUrl = `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${apiKey}`;
      options = {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3']
      };
    } else {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      options = {
        maxZoom: 19,
        subdomains: 'abcd'
      };
    }

    tileLayerRef.current = L.tileLayer(tileUrl, options).addTo(map);
  }, [mapType, apiKey]);

  const surveillanceLayersRef = useRef([]);

  // Setup Surveillance Circles & Radar on Focal Coordinates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous circles
    surveillanceLayersRef.current.forEach(layer => layer.remove());
    surveillanceLayersRef.current = [];

    // Outer 1200m Perimeter Zone
    const outerCircle = L.circle([FOCAL_LAT, FOCAL_LNG], {
      radius: 1200,
      color: '#3b82f6',
      weight: 1.2,
      dashArray: '8, 8',
      fillColor: '#1d4ed8',
      fillOpacity: 0.03
    }).addTo(map);

    // Mid 600m Surveillance Zone
    const midCircle = L.circle([FOCAL_LAT, FOCAL_LNG], {
      radius: 600,
      color: '#06b6d4',
      weight: 1.5,
      dashArray: '5, 5',
      fillColor: '#0891b2',
      fillOpacity: 0.06
    }).addTo(map);

    // Inner 250m Tactical Hotzone
    const innerCircle = L.circle([FOCAL_LAT, FOCAL_LNG], {
      radius: 250,
      color: '#10b981',
      weight: 1.8,
      fillColor: '#059669',
      fillOpacity: 0.08
    }).addTo(map);

    // Focal HQ Pin
    const hqIconHtml = `
      <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer;">
        <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: #38bdf8; opacity: 0.35; animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: #081229; border: 2px solid #38bdf8; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px #38bdf8;">
          <span style="font-size: 11px;">🎯</span>
        </div>
      </div>
    `;
    const hqIcon = L.divIcon({
      html: hqIconHtml,
      className: 'focal-hq-pin',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const hqMarker = L.marker([FOCAL_LAT, FOCAL_LNG], { icon: hqIcon }).addTo(map);
    hqMarker.bindPopup(`
      <div style="font-family: -apple-system, sans-serif; font-size: 12px; min-width: 180px; padding: 2px; color: #fff;">
        <div style="font-weight: 800; color: #38bdf8; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
          <span>🎯</span> TRACKING FOCAL POINT
        </div>
        <div style="font-family: monospace; font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
          GPS: ${FOCAL_LAT.toFixed(6)}, ${FOCAL_LNG.toFixed(6)}
        </div>
        <div style="background: #080d1a; padding: 6px; border-radius: 6px; border: 1px solid #1e294b; font-size: 10px; color: #cbd5e1;">
          <div>Zone: <strong>1.2km Tactical Radar</strong></div>
          <div>Sector: <strong>Active Surroundings Tracker</strong></div>
        </div>
      </div>
    `);

    surveillanceLayersRef.current = [outerCircle, midCircle, innerCircle, hqMarker];
  }, [FOCAL_LAT, FOCAL_LNG]);

  // Update Markers & Centering
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    patients.forEach(item => {
      const p = item.capsule;
      const lat = p.gps?.lat || FOCAL_LAT;
      const lng = p.gps?.lng || FOCAL_LNG;
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
        <div style="font-family: -apple-system, sans-serif; font-size: 13px; min-width: 190px; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: #f8fafc;">${p.patient_id}</strong>
            <span style="background: ${pinColor}25; color: ${pinColor}; border: 1px solid ${pinColor}; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
              ${badge} (${item.priority_score})
            </span>
          </div>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">${p.patient_name || 'Patient'}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; background: #080d1a; padding: 6px; border-radius: 6px; border: 1px solid #1e294b;">
            <div>HR: <strong style="color: #fff;">${p.vitals?.heart_rate || '--'}</strong></div>
            <div>SpO2: <strong style="color: #fff;">${p.vitals?.spo2 || '--'}%</strong></div>
            <div>Help: <strong style="color: #38bdf8;">${Math.round(p.time_to_help * 60)}m</strong></div>
            <div>Auth: <strong style="color: ${p.verification_status === 'VERIFIED' ? '#10b981' : '#ef4444'};">${p.verification_status}</strong></div>
          </div>
        </div>
      `);

      marker.on('click', () => {
        if (onSelectPatient) onSelectPatient(p.patient_id);
      });

      markersRef.current[p.patient_id] = marker;

      if (isSelected) {
        map.flyTo([lat, lng], 17, { duration: 0.8 });
        marker.openPopup();
      }
    });

  }, [patients, selectedPatientId, onSelectPatient, FOCAL_LAT, FOCAL_LNG]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([FOCAL_LAT, FOCAL_LNG], 16, { duration: 0.7 });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-[#1b284a] bg-[#0b1328] shadow-xl">
      {/* Top Header Overlay */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#080d1c]/90 border border-[#1b284a] backdrop-blur-md text-xs shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="text-slate-200 font-semibold tracking-wide">SURVEILLANCE RADAR ACTIVE</span>
        <span className="text-slate-600">|</span>
        <span className="text-sky-400 font-mono font-semibold">12.8718° N, 77.5769° E</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400 font-mono">{patients.length} Nodes in Perimeter</span>
      </div>

      {/* Layer Switcher & Recenter */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        <button
          onClick={handleRecenter}
          className="px-2.5 py-1.5 rounded-lg bg-[#080d1c]/90 border border-[#1b284a] text-slate-300 hover:text-white hover:bg-blue-600/30 text-[11px] font-mono transition-all flex items-center gap-1.5 shadow-md"
          title="Recenter to 12.871773, 77.576856"
        >
          <span>🎯</span> Focus Target
        </button>

        <div className="flex bg-[#080d1c]/90 border border-[#1b284a] rounded-lg p-0.5 backdrop-blur-md text-xs shadow-md">
          <button
            onClick={() => setMapType('google-hybrid')}
            className={`px-2 py-1 rounded transition-all text-[11px] font-medium ${
              mapType === 'google-hybrid'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🛰️ Satellite
          </button>
          <button
            onClick={() => setMapType('google-roads')}
            className={`px-2 py-1 rounded transition-all text-[11px] font-medium ${
              mapType === 'google-roads'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🗺️ Roads
          </button>
          <button
            onClick={() => setMapType('tactical-dark')}
            className={`px-2 py-1 rounded transition-all text-[11px] font-medium ${
              mapType === 'tactical-dark'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌌 Tactical
          </button>
        </div>
      </div>

      <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />
    </div>
  );
}
