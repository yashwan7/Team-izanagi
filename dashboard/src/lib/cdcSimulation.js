export const CDC_SOFTWARE_VERSION = 'cdc-parquet-telemetry-1.0.0';
export const TRACE_SCHEMA_VERSION = 'kshitij.cdc.telemetry_trace.v1';
export const RESULT_SCHEMA_VERSION = 'kshitij.cdc.verification_results.v1';

export const DEFAULT_CDC_CONFIG = Object.freeze({
  runId: 'cdc-synthetic-demo',
  sourceHz: 80,
  destinationHz: 55,
  durationMs: 650,
  fifoDepth: 8,
  dataWidth: 8,
  writeEverySourceEdges: 1,
  readEveryDestinationEdges: 2,
  sourceTransitionEveryEdges: 5,
  seed: 7,
  metastabilityWindowMs: 1.2,
  replaySpeed: 10,
  traceKind: 'synthetic',
});

const EVENT_DESCRIPTIONS = {
  simulation_start: 'Deterministic CDC simulation run started.',
  simulation_reset: 'CDC model reset to a known state.',
  source_clock_edge: 'Source clock edge advanced the write/source domain.',
  destination_clock_edge: 'Destination clock edge advanced the read/destination domain.',
  source_signal_transition: 'Asynchronous input transition injected in the source domain.',
  dff1_sample: 'First destination flip-flop sampled the asynchronous input.',
  dff2_sample: 'Second destination flip-flop sampled the first stage output.',
  sync_latency_observed: 'Two-flip-flop synchronizer output reached the requested value.',
  illustrative_timing_violation: 'Illustrative setup/hold window crossing, not measured analog metastability.',
  read_pointer_sync: 'Read pointer Gray code sampled into the write domain.',
  write_pointer_sync: 'Write pointer Gray code sampled into the read domain.',
  fifo_write_accepted: 'FIFO write accepted using synchronized read pointer status.',
  fifo_read_accepted: 'FIFO read accepted using synchronized write pointer status.',
  fifo_full: 'FIFO full condition observed in the write domain.',
  fifo_empty: 'FIFO empty condition observed in the read domain.',
  invalid_write_rejected: 'Write attempt rejected because the FIFO appeared full.',
  invalid_read_rejected: 'Read attempt rejected because the FIFO appeared empty.',
  pointer_wraparound: 'FIFO pointer crossed the depth boundary using the extra pointer bit.',
  data_integrity_result: 'FIFO data ordering and integrity check completed.',
  simulation_complete: 'Deterministic CDC simulation run completed.',
  replay_event: 'Trace row replayed from a Parquet source.',
};

export function createRunId(prefix = 'cdc') {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
}

export function mergeConfig(overrides = {}) {
  const fifoDepth = Number(overrides.fifoDepth ?? DEFAULT_CDC_CONFIG.fifoDepth);
  return {
    ...DEFAULT_CDC_CONFIG,
    ...overrides,
    fifoDepth: isPowerOfTwo(fifoDepth) ? fifoDepth : DEFAULT_CDC_CONFIG.fifoDepth,
  };
}

export function grayEncode(value) {
  return value ^ (value >> 1);
}

export function grayDecode(gray) {
  let value = gray;
  for (let mask = gray >> 1; mask !== 0; mask >>= 1) {
    value ^= mask;
  }
  return value;
}

export function hammingDistance(a, b) {
  let value = a ^ b;
  let count = 0;
  while (value) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}

