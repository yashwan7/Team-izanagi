"""
sensors/eog_dsp/test_eog_dsp.py
===============================
Unit Test Suite for Kshitij EOG DSP Module.

Asserts:
  1. 4th-Order Butterworth Bandpass Frequency Response (DC drift & 50Hz elimination).
  2. Pulse-width Blink Filter (100ms <= duration <= 400ms constraint).
  3. 2 Blinks within 1.5s -> 'CALL_NURSE'.
  4. 3 Blinks within 1.5s -> 'PAIN'.
  5. Gaze Step-Voltage Detection (LEFT / RIGHT).
  6. Gaze LEFT + 1 Blink -> 'WATER'.
  7. Gaze RIGHT + 1 Blink -> 'BATHROOM'.
  8. Artifact rejection (EMG spikes < 100ms and slow drift > 400ms).
"""

import math
import unittest
from typing import List

from sensors.eog_dsp.detector import (
    BlinkDetector,
    CommandEvent,
    EOGCommandEngine,
    GazeDetector,
    GazeDirection,
)
from sensors.eog_dsp.filter import (
    ButterworthBandpassFilter,
    ButterworthLowpassFilter,
)
from sensors.eog_dsp.pipeline import EOGDSPPipeline
from sensors.eog_dsp.simulator import EOGSimulator


class TestButterworthBandpassFilter(unittest.TestCase):
    def setUp(self):
        self.filter = ButterworthBandpassFilter(lowcut=0.1, highcut=10.0, fs=100.0)

    def test_frequency_response_attenuation(self):
        """Verify frequency response characteristics of 4th-order IIR bandpass."""
        # 1. DC Baseline Drift attenuation at 0.01 Hz (> 40 dB attenuation)
        gain_dc, db_dc = self.filter.frequency_response(0.01)
        self.assertLess(db_dc, -40.0, f"DC drift attenuation insufficient: {db_dc:.1f} dB")

        # 2. Lower -3dB cutoff at 0.1 Hz
        gain_low, db_low = self.filter.frequency_response(0.1)
        self.assertAlmostEqual(db_low, -3.01, delta=0.5, msg="Lower cutoff should be ~ -3dB")

        # 3. Passband at 1.0 Hz, 3.0 Hz, 5.0 Hz (gain ~ 1.0)
        for f in (1.0, 3.0, 5.0):
            gain_pb, db_pb = self.filter.frequency_response(f)
            self.assertAlmostEqual(gain_pb, 1.0, delta=0.05, msg=f"Passband at {f}Hz should have gain ~1.0")

        # 4. Upper -3dB cutoff at 10.0 Hz
        gain_high, db_high = self.filter.frequency_response(10.0)
        self.assertAlmostEqual(db_high, -3.01, delta=0.5, msg="Upper cutoff should be ~ -3dB")

        # 5. 50 Hz AC mains hum elimination (> 60 dB attenuation)
        gain_50, db_50 = self.filter.frequency_response(50.0)
        self.assertLess(db_50, -60.0, f"50Hz mains attenuation insufficient: {db_50:.1f} dB")

    def test_filter_removes_dc_and_high_frequency_noise(self):
        """Simulate a signal with 0.02 Hz drift (80 uV), 2.0 Hz biopotential (100 uV), and 50Hz hum (30 uV)."""
        fs = 100.0
        n_samples = 1000
        # Signal: 2.0 Hz passband tone + 0.02 Hz drift + 50Hz noise
        raw_sig = [
            80.0 * math.sin(2.0 * math.pi * 0.02 * (i / fs)) +
            100.0 * math.sin(2.0 * math.pi * 2.0 * (i / fs)) +
            30.0 * math.sin(2.0 * math.pi * 50.0 * (i / fs))
            for i in range(n_samples)
        ]
        filtered = self.filter.filter_stream(raw_sig)

        # In steady state (after initial warmup of 200 samples), 2Hz peak should be preserved ~100uV
        steady_state = filtered[300:]
        max_val = max(steady_state)
        min_val = min(steady_state)
        peak_to_peak = max_val - min_val

        # 2Hz tone with amp 100 has peak-to-peak of 200 uV
        self.assertAlmostEqual(peak_to_peak, 200.0, delta=15.0, msg="Passband signal should be preserved")


class TestBlinkDetector(unittest.TestCase):
    def setUp(self):
        self.detector = BlinkDetector(threshold=50.0, min_duration_ms=100.0, max_duration_ms=400.0, fs=100.0)

    def _feed_pulse(self, duration_samples: int, amplitude_uv: float = 200.0) -> List:
        events = []
        # Pre-pulse baseline
        for _ in range(10):
            ev = self.detector.process_sample(0.0)
            if ev: events.append(ev)
        # Pulse
        for _ in range(duration_samples):
            ev = self.detector.process_sample(amplitude_uv)
            if ev: events.append(ev)
        # Post-pulse baseline
        for _ in range(15):
            ev = self.detector.process_sample(0.0)
            if ev: events.append(ev)
        return events

    def test_valid_blink_pulse_detected(self):
        """A 200ms pulse (20 samples at 100Hz) should be detected as a valid blink."""
        self.detector.reset()
        events = self._feed_pulse(duration_samples=20)
        self.assertEqual(len(events), 1, "Expected 1 valid blink event")
        self.assertEqual(events[0].duration_ms, 200.0)

    def test_short_spike_rejected(self):
        """A 40ms spike (4 samples at 100Hz < 100ms) must be rejected."""
        self.detector.reset()
        events = self._feed_pulse(duration_samples=4)
        self.assertEqual(len(events), 0, "Spike < 100ms should be rejected")

    def test_long_pulse_rejected(self):
        """A 600ms pulse (60 samples at 100Hz > 400ms) must be rejected."""
        self.detector.reset()
        events = self._feed_pulse(duration_samples=60)
        self.assertEqual(len(events), 0, "Prolonged pulse > 400ms should be rejected")


