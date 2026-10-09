import { parquetMetadata, parquetReadObjects, parquetSchema } from 'hyparquet';
import {
  runAutomatedCdcTests,
  runCdcSimulation,
  replayTraceRows,
} from '../src/lib/cdcSimulation.js';
import {
  buildTraceParquet,
  buildVerificationParquet,
  validateTraceSchema,
} from '../src/lib/cdcParquet.js';

const failures = [];

function check(condition, message, details = {}) {
  if (!condition) {
    failures.push({ message, details });
  }
}

const tests = runAutomatedCdcTests();
check(tests.every(test => test.status === 'PASS'), 'Automated CDC test suite has failures.', tests.filter(test => test.status !== 'PASS'));

const simulation = runCdcSimulation({
  runId: 'node-parquet-roundtrip',
  sourceHz: 95,
  destinationHz: 61,
  durationMs: 800,
  fifoDepth: 8,
  readEveryDestinationEdges: 1,
});

const traceExport = buildTraceParquet(simulation);
const traceMetadata = parquetMetadata(traceExport.arrayBuffer);
const schemaTree = parquetSchema(traceMetadata);
const columns = schemaTree.children.map(child => child.element.name);
const validation = validateTraceSchema(columns, traceMetadata);
check(validation.valid, 'Trace Parquet schema validation failed.', validation);
check(Number(traceMetadata.num_rows) === simulation.events.length, 'Trace row count does not match exported event count.', {
  metadataRows: Number(traceMetadata.num_rows),
  eventRows: simulation.events.length,
});

const traceRows = await parquetReadObjects({ file: traceExport.arrayBuffer, rowStart: 0, rowEnd: simulation.events.length });
check(traceRows.length === simulation.events.length, 'Trace import row count mismatch.', {
  importedRows: traceRows.length,
  eventRows: simulation.events.length,
});
check(traceRows.some(row => row.is_synthetic === true), 'Synthetic marker was not preserved in trace rows.');

const replay = replayTraceRows(traceRows, { replaySpeed: 25, clockMode: 'recorded-timestamps' });
check(replay.summary.acceptedTransactions === simulation.summary.acceptedTransactions, 'Replay accepted transaction count is not reproducible.', {
  replay: replay.summary.acceptedTransactions,
  original: simulation.summary.acceptedTransactions,
});
check(replay.summary.dataIntegrityPassed === simulation.summary.dataIntegrityPassed, 'Replay integrity result is not reproducible.', {
  replay: replay.summary.dataIntegrityPassed,
  original: simulation.summary.dataIntegrityPassed,
});

const resultExport = buildVerificationParquet({
  runId: replay.summary.runId,
  summary: replay.summary,
  results: replay.results,
});
const resultMetadata = parquetMetadata(resultExport.arrayBuffer);
const resultRows = await parquetReadObjects({ file: resultExport.arrayBuffer });
check(Number(resultMetadata.num_rows) === replay.results.length, 'Verification result row count mismatch.', {
  metadataRows: Number(resultMetadata.num_rows),
  resultRows: replay.results.length,
});
check(resultRows.some(row => row.metric_name === 'data_integrity_passed' && row.passed === true), 'Verification results do not include passing data_integrity_passed metric.');

if (failures.length) {
  console.error('CDC Parquet verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure.message}`);
    if (Object.keys(failure.details || {}).length) {
      console.error(JSON.stringify(failure.details, null, 2));
    }
  }
  process.exit(1);
}

console.log('CDC Parquet verification passed.');
console.log(JSON.stringify({
  tests: `${tests.filter(test => test.status === 'PASS').length}/${tests.length}`,
  traceRows: traceRows.length,
  resultRows: resultRows.length,
  acceptedTransactions: replay.summary.acceptedTransactions,
  dataIntegrityPassed: replay.summary.dataIntegrityPassed,
}, null, 2));
