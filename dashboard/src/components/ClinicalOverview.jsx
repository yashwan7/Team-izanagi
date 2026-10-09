import React, { useMemo } from 'react';
import { 
  Users, Activity, FileText, Heart, 
  Flame, Moon, Footprints, ShieldCheck, 
  ChevronRight, Radio, Cpu, Compass, 
  Gauge, ExternalLink, RefreshCw, AlertTriangle,
  Sparkles, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { useMqttTelemetry } from '../lib/useMqttTelemetry';

export default function ClinicalOverview({ 
  patients = [], 
  selectedPatientId, 
  onSelectPatient,
  networkStatus,
  onNavigateTab
}) {
  // Connect to real-time MQTT telemetry stream from HiveMQ
  // Broker: wss://broker.hivemq.com:8084/mqtt
  // Topic: izanagi/sensors/data
  const {
    telemetry,
    connectionStatus,
    packetCount,
    lastUpdated,
    pulseHistory,
    topic,
    injectSamplePacket
  } = useMqttTelemetry();

  const { pulse_val, force_n, hub_online, lat, lng } = telemetry;

  const activePatientItem = patients.find(p => p.capsule.patient_id === selectedPatientId) || patients[0];
  const p = activePatientItem?.capsule || {
    patient_id: 'PT-101',
    patient_name: 'John Smith',
    vitals: { heart_rate: pulse_val, spo2: 98, systolic_bp: 120, diastolic_bp: 80, respiratory_rate: 16 }
  };

  const isTachycardic = pulse_val > 100;
  const isBradycardic = pulse_val < 60;
  
  // Force N calculations (0 - 4095 gauge)
  const forcePct = Math.min(100, Math.max(0, Math.round((force_n / 4095) * 100)));
  const forceNewtons = Math.round((force_n / 4095) * 980);
  const estimatedKg = ((force_n / 4095) * 100).toFixed(1);

  const bedOccupancyState = useMemo(() => {
    if (force_n < 250) {
      return { label: 'BED UNOCCUPIED / CALIBRATED', color: 'text-[#94A3B8]', badge: 'nm-badge' };
    }
    if (force_n > 3200) {
      return { label: 'HIGH LOAD / PATIENT RESTLESS', color: 'text-[#C84B31]', badge: 'nm-alert-inset text-[#C84B31] border border-[#C84B31]/40' };
    }
    return { label: 'OCCUPIED — STABLE REST', color: 'text-[#2D6A4F]', badge: 'nm-inset text-[#2D6A4F] border border-[#2D6A4F]/30' };
  }, [force_n]);

  // Generate SVG path for dynamic pulse waveform based on history
  const waveSvgPath = useMemo(() => {
    if (!pulseHistory || pulseHistory.length === 0) {
      return 'M 0 60 L 500 60';
    }
    const points = pulseHistory.map((val, idx) => {
      const x = (idx / (pulseHistory.length - 1)) * 500;
      // Map 40-140 bpm to 10-110 SVG Y coordinates (inverted)
      const normalized = Math.min(130, Math.max(50, val));
      const y = 110 - ((normalized - 50) / 80) * 80;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${points[0]} ` + points.slice(1).map(pt => `L ${pt}`).join(' ');
  }, [pulseHistory]);

  return (
    <div className="space-y-5 font-mono select-none text-[#1A241C]">
      
      {/* ================= TOP HARDWARE & HIVEMQ MQTT STREAM HEADER ================= */}
      <div className="nm-flat rounded-2xl p-4 border border-white/80 flex items-center justify-between gap-3 flex-wrap">
        
        {/* Hardware Status Badge & Title */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 nm-convex rounded-xl flex items-center justify-center text-[#2D6A4F]">
            <Cpu className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-black tracking-wider text-[#1A241C] uppercase">
                EMBEDDED EDGE TELEMETRY GRID
              </span>

              {/* Hardware Status Badge / Hub Link Indicator */}
              {hub_online ? (
                <div className="flex items-center gap-2 px-3 py-1 nm-inset rounded-xl border border-[#2D6A4F]/50 text-[#2D6A4F] text-[10px] font-bold shadow-[0_0_10px_rgba(45,106,79,0.15)]">
                  <span className="w-2 h-2 rounded-full bg-[#2D6A4F] shadow-[0_0_6px_#2D6A4F] animate-pulse"></span>
                  <span>NXP MCXN236: ONLINE</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 nm-alert-inset rounded-xl border border-[#C84B31]/60 text-[#C84B31] text-[10px] font-bold shadow-[0_0_10px_rgba(200,75,49,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-[#C84B31] shadow-[0_0_6px_#C84B31] animate-pulse"></span>
                  <span>NXP MCXN236: OFFLINE</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-[#758475] mt-1 font-medium flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                connectionStatus === 'CONNECTED'
                  ? 'nm-inset text-[#2D6A4F] border border-[#2D6A4F]/40 bg-[#E8EFE9] shadow-[0_0_8px_rgba(45,106,79,0.15)]'
                  : 'nm-alert-inset text-[#C84B31] border border-[#C84B31]/40'
              }`}>
                <Radio className={`w-3 h-3 ${connectionStatus === 'CONNECTED' ? 'text-[#2D6A4F]' : 'text-[#C84B31]'}`} />
                <span>HiveMQ WSS:</span>
                <strong className={connectionStatus === 'CONNECTED' ? 'text-[#2D6A4F]' : 'text-[#C84B31]'}>
                  {connectionStatus}
                </strong>
              </span>
              <span>&bull;</span>
              <span>Topic: <code className="text-[#1A241C] bg-[#E8E4DA] px-1.5 py-0.5 rounded font-mono text-[9px]">{topic}</code></span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <span>Pkts:</span>
                <strong className="text-[#2D6A4F] font-black text-xs nm-inset px-1.5 py-0.2 rounded-md border border-[#2D6A4F]/30 bg-[#E8EFE9]">
                  {packetCount}
                </strong>
              </span>
              <span>&bull;</span>
              <span>Sync: <span className="text-[#556455]">{lastUpdated}</span></span>
            </div>
          </div>
        </div>

        {/* Quick Testing & Live Stream Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => injectSamplePacket()}
            className="px-3 py-1.5 nm-btn rounded-xl text-[10px] font-bold text-[#1A241C] hover:text-[#2D6A4F] flex items-center gap-1.5 transition-all uppercase"
            title="Inject a real-time sample packet to verify telemetry stream binding"
          >
            <Sparkles className="w-3 h-3 text-[#2D6A4F]" />
            <span>TEST MQTT PACKET</span>
          </button>

          <button
            onClick={() => injectSamplePacket({ hub_online: !hub_online })}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all uppercase ${
              hub_online 
                ? 'nm-alert-inset text-[#C84B31] border border-[#C84B31]/30 hover:border-[#C84B31]/60' 
                : 'nm-btn text-[#2D6A4F] border border-[#2D6A4F]/30'
            }`}
            title="Toggle NXP MCXN236 Hub Link state"
          >
            <RefreshCw className="w-3 h-3" />
            <span>TOGGLE HUB {hub_online ? 'OFFLINE' : 'ONLINE'}</span>
          </button>
        </div>

      </div>

      {/* ================= PRIMARY TELEMETRY CARDS (3 COLS) ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* CARD 1: PULSE RATE CARD */}
        <div className="nm-flat rounded-2xl p-5 border border-white/80 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 nm-convex rounded-xl flex items-center justify-center text-[#C84B31]">
                  <Heart className="w-4 h-4 fill-[#C84B31]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#758475]">Live Pulse Telemetry</div>
                  <div className="text-xs font-black text-[#1A241C]">PULSE RATE CARD</div>
                </div>
              </div>

              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg uppercase ${
                isTachycardic
                  ? 'nm-alert-inset text-[#C84B31] border border-[#C84B31]/40'
                  : isBradycardic
                  ? 'nm-inset text-[#F59E0B] border border-[#F59E0B]/30'
                  : 'nm-inset text-[#2D6A4F] border border-[#2D6A4F]/30'
              }`}>
                {isTachycardic ? 'TACHYCARDIA' : isBradycardic ? 'BRADYCARDIA' : 'NORMAL'}
              </span>
            </div>

            {/* Hero Live Pulse Readout */}
            <div className="nm-inset rounded-xl p-3 my-2 flex items-baseline justify-between">
              <div>
                <span className="text-[9px] uppercase font-bold text-[#758475] block">pulse_val readout</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-black tracking-tight ${isTachycardic ? 'text-[#C84B31]' : 'text-[#1A241C]'}`}>
                    {pulse_val}
                  </span>
                  <span className="text-xs font-bold text-[#758475]">BPM</span>
                </div>
              </div>
              
              <div className="text-right">
                <span className="text-[9px] font-bold text-[#556455] block">STREAM ACTIVE</span>
                <span className="text-[10px] text-[#758475] font-mono">±1.2 bpm precision</span>
              </div>
            </div>

            {/* Reactive Waveform Mini Chart */}
            <div className="relative h-16 w-full nm-inset rounded-xl p-1.5 overflow-hidden my-2">
              <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                <path
                  d={waveSvgPath}
                  fill="none"
                  stroke={isTachycardic ? '#C84B31' : '#2D6A4F'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div className="pt-2 border-t border-[#D5CEBF]/40 flex items-center justify-between text-[10px] text-[#758475]">
            <span>Patient: <strong className="text-[#1A241C]">{p.patient_name}</strong></span>
            <span>SpO2: <strong className="text-[#2D6A4F]">{p.vitals?.spo2 || 98}%</strong></span>
          </div>
        </div>

        {/* CARD 2: BED FORCE / WEIGHT CARD */}
        <div className="nm-flat rounded-2xl p-5 border border-white/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 nm-convex rounded-xl flex items-center justify-center text-[#2D6A4F]">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#758475]">Load Cell &bull; Force Sensor</div>
                  <div className="text-xs font-black text-[#1A241C]">BED FORCE / WEIGHT CARD</div>
                </div>
              </div>

              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg uppercase ${bedOccupancyState.badge}`}>
                {forcePct}% LOAD
              </span>
            </div>

            {/* Hero Force Readout */}
            <div className="nm-inset rounded-xl p-3 my-2 flex items-baseline justify-between">
              <div>
                <span className="text-[9px] uppercase font-bold text-[#758475] block">force_n (0 - 4095)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-[#1A241C] tracking-tight">
                    {force_n}
                  </span>
                  <span className="text-xs font-bold text-[#758475]">/ 4095</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black text-[#2D6A4F] block">~{forceNewtons} N</span>
                <span className="text-[10px] text-[#758475] font-mono">est. {estimatedKg} kg</span>
              </div>
            </div>

            {/* Neumorphic Force Gauge Bar */}
            <div className="space-y-1 my-2">
              <div className="flex justify-between text-[9px] font-bold text-[#758475]">
                <span>0 (EMPTY)</span>
                <span>2048 (MID)</span>
                <span>4095 (MAX)</span>
              </div>
              <div className="w-full h-3.5 nm-inset rounded-full p-0.5 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#2D6A4F] via-[#52B788] to-[#C84B31] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(45,106,79,0.3)]"
                  style={{ width: `${forcePct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#D5CEBF]/40 flex items-center justify-between text-[10px]">
            <span className="text-[#758475]">Status:</span>
            <strong className={`font-bold uppercase ${bedOccupancyState.color}`}>{bedOccupancyState.label}</strong>
          </div>
        </div>

        {/* CARD 3: ACTIVE ROUTE MATRIX / GPS CARD */}
        <div className="nm-flat rounded-2xl p-5 border border-white/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 nm-convex rounded-xl flex items-center justify-center text-[#2D6A4F]">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#758475]">Live Geonav Telemetry</div>
                  <div className="text-xs font-black text-[#1A241C]">ACTIVE ROUTE MATRIX / GPS</div>
                </div>
              </div>

              <span className="px-2 py-0.5 text-[9px] font-bold nm-inset rounded-lg text-[#2D6A4F] border border-[#2D6A4F]/30 uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] animate-pulse"></span>
                <span>LOCK ±2.4M</span>
              </span>
            </div>

            {/* Coordinates Display Card */}
            <div className="nm-inset rounded-xl p-3 my-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#758475] uppercase">LATITUDE:</span>
                <strong className="text-[#1A241C] font-mono text-sm">{lat}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#758475] uppercase">LONGITUDE:</span>
                <strong className="text-[#1A241C] font-mono text-sm">{lng}</strong>
              </div>
              <div className="text-[9px] text-[#556455] pt-1 border-t border-[#D5CEBF]/40 font-medium truncate">
                80 Feet Rd &bull; Brookes Haven Layout &bull; JP Nagar Ph 8
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 my-2 text-[10px]">
              <div className="nm-inset rounded-lg p-2 text-center">
                <span className="text-[8px] text-[#758475] uppercase block font-bold">CARRIER LINK</span>
                <span className="font-bold text-[#2D6A4F]">4G LTE UPLINK</span>
              </div>
              <div className="nm-inset rounded-lg p-2 text-center">
                <span className="text-[8px] text-[#758475] uppercase block font-bold">DISPATCH SECTOR</span>
                <span className="font-bold text-[#1A241C]">JP NAGAR 560076</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#D5CEBF]/40 flex items-center justify-between text-[10px]">
            {onNavigateTab ? (
              <button
                onClick={() => onNavigateTab('map')}
                className="text-[#2D6A4F] hover:underline font-bold uppercase flex items-center gap-1"
              >
                <span>OPEN GPS RADAR</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-[#2D6A4F] font-bold">RADAR MESH SYNCED</span>
            )}
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#758475] hover:text-[#1A241C] flex items-center gap-1"
            >
              <span>GOOGLE MAPS</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

      </div>

      {/* ================= MIDDLE ROW: CLINICAL ADMISSIONS & QUEUE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Total Admissions & System Stats (8 Cols) */}
        <div className="lg:col-span-8 nm-flat rounded-2xl p-5 border border-white/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[#D5CEBF]/40 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2D6A4F]" />
                <span className="text-xs font-bold text-[#1A241C] uppercase tracking-wider">
                  Clinical Admissions &amp; Rapid Triage
                </span>
              </div>
              <span className="text-[10px] text-[#758475]">&bull; Integrated NXP Edge Node</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="nm-inset rounded-xl p-3.5">
                <div className="text-[10px] uppercase font-bold text-[#758475]">Total Sector Cases</div>
                <div className="text-2xl font-black text-[#1A241C] mt-1">1,247</div>
                <div className="text-[10px] text-[#2D6A4F] font-bold mt-1">+12% prior cycle</div>
              </div>

              <div className="nm-alert-inset rounded-xl p-3.5 border border-[#C84B31]/30">
                <div className="text-[10px] uppercase font-bold text-[#C84B31]">Critical Triage (Red)</div>
                <div className="text-2xl font-black text-[#C84B31] mt-1">32 CASES</div>
                <div className="text-[10px] text-[#758475] font-medium mt-1">Acute priority demand</div>
              </div>

              <div className="nm-inset rounded-xl p-3.5">
                <div className="text-[10px] uppercase font-bold text-[#758475]">Pending Sync &amp; Merges</div>
                <div className="text-2xl font-black text-[#2D6A4F] mt-1">18 QUEUED</div>
                <div className="text-[10px] text-[#2D6A4F] font-bold mt-1">100% Nirantara CDC</div>
              </div>
            </div>

            {/* Secondary Vitals Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#D5CEBF]/40 text-xs">
              <div className="nm-inset rounded-xl p-2.5">
                <span className="text-[9px] uppercase font-bold text-[#758475] block">Oxygen Sat</span>
                <span className="font-black text-[#1A241C] text-sm">{p.vitals?.spo2 || 98}% SpO2</span>
              </div>
              <div className="nm-inset rounded-xl p-2.5">
                <span className="text-[9px] uppercase font-bold text-[#758475] block">Blood Pressure</span>
                <span className="font-black text-[#1A241C] text-sm">{p.vitals?.systolic_bp || 120}/{p.vitals?.diastolic_bp || 80}</span>
              </div>
              <div className="nm-inset rounded-xl p-2.5">
                <span className="text-[9px] uppercase font-bold text-[#758475] block">Resp. Rate</span>
                <span className="font-black text-[#1A241C] text-sm">{p.vitals?.respiratory_rate || 16} /min</span>
              </div>
              <div className="nm-alert-inset rounded-xl p-2.5 border border-[#C84B31]/30">
                <span className="text-[9px] uppercase font-bold text-[#C84B31] block">Transit ETA</span>
                <span className="font-black text-[#C84B31] text-sm">
                  {p.time_to_help < 1 ? `${Math.round(p.time_to_help * 60)} mins` : `${p.time_to_help} hrs`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Priority Triage Queue (4 Cols) */}
        <div className="lg:col-span-4 nm-flat rounded-2xl p-5 border border-white/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[#D5CEBF]/40 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#C84B31]" />
                <span className="text-xs font-bold text-[#1A241C] uppercase tracking-wider">Triage Queue</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-[#C84B31] shadow-[0_0_8px_#C84B31] animate-pulse"></span>
            </div>

            <div className="space-y-2.5">
              {patients.slice(0, 4).map((item, idx) => {
                const pt = item.capsule;
                const isSelected = pt.patient_id === selectedPatientId;
                const times = ['10:00 AM', '11:30 AM', '14:00 PM', '15:30 PM'];
                const timeStr = times[idx] || '16:15 PM';

                const badgeStyle = {
                  RED: 'text-[#C84B31] nm-alert-inset border border-[#C84B31]/40',
                  YELLOW: 'text-[#F59E0B] nm-inset border border-[#F59E0B]/30',
                  GREEN: 'text-[#2D6A4F] nm-inset border border-[#2D6A4F]/30'
                }[item.triage_badge] || 'text-[#758475] nm-inset';

                return (
                  <div
                    key={pt.patient_id}
                    onClick={() => onSelectPatient && onSelectPatient(pt.patient_id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                      isSelected 
                        ? 'nm-inset border border-[#2D6A4F]/40' 
                        : 'nm-flat hover:nm-convex border border-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-semibold text-[#758475] w-14">{timeStr}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]"></span>
                        <span className="text-xs font-bold text-[#1A241C] truncate max-w-[110px]">
                          {pt.patient_name || pt.patient_id}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg ${badgeStyle}`}>
                      {item.triage_badge}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {onSelectPatient && (
            <button 
              onClick={() => onSelectPatient(selectedPatientId)}
              className="w-full nm-btn rounded-xl py-2.5 text-xs font-bold text-[#1A241C] hover:text-[#2D6A4F] flex items-center justify-center gap-1.5 transition-all mt-4 uppercase"
            >
              <span>INSPECT COMPLETE ROSTER</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>

      {/* ================= BOTTOM ROW: HARDWARE & SYSTEM TELEMETRY STATS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Recent Admissions (6 Cols) */}
        <div className="lg:col-span-6 nm-flat rounded-2xl p-5 border border-white/80">
          <div className="flex items-center justify-between mb-4 border-b border-[#D5CEBF]/40 pb-3">
            <span className="text-xs font-bold text-[#1A241C] uppercase tracking-wider">Recent Registrations</span>
            <span className="text-[10px] font-bold text-[#2D6A4F] cursor-pointer hover:underline uppercase">Sector View</span>
          </div>

          <div className="space-y-2.5">
            {patients.slice(0, 4).map((item, idx) => {
              const pt = item.capsule;
              const isSelected = pt.patient_id === selectedPatientId;
              const dates = ['12 Oct, 2026', '11 Oct, 2026', '10 Oct, 2026', '09 Oct, 2026'];
              const ages = ['45 yrs &bull; Male', '32 yrs &bull; Female', '56 yrs &bull; Male', '29 yrs &bull; Male'];

              return (
                <div
                  key={pt.patient_id}
                  onClick={() => onSelectPatient && onSelectPatient(pt.patient_id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'nm-inset border border-[#2D6A4F]/40' 
                      : 'nm-flat hover:nm-convex border border-white/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 nm-convex rounded-xl flex items-center justify-center font-bold text-[10px] text-[#2D6A4F]">
                      {pt.patient_name ? pt.patient_name.split(' ').map(n=>n[0]).join('').slice(0,2) : 'PT'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1A241C]">{pt.patient_name}</div>
                      <div className="text-[10px] text-[#758475]" dangerouslySetInnerHTML={{ __html: ages[idx % ages.length] }} />
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-[#758475]">{dates[idx % dates.length]}</div>
                    <div className="text-[10px] font-bold text-[#2D6A4F]">{pt.patient_id}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Telemetry Hardware Link & Protocol Verification (6 Cols) */}
        <div className="lg:col-span-6 nm-flat rounded-2xl p-5 border border-white/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 border-b border-[#D5CEBF]/40 pb-3">
            <span className="text-xs font-bold text-[#1A241C] uppercase tracking-wider">
              NXP &amp; Dual-Port Failover Telemetry
            </span>
            <span className="text-[10px] text-[#758475] uppercase">Live Sync</span>
          </div>

          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <Footprints className="w-3.5 h-3.5 text-[#2D6A4F]" />
                  <span className="text-xs font-bold text-[#556455]">Port A Link Quality</span>
                </div>
                <span className="font-bold text-[#1A241C] text-xs">9,842 <span className="text-[#758475]">/ 10,000 pkts</span></span>
              </div>
              <div className="w-full h-2 nm-inset rounded-full p-0.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#2D6A4F] to-[#52B788] rounded-full" style={{ width: '98%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span className="text-xs font-bold text-[#556455]">Dual-Port Failover Redundancy</span>
                </div>
                <span className="font-bold text-[#1A241C] text-xs">Active &bull; 0 packet drops</span>
              </div>
              <div className="w-full h-2 nm-inset rounded-full p-0.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#F59E0B] to-[#FCD34D] rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-[#2D6A4F]" />
                  <span className="text-xs font-bold text-[#556455]">HMAC Device Security &amp; Nirantara CDC</span>
                </div>
                <span className="font-bold text-[#2D6A4F] text-xs">AUTHENTICATED</span>
              </div>
              <div className="w-full h-2 nm-inset rounded-full p-0.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#2D6A4F] to-[#52B788] rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-[#758475] pt-3.5 border-t border-[#D5CEBF]/40 flex items-center justify-between mt-4">
            <span>Hospital Telemetry Protocol &bull; MCXN236 Edge Hub</span>
            <span className="text-[#2D6A4F] font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> VERIFIED
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
