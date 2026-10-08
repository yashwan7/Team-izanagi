import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function TriageMap({ patients = [], selectedPatientId, onSelectPatient }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map centered on tactical sector
      const map = L.map(mapContainerRef.current, {
        center: [28.6189, 77.2150],
        zoom: 14,
        zoomControl: true,
        attributionControl: false
      });

      // Dark tactical map tiles (CartoDB Dark Matter)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add tactical triage pins
    patients.forEach(item => {
      const p = item.capsule;
      const lat = p.gps?.lat || 28.6189;
      const lng = p.gps?.lng || 77.2150;
      const badge = item.triage_badge || 'YELLOW';
      const isSelected = p.patient_id === selectedPatientId;

      const colorMap = {
        RED: '#ef4444',
        YELLOW: '#eab308',
        GREEN: '#22c55e',
        BLACK: '#6b7280'
      };
      const pinColor = colorMap[badge] || '#eab308';

      // Create glowing military HUD pin
      const iconHtml = `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; width: ${isSelected ? '36px' : '28px'}; height: ${isSelected ? '36px' : '28px'}; border-radius: 50%; background: ${pinColor}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #0f172a; border: 2.5px solid ${pinColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px ${pinColor};">
            <span style="font-size: 9px; font-weight: 800; color: ${pinColor};">${badge[0]}</span>
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

      // Popup
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; min-width: 170px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: #f3f4f6;">${p.patient_id}</strong>
            <span style="background: ${pinColor}22; color: ${pinColor}; border: 1px solid ${pinColor}; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
              ${badge} (${item.priority_score})
            </span>
          </div>
          <div style="color: #9ca3af; font-size: 11px; margin-bottom: 6px;">${p.patient_name || 'Operative'}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; background: #0b0f19; padding: 6px; border-radius: 4px;">
            <div>HR: <strong style="color: #fff;">${p.vitals?.heart_rate || '--'}</strong></div>
            <div>SpO2: <strong style="color: #fff;">${p.vitals?.spo2 || '--'}%</strong></div>
            <div>Help: <strong style="color: #38bdf8;">${Math.round(p.time_to_help * 60)}m</strong></div>
            <div>HMAC: <strong style="color: ${p.verification_status === 'VERIFIED' ? '#22c55e' : '#ef4444'};">${p.verification_status}</strong></div>
          </div>
        </div>
      `);

      marker.on('click', () => {
        if (onSelectPatient) onSelectPatient(p.patient_id);
      });

      markersRef.current[p.patient_id] = marker;
    });

  }, [patients, selectedPatientId, onSelectPatient]);

  return (
    <div className="relative w-full h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950/70 shadow-xl">
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md text-xs font-mono">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-slate-300 font-semibold tracking-wider">OFFLINE TACTICAL GPS MAP</span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400">{patients.length} Nodes Located</span>
      </div>
      <div ref={mapContainerRef} className="w-full h-full min-h-[340px]" />
    </div>
  );
}