export function runCdcSimulation(overrides = {}) {
  const config = mergeConfig(overrides);
  const runId = config.runId || createRunId();
  const sourcePeriod = 1000 / config.sourceHz;
  const destinationPeriod = 1000 / config.destinationHz;
  const pointerModulo = config.fifoDepth * 2;
  const pointerMask = pointerModulo - 1;
  const events = [];
  const expectedQueue = [];
  const readValues = [];
  const sequenceNumbers = [];
  const occupancyObservations = [];
  const sequenceGaps = [];
  const stats = {
    acceptedWrites: 0,
    acceptedReads: 0,
    rejectedWrites: 0,
    rejectedReads: 0,
    fifoFullObservations: 0,
    fifoEmptyObservations: 0,
    wraparounds: 0,
    integrityFailures: 0,
    synchronizerLatencyCycles: null,
    illustrativeTimingViolations: 0,
  };

  let eventIndex = 0;
  let sourceEdgeCount = 0;
  let destinationEdgeCount = 0;
  let nextSourceTime = 0;
  let nextDestinationTime = 0;
  let sourceSignal = 0;
  let dff1 = 0;
  let dff2 = 0;
  let pendingSyncTransition = null;
  let lastTransitionTime = Number.NEGATIVE_INFINITY;
  let writePointer = 0;
  let readPointer = 0;
  let writeGray = grayEncode(writePointer);
  let readGray = grayEncode(readPointer);
  let readGraySync1 = readGray;
  let readGraySync2 = readGray;
  let writeGraySync1 = writeGray;
  let writeGraySync2 = writeGray;
  let memory = Array(config.fifoDepth).fill(null);
  let lastWriteSequence = null;

  const recordedAt = new Date();
  const recordEvent = (eventType, timestampMs, domain, details = {}) => {
    const telemetry = details.telemetry || syntheticTelemetry(details.sequenceNumber ?? eventIndex, config.seed);
    const event = {
      schema_version: TRACE_SCHEMA_VERSION,
      simulation_run_id: runId,
      software_version: CDC_SOFTWARE_VERSION,
      recorded_at: recordedAt,
      timestamp_ms: round(timestampMs, 6),
      source_id: details.sourceId || 'cdc-simulator',
      source_kind: details.sourceKind || 'synthetic_cdc_simulator',
      event_type: eventType,
      clock_domain: domain,
      event_index: eventIndex,
      sequence_number: details.sequenceNumber ?? eventIndex,
      sensor_heart_rate: telemetry?.heartRate ?? null,
      sensor_spo2: telemetry?.spo2 ?? null,
      sensor_pressure: telemetry?.pressure ?? null,
      sensor_gyro_x: telemetry?.gyroX ?? null,
      sensor_gyro_y: telemetry?.gyroY ?? null,
      sensor_gyro_z: telemetry?.gyroZ ?? null,
      prediction_label: details.predictionLabel ?? telemetry?.predictionLabel ?? null,
      is_synthetic: details.isSynthetic ?? true,
      fifo_occupancy: details.fifoOccupancy ?? occupancy(writePointer, readPointer, pointerModulo),
      write_pointer_binary: writePointer,
      read_pointer_binary: readPointer,
      write_pointer_gray: writeGray,
      read_pointer_gray: readGray,
      accepted: details.accepted ?? null,
      integrity_status: details.integrityStatus ?? null,
      description: details.description || EVENT_DESCRIPTIONS[eventType] || eventType,
      payload_json: {
        dff1,
        dff2,
        sourceSignal,
        readGraySync2,
        writeGraySync2,
        ...details.payload,
      },
    };
    events.push(event);
    eventIndex += 1;
    return event;
  };

  const resetState = (timestampMs) => {
    sourceSignal = 0;
    dff1 = 0;
    dff2 = 0;
    pendingSyncTransition = null;
    writePointer = 0;
    readPointer = 0;
    writeGray = grayEncode(writePointer);
    readGray = grayEncode(readPointer);
    readGraySync1 = readGray;
    readGraySync2 = readGray;
    writeGraySync1 = writeGray;
    writeGraySync2 = writeGray;
    memory = Array(config.fifoDepth).fill(null);
    expectedQueue.length = 0;
    recordEvent('simulation_reset', timestampMs, 'system', {
      sequenceNumber: sourceEdgeCount + destinationEdgeCount,
      integrityStatus: 'reset',
    });
  };

  recordEvent('simulation_start', 0, 'system', {
    sequenceNumber: 0,
    fifoOccupancy: 0,
    payload: { config: stripVolatileConfig(config, runId) },
  });

  while (nextSourceTime <= config.durationMs || nextDestinationTime <= config.durationMs) {
    const runSource = nextSourceTime <= nextDestinationTime;
    const time = runSource ? nextSourceTime : nextDestinationTime;

    if (config.resetAtMs !== undefined && !config._resetApplied && time >= config.resetAtMs) {
      resetState(time);
      config._resetApplied = true;
    }

    if (runSource && nextSourceTime <= config.durationMs) {
      sourceEdgeCount += 1;
      recordEvent('source_clock_edge', time, 'source', {
        sequenceNumber: sourceEdgeCount,
        sourceId: 'source-clock-a',
      });

      if (config.sourceTransitionEveryEdges > 0 && sourceEdgeCount % config.sourceTransitionEveryEdges === 0) {
        sourceSignal = sourceSignal ? 0 : 1;
        lastTransitionTime = time;
        pendingSyncTransition = {
          target: sourceSignal,
          destinationEdges: 0,
          startedAtMs: time,
        };
        recordEvent('source_signal_transition', time, 'source', {
          sequenceNumber: sourceEdgeCount,
          sourceId: 'single-bit-source',
          description: `Async input toggled to ${sourceSignal}.`,
          payload: { sourceSignal },
        });
      }

      const oldSync1 = readGraySync1;
      readGraySync1 = readGray;
      readGraySync2 = oldSync1;
      recordEvent('read_pointer_sync', time, 'write', {
        sequenceNumber: sourceEdgeCount,
        sourceId: 'fifo-write-domain',
        payload: { readGraySync1, readGraySync2 },
      });

      const synchronizedReadPointer = grayDecode(readGraySync2) & pointerMask;
      const writeOccupancy = occupancy(writePointer, synchronizedReadPointer, pointerModulo);
      const full = writeOccupancy >= config.fifoDepth;

      if (full) {
        stats.fifoFullObservations += 1;
        recordEvent('fifo_full', time, 'write', {
          sequenceNumber: sourceEdgeCount,
          sourceId: 'fifo-write-domain',
          fifoOccupancy: writeOccupancy,
        });
      }

      const writeEnabled = config.enableWrites !== false && sourceEdgeCount % config.writeEverySourceEdges === 0;
      if (writeEnabled) {
        if (full) {
          stats.rejectedWrites += 1;
          recordEvent('invalid_write_rejected', time, 'write', {
            sequenceNumber: sourceEdgeCount,
            sourceId: 'fifo-write-domain',
            accepted: false,
            fifoOccupancy: writeOccupancy,
            integrityStatus: 'rejected_full',
          });
        } else {
          const dataValue = sourceEdgeCount & ((1 << Math.min(config.dataWidth, 16)) - 1);
          const slot = writePointer % config.fifoDepth;
          memory[slot] = dataValue;
          expectedQueue.push(dataValue);
          stats.acceptedWrites += 1;
          if (lastWriteSequence !== null && sourceEdgeCount - lastWriteSequence > config.writeEverySourceEdges) {
            sequenceGaps.push({
              from: lastWriteSequence,
              to: sourceEdgeCount,
              gap: sourceEdgeCount - lastWriteSequence - config.writeEverySourceEdges,
            });
          }
          lastWriteSequence = sourceEdgeCount;
          const before = writePointer;
          writePointer = (writePointer + 1) & pointerMask;
          writeGray = grayEncode(writePointer);
          const didWrap = (before % config.fifoDepth) > (writePointer % config.fifoDepth);
          if (didWrap) {
            stats.wraparounds += 1;
          }
          recordEvent('fifo_write_accepted', time, 'write', {
            sequenceNumber: sourceEdgeCount,
            sourceId: 'fifo-write-domain',
            accepted: true,
            fifoOccupancy: occupancy(writePointer, readPointer, pointerModulo),
            predictionLabel: predictionForData(dataValue),
            payload: { dataValue, slot, didWrap },
          });
          if (didWrap) {
            recordEvent('pointer_wraparound', time, 'write', {
              sequenceNumber: sourceEdgeCount,
              sourceId: 'fifo-write-domain',
              payload: { pointer: 'write', before, after: writePointer },
            });
          }
        }
      }

      nextSourceTime += sourcePeriod;
    } else if (nextDestinationTime <= config.durationMs) {
      destinationEdgeCount += 1;
      recordEvent('destination_clock_edge', time, 'destination', {
        sequenceNumber: destinationEdgeCount,
        sourceId: 'destination-clock-b',
      });

      if (time - lastTransitionTime >= 0 && time - lastTransitionTime <= config.metastabilityWindowMs) {
        stats.illustrativeTimingViolations += 1;
        recordEvent('illustrative_timing_violation', time, 'destination', {
          sequenceNumber: destinationEdgeCount,
          sourceId: 'two-flop-sync',
          description: 'Input transition is inside the illustrative setup/hold window; this is not measured hardware metastability.',
          payload: { deltaMs: round(time - lastTransitionTime, 6) },
        });
      }

      const previousDff1 = dff1;
      dff1 = sourceSignal;
      dff2 = previousDff1;
      recordEvent('dff1_sample', time, 'destination', {
        sequenceNumber: destinationEdgeCount,
        sourceId: 'two-flop-sync',
        payload: { dff1, sampled: sourceSignal },
      });
      recordEvent('dff2_sample', time, 'destination', {
        sequenceNumber: destinationEdgeCount,
        sourceId: 'two-flop-sync',
        payload: { dff2, sampled: previousDff1 },
      });

      if (pendingSyncTransition) {
        pendingSyncTransition.destinationEdges += 1;
        if (dff2 === pendingSyncTransition.target) {
          stats.synchronizerLatencyCycles = pendingSyncTransition.destinationEdges;
          recordEvent('sync_latency_observed', time, 'destination', {
            sequenceNumber: destinationEdgeCount,
            sourceId: 'two-flop-sync',
            payload: {
              latencyDestinationCycles: pendingSyncTransition.destinationEdges,
              startedAtMs: pendingSyncTransition.startedAtMs,
              completedAtMs: time,
            },
          });
          pendingSyncTransition = null;
        }
      }

      const oldWriteSync1 = writeGraySync1;
      writeGraySync1 = writeGray;
      writeGraySync2 = oldWriteSync1;
      recordEvent('write_pointer_sync', time, 'read', {
        sequenceNumber: destinationEdgeCount,
        sourceId: 'fifo-read-domain',
        payload: { writeGraySync1, writeGraySync2 },
      });

      const synchronizedWritePointer = grayDecode(writeGraySync2) & pointerMask;
      const readOccupancy = occupancy(synchronizedWritePointer, readPointer, pointerModulo);
      const empty = readOccupancy === 0;

      if (empty) {
        stats.fifoEmptyObservations += 1;
        recordEvent('fifo_empty', time, 'read', {
          sequenceNumber: destinationEdgeCount,
          sourceId: 'fifo-read-domain',
          fifoOccupancy: readOccupancy,
        });
      }

      const readEnabled = config.enableReads !== false && destinationEdgeCount % config.readEveryDestinationEdges === 0;
      if (readEnabled) {
        if (empty) {
          stats.rejectedReads += 1;
          recordEvent('invalid_read_rejected', time, 'read', {
            sequenceNumber: destinationEdgeCount,
            sourceId: 'fifo-read-domain',
            accepted: false,
            fifoOccupancy: readOccupancy,
            integrityStatus: 'rejected_empty',
          });
        } else {
          const slot = readPointer % config.fifoDepth;
          const dataValue = memory[slot];
          memory[slot] = null;
          const expected = expectedQueue.shift();
          const matched = dataValue === expected;
          if (!matched) {
            stats.integrityFailures += 1;
          }
          stats.acceptedReads += 1;
          readValues.push(dataValue);
          const before = readPointer;
          readPointer = (readPointer + 1) & pointerMask;
          readGray = grayEncode(readPointer);
          const didWrap = (before % config.fifoDepth) > (readPointer % config.fifoDepth);
          if (didWrap) {
            stats.wraparounds += 1;
          }
          recordEvent('fifo_read_accepted', time, 'read', {
            sequenceNumber: destinationEdgeCount,
            sourceId: 'fifo-read-domain',
            accepted: true,
            fifoOccupancy: occupancy(writePointer, readPointer, pointerModulo),
            predictionLabel: predictionForData(dataValue),
            integrityStatus: matched ? 'ordered' : 'mismatch',
            payload: { dataValue, expected, slot, didWrap },
          });
          if (didWrap) {
            recordEvent('pointer_wraparound', time, 'read', {
              sequenceNumber: destinationEdgeCount,
              sourceId: 'fifo-read-domain',
              payload: { pointer: 'read', before, after: readPointer },
            });
          }
        }
      }

      nextDestinationTime += destinationPeriod;
    } else {
      break;
    }

    occupancyObservations.push(occupancy(writePointer, readPointer, pointerModulo));
    sequenceNumbers.push(sourceEdgeCount + destinationEdgeCount);
  }

  const integrityPassed = stats.integrityFailures === 0;
  recordEvent('data_integrity_result', config.durationMs, 'verification', {
    sequenceNumber: eventIndex,
    sourceId: 'verification-runner',
    integrityStatus: integrityPassed ? 'passed' : 'failed',
    payload: {
      acceptedWrites: stats.acceptedWrites,
      acceptedReads: stats.acceptedReads,
      remainingBufferedItems: expectedQueue.length,
      readValues,
      sequenceGaps,
    },
  });
  recordEvent('simulation_complete', config.durationMs, 'system', {
    sequenceNumber: eventIndex,
    sourceId: 'cdc-simulator',
    integrityStatus: integrityPassed ? 'passed' : 'failed',
  });

  const summary = buildSummary({
    runId,
    config,
    events,
    stats,
    occupancyObservations,
    sequenceGaps,
    integrityPassed,
  });

  return {
    runId,
    config: stripVolatileConfig(config, runId),
    events,
    summary,
    results: buildVerificationRows(summary),
  };
}

