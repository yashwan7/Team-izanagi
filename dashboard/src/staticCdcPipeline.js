import {
  DEFAULT_CDC_CONFIG,
  createRunId,
  replayTraceRows,
  runAutomatedCdcTests,
  runCdcSimulation,
} from './lib/cdcSimulation.js';
import {
  TRACE_PARQUET_SCHEMA,
  buildJsonReport,
  buildTraceParquet,
  buildVerificationParquet,
  downloadArrayBuffer,
  downloadText,
  inspectTraceFile,
} from './lib/cdcParquet.js';

const state = {
  config: {
    ...DEFAULT_CDC_CONFIG,
    runId: createRunId('cdc-synthetic'),
  },
  simulation: null,
  traceInspection: null,
  replayReport: null,
  replayTimer: null,
  replayIndex: 0,
};

state.simulation = runCdcSimulation(state.config);

function initCdcStaticPipeline() {
  if (!document.getElementById('view-cdc')) return;

  bindControl('cdcSourceHz', 'input', () => {
    state.config.sourceHz = numberValue('cdcSourceHz', state.config.sourceHz);
    syncControlLabels();
  });
  bindControl('cdcDestinationHz', 'input', () => {
    state.config.destinationHz = numberValue('cdcDestinationHz', state.config.destinationHz);
    syncControlLabels();
  });
  bindControl('cdcDurationMs', 'input', () => {
    state.config.durationMs = numberValue('cdcDurationMs', state.config.durationMs);
    syncControlLabels();
  });
  bindControl('cdcReplaySpeed', 'input', () => {
    state.config.replaySpeed = numberValue('cdcReplaySpeed', state.config.replaySpeed);
    syncControlLabels();
  });
  bindControl('cdcFifoDepth', 'change', () => {
    state.config.fifoDepth = numberValue('cdcFifoDepth', state.config.fifoDepth);
  });
  bindControl('cdcGenerateBtn', 'click', generateSyntheticTrace);
  bindControl('cdcReplayBtn', 'click', startReplay);
  bindControl('cdcPauseReplayBtn', 'click', () => stopReplay(true));
  bindControl('cdcExportTraceBtn', 'click', () => downloadArrayBuffer(buildTraceParquet(state.simulation)));
  bindControl('cdcExportResultsBtn', 'click', () => downloadArrayBuffer(buildVerificationParquet(state.replayReport || state.simulation)));
  bindControl('cdcExportJsonBtn', 'click', () => downloadText(buildJsonReport(state.replayReport || state.simulation)));
  bindControl('cdcTraceFileInput', 'change', handleTraceFile);

  syncControlLabels();
  renderAll();
}

function generateSyntheticTrace() {
  stopReplay(false);
  state.config = {
    ...state.config,
    runId: createRunId('cdc-synthetic'),
    traceKind: 'synthetic',
  };
  state.simulation = runCdcSimulation(state.config);
  state.traceInspection = null;
  state.replayReport = null;
  state.replayIndex = 0;
  setText('cdcImportStatus', 'Using a new synthetic CDC trace. Every row is marked is_synthetic=true.');
  renderAll();
}

async function handleTraceFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  stopReplay(false);
  setText('cdcImportStatus', 'Inspecting Parquet footer and preview rows...');

  try {
    const inspection = await inspectTraceFile(file, { replaySpeed: state.config.replaySpeed });
    state.traceInspection = inspection;
    state.replayReport = inspection.replay;
    state.replayIndex = 0;

    if (inspection.validation.valid) {
      setText(
        'cdcImportStatus',
        inspection.previewTruncated
          ? `Loaded ${inspection.previewLimit.toLocaleString()} preview rows from ${file.name}; replay is preview-limited to protect browser memory.`
          : `Loaded ${file.name}; schema validated for CDC replay.`
      );
    } else {
      setText('cdcImportStatus', `Invalid CDC trace schema. Missing: ${inspection.validation.missing.join(', ')}`);
    }
  } catch (error) {
    state.traceInspection = null;
    state.replayReport = null;
    setText('cdcImportStatus', error.message || 'Could not inspect this Parquet file.');
  } finally {
    event.target.value = '';
    renderAll();
  }
}

function startReplay() {
  const rows = currentRows().sort((a, b) => Number(a.timestamp_ms || 0) - Number(b.timestamp_ms || 0));
  if (!rows.length) return;
  stopReplay(false);

  state.replayReport = replayTraceRows(rows, {
    replaySpeed: state.config.replaySpeed,
    clockMode: 'recorded-timestamps',
    runId: rows[0]?.simulation_run_id,
  });

  const firstTimestamp = Number(rows[0].timestamp_ms || 0);
  const startWall = performance.now();
  state.replayIndex = 0;
  renderReplay(rows[0], rows.length);

  state.replayTimer = window.setInterval(() => {
    const targetTime = firstTimestamp + (performance.now() - startWall) * state.config.replaySpeed;
    let index = state.replayIndex;
    while (index < rows.length - 1 && Number(rows[index + 1].timestamp_ms || 0) <= targetTime) {
      index += 1;
    }
    state.replayIndex = index;
    renderReplay(rows[index], rows.length);

    if (index >= rows.length - 1) {
      stopReplay(false);
      setText('cdcReplayMeta', `Replay complete • ${formatMs(rows[index].timestamp_ms)} • ${rows[index].clock_domain || 'domain'}`);
    }
  }, 60);

  renderAll();
}

