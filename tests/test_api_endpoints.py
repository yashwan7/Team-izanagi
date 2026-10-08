"""
Unit tests for FastAPI REST API endpoint handlers.
"""

import unittest
from core.failover.api import (
    get_status,
    get_telemetry,
    get_sliding_window,
    trigger_preset,
    clear_degradation,
    get_events,
    DegradationRequest,
    inject_degradation,
    health_check,
)
from core.failover.models import SystemState


class TestApiEndpoints(unittest.TestCase):

    def test_health_check(self):
        res = health_check()
        self.assertEqual(res["status"], "ok")

    def test_get_status_and_telemetry(self):
        status = get_status()
        self.assertIn("current_state", status)
        self.assertIn("active_path", status)
        self.assertIn("feature_vector_8d", status)

        telem = get_telemetry()
        self.assertIn("sliding_window_8d_vector", telem)

    def test_sliding_window_endpoint(self):
        win = get_sliding_window()
        self.assertIn("sample_count", win)
        self.assertIn("sliding_window_mean_8d", win)
        self.assertEqual(len(win["dimension_labels"]), 8)

    def test_presets_and_degrade(self):
        # 1. Trigger warning
        res_warn = trigger_preset("warning")
        self.assertEqual(res_warn["preset"], "warning")

        # 2. Trigger failover
        res_failover = trigger_preset("failover")
        self.assertEqual(res_failover["preset"], "failover")

        # 3. Trigger mesh
        res_mesh = trigger_preset("mesh")
        self.assertEqual(res_mesh["preset"], "mesh")

        # 4. Custom degradation request
        req = DegradationRequest(port="PORT_A", duration_sec=5.0, latency_spike_ms=250.0, packet_loss_spike_pct=30.0)
        res_custom = inject_degradation(req)
        self.assertEqual(res_custom["status"], "degradation_injected")

        # 5. Recover
        res_rec = clear_degradation()
        self.assertEqual(res_rec["status"], "degradation_cleared")

    def test_events_log(self):
        events = get_events()
        self.assertIn("events", events)
        self.assertIsInstance(events["events"], list)


if __name__ == "__main__":
    unittest.main()
