import { parquetMetadataAsync, parquetReadObjects, parquetSchema } from 'hyparquet';
import { parquetWriteBuffer } from 'hyparquet-writer';
import {
  CDC_SOFTWARE_VERSION,
  RESULT_SCHEMA_VERSION,
  TRACE_SCHEMA_VERSION,
  replayTraceRows,
} from './cdcSimulation.js';

export const MAX_TRACE_PREVIEW_ROWS = 2000;

export const TRACE_PARQUET_SCHEMA = Object.freeze([
  { name: 'schema_version', type: 'STRING', nullable: false, description: 'Trace schema identifier.' },
  { name: 'simulation_run_id', type: 'STRING', nullable: false, description: 'Stable run identifier used for replay and reports.' },
  { name: 'software_version', type: 'STRING', nullable: false, description: 'CDC simulator/export software version.' },
  { name: 'recorded_at', type: 'TIMESTAMP', nullable: false, description: 'Wall-clock export timestamp.' },
  { name: 'timestamp_ms', type: 'DOUBLE', nullable: false, description: 'Logical simulation timestamp in milliseconds.' },
  { name: 'source_id', type: 'STRING', nullable: false, description: 'Sensor, simulator, clock, or CDC model source identifier.' },
  { name: 'source_kind', type: 'STRING', nullable: false, description: 'synthetic_cdc_simulator or hardware telemetry source label.' },
  { name: 'event_type', type: 'STRING', nullable: false, description: 'CDC, FIFO, verification, or replay event type.' },
  { name: 'clock_domain', type: 'STRING', nullable: false, description: 'source, destination, write, read, system, or verification domain.' },
  { name: 'event_index', type: 'INT32', nullable: false, description: 'Monotonic event index within a trace.' },
  { name: 'sequence_number', type: 'INT32', nullable: false, description: 'Source-domain or destination-domain sequence number.' },
  { name: 'sensor_heart_rate', type: 'DOUBLE', nullable: true, description: 'Synthetic or imported heart-rate telemetry when available.' },
  { name: 'sensor_spo2', type: 'DOUBLE', nullable: true, description: 'Synthetic or imported SpO2 telemetry when available.' },
  { name: 'sensor_pressure', type: 'DOUBLE', nullable: true, description: 'Synthetic or imported pressure/force telemetry when available.' },
  { name: 'sensor_gyro_x', type: 'DOUBLE', nullable: true, description: 'Synthetic or imported gyroscope X reading when available.' },
  { name: 'sensor_gyro_y', type: 'DOUBLE', nullable: true, description: 'Synthetic or imported gyroscope Y reading when available.' },
  { name: 'sensor_gyro_z', type: 'DOUBLE', nullable: true, description: 'Synthetic or imported gyroscope Z reading when available.' },
  { name: 'prediction_label', type: 'STRING', nullable: true, description: 'TinyML-style prediction label when available.' },
  { name: 'is_synthetic', type: 'BOOLEAN', nullable: false, description: 'True for generated simulation rows; false only for real telemetry imports.' },
  { name: 'fifo_occupancy', type: 'INT32', nullable: true, description: 'Observed simulated FIFO occupancy.' },
  { name: 'write_pointer_binary', type: 'INT32', nullable: true, description: 'Write pointer with extra wrap bit, binary encoded.' },
  { name: 'read_pointer_binary', type: 'INT32', nullable: true, description: 'Read pointer with extra wrap bit, binary encoded.' },
  { name: 'write_pointer_gray', type: 'INT32', nullable: true, description: 'Write pointer Gray code observed by the model.' },
  { name: 'read_pointer_gray', type: 'INT32', nullable: true, description: 'Read pointer Gray code observed by the model.' },
  { name: 'accepted', type: 'BOOLEAN', nullable: true, description: 'Whether a write/read operation was accepted.' },
  { name: 'integrity_status', type: 'STRING', nullable: true, description: 'ordered, mismatch, rejected_full, rejected_empty, passed, failed, or reset.' },
  { name: 'description', type: 'STRING', nullable: false, description: 'Human-readable event explanation.' },
  { name: 'payload_json', type: 'JSON', nullable: true, description: 'Structured event payload for replay diagnostics.' },
]);

