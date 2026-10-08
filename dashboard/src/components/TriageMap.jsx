import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Radio } from 'lucide-react';

export default function TriageMap({ patients = [], selectedPatientId, onSelectPatient }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.6189, 77.2150],
        zoom: 14,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

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
          <div style="position: absolute; width: ${isSelected ? '36px' : '28px'}; height: ${isSelected ? '36px' : '28px'}; border-radius: 50%; background: ${pinColor}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #0b1328; border: 2px solid ${pinColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${pinColor};">
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
        <div style="font-family: -apple-system, sans-serif; font-size: 13px; min-width: 180px; padding: 2px;">
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
    });

  }, [patients, selectedPatientId, onSelectPatient]);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-[#1b284a] bg-[#0b1328] shadow-xl">
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#080d1c]/90 border border-[#1b284a] backdrop-blur-md text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="text-slate-200 font-semibold tracking-wide">AMBULANCE & FIELD EVACUATION DISPATCH</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400 font-mono">{patients.length} Field Nodes Tracked</span>
      </div>
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />
    </div>
  );
}