export function runAutomatedCdcTests() {
  const tests = [
    {
      id: 'sync-propagation',
      label: 'Single-bit synchronizer propagation',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-sync-propagation', durationMs: 350, sourceHz: 40, destinationHz: 30, sourceTransitionEveryEdges: 2, enableWrites: false, enableReads: false });
        return pass(run.summary.synchronizerLatencyCycles >= 2, run.summary);
      },
    },
    {
      id: 'source-faster',
      label: 'Source clock faster than destination clock',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-source-faster', durationMs: 450, sourceHz: 120, destinationHz: 35, readEveryDestinationEdges: 1 });
        return pass(run.summary.acceptedTransactions > 0 && run.summary.rejectedWriteAttempts >= 0, run.summary);
      },
    },
    {
      id: 'destination-faster',
      label: 'Destination clock faster than source clock',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-destination-faster', durationMs: 450, sourceHz: 35, destinationHz: 120, writeEverySourceEdges: 1, readEveryDestinationEdges: 1 });
        return pass(run.summary.rejectedReadAttempts > 0 && run.summary.acceptedTransactions > 0, run.summary);
      },
    },
    {
      id: 'fifo-write-read',
      label: 'FIFO write and read operations',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-fifo-write-read', durationMs: 520, sourceHz: 70, destinationHz: 70, readEveryDestinationEdges: 1 });
        return pass(run.summary.acceptedTransactions > 4 && run.summary.dataIntegrityPassed, run.summary);
      },
    },
    {
      id: 'fifo-full',
      label: 'FIFO full detection',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-fifo-full', durationMs: 400, sourceHz: 140, destinationHz: 15, readEveryDestinationEdges: 8 });
        return pass(run.summary.fifoFullObservations > 0 && run.summary.rejectedWriteAttempts > 0, run.summary);
      },
    },
    {
      id: 'fifo-empty',
      label: 'FIFO empty detection',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-fifo-empty', durationMs: 320, sourceHz: 25, destinationHz: 120, writeEverySourceEdges: 4, readEveryDestinationEdges: 1 });
        return pass(run.summary.fifoEmptyObservations > 0 && run.summary.rejectedReadAttempts > 0, run.summary);
      },
    },
    {
      id: 'pointer-wraparound',
      label: 'FIFO pointer wraparound',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-pointer-wraparound', durationMs: 900, sourceHz: 80, destinationHz: 80, fifoDepth: 8, readEveryDestinationEdges: 1 });
        return pass(run.summary.pointerWraparounds > 0, run.summary);
      },
    },
    {
      id: 'gray-adjacent',
      label: 'Gray-code adjacent-pointer transitions',
      run: () => {
        const failures = [];
        for (let pointer = 0; pointer < 16; pointer += 1) {
          const current = grayEncode(pointer);
          const next = grayEncode((pointer + 1) & 15);
          const distance = hammingDistance(current, next);
          if (distance !== 1) failures.push({ pointer, current, next, distance });
        }
        return pass(failures.length === 0, { failures });
      },
    },
    {
      id: 'data-ordering',
      label: 'Data ordering and integrity',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-data-ordering', durationMs: 700, sourceHz: 65, destinationHz: 75, readEveryDestinationEdges: 1 });
        return pass(run.summary.dataIntegrityPassed && run.summary.integrityFailures === 0, run.summary);
      },
    },
    {
      id: 'reset-during-operation',
      label: 'Reset during operation',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-reset', durationMs: 500, sourceHz: 80, destinationHz: 55, resetAtMs: 220 });
        const hasReset = run.events.some(event => event.event_type === 'simulation_reset');
        return pass(hasReset && run.summary.dataIntegrityPassed, run.summary);
      },
    },
    {
      id: 'invalid-ops',
      label: 'Invalid read/write operations',
      run: () => {
        const fullRun = runCdcSimulation({ runId: 'test-invalid-write', durationMs: 350, sourceHz: 160, destinationHz: 10, readEveryDestinationEdges: 99 });
        const emptyRun = runCdcSimulation({ runId: 'test-invalid-read', durationMs: 350, sourceHz: 15, destinationHz: 150, writeEverySourceEdges: 6, readEveryDestinationEdges: 1 });
        return pass(fullRun.summary.rejectedWriteAttempts > 0 && emptyRun.summary.rejectedReadAttempts > 0, {
          rejectedWriteAttempts: fullRun.summary.rejectedWriteAttempts,
          rejectedReadAttempts: emptyRun.summary.rejectedReadAttempts,
        });
      },
    },
    {
      id: 'sustained-producer-consumer',
      label: 'Sustained producer-consumer at different rates',
      run: () => {
        const run = runCdcSimulation({ runId: 'test-sustained', durationMs: 1200, sourceHz: 90, destinationHz: 63, readEveryDestinationEdges: 1 });
        return pass(run.summary.acceptedTransactions > 20 && run.summary.dataIntegrityPassed, run.summary);
      },
    },
  ];

  return tests.map(test => {
    try {
      const result = test.run();
      return {
        id: test.id,
        label: test.label,
        status: result.ok ? 'PASS' : 'FAIL',
        details: result.details,
      };
    } catch (error) {
      return {
        id: test.id,
        label: test.label,
        status: 'FAIL',
        details: { error: error.message },
      };
    }
  });
}

