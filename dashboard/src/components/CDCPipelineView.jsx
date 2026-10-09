import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileCode2,
  FileInput,
  Gauge,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  Cpu,
  Layers,
  ArrowRight,
  Radio,
  Sliders,
  HardDrive,
  FileSpreadsheet,
  Zap,
  Info
} from 'lucide-react';
import {
  DEFAULT_CDC_CONFIG,
  createRunId,
  replayTraceRows,
  runAutomatedCdcTests,
  runCdcSimulation,
} from '../lib/cdcSimulation.js';
import {
  TRACE_PARQUET_SCHEMA,
  buildJsonReport,
  buildTraceParquet,
  buildVerificationParquet,
  downloadArrayBuffer,
  downloadText,
  inspectTraceFile,
} from '../lib/cdcParquet.js';

const speedOptions = [1, 5, 10, 25, 100];
const depthOptions = [8, 16];

// Tactical Clinical Telemetry Presets connecting CDC to Frontline Medicine
const CLINICAL_PRESETS = [
  {
    id: 'combat-eog',
    name: 'Combat Bio-Wearable (100Hz → 25Hz)',
    badge: 'EOG & Vitals',
    sourceHz: 100,
    destinationHz: 25,
    durationMs: 800,
    fifoDepth: 16,
    description: 'High-speed eye-gaze (100Hz) & SpO2 micro-flutter bridged into austere LoRa mesh transmitter (25Hz) with zero frame drop.'
  },
  {
    id: 'ambulance-icu',
    name: 'Mobile ICU Critical (120Hz → 50Hz)',
    badge: 'Multipara Monitor',
    sourceHz: 120,
    destinationHz: 50,
    durationMs: 1000,
    fifoDepth: 16,
    description: 'Continuous 12-lead ECG & transport vent waveforms buffered across high-latency satellite burst transceiver.'
  },
  {
    id: 'vital-patch',
    name: 'Field Vital Patch (75Hz → 20Hz)',
    badge: 'Triage Sieve',
    sourceHz: 75,
    destinationHz: 20,
    durationMs: 600,
    fifoDepth: 8,
    description: 'Battery-optimized triage vital sensor feeding tactical body-area mesh network under intermittent channel fade.'
  },
  {
    id: 'surge-stress',
    name: 'Surge Channel Stress Test (160Hz → 35Hz)',
    badge: 'Backpressure Test',
    sourceHz: 160,
    destinationHz: 35,
    durationMs: 900,
    fifoDepth: 8,
    description: 'Forces high clock disparity to verify FIFO full flag detection, Gray code wrap integrity, and zero data corruption.'
  }
];