function stopReplay(markPaused) {
  if (state.replayTimer) {
    window.clearInterval(state.replayTimer);
    state.replayTimer = null;
  }
  if (markPaused) {
    setText('cdcReplayMeta', `Replay paused • event ${state.replayIndex + 1} / ${currentRows().length}`);
  }
}

function renderAll() {
  const summary = (state.replayReport || state.traceInspection?.replay || state.simulation).summary;
  const rejected = (summary.rejectedWriteAttempts || 0) + (summary.rejectedReadAttempts || 0);
  setText('cdcAccepted', summary.acceptedTransactions ?? '--');
  setText('cdcRejected', rejected);
  setText('cdcFifoMax', summary.fifoOccupancyMax ?? '--');
  setText('cdcIntegrity', summary.dataIntegrityPassed ? 'PASS' : 'FAIL');

  const rows = currentRows();
  const timestampRange = state.traceInspection?.timestampRange || {
    min: state.simulation.summary.firstTimestampMs,
    max: state.simulation.summary.lastTimestampMs,
  };
  const columns = state.traceInspection?.columns || TRACE_PARQUET_SCHEMA.map(column => column.name);
  const fileName = state.traceInspection?.fileName || 'Synthetic CDC sample';
  const valid = state.traceInspection?.validation?.valid !== false;

  setText('cdcSelectedFile', fileName);
  setText('cdcRowCount', (state.traceInspection?.rowCount ?? rows.length).toLocaleString());
  setText('cdcTimestampRange', `${formatMs(timestampRange?.min)} - ${formatMs(timestampRange?.max)}`);
  setText('cdcColumnCount', columns.length);
  setText('cdcValidationBadge', valid ? 'Ready' : 'Invalid');
  setText('cdcEventCount', `${rows.length.toLocaleString()} events`);

  renderSchema();
  renderTests();
  renderEvents(rows);
  renderReplay(rows[state.replayIndex] || rows[0], rows.length);
}

function renderSchema() {
  const schema = state.traceInspection?.schema || TRACE_PARQUET_SCHEMA.map(column => ({
    name: column.name,
    logicalType: column.type,
    physicalType: column.type,
    repetition: column.nullable ? 'OPTIONAL' : 'REQUIRED',
  }));
  const body = document.getElementById('cdcSchemaBody');
  if (!body) return;
  body.innerHTML = schema.map(column => `
    <tr>
      <td>${escapeHtml(column.name)}</td>
      <td>${escapeHtml(column.logicalType || column.physicalType || '-')}</td>
      <td>${escapeHtml(column.repetition || 'OPTIONAL')}</td>
    </tr>
  `).join('');
}

function renderTests() {
  const tests = runAutomatedCdcTests();
  const body = document.getElementById('cdcTestsBody');
  if (!body) return;
  body.innerHTML = tests.map(test => `
    <tr>
      <td>${escapeHtml(test.label)}</td>
      <td style="color:${test.status === 'PASS' ? 'var(--green)' : 'var(--coral)'}; font-weight:800;">${test.status}</td>
    </tr>
  `).join('');
}

function renderEvents(rows) {
  const body = document.getElementById('cdcEventsBody');
  if (!body) return;
  body.innerHTML = rows.slice(-90).reverse().map(row => `
    <tr>
      <td>${formatMs(row.timestamp_ms)}</td>
      <td>${escapeHtml(row.clock_domain || '-')}</td>
      <td>
        <strong>${escapeHtml(row.event_type || '-')}</strong>
        <div style="font-family:'Plus Jakarta Sans', sans-serif; color: var(--text-muted); font-size: 11px; max-width: 520px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(row.description || '')}
        </div>
      </td>
      <td>${escapeHtml(String(row.sequence_number ?? '-'))}</td>
      <td>${escapeHtml(String(row.fifo_occupancy ?? '-'))}</td>
      <td>${escapeHtml(row.integrity_status || '-')}</td>
    </tr>
  `).join('');
}

function renderReplay(row, rowCount) {
  if (!row) return;
  const runningText = state.replayTimer ? 'Replay running' : 'Replay idle';
  setText('cdcReplayMeta', `${runningText} • ${formatMs(row.timestamp_ms)} • ${row.clock_domain || 'domain'}`);
  setText('cdcReplayEvent', row.event_type || 'Replay event');
  setText('cdcReplayDescription', row.description || 'Recorded CDC event replayed from the selected trace.');
  const progress = document.getElementById('cdcReplayProgress');
  if (progress) {
    progress.style.width = `${rowCount ? ((state.replayIndex + 1) / rowCount) * 100 : 0}%`;
  }
}

function currentRows() {
  if (state.traceInspection?.previewRows?.length) {
    return [...state.traceInspection.previewRows];
  }
  return [...state.simulation.events];
}

function syncControlLabels() {
  setText('cdcSourceHzLabel', `${numberValue('cdcSourceHz', state.config.sourceHz)} Hz`);
  setText('cdcDestinationHzLabel', `${numberValue('cdcDestinationHz', state.config.destinationHz)} Hz`);
  setText('cdcDurationLabel', `${numberValue('cdcDurationMs', state.config.durationMs)} ms`);
  setText('cdcReplaySpeedLabel', `${numberValue('cdcReplaySpeed', state.config.replaySpeed)}x`);
}

function bindControl(id, eventName, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(eventName, handler);
}

function numberValue(id, fallback) {
  const element = document.getElementById(id);
  const value = Number(element?.value);
  return Number.isFinite(value) ? value : fallback;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerText = value;
}

function formatMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric.toFixed(2)} ms`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', initCdcStaticPipeline);
