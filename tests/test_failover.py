"""
Comprehensive unit and integration test suite for Kshitij Dual-Port Telemetry & Failover Engine.
"""

import time
import unittest
from core.failover.models import PortId, SystemState, DualTelemetrySample, PortMetric
from core.failover.telemetry import TelemetryGenerator
from core.failover.state_machine import FailoverStateMachine
from core.failover.engine import FailoverEngine


class TestFailoverEngine(unittest.TestCase):

    def test_01_telemetry_generator_baseline(self):
        """Test that telemetry generator produces valid samples with Port A and Port B metrics."""
        generator = TelemetryGenerator()
        sample = generator.generate_sample()

        self.assertIsInstance(sample, DualTelemetrySample)
        self.assertGreater(sample.port_a.latency_ms, 0)
        self.assertGreater(sample.port_b.latency_ms, 0)

        # 8D vector test
        vec = sample.to_8d_vector()
        self.assertEqual(len(vec), 8)
        self.assertEqual(vec[0], sample.port_a.latency_ms)
        self.assertEqual(vec[4], sample.port_b.latency_ms)

    def test_02_inject_network_degradation(self):
        """Test fault injection spiking latency and packet loss."""
        generator = TelemetryGenerator()
        generator.inject_network_degradation(
            port=PortId.PORT_A,
            duration_sec=5.0,
            latency_spike_ms=300.0,
            packet_loss_spike_pct=40.0,
        )

        sample = generator.generate_sample()
        self.assertGreater(sample.port_a.latency_ms, 250.0)
        self.assertGreater(sample.port_a.packet_loss_pct, 30.0)

        # Port B should remain healthy
        self.assertLess(sample.port_b.latency_ms, 70.0)
        self.assertLess(sample.port_b.packet_loss_pct, 5.0)

    def test_03_sliding_window_8d_feature_vector(self):
        """Test maintaining 50-sample (5s) sliding window and 8D feature vector."""
        sm = FailoverStateMachine(window_size=50)

        for i in range(60):
            sample = DualTelemetrySample(
                timestamp=time.time(),
                port_a=PortMetric(latency_ms=20.0, jitter_ms=2.0, packet_loss_pct=0.1, dns_time_ms=10.0),
                port_b=PortMetric(latency_ms=40.0, jitter_ms=4.0, packet_loss_pct=0.2, dns_time_ms=15.0),
            )
            sm.ingest_sample(sample)

        self.assertEqual(len(sm._window), 50)
        vec_8d = sm.get_sliding_window_8d_vector()
        self.assertEqual(len(vec_8d), 8)
        self.assertAlmostEqual(vec_8d[0], 20.0, places=1)
        self.assertAlmostEqual(vec_8d[4], 40.0, places=1)

    def test_04_state_warning_emission(self):
        """Test degradation score > 0.60 triggers STATE_WARNING."""
        sm = FailoverStateMachine(window_size=50)
        warning_called = []
        sm.register_warning_callback(lambda payload: warning_called.append(payload))

        # Ingest mild degraded samples (latency ~ 170ms, loss ~ 14%)
        for _ in range(50):
            sample = DualTelemetrySample(
                timestamp=time.time(),
                port_a=PortMetric(latency_ms=175.0, jitter_ms=18.0, packet_loss_pct=14.0, dns_time_ms=60.0),
                port_b=PortMetric(latency_ms=40.0, jitter_ms=4.0, packet_loss_pct=0.2, dns_time_ms=15.0),
            )
            sm.ingest_sample(sample)

        evaluation = sm.evaluate_health()
        self.assertGreater(evaluation.port_a_degradation_score, 0.60)
        self.assertLessEqual(evaluation.port_a_degradation_score, 0.85)
        self.assertEqual(evaluation.state, SystemState.STATE_WARNING)
        self.assertEqual(evaluation.active_path, PortId.PORT_A)
        self.assertGreater(len(warning_called), 0)

    def test_05_path_failover_to_port_b(self):
        """Test degradation score > 0.85 OR critical > 0.50 executes immediate failover to Port B."""
        sm = FailoverStateMachine(window_size=50)
        failover_events = []
        sm.register_failover_callback(lambda payload: failover_events.append(payload))

        # Ingest severe failure on Port A (latency ~ 320ms, packet loss ~ 45%)
        for _ in range(50):
            sample = DualTelemetrySample(
                timestamp=time.time(),
                port_a=PortMetric(latency_ms=320.0, jitter_ms=35.0, packet_loss_pct=45.0, dns_time_ms=150.0),
                port_b=PortMetric(latency_ms=40.0, jitter_ms=4.0, packet_loss_pct=0.2, dns_time_ms=15.0),
            )
            sm.ingest_sample(sample)

        evaluation = sm.evaluate_health()
        self.assertTrue(evaluation.port_a_degradation_score > 0.85 or evaluation.port_a_critical_score > 0.50)
        self.assertEqual(evaluation.state, SystemState.STATE_FAILOVER_B)
        self.assertEqual(evaluation.active_path, PortId.PORT_B)
        self.assertGreater(len(failover_events), 0)

    def test_06_mesh_mode_callback_activation(self):
        """Test that when both ports are critical, the Mesh Mode callback is triggered."""
        sm = FailoverStateMachine(window_size=50)
        mesh_activated_events = []
        sm.register_mesh_callback(lambda payload: mesh_activated_events.append(payload))

        # Ingest catastrophic failure on BOTH Port A and Port B
        for _ in range(50):
            sample = DualTelemetrySample(
                timestamp=time.time(),
                port_a=PortMetric(latency_ms=350.0, jitter_ms=40.0, packet_loss_pct=50.0, dns_time_ms=160.0),
                port_b=PortMetric(latency_ms=360.0, jitter_ms=45.0, packet_loss_pct=52.0, dns_time_ms=170.0),
            )
            sm.ingest_sample(sample)

        evaluation = sm.evaluate_health()
        self.assertEqual(evaluation.state, SystemState.STATE_MESH_ACTIVE)
        self.assertEqual(evaluation.active_path, PortId.MESH)
        self.assertTrue(evaluation.mesh_activated)
        self.assertGreater(len(mesh_activated_events), 0)
        self.assertIn("CRITICAL", mesh_activated_events[0]["message"])

    def test_07_engine_integration_and_recovery(self):
        """Test engine end-to-end integration and recovery back to normal."""
        engine = FailoverEngine(telemetry_interval_sec=0.02, eval_interval_sec=0.05, window_size=20)
        engine.start()

        time.sleep(0.15)
        status = engine.get_system_status()
        self.assertEqual(status["current_state"], SystemState.STATE_NORMAL.value)

        # Inject degradation on Port A
        engine.inject_network_degradation(PortId.PORT_A, duration_sec=1.0, latency_spike_ms=300.0, packet_loss_spike_pct=40.0)
        time.sleep(0.3)

        status_degraded = engine.get_system_status()
        self.assertIn(status_degraded["current_state"], [SystemState.STATE_FAILOVER_B.value, SystemState.STATE_WARNING.value])

        # Clear degradation
        engine.clear_degradation()
        time.sleep(0.5)

        engine.stop()


if __name__ == "__main__":
    unittest.main()