export const RESULT_PARQUET_SCHEMA = Object.freeze([
  { name: 'schema_version', type: 'STRING', nullable: false, description: 'Verification result schema identifier.' },
  { name: 'result_id', type: 'STRING', nullable: false, description: 'Stable result row identifier.' },
  { name: 'simulation_run_id', type: 'STRING', nullable: false, description: 'Run identifier that produced this result.' },
  { name: 'software_version', type: 'STRING', nullable: false, description: 'CDC simulator/export software version.' },
  { name: 'created_at', type: 'TIMESTAMP', nullable: false, description: 'Report export timestamp.' },
  { name: 'metric_name', type: 'STRING', nullable: false, description: 'Verification metric name.' },
  { name: 'metric_type', type: 'STRING', nullable: false, description: 'Metric representation type.' },
  { name: 'metric_value', type: 'DOUBLE', nullable: true, description: 'Numeric metric value when applicable.' },
  { name: 'metric_text', type: 'STRING', nullable: true, description: 'Text metric value when applicable.' },
  { name: 'passed', type: 'BOOLEAN', nullable: false, description: 'Whether this metric passed its verification predicate.' },
  { name: 'is_synthetic', type: 'BOOLEAN', nullable: false, description: 'True when the result came from synthetic simulation data.' },
  { name: 'timing_basis', type: 'STRING', nullable: false, description: 'logical_simulation_time; not physical hardware timing.' },
  { name: 'config_json', type: 'JSON', nullable: true, description: 'Simulation configuration captured with the run.' },
  { name: 'notes', type: 'STRING', nullable: false, description: 'Result explanation and limitations.' },
]);

const TRACE_REQUIRED_COLUMNS = [
  'schema_version',
  'simulation_run_id',
  'timestamp_ms',
  'source_id',
  'source_kind',
  'event_type',
  'clock_domain',
  'sequence_number',
  'is_synthetic',
];

export function buildTraceParquet(simulation) {
  const columnData = rowsToColumnData(simulation.events, TRACE_PARQUET_SCHEMA);
  const arrayBuffer = parquetWriteBuffer({
    columnData,
    codec: 'UNCOMPRESSED',
    rowGroupSize: 512,
    kvMetadata: [
      { key: 'schema.name', value: TRACE_SCHEMA_VERSION },
      { key: 'software.version', value: CDC_SOFTWARE_VERSION },
      { key: 'simulation.run_id', value: simulation.runId },
      { key: 'simulation.config', value: JSON.stringify(simulation.config) },
      { key: 'timing.basis', value: 'logical simulation timestamps, not measured physical hardware timing' },
    ],
  });

  return {
    arrayBuffer,
    fileName: `${simulation.runId}-telemetry-trace.parquet`,
    mimeType: 'application/vnd.apache.parquet',
  };
}

export function buildVerificationParquet(simulationOrReplay) {
  const rows = simulationOrReplay.results || [];
  const runId = simulationOrReplay.runId || simulationOrReplay.summary?.runId || 'cdc-verification';
  const columnData = rowsToColumnData(rows, RESULT_PARQUET_SCHEMA);
  const arrayBuffer = parquetWriteBuffer({
    columnData,
    codec: 'UNCOMPRESSED',
    rowGroupSize: 256,
    kvMetadata: [
      { key: 'schema.name', value: RESULT_SCHEMA_VERSION },
      { key: 'software.version', value: CDC_SOFTWARE_VERSION },
      { key: 'simulation.run_id', value: runId },
      { key: 'timing.basis', value: 'logical simulation timestamps, not measured physical hardware timing' },
    ],
  });

  return {
    arrayBuffer,
    fileName: `${runId}-verification-results.parquet`,
    mimeType: 'application/vnd.apache.parquet',
  };
}

export function buildJsonReport(simulationOrReplay) {
  const summary = simulationOrReplay.summary || {};
  const runId = simulationOrReplay.runId || summary.runId || 'cdc-report';
  const report = {
    schema_version: RESULT_SCHEMA_VERSION,
    software_version: CDC_SOFTWARE_VERSION,
    simulation_run_id: runId,
    generated_at: new Date().toISOString(),
    summary,
    results: simulationOrReplay.results || [],
    timing_notice: 'All timing values are deterministic logical simulation timestamps, not measured physical hardware timing.',
  };
  return {
    text: JSON.stringify(report, null, 2),
    fileName: `${runId}-verification-report.json`,
    mimeType: 'application/json',
  };
}

