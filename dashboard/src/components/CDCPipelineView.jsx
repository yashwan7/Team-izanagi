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
    : 'Synthetic CDC sample trace';

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

  return (
    <div className="space-y-6">
      <section className="bg-white/85 backdrop-blur-md rounded-3xl p-6 border border-slate-200/70 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700">
                <Activity className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">CDC Pipeline — Clock Domain Crossing</h2>
              <span className="px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Synthetic by default
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 pl-12 max-w-4xl">
              Browser CDC verification console with Parquet trace export, schema inspection and deterministic replay.
              Timing shown here is logical simulation time, not measured physical timing from NXP or ESP32 hardware.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={generateSyntheticTrace} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
              Generate Trace
            </button>
            <button onClick={handleExportTrace} className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all">
              <Download className="w-3.5 h-3.5" />
              Export Trace
            </button>
            <button onClick={handleExportVerification} className="px-3 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-semibold flex items-center gap-1.5 transition-all">
              <Database className="w-3.5 h-3.5" />
              Export Results
            </button>
            <button onClick={handleExportJson} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all">
              <FileCode2 className="w-3.5 h-3.5" />
              JSON Report
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <StatCard title="Accepted Transactions" value={activeSummary.acceptedTransactions} tone="emerald" icon={CheckCircle2} />
        <StatCard title="Rejected Attempts" value={(activeSummary.rejectedWriteAttempts || 0) + (activeSummary.rejectedReadAttempts || 0)} tone="amber" icon={AlertTriangle} />
        <StatCard title="FIFO Occupancy Max" value={activeSummary.fifoOccupancyMax} tone="blue" icon={Gauge} />
        <StatCard title="Integrity Result" value={activeSummary.dataIntegrityPassed ? 'PASS' : 'FAIL'} tone={activeSummary.dataIntegrityPassed ? 'emerald' : 'rose'} icon={ShieldCheck} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5 xl:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-blue-600" />
              Clock Domains
            </h3>
            <button onClick={resetSyntheticTrace} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600" title="Reset synthetic CDC configuration">
              <TimerReset className="w-4 h-4" />
            </button>
          </div>

          <ControlSlider label="Source Clock A" suffix="Hz" min={10} max={180} value={config.sourceHz} onChange={value => updateConfig('sourceHz', value)} />
          <ControlSlider label="Destination Clock B" suffix="Hz" min={10} max={180} value={config.destinationHz} onChange={value => updateConfig('destinationHz', value)} />
          <ControlSlider label="Duration" suffix="ms" min={200} max={1600} step={50} value={config.durationMs} onChange={value => updateConfig('durationMs', value)} />

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">FIFO Depth</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {depthOptions.map(depth => (
                <button
                  key={depth}
                  onClick={() => updateConfig('fifoDepth', depth)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    config.fifoDepth === depth
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {depth} entries
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Source A</span>
              <span>{config.sourceHz}Hz</span>
            </div>
            <Waveform frequency={config.sourceHz} tone="blue" />
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Destination B</span>
              <span>{config.destinationHz}Hz</span>
            </div>
            <Waveform frequency={config.destinationHz} tone="cyan" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5 xl:col-span-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileInput className="w-4 h-4 text-cyan-700" />
                Parquet Trace Explorer
              </h3>
              <p className="text-xs text-slate-500 mt-1">Selected file: <span className="font-semibold text-slate-700">{sourceLabel}</span></p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                <FileInput className="w-3.5 h-3.5" />
                Select Trace
                <input type="file" accept=".parquet,application/vnd.apache.parquet" onChange={handleTraceFile} className="hidden" />
              </label>
              <select
                value={replaySpeed}
                onChange={event => setReplaySpeed(Number(event.target.value))}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 outline-none"
              >
                {speedOptions.map(speed => <option key={speed} value={speed}>{speed}x replay</option>)}
              </select>
              <button onClick={runReplay} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all">
                <Play className="w-3.5 h-3.5" />
                Run Replay
              </button>
              <button onClick={() => stopReplay()} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600" title="Pause replay">
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {traceError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {traceError}
            </div>
          )}

          {isInspecting && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 px-4 py-3 text-xs font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Inspecting Parquet footer, schema and preview rows...
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <InfoTile label="Rows" value={rowCount.toLocaleString()} />
            <InfoTile label="Timestamp Range" value={`${formatMs(timestampRange?.min)} - ${formatMs(timestampRange?.max)}`} />
            <InfoTile label="Columns" value={selectedColumns.length} />
            <InfoTile label="Validation" value={traceInspection?.validation?.valid === false ? 'Invalid' : 'Ready'} tone={traceInspection?.validation?.valid === false ? 'rose' : 'emerald'} />
          </div>

          {traceInspection?.previewTruncated && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-xs font-semibold">
              Preview and replay are limited to the first {traceInspection.previewLimit.toLocaleString()} rows to avoid loading a large local Parquet file into browser memory.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wide">Schema</div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white sticky top-0">
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-2 font-semibold">Column</th>
                      <th className="px-4 py-2 font-semibold">Type</th>
                      <th className="px-4 py-2 font-semibold">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSchema.map(column => (
                      <tr key={column.name} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-mono text-slate-700">{column.name}</td>
                        <td className="px-4 py-2 text-slate-600">{column.logicalType || column.physicalType}</td>
                        <td className="px-4 py-2 text-slate-500">{column.repetition || (schemaTypeMap.get(column.name)?.nullable ? 'OPTIONAL' : 'REQUIRED')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wide">Replay State</div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    replayState.running
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {replayState.running ? 'Replaying' : 'Paused'}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {Math.min(replayState.index + 1, eventRows.length)} / {eventRows.length}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all"
                    style={{ width: `${eventRows.length ? ((replayState.index + 1) / eventRows.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="rounded-2xl bg-slate-950 text-slate-100 p-4 min-h-32">
                  <div className="text-[11px] text-cyan-300 font-mono">{formatMs(replayState.currentEvent?.timestamp_ms)} • {replayState.currentEvent?.clock_domain || 'domain'}</div>
                  <div className="mt-2 text-sm font-bold">{replayState.currentEvent?.event_type || 'Replay not started'}</div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">{replayState.currentEvent?.description || 'Run a replay to step through recorded CDC events using the selected clock speed.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Verification Results</h3>
            <button onClick={handleRunTests} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Rerun
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-extrabold text-slate-800">{passCount}/{tests.length}</div>
            <div className="text-xs text-slate-500">automated CDC checks passing</div>
          </div>
          <div className="space-y-2 max-h-96 overflow-auto pr-1">
            {tests.map(test => (
              <div key={test.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">{test.label}</span>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                  test.status === 'PASS'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}>
                  {test.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-slate-800">CDC Event Log</h3>
            <span className="text-xs text-slate-500">Showing latest {eventRowsForTable.length} rows from {sourceLabel}</span>
          </div>
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="max-h-[30rem] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Domain</th>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Seq</th>
                    <th className="px-4 py-3 font-semibold">FIFO</th>
                    <th className="px-4 py-3 font-semibold">Integrity</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRowsForTable.map((row, index) => (
                    <tr key={`${row.event_index}-${index}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-2 font-mono text-slate-600">{formatMs(row.timestamp_ms)}</td>
                      <td className="px-4 py-2 text-slate-600">{row.clock_domain}</td>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-800">{row.event_type}</div>
                        <div className="text-[11px] text-slate-500 max-w-xl truncate">{row.description}</div>
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-500">{row.sequence_number}</td>
                      <td className="px-4 py-2 font-mono text-slate-500">{row.fifo_occupancy ?? '-'}</td>
                      <td className="px-4 py-2 text-slate-600">{row.integrity_status || '-'}</td>
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

function StatCard({ title, value, tone, icon: Icon }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
        <span>{title}</span>
        <span className={`w-8 h-8 rounded-xl border flex items-center justify-center ${tones[tone] || tones.blue}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="text-2xl font-bold text-slate-800 tracking-tight">{value}</div>
    </div>
  );
}

function InfoTile({ label, value, tone = 'slate' }) {
  const toneClass = tone === 'emerald'
    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
    : tone === 'rose'
      ? 'text-rose-700 bg-rose-50 border-rose-100'
      : 'text-slate-700 bg-slate-50 border-slate-200';

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-sm font-bold mt-1 truncate">{value}</div>
    </div>
  );
}

function ControlSlider({ label, suffix, min, max, step = 1, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wide">
        <label>{label}</label>
        <span className="font-mono text-slate-700">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full accent-blue-600 mt-2"
      />
    </div>
  );
}

function Waveform({ frequency, tone }) {
  const bars = Array.from({ length: 24 }, (_, index) => index);
  const activeModulo = Math.max(2, Math.round(180 / frequency));
  const color = tone === 'cyan' ? 'bg-cyan-500' : 'bg-blue-600';

  return (
    <div className="h-10 flex items-end gap-1">
      {bars.map(index => (
        <span
          key={index}
          className={`flex-1 rounded-sm ${index % activeModulo === 0 ? color : 'bg-slate-200'}`}
          style={{ height: index % activeModulo === 0 ? '100%' : '38%' }}
        />
      ))}
    </div>
  );
}

function formatMs(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toFixed(2)}ms`;
}