export function replayTraceRows(rows, options = {}) {
  const orderedRows = [...rows].sort((a, b) => Number(a.timestamp_ms ?? 0) - Number(b.timestamp_ms ?? 0));
  const occupancyObservations = orderedRows
    .map(row => numberOrNull(row.fifo_occupancy))
    .filter(value => value !== null);
  const acceptedWrites = orderedRows.filter(row => row.event_type === 'fifo_write_accepted').length;
  const acceptedReads = orderedRows.filter(row => row.event_type === 'fifo_read_accepted').length;
  const rejectedWrites = orderedRows.filter(row => row.event_type === 'invalid_write_rejected').length;
  const rejectedReads = orderedRows.filter(row => row.event_type === 'invalid_read_rejected').length;
  const sequenceGaps = findSequenceGaps(orderedRows);
  const mismatches = orderedRows.filter(row => row.integrity_status === 'mismatch').length;
  const firstTimestamp = orderedRows.length ? Number(orderedRows[0].timestamp_ms ?? 0) : 0;
  const lastTimestamp = orderedRows.length ? Number(orderedRows[orderedRows.length - 1].timestamp_ms ?? 0) : 0;

  const summary = {
    runId: options.runId || orderedRows[0]?.simulation_run_id || createRunId('replay'),
    source: 'parquet-replay',
    replayClock: options.clockMode || 'recorded-timestamps',
    replaySpeed: options.replaySpeed ?? DEFAULT_CDC_CONFIG.replaySpeed,
    rowCount: orderedRows.length,
    firstTimestampMs: firstTimestamp,
    lastTimestampMs: lastTimestamp,
    durationMs: round(lastTimestamp - firstTimestamp, 6),
    acceptedTransactions: acceptedWrites + acceptedReads,
    acceptedWrites,
    acceptedReads,
    rejectedWriteAttempts: rejectedWrites,
    rejectedReadAttempts: rejectedReads,
    fifoOccupancyMin: occupancyObservations.length ? Math.min(...occupancyObservations) : 0,
    fifoOccupancyMax: occupancyObservations.length ? Math.max(...occupancyObservations) : 0,
    fifoOccupancyObservations: occupancyObservations.length,
    fifoFullObservations: orderedRows.filter(row => row.event_type === 'fifo_full').length,
    fifoEmptyObservations: orderedRows.filter(row => row.event_type === 'fifo_empty').length,
    sequenceGaps,
    sequenceGapCount: sequenceGaps.length,
    dataIntegrityPassed: mismatches === 0,
    integrityFailures: mismatches,
    pointerWraparounds: orderedRows.filter(row => row.event_type === 'pointer_wraparound').length,
    timingBasis: 'logical simulation timestamps from trace, not measured physical hardware timing',
    softwareVersion: CDC_SOFTWARE_VERSION,
  };

  return {
    summary,
    results: buildVerificationRows(summary),
    orderedRows,
  };
}