export async function inspectTraceFile(file, options = {}) {
  const asyncBuffer = browserFileToAsyncBuffer(file);
  const metadata = await parquetMetadataAsync(asyncBuffer);
  const schemaTree = parquetSchema(metadata);
  const columns = (schemaTree.children || []).map(child => child.element.name);
  const validation = validateTraceSchema(columns, metadata);
  const rowCount = Number(metadata.num_rows ?? 0);
  const previewLimit = Math.min(rowCount, options.previewLimit ?? MAX_TRACE_PREVIEW_ROWS);
  let previewRows = [];
  let replay = null;
  let timestampRange = timestampRangeFromMetadata(metadata);

  if (validation.valid && previewLimit > 0) {
    previewRows = await parquetReadObjects({
      file: asyncBuffer,
      rowStart: 0,
      rowEnd: previewLimit,
      columns: TRACE_PARQUET_SCHEMA.map(column => column.name).filter(name => columns.includes(name)),
    });
    if (!timestampRange && previewRows.length) {
      timestampRange = timestampRangeFromRows(previewRows);
    }
    replay = replayTraceRows(previewRows, {
      replaySpeed: options.replaySpeed,
      clockMode: 'recorded-timestamps',
      runId: previewRows[0]?.simulation_run_id,
    });
  }

  return {
    fileName: file.name,
    byteLength: file.size,
    createdBy: metadata.created_by,
    rowCount,
    previewLimit,
    previewTruncated: rowCount > previewLimit,
    columns,
    schema: schemaElementsForDisplay(metadata.schema),
    keyValueMetadata: metadata.key_value_metadata || [],
    validation,
    timestampRange,
    previewRows,
    replay,
  };
}

export function validateTraceSchema(columns, metadata = {}) {
  const missing = TRACE_REQUIRED_COLUMNS.filter(column => !columns.includes(column));
  const keyValue = metadata.key_value_metadata || [];
  const schemaName = keyValue.find(item => item.key === 'schema.name')?.value;
  const warnings = [];

  if (schemaName && schemaName !== TRACE_SCHEMA_VERSION) {
    warnings.push(`Schema metadata is ${schemaName}; expected ${TRACE_SCHEMA_VERSION}.`);
  }
  if (!columns.includes('payload_json')) {
    warnings.push('payload_json is absent, so detailed replay diagnostics will be limited.');
  }
  if (!columns.includes('is_synthetic')) {
    warnings.push('is_synthetic is required to separate synthetic traces from hardware telemetry.');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
    schemaName: schemaName || null,
  };
}

export function schemaElementsForDisplay(schemaElements = []) {
  return schemaElements
    .filter(element => element.type)
    .map(element => ({
      name: element.name,
      physicalType: element.type,
      logicalType: element.converted_type || element.logical_type?.type || null,
      repetition: element.repetition_type || 'OPTIONAL',
    }));
}

export function downloadArrayBuffer({ arrayBuffer, fileName, mimeType }) {
  const blob = new Blob([arrayBuffer], { type: mimeType });
  downloadBlob(blob, fileName);
}

export function downloadText({ text, fileName, mimeType }) {
  const blob = new Blob([text], { type: mimeType });
  downloadBlob(blob, fileName);
}

function rowsToColumnData(rows, schema) {
  return schema.map(column => ({
    name: column.name,
    type: column.type,
    nullable: column.nullable !== false,
    data: rows.map(row => coerceValue(row[column.name], column.type)),
  }));
}

function coerceValue(value, type) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (type === 'TIMESTAMP') {
    return value instanceof Date ? value : new Date(value);
  }
  if (type === 'INT32') {
    return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
  }
  if (type === 'DOUBLE') {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }
  if (type === 'BOOLEAN') {
    return value === null ? null : Boolean(value);
  }
  if (type === 'JSON') {
    return typeof value === 'string' ? parseJsonOrWrap(value) : value;
  }
  return String(value);
}

function parseJsonOrWrap(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { value };
  }
}

function browserFileToAsyncBuffer(file) {
  return {
    byteLength: file.size,
    slice: (start, end) => file.slice(start, end).arrayBuffer(),
  };
}

function timestampRangeFromRows(rows) {
  const timestamps = rows
    .map(row => Number(row.timestamp_ms))
    .filter(Number.isFinite);
  if (!timestamps.length) return null;
  return {
    min: Math.min(...timestamps),
    max: Math.max(...timestamps),
  };
}

function timestampRangeFromMetadata(metadata) {
  const timestampColumnIndex = metadata.schema?.filter(element => element.type).findIndex(element => element.name === 'timestamp_ms');
  if (timestampColumnIndex === undefined || timestampColumnIndex < 0) return null;

  const mins = [];
  const maxes = [];
  for (const rowGroup of metadata.row_groups || []) {
    const stats = rowGroup.columns?.[timestampColumnIndex]?.meta_data?.statistics;
    if (Number.isFinite(Number(stats?.min))) mins.push(Number(stats.min));
    if (Number.isFinite(Number(stats?.max))) maxes.push(Number(stats.max));
  }
  if (!mins.length || !maxes.length) return null;
  return {
    min: Math.min(...mins),
    max: Math.max(...maxes),
  };
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