class TestGazeDetector(unittest.TestCase):
    def setUp(self):
        self.gaze = GazeDetector(gaze_left_threshold=60.0, gaze_right_threshold=-60.0, fs=100.0)

    def test_gaze_direction_tracking(self):
        # Baseline
        for _ in range(10):
            dir_ = self.gaze.process_sample(0.0)
        self.assertEqual(dir_, GazeDirection.CENTER)

        # Step shift to LEFT (+100 uV)
        for _ in range(10):
            dir_ = self.gaze.process_sample(100.0)
        self.assertEqual(dir_, GazeDirection.LEFT)

        # Step shift to RIGHT (-100 uV)
        for _ in range(10):
            dir_ = self.gaze.process_sample(-100.0)
        self.assertEqual(dir_, GazeDirection.RIGHT)


class TestEOGCommandEngine(unittest.TestCase):
    def setUp(self):
        self.pipeline = EOGDSPPipeline(fs=100.0)
        self.sim = EOGSimulator(fs=100.0)

    def test_scenario_call_nurse_on_2_blinks(self):
        """Assert that 2 blinks within 1.5s triggers CALL_NURSE command."""
        self.pipeline.reset()
        samples = self.sim.generate_scenario_nurse(3.0)
        commands: List[CommandEvent] = []

        for s in samples:
            frame = self.pipeline.process_sample(s.raw_vertical_uv, s.raw_horizontal_uv, s.timestamp_s)
            if frame.command:
                commands.append(frame.command)

        self.assertEqual(len(commands), 1, f"Expected 1 CALL_NURSE command, got {len(commands)}")
        self.assertEqual(commands[0].command, "CALL_NURSE")
        self.assertEqual(commands[0].blink_count, 2)

    def test_scenario_pain_on_3_blinks(self):
        """Assert that 3 blinks within 1.5s triggers PAIN command."""
        self.pipeline.reset()
        samples = self.sim.generate_scenario_pain(3.0)
        commands: List[CommandEvent] = []

        for s in samples:
            frame = self.pipeline.process_sample(s.raw_vertical_uv, s.raw_horizontal_uv, s.timestamp_s)
            if frame.command:
                commands.append(frame.command)

        self.assertEqual(len(commands), 1, f"Expected 1 PAIN command, got {len(commands)}")
        self.assertEqual(commands[0].command, "PAIN")
        self.assertEqual(commands[0].blink_count, 3)

    def test_scenario_water_on_left_gaze_plus_blink(self):
        """Assert that Gaze LEFT + 1 blink triggers WATER command."""
        self.pipeline.reset()
        samples = self.sim.generate_scenario_water(3.0)
        commands: List[CommandEvent] = []

        for s in samples:
            frame = self.pipeline.process_sample(s.raw_vertical_uv, s.raw_horizontal_uv, s.timestamp_s)
            if frame.command:
                commands.append(frame.command)

        self.assertEqual(len(commands), 1, f"Expected 1 WATER command, got {len(commands)}")
        self.assertEqual(commands[0].command, "WATER")
        self.assertEqual(commands[0].gaze, GazeDirection.LEFT)

    def test_scenario_bathroom_on_right_gaze_plus_blink(self):
        """Assert that Gaze RIGHT + 1 blink triggers BATHROOM command."""
        self.pipeline.reset()
        samples = self.sim.generate_scenario_bathroom(3.0)
        commands: List[CommandEvent] = []

        for s in samples:
            frame = self.pipeline.process_sample(s.raw_vertical_uv, s.raw_horizontal_uv, s.timestamp_s)
            if frame.command:
                commands.append(frame.command)

        self.assertEqual(len(commands), 1, f"Expected 1 BATHROOM command, got {len(commands)}")
        self.assertEqual(commands[0].command, "BATHROOM")
        self.assertEqual(commands[0].gaze, GazeDirection.RIGHT)

    def test_artifact_rejection_no_false_triggers(self):
        """Assert that noise spikes and slow drift artifacts produce zero false command triggers."""
        self.pipeline.reset()
        samples = self.sim.generate_scenario_invalid_artifacts(3.0)
        commands: List[CommandEvent] = []

        for s in samples:
            frame = self.pipeline.process_sample(s.raw_vertical_uv, s.raw_horizontal_uv, s.timestamp_s)
            if frame.command:
                commands.append(frame.command)

        self.assertEqual(len(commands), 0, f"Expected 0 commands on artifacts, got {len(commands)}")


if __name__ == "__main__":
    unittest.main()