export function buildVerificationRows(summary) {
  const createdAt = new Date();
  const configJson = summary.config || {};
  const base = {
    schema_version: RESULT_SCHEMA_VERSION,
    simulation_run_id: summary.runId,
    software_version: CDC_SOFTWARE_VERSION,
    created_at: createdAt,
    is_synthetic: true,
    timing_basis: 'logical_simulation_time',
    config_json: configJson,
  };

  const metrics = [
    ['accepted_transactions', summary.acceptedTransactions, true, 'Accepted FIFO writes plus accepted FIFO reads.'],
    ['accepted_writes', summary.acceptedWrites, true, 'FIFO writes accepted by the simulated write domain.'],
    ['accepted_reads', summary.acceptedReads, true, 'FIFO reads accepted by the simulated read domain.'],
    ['rejected_write_attempts', summary.rejectedWriteAttempts, summary.rejectedWriteAttempts >= 0, 'Rejected writes are counted separately from data corruption.'],
    ['rejected_read_attempts', summary.rejectedReadAttempts, summary.rejectedReadAttempts >= 0, 'Rejected reads are counted separately from data corruption.'],
    ['fifo_occupancy_min', summary.fifoOccupancyMin, true, 'Minimum observed simulated FIFO occupancy.'],
    ['fifo_occupancy_max', summary.fifoOccupancyMax, true, 'Maximum observed simulated FIFO occupancy.'],
    ['fifo_full_observations', summary.fifoFullObservations, true, 'Number of full-status observations.'],
    ['fifo_empty_observations', summary.fifoEmptyObservations, true, 'Number of empty-status observations.'],
    ['sequence_gap_count', summary.sequenceGapCount, true, 'Sequence gaps observed in accepted write sequence numbers.'],
    ['data_integrity_passed', summary.dataIntegrityPassed ? 1 : 0, summary.dataIntegrityPassed, 'Read data matched accepted write ordering.'],
    ['integrity_failures', summary.integrityFailures, summary.integrityFailures === 0, 'Detected FIFO data mismatches.'],
    ['pointer_wraparounds', summary.pointerWraparounds, true, 'Pointer wraparound observations using the extra pointer bit.'],
    ['synchronizer_latency_cycles', summary.synchronizerLatencyCycles ?? -1, summary.synchronizerLatencyCycles === null || summary.synchronizerLatencyCycles >= 2, 'Destination clock cycles until DFF2 reached the target value.'],
  ];

  return metrics.map(([metricName, metricValue, passedValue, notes], index) => ({
    ...base,
    result_id: `${summary.runId}-metric-${String(index).padStart(2, '0')}`,
    metric_name: metricName,
    metric_type: typeof metricValue === 'number' ? 'number' : 'text',
    metric_value: typeof metricValue === 'number' ? metricValue : null,
    metric_text: typeof metricValue === 'number' ? null : String(metricValue),
    passed: Boolean(passedValue),
    notes,
  }));
}

