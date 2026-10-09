import React from 'react';
import { 
  Heart, Activity, Gauge, Thermometer, 
  CreditCard, Radio, Zap, Wind 
} from 'lucide-react';

/**
 * PulseCard Component - Displays real-time Pulse/Heart Rate (BPM)
 */
export function PulseCard({ value = 0, className = '' }) {
  const isElevated = value > 100;
  const isCritical = value > 130 || (value > 0 && value < 45);

  return (
    <div className={`bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all duration-300 hover:shadow-md ${className}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pulse Rate</div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
          isCritical ? 'bg-rose-100 text-rose-600 animate-pulse' :
          isElevated ? 'bg-amber-100 text-amber-600' :
          'bg-rose-50 text-rose-500'
        }`}>
          <Heart className={`w-5 h-5 ${value > 0 ? 'animate-bounce' : ''}`} style={{ animationDuration: value > 0 ? `${Math.max(0.4, 60 / value)}s` : '1s' }} />
        </div>
      </div>

      <div className="my-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-slate-800 tracking-tight font-mono">
            {value > 0 ? value : '--'}
          </span>
          <span className="text-xs font-semibold text-slate-400">BPM</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px]">
        <span className="text-slate-400 font-medium">Status</span>
        <span className={`font-bold px-2 py-0.5 rounded-full ${
          isCritical ? 'bg-rose-50 text-rose-600' :
          isElevated ? 'bg-amber-50 text-amber-600' :
          value > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
        }`}>
          {value === 0 ? 'STANDBY' : isCritical ? 'CRITICAL' : isElevated ? 'TACHYCARDIA' : 'NOMINAL'}
        </span>
      </div>
    </div>
  );
}

/**
 * ForceGauge Component - Displays real-time Load / Strain Force (N)
 */
export function ForceGauge({ value = 0, className = '' }) {
  const maxForce = 50.0;
  const pct = Math.min(100, Math.max(0, (value / maxForce) * 100));
  const isHigh = value > 35;

  return (
    <div className={`bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all duration-300 hover:shadow-md ${className}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Force Strain</div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
          isHigh ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'
        }`}>
          <Gauge className="w-5 h-5" />
        </div>
      </div>

      <div className="my-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-slate-800 tracking-tight font-mono">
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          <span className="text-xs font-semibold text-slate-400">Newtons (N)</span>
        </div>

        {/* Progress meter bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${
              isHigh ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px]">
        <span className="text-slate-400 font-medium">Load Gauge</span>
        <span className="font-semibold text-slate-600">{pct.toFixed(0)}% Capacity</span>
      </div>
    </div>
  );
}

/**
 * RFIDBadge Component - Displays detected RFID/NFC patient tag
 */
export function RFIDBadge({ cardId = 'NONE', className = '' }) {
  const hasTag = cardId && cardId !== 'NONE' && cardId !== 'NO_TAG';

  return (
    <div className={`bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all duration-300 hover:shadow-md ${className}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RFID Triage Tag</div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
          hasTag ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'
        }`}>
          <CreditCard className="w-5 h-5" />
        </div>
      </div>

      <div className="my-2">
        <div className="text-xs text-slate-400 font-medium mb-1">Tag UID / Identifier</div>
        <div className="flex items-center gap-2">
          <span className={`text-xl font-bold tracking-tight font-mono truncate ${
            hasTag ? 'text-purple-700' : 'text-slate-400'
          }`}>
            {cardId || 'NONE'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px]">
        <span className="text-slate-400 font-medium">Scanner</span>
        <span className={`font-bold px-2 py-0.5 rounded-full ${
          hasTag ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-500'
        }`}>
          {hasTag ? 'TAG IDENTIFIED' : 'SCANNING...'}
        </span>
      </div>
    </div>
  );
}

/**
 * EnvironmentCards - Pressure and Temperature Mini Cards
 */
export function PressureCard({ value = 0 }) {
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pressure</div>
        <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
          <Wind className="w-5 h-5" />
        </div>
      </div>
      <div className="my-2 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-slate-800 tracking-tight font-mono">
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        <span className="text-xs font-semibold text-slate-400">kPa</span>
      </div>
      <div className="pt-2 border-t border-slate-50 text-[11px] text-slate-400 flex justify-between">
        <span>Barometric Sensor</span>
        <span className="text-emerald-600 font-semibold">Active</span>
      </div>
    </div>
  );
}

export function TempCard({ value = 0 }) {
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Body Temp</div>
        <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
          <Thermometer className="w-5 h-5" />
        </div>
      </div>
      <div className="my-2 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-slate-800 tracking-tight font-mono">
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        <span className="text-xs font-semibold text-slate-400">&deg;C</span>
      </div>
      <div className="pt-2 border-t border-slate-50 text-[11px] text-slate-400 flex justify-between">
        <span>Thermal Sensor</span>
        <span className="text-emerald-600 font-semibold">{value >= 38 ? 'FEVER' : 'NORMAL'}</span>
      </div>
    </div>
  );
}

/**
 * Combined Sensor Grid - Renders all MQTT live telemetry widgets
 */
export default function SensorWidgetsGrid({ sensorData = {}, connectionStatus = 'Connecting...' }) {
  const isConnected = connectionStatus === 'Connected';

  return (
    <div className="space-y-4 mb-6">
      {/* Header bar with MQTT Status Pill */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span>MQTT Live Sensors Stream</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">topic: antigravity/sensors/data</span>
            </div>
            <div className="text-[11px] text-slate-500">
              HiveMQ WebSocket Broker &bull; MCXN236 / Tactical Bio-Sensors
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border shadow-sm transition-all ${
            isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : connectionStatus === 'Connecting...' || connectionStatus === 'Reconnecting...'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-ping' :
              connectionStatus === 'Connecting...' ? 'bg-amber-500' : 'bg-rose-500'
            }`} style={{ animationDuration: '2s' }} />
            <span>{connectionStatus}</span>
          </span>
        </div>
      </div>

      {/* 5-Widget Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <PulseCard value={sensorData.pulse_bpm} />
        <ForceGauge value={sensorData.force_n} />
        <RFIDBadge cardId={sensorData.rfid} />
        <PressureCard value={sensorData.pressure_kpa} />
        <TempCard value={sensorData.temp_c} />
      </div>
    </div>
  );
}