export default function CDCPipelineView() {
  const [config, setConfig] = useState(() => ({
    ...DEFAULT_CDC_CONFIG,
    runId: createRunId('cdc-synthetic'),
  }));
  const [simulation, setSimulation] = useState(() => runCdcSimulation({
    ...DEFAULT_CDC_CONFIG,
    runId: createRunId('cdc-synthetic'),
  }));
  const [tests, setTests] = useState(() => runAutomatedCdcTests());
  const [traceInspection, setTraceInspection] = useState(null);
  const [traceError, setTraceError] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(DEFAULT_CDC_CONFIG.replaySpeed);
  const [activePreset, setActivePreset] = useState('combat-eog');
  const [replayState, setReplayState] = useState({
    running: false,
    index: 0,
    currentEvent: null,
    source: 'synthetic sample',
  });
  const [replayReport, setReplayReport] = useState(null);
  const replayTimerRef = useRef(null);

  const passCount = tests.filter(test => test.status === 'PASS').length;
  const eventRows = traceInspection?.previewRows?.length ? traceInspection.previewRows : simulation.events;
  const eventRowsForTable = eventRows.slice(-80).reverse();
  const selectedColumns = traceInspection?.columns || TRACE_PARQUET_SCHEMA.map(column => column.name);
  const selectedSchema = traceInspection?.schema || TRACE_PARQUET_SCHEMA.map(column => ({
    name: column.name,
    physicalType: column.type,
    logicalType: column.type,
    repetition: column.nullable ? 'OPTIONAL' : 'REQUIRED',
  }));
  const timestampRange = traceInspection?.timestampRange || {
    min: simulation.summary.firstTimestampMs,
    max: simulation.summary.lastTimestampMs,
  };
  const rowCount = traceInspection?.rowCount ?? simulation.events.length;
  const activeSummary = replayReport?.summary || traceInspection?.replay?.summary || simulation.summary;
  const sourceLabel = traceInspection
    ? traceInspection.fileName
    : 'Synthetic Tactical CDC Sample Trace';

  const schemaTypeMap = useMemo(() => {
    return new Map(TRACE_PARQUET_SCHEMA.map(column => [column.name, column]));
  }, []);

  useEffect(() => {
    return () => stopReplay();
  }, []);

  const updateConfig = (key, value) => {
    setConfig(current => ({
      ...current,
      [key]: value,
    }));
  };

  const applyPreset = (preset) => {
    stopReplay();
    setActivePreset(preset.id);
    const nextConfig = {
      ...config,
      sourceHz: preset.sourceHz,
      destinationHz: preset.destinationHz,
      durationMs: preset.durationMs,
      fifoDepth: preset.fifoDepth,
      runId: createRunId(`cdc-${preset.id}`),
      replaySpeed,
    };
    setConfig(nextConfig);
    const nextSim = runCdcSimulation(nextConfig);
    setSimulation(nextSim);
    setTraceInspection(null);
    setTraceError('');
    setReplayReport(null);
    setReplayState({
      running: false,
      index: 0,
      currentEvent: null,
      source: `Preset: ${preset.name}`,
    });
  };

  const generateSyntheticTrace = () => {
    stopReplay();
    const nextConfig = {
      ...config,
      runId: createRunId('cdc-synthetic'),
      replaySpeed,
    };
    const nextSimulation = runCdcSimulation(nextConfig);
    setConfig(nextConfig);
    setSimulation(nextSimulation);
    setTraceInspection(null);
    setTraceError('');
    setReplayReport(null);
    setReplayState({
      running: false,
      index: 0,
      currentEvent: null,
      source: 'synthetic sample',
    });
  };

  const resetSyntheticTrace = () => {
    stopReplay();
    const nextConfig = {
      ...DEFAULT_CDC_CONFIG,
      runId: createRunId('cdc-synthetic'),
      replaySpeed,
    };
    setConfig(nextConfig);
    const nextSimulation = runCdcSimulation(nextConfig);
    setSimulation(nextSimulation);
    setTraceInspection(null);
    setTraceError('');
    setReplayReport(null);
  };

  const handleTraceFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    stopReplay();
    setTraceError('');
    setIsInspecting(true);
    try {
      const inspection = await inspectTraceFile(file, { replaySpeed });
      setTraceInspection(inspection);
      setReplayReport(inspection.replay);
      if (!inspection.validation.valid) {
        setTraceError(`Invalid CDC trace schema. Missing: ${inspection.validation.missing.join(', ')}`);
      }
    } catch (error) {
      setTraceInspection(null);
      setReplayReport(null);
      setTraceError(error.message || 'Could not inspect this Parquet file.');
    } finally {
      setIsInspecting(false);
      event.target.value = '';
    }
  };

  const handleExportTrace = () => {
    downloadArrayBuffer(buildTraceParquet(simulation));
  };

  const handleExportVerification = () => {
    downloadArrayBuffer(buildVerificationParquet(replayReport || simulation));
  };

  const handleExportJson = () => {
    downloadText(buildJsonReport(replayReport || simulation));
  };

  const handleRunTests = () => {
    setTests(runAutomatedCdcTests());
  };

  const runReplay = () => {
    stopReplay();
    const rows = [...eventRows].sort((a, b) => Number(a.timestamp_ms ?? 0) - Number(b.timestamp_ms ?? 0));
    if (!rows.length) return;

    const report = replayTraceRows(rows, {
      replaySpeed,
      clockMode: 'recorded-timestamps',
      runId: rows[0]?.simulation_run_id,
    });
    setReplayReport(report);

    const firstTimestamp = Number(rows[0].timestamp_ms ?? 0);
    const startWall = performance.now();
    setReplayState({
      running: true,
      index: 0,
      currentEvent: rows[0],
      source: sourceLabel,
    });

    replayTimerRef.current = window.setInterval(() => {
      const elapsedLogicalMs = (performance.now() - startWall) * replaySpeed;
      const targetTime = firstTimestamp + elapsedLogicalMs;
      let nextIndex = 0;
      while (nextIndex < rows.length - 1 && Number(rows[nextIndex + 1].timestamp_ms ?? 0) <= targetTime) {
        nextIndex += 1;
      }

      setReplayState({
        running: nextIndex < rows.length - 1,
        index: nextIndex,
        currentEvent: rows[nextIndex],
        source: sourceLabel,
      });

      if (nextIndex >= rows.length - 1) {
        stopReplay(false);
      }
    }, 60);
  };

  function stopReplay(markPaused = true) {
    if (replayTimerRef.current) {
      window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    if (markPaused) {
      setReplayState(current => ({
        ...current,
        running: false,
      }));
    }
  }

  // Live or latest FIFO occupancy calculation
  const currentOccupancy = replayState.currentEvent
    ? (replayState.currentEvent.fifo_occupancy ?? 0)
    : (eventRows[eventRows.length - 1]?.fifo_occupancy ?? 0);
  const fifoDepth = config.fifoDepth || 8;
  const isFifoFull = currentOccupancy >= fifoDepth;
  const isFifoEmpty = currentOccupancy === 0;

  return (
    <div className="space-y-6">
      
      {/* ================= TOP TACTICAL MISSION HEADER ================= */}
      <section className="nm-flat rounded-2xl p-6 border border-white/80 bg-[#F7F4ED] shadow-[4px_4px_16px_rgba(200,190,175,0.4)]">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="w-10 h-10 nm-convex rounded-xl flex items-center justify-center text-[#2D6A4F] border border-white/70">
                <Cpu className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-[#1A241C] tracking-tight flex items-center gap-2">
                  <span>CDC Pipeline — Clock Domain Crossing & Parquet Telemetry</span>
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 nm-inset rounded text-[#2D6A4F] font-bold">
                    DUAL-CLOCK ASYNC FIFO
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 nm-inset rounded text-[#40534C] font-semibold">
                    APACHE PARQUET COLUMNAR
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 nm-inset rounded text-[#8F5A1E] font-semibold">
                    GRAY CODE POINTERS
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-[#556558] mt-3 max-w-4xl leading-relaxed">
              Tactical biomedical hardware bridges high-frequency patient biosensors (100Hz EOG eye tracking, ECG, SpO2) across
              asynchronous clock boundaries to austere telemetry radios (LoRa mesh, satellite burst) without packet dropping or metastablity.
              Traces are serialized into type-safe, compressed <strong>Apache Parquet</strong> files for offline audit and clinical analytics.
            </p>
          </div>

          {/* Quick Tactical Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={generateSyntheticTrace}
              className="px-3.5 py-2 rounded-xl nm-btn text-[#1A241C] text-xs font-bold flex items-center gap-2 transition-all hover:text-[#2D6A4F]"
              title="Generate new trace from active clock parameters"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Generate Trace</span>
            </button>
            <button
              onClick={handleExportTrace}
              className="px-3.5 py-2 rounded-xl nm-btn-accent text-white text-xs font-bold flex items-center gap-2 shadow-[0_0_12px_rgba(45,106,79,0.35)] transition-all"
              title="Download binary Apache Parquet trace file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .parquet</span>
            </button>
            <button
              onClick={handleExportVerification}
              className="px-3.5 py-2 rounded-xl nm-btn text-[#2D6A4F] border border-[#2D6A4F]/20 text-xs font-bold flex items-center gap-2 transition-all"
              title="Download verification results as Parquet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Results .parquet</span>
            </button>
            <button
              onClick={handleExportJson}
              className="px-3 py-2 rounded-xl nm-btn text-[#556558] text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Download human-readable JSON telemetry audit"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* CLINICAL TELEMETRY PRESETS */}
        <div className="mt-5 pt-4 border-t border-[#D5CEBF]/60">
          <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#40534C] uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <span>Clinical Domain Presets:</span>
            </span>
            <span className="text-[11px] text-[#7A8A7C]">Select a frontline telemetry scenario:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {CLINICAL_PRESETS.map(preset => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`text-left p-3 rounded-xl transition-all border ${
                    isActive
                      ? 'nm-inset bg-[#EFECE6] border-[#2D6A4F]/50 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06)]'
                      : 'nm-flat bg-[#F7F4ED] border-white/80 hover:border-[#2D6A4F]/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs font-bold text-[#1A241C] truncate">{preset.name}</strong>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black ${
                      isActive ? 'bg-[#2D6A4F] text-white' : 'nm-inset text-[#2D6A4F]'
                    }`}>
                      {preset.badge}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#2D6A4F] mt-1 font-semibold">
                    {preset.sourceHz}Hz → {preset.destinationHz}Hz • {preset.durationMs}ms
                  </div>
                  <p className="text-[10px] text-[#556558] mt-1.5 leading-snug line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= KEY METRICS SUMMARY ================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Accepted Telemetry Packets"
          value={activeSummary.acceptedTransactions?.toLocaleString() ?? 0}
          subtitle="Cross-domain FIFO writes accepted"
          tone="emerald"
          icon={CheckCircle2}
        />
        <StatCard
          title="Rejected Overflow / Underflow"
          value={((activeSummary.rejectedWriteAttempts || 0) + (activeSummary.rejectedReadAttempts || 0)).toLocaleString()}
          subtitle="Safely mitigated by backpressure"
          tone="amber"
          icon={AlertTriangle}
        />
        <StatCard
          title="FIFO Peak Occupancy"
          value={`${activeSummary.fifoOccupancyMax ?? 0} / ${config.fifoDepth}`}
          subtitle={`Buffer head-room: ${Math.max(0, config.fifoDepth - (activeSummary.fifoOccupancyMax || 0))} slots`}
          tone="blue"
          icon={Gauge}
        />
        <StatCard
          title="Data Integrity Verification"
          value={activeSummary.dataIntegrityPassed ? 'PASS (100%)' : 'FAIL'}
          subtitle="Zero frame corruption or reordering"
          tone={activeSummary.dataIntegrityPassed ? 'emerald' : 'rose'}
          icon={ShieldCheck}
        />
      </section>

      {/* ================= INTERACTIVE ASYNC FIFO HARDWARE VISUALIZER ================= */}
      <section className="nm-flat rounded-2xl p-5 border border-white/80 bg-[#F7F4ED]">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-[#2D6A4F]" />
            <h3 className="text-sm font-bold text-[#1A241C] uppercase tracking-wide">
              Dual-Clock Asynchronous FIFO Buffer State
            </h3>
            <span className="text-[11px] text-[#7A8A7C] font-mono">
              Depth: {fifoDepth} Entries • Current Occupancy: {currentOccupancy}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-2 py-1 rounded-lg font-bold flex items-center gap-1.5 ${
              isFifoFull
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : 'nm-inset text-[#556558]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isFifoFull ? 'bg-rose-600 animate-ping' : 'bg-[#7A8A7C]'}`} />
              FULL FLAG: {isFifoFull ? 'ASSERTED' : 'CLEAR'}
            </span>
            <span className={`text-[10px] font-mono px-2 py-1 rounded-lg font-bold flex items-center gap-1.5 ${
              isFifoEmpty
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'nm-inset text-[#556558]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isFifoEmpty ? 'bg-amber-600' : 'bg-[#7A8A7C]'}`} />
              EMPTY FLAG: {isFifoEmpty ? 'ASSERTED' : 'CLEAR'}
            </span>
          </div>
        </div>

        {/* Visual FIFO Cell Slots */}
        <div className="p-4 nm-inset rounded-xl bg-[#EFECE6]/70">
          <div className="grid grid-cols-8 md:grid-cols-16 gap-1.5">
            {Array.from({ length: fifoDepth }).map((_, index) => {
              const isOccupied = index < currentOccupancy;
              const isWriteHead = index === (currentOccupancy % fifoDepth);
              return (
                <div
                  key={index}
                  className={`h-16 rounded-lg border transition-all flex flex-col justify-between p-1.5 select-none ${
                    isOccupied
                      ? 'bg-[#2D6A4F] text-white border-[#2D6A4F] shadow-sm'
                      : 'bg-[#F7F4ED] border-[#D5CEBF] text-[#7A8A7C]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold">#{index}</span>
                    {isOccupied && <span className="w-1.5 h-1.5 rounded-full bg-[#52B788]" />}
                  </div>
                  <div className="text-center font-mono text-[10px] font-black">
                    {isOccupied ? 'DATA' : 'EMPTY'}
                  </div>
                  <div className="text-[8px] font-mono text-center truncate opacity-80">
                    {isWriteHead ? 'PTR' : ''}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#556558] mt-3 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#2D6A4F]" />
              <strong>Clock Domain A (Write):</strong> {config.sourceHz} Hz (High-Frequency Sensor Producer)
            </span>
            <span className="flex items-center gap-1.5">
              <strong>Clock Domain B (Read):</strong> {config.destinationHz} Hz (Telemetry Radio Consumer)
              <span className="w-2.5 h-2.5 rounded bg-[#F7F4ED] border border-[#D5CEBF]" />
            </span>
          </div>
        </div>
      </section>

      {/* ================= CONTROLS & TRACE REPLAY WORKSPACE ================= */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* CLOCK DOMAINS & HARDWARE CONTROLS */}
        <div className="nm-flat rounded-2xl p-6 border border-white/80 bg-[#F7F4ED] space-y-5 xl:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A241C] flex items-center gap-2 uppercase tracking-wide">
              <Clock3 className="w-4 h-4 text-[#2D6A4F]" />
              <span>Clock Domain Parameters</span>
            </h3>
            <button
              onClick={resetSyntheticTrace}
              className="p-2 rounded-xl nm-btn text-[#556558] hover:text-[#1A241C]"
              title="Reset to default synthetic CDC configuration"
            >
              <TimerReset className="w-4 h-4" />
            </button>
          </div>

          <ControlSlider
            label="Source Clock Domain A (Sensor Producer)"
            suffix=" Hz"
            min={10}
            max={180}
            value={config.sourceHz}
            onChange={value => updateConfig('sourceHz', value)}
          />
          <ControlSlider
            label="Destination Clock Domain B (Radio Consumer)"
            suffix=" Hz"
            min={10}
            max={180}
            value={config.destinationHz}
            onChange={value => updateConfig('destinationHz', value)}
          />
          <ControlSlider
            label="Trace Duration"
            suffix=" ms"
            min={200}
            max={1600}
            step={50}
            value={config.durationMs}
            onChange={value => updateConfig('durationMs', value)}
          />

          <div>
            <label className="text-[11px] font-bold text-[#556558] uppercase tracking-wider">FIFO Hardware Depth</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {depthOptions.map(depth => (
                <button
                  key={depth}
                  onClick={() => updateConfig('fifoDepth', depth)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    config.fifoDepth === depth
                      ? 'nm-btn-accent text-white shadow-[0_0_10px_rgba(45,106,79,0.3)]'
                      : 'nm-btn text-[#556558] hover:text-[#1A241C]'
                  }`}
                >
                  {depth} Slots ({depth * 32} bytes)
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl nm-inset p-4 space-y-3 bg-[#EFECE6]/60">
            <div className="flex items-center justify-between text-xs font-bold text-[#40534C]">
              <span>Source A Clock Pulses</span>
              <span className="font-mono">{config.sourceHz} Hz</span>
            </div>
            <Waveform frequency={config.sourceHz} tone="sage" />
            <div className="flex items-center justify-between text-xs font-bold text-[#40534C]">
              <span>Destination B Clock Pulses</span>
              <span className="font-mono">{config.destinationHz} Hz</span>
            </div>
            <Waveform frequency={config.destinationHz} tone="amber" />
          </div>
        </div>

        {/* PARQUET TRACE EXPLORER & DETERMINISTIC REPLAY */}
        <div className="nm-flat rounded-2xl p-6 border border-white/80 bg-[#F7F4ED] space-y-5 xl:col-span-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#1A241C] flex items-center gap-2 uppercase tracking-wide">
                <FileInput className="w-4 h-4 text-[#2D6A4F]" />
                <span>Parquet Telemetry Replay Engine</span>
              </h3>
              <p className="text-xs text-[#556558] mt-1 font-mono">
                Active Source: <strong className="text-[#1A241C]">{sourceLabel}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="px-3 py-2 rounded-xl nm-btn text-[#1A241C] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:text-[#2D6A4F]">
                <FileInput className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>Select .parquet</span>
                <input type="file" accept=".parquet,application/vnd.apache.parquet" onChange={handleTraceFile} className="hidden" />
              </label>

              <select
                value={replaySpeed}
                onChange={event => setReplaySpeed(Number(event.target.value))}
                className="px-3 py-2 rounded-xl nm-inset bg-transparent text-xs font-bold text-[#1A241C] outline-none"
              >
                {speedOptions.map(speed => <option key={speed} value={speed} className="bg-[#EFECE6]">{speed}x Speed</option>)}
              </select>

              <button
                onClick={runReplay}
                className="px-3.5 py-2 rounded-xl nm-btn-accent text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(45,106,79,0.3)]"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run Replay</span>
              </button>

              <button
                onClick={() => stopReplay()}
                className="p-2 rounded-xl nm-btn text-[#556558] hover:text-[#1A241C]"
                title="Pause replay"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {traceError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-800 px-4 py-3 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{traceError}</span>
            </div>
          )}

          {isInspecting && (
            <div className="rounded-xl nm-inset px-4 py-3 text-xs font-bold text-[#2D6A4F] flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#2D6A4F]" />
              <span>Inspecting Parquet footer, dictionary pages and schemas...</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoTile label="Total Rows" value={rowCount.toLocaleString()} />
            <InfoTile label="Time Window" value={`${formatMs(timestampRange?.min)} - ${formatMs(timestampRange?.max)}`} />
            <InfoTile label="Schema Cols" value={`${selectedColumns.length} fields`} />
            <InfoTile
              label="Schema Status"
              value={traceInspection?.validation?.valid === false ? 'Schema Error' : 'Valid Parquet'}
              tone={traceInspection?.validation?.valid === false ? 'rose' : 'emerald'}
            />
          </div>

          {traceInspection?.previewTruncated && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-2.5 text-xs font-medium">
              Preview and replay are bounded to the first {traceInspection.previewLimit.toLocaleString()} rows to keep memory footprint austere.
            </div>
          )}

          {/* PARQUET SCHEMA TABLE & REPLAY STATE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* SCHEMA SPECIFICATION */}
            <div className="nm-inset rounded-xl p-3 bg-[#EFECE6]/50">
              <div className="px-2 py-1.5 text-[11px] font-bold text-[#40534C] uppercase tracking-wider border-b border-[#D5CEBF] flex items-center justify-between">
                <span>Parquet Schema (28 Columns)</span>
                <span className="font-mono text-[9px] text-[#7A8A7C]">HYPARQUET V1.31</span>
              </div>
              <div className="max-h-64 overflow-auto mt-2">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#EFECE6] text-[#7A8A7C]">
                    <tr className="border-b border-[#D5CEBF]">
                      <th className="px-3 py-1.5 font-bold">Column</th>
                      <th className="px-3 py-1.5 font-bold">Type</th>
                      <th className="px-3 py-1.5 font-bold">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSchema.map(column => (
                      <tr key={column.name} className="border-b border-[#D5CEBF]/40 last:border-0 hover:bg-white/40">
                        <td className="px-3 py-1.5 font-mono text-[#1A241C] text-[11px]">{column.name}</td>
                        <td className="px-3 py-1.5 text-[#2D6A4F] font-mono text-[11px] font-semibold">{column.logicalType || column.physicalType}</td>
                        <td className="px-3 py-1.5 text-[#556558] text-[10px]">{column.repetition || (schemaTypeMap.get(column.name)?.nullable ? 'OPT' : 'REQ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* REPLAY PROGRESS & CURRENT EVENT TELEMETRY */}
            <div className="nm-inset rounded-xl p-3 bg-[#EFECE6]/50 space-y-3">
              <div className="px-2 py-1.5 text-[11px] font-bold text-[#40534C] uppercase tracking-wider border-b border-[#D5CEBF] flex items-center justify-between">
                <span>Deterministic Replay Monitor</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  replayState.running ? 'bg-[#2D6A4F] text-white' : 'text-[#7A8A7C]'
                }`}>
                  {replayState.running ? 'STREAMING' : 'IDLE'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-[#556558] px-2">
                <span>Progress: {Math.min(replayState.index + 1, eventRows.length)} / {eventRows.length} events</span>
                <span className="font-bold text-[#2D6A4F]">{eventRows.length ? Math.round(((replayState.index + 1) / eventRows.length) * 100) : 0}%</span>
              </div>

              <div className="h-2 rounded-full nm-inset overflow-hidden bg-[#D5CEBF]/60">
                <div
                  className="h-full bg-[#2D6A4F] transition-all"
                  style={{ width: `${eventRows.length ? ((replayState.index + 1) / eventRows.length) * 100 : 0}%` }}
                />
              </div>

              <div className="rounded-xl nm-flat p-4 bg-[#F7F4ED] border border-white/70 min-h-32">
                <div className="text-[11px] text-[#2D6A4F] font-mono font-bold flex items-center justify-between">
                  <span>{formatMs(replayState.currentEvent?.timestamp_ms)}</span>
                  <span className="uppercase">{replayState.currentEvent?.clock_domain || 'DOMAIN'}</span>
                </div>
                <div className="mt-1.5 text-xs font-bold text-[#1A241C]">
                  {replayState.currentEvent?.event_type || 'Replay ready — click "Run Replay" above'}
                </div>
                <p className="mt-1.5 text-[11px] text-[#556558] leading-relaxed">
                  {replayState.currentEvent?.description || 'Simulate or step through asynchronous FIFO crossing telemetry packets.'}
                </p>
                {replayState.currentEvent?.sensor_heart_rate && (
                  <div className="mt-2 pt-2 border-t border-[#D5CEBF]/60 flex items-center gap-3 text-[10px] font-mono text-[#2D6A4F]">
                    <span>HR: {replayState.currentEvent.sensor_heart_rate} bpm</span>
                    <span>SpO2: {replayState.currentEvent.sensor_spo2}%</span>
                    <span>Pressure: {replayState.currentEvent.sensor_pressure} mmHg</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= AUTOMATED VERIFICATION SUITE & EVENT LOG ================= */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* AUTOMATED FORMAL CHECKS */}
        <div className="nm-flat rounded-2xl p-6 border border-white/80 bg-[#F7F4ED] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A241C] uppercase tracking-wide">
              Automated CDC Verification (12 Proofs)
            </h3>
            <button
              onClick={handleRunTests}
              className="px-2.5 py-1 rounded-xl nm-btn text-[#2D6A4F] text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rerun</span>
            </button>
          </div>

          <div className="flex items-baseline gap-2.5 p-3 nm-inset rounded-xl bg-[#EFECE6]/60">
            <div className="text-3xl font-black text-[#2D6A4F]">{passCount}/{tests.length}</div>
            <div className="text-xs text-[#556558] font-semibold">formal CDC & Parquet assertions passing</div>
          </div>

          <div className="space-y-2 max-h-96 overflow-auto pr-1">
            {tests.map(test => (
              <div key={test.id} className="flex items-center justify-between gap-3 rounded-xl nm-flat p-2.5 bg-[#F7F4ED] border border-white/70">
                <span className="text-xs font-bold text-[#1A241C] truncate">{test.label}</span>
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-lg ${
                  test.status === 'PASS'
                    ? 'bg-[#2D6A4F] text-white shadow-sm'
                    : 'bg-rose-600 text-white'
                }`}>
                  {test.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT TELEMETRY EVENT LOG */}
        <div className="nm-flat rounded-2xl p-6 border border-white/80 bg-[#F7F4ED] xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-[#1A241C] uppercase tracking-wide">
              CDC Event Stream (Chronological Telemetry)
            </h3>
            <span className="text-xs text-[#7A8A7C] font-mono">
              Latest {eventRowsForTable.length} recorded events
            </span>
          </div>

          <div className="rounded-xl nm-inset p-2 bg-[#EFECE6]/50 overflow-hidden">
            <div className="max-h-[26rem] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#EFECE6] text-[#7A8A7C] z-10">
                  <tr className="border-b border-[#D5CEBF]">
                    <th className="px-3 py-2 font-bold">Time</th>
                    <th className="px-3 py-2 font-bold">Domain</th>
                    <th className="px-3 py-2 font-bold">Event Type</th>
                    <th className="px-3 py-2 font-bold">Seq</th>
                    <th className="px-3 py-2 font-bold">FIFO</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRowsForTable.map((row, index) => (
                    <tr key={`${row.event_index}-${index}`} className="border-b border-[#D5CEBF]/40 last:border-0 hover:bg-white/60">
                      <td className="px-3 py-2 font-mono text-[#556558] text-[11px]">{formatMs(row.timestamp_ms)}</td>
                      <td className="px-3 py-2 text-[#40534C] text-[11px] font-bold">{row.clock_domain}</td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-[#1A241C] text-[11px]">{row.event_type}</div>
                        <div className="text-[10px] text-[#7A8A7C] truncate max-w-sm">{row.description}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[#556558] text-[11px]">#{row.sequence_number}</td>
                      <td className="px-3 py-2 font-mono font-bold text-[#2D6A4F] text-[11px]">
                        {row.fifo_occupancy !== null && row.fifo_occupancy !== undefined ? `${row.fifo_occupancy}/${config.fifoDepth}` : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          row.integrity_status === 'ordered' || row.accepted
                            ? 'text-[#2D6A4F] bg-[#2D6A4F]/10'
                            : 'text-amber-800 bg-amber-100'
                        }`}>
                          {row.integrity_status || (row.accepted ? 'ACCEPTED' : 'REJECTED')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

// -------------------------------------------------------------
// Neumorphic Helper Components
// -------------------------------------------------------------

function StatCard({ title, value, subtitle, tone, icon: Icon }) {
  const tones = {
    emerald: 'text-[#2D6A4F] bg-[#2D6A4F]/10 border-[#2D6A4F]/20',
    amber: 'text-[#B45309] bg-[#B45309]/10 border-[#B45309]/20',
    blue: 'text-[#1D4ED8] bg-[#1D4ED8]/10 border-[#1D4ED8]/20',
    rose: 'text-[#BE123C] bg-[#BE123C]/10 border-[#BE123C]/20',
  };

  return (
    <div className="nm-flat rounded-2xl p-5 border border-white/80 bg-[#F7F4ED] shadow-[3px_3px_12px_rgba(200,190,175,0.35)]">
      <div className="flex items-center justify-between text-xs text-[#7A8A7C] font-bold mb-2">
        <span className="uppercase tracking-wider">{title}</span>
        <span className={`w-8 h-8 rounded-xl border flex items-center justify-center ${tones[tone] || tones.emerald}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="text-2xl font-black text-[#1A241C] tracking-tight">{value}</div>
      {subtitle && <p className="text-[11px] text-[#7A8A7C] mt-1 truncate">{subtitle}</p>}
    </div>
  );
}

function InfoTile({ label, value, tone = 'slate' }) {
  const toneClass = tone === 'emerald'
    ? 'text-[#2D6A4F] border-[#2D6A4F]/30 bg-[#2D6A4F]/5'
    : tone === 'rose'
      ? 'text-rose-800 border-rose-300 bg-rose-50'
      : 'text-[#1A241C] border-[#D5CEBF] bg-[#F7F4ED]';

  return (
    <div className={`rounded-xl border p-3 nm-flat ${toneClass}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A8A7C]">{label}</div>
      <div className="text-xs font-black mt-1 truncate">{value}</div>
    </div>
  );
}

function ControlSlider({ label, suffix, min, max, step = 1, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-[#556558] uppercase tracking-wide">
        <label>{label}</label>
        <span className="font-mono text-[#2D6A4F] font-black">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full accent-[#2D6A4F] mt-2 cursor-pointer"
      />
    </div>
  );
}

function Waveform({ frequency, tone }) {
  const bars = Array.from({ length: 28 }, (_, index) => index);
  const activeModulo = Math.max(2, Math.round(180 / frequency));
  const color = tone === 'amber' ? 'bg-[#D97706]' : 'bg-[#2D6A4F]';

  return (
    <div className="h-9 flex items-end gap-1">
      {bars.map(index => (
        <span
          key={index}
          className={`flex-1 rounded-sm transition-all ${index % activeModulo === 0 ? color : 'bg-[#D5CEBF]/70'}`}
          style={{ height: index % activeModulo === 0 ? '100%' : '35%' }}
        />
      ))}
    </div>
  );
}

function formatMs(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toFixed(2)}ms`;
}