function buildSummary({ runId, config, events, stats, occupancyObservations, sequenceGaps, integrityPassed }) {
  return {
    runId,
    source: 'synthetic-cdc-simulator',
    config: stripVolatileConfig(config, runId),
    eventCount: events.length,
    acceptedTransactions: stats.acceptedWrites + stats.acceptedReads,
    acceptedWrites: stats.acceptedWrites,
    acceptedReads: stats.acceptedReads,
    rejectedWriteAttempts: stats.rejectedWrites,
    rejectedReadAttempts: stats.rejectedReads,
    fifoOccupancyMin: occupancyObservations.length ? Math.min(...occupancyObservations) : 0,
    fifoOccupancyMax: occupancyObservations.length ? Math.max(...occupancyObservations) : 0,
    fifoOccupancyObservations: occupancyObservations.length,
    fifoFullObservations: stats.fifoFullObservations,
    fifoEmptyObservations: stats.fifoEmptyObservations,
    sequenceGaps,
    sequenceGapCount: sequenceGaps.length,
    dataIntegrityPassed: integrityPassed,
    integrityFailures: stats.integrityFailures,
    pointerWraparounds: stats.wraparounds,
    synchronizerLatencyCycles: stats.synchronizerLatencyCycles,
    illustrativeTimingViolations: stats.illustrativeTimingViolations,
    firstTimestampMs: 0,
    lastTimestampMs: config.durationMs,
    durationMs: config.durationMs,
    timingBasis: 'logical simulation timestamps only; not measured physical hardware timing',
    softwareVersion: CDC_SOFTWARE_VERSION,
  };
}

function pass(ok, details) {
  return { ok, details };
}

function syntheticTelemetry(sequenceNumber, seed) {
  const phase = (sequenceNumber + seed) % 32;
  const heartRate = 78 + (phase % 9) * 2 + Math.sin(phase / 3) * 3;
  const spo2 = 97 - ((phase % 5) * 0.35);
  const pressure = 24 + ((phase * 7) % 18) * 0.8;
  return {
    heartRate: round(heartRate, 2),
    spo2: round(spo2, 2),
    pressure: round(pressure, 2),
    gyroX: round(Math.sin(phase / 5) * 0.22, 4),
    gyroY: round(Math.cos(phase / 6) * 0.18, 4),
    gyroZ: round(Math.sin(phase / 7) * 0.12, 4),
    predictionLabel: phase > 24 ? 'DEGRADING' : phase > 29 ? 'CRITICAL' : 'HEALTHY',
  };
}

function predictionForData(value) {
  if (value % 17 === 0) return 'CRITICAL';
  if (value % 7 === 0) return 'DEGRADING';
  return 'HEALTHY';
}

function occupancy(writePointer, readPointer, pointerModulo) {
  return (writePointer - readPointer + pointerModulo) % pointerModulo;
}

function isPowerOfTwo(value) {
  return Number.isInteger(value) && value > 1 && (value & (value - 1)) === 0;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(Number(value) * factor) / factor;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function findSequenceGaps(rows) {
  const writes = rows
    .filter(row => row.event_type === 'fifo_write_accepted')
    .map(row => Number(row.sequence_number))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const gaps = [];
  for (let index = 1; index < writes.length; index += 1) {
    const gap = writes[index] - writes[index - 1];
    if (gap > 1) {
      gaps.push({ from: writes[index - 1], to: writes[index], gap: gap - 1 });
    }
  }
  return gaps;
}

function stripVolatileConfig(config, runId) {
  const { _resetApplied, ...rest } = config;
  return {
    ...rest,
    runId,
    note: 'Synthetic CDC simulation config; timing is logical simulation time, not physical hardware timing.',
  };
}
