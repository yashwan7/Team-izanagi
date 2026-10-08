"""
Unit tests for TinyML Network Anomaly Classifier and TFLite Inference Wrapper.
"""

import unittest
import time
from ml.network_anomaly.inference import AnomalyInferenceWrapper, AnomalyPrediction


class TestTinyMLInference(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.wrapper = AnomalyInferenceWrapper(
            model_path="ml/network_anomaly/model.tflite",
            norm_params_path="ml/network_anomaly/norm_params.json",
        )

    def test_01_model_loaded(self):
        """Verify TFLite model loaded successfully."""
        self.assertIsNotNone(self.wrapper.interpreter)
        self.assertIsNotNone(self.wrapper.input_details)
        self.assertIsNotNone(self.wrapper.output_details)

    def test_02_inference_latency_under_5ms(self):
        """Verify inference latency is strictly < 5.0ms (typically <0.1ms)."""
        # Warm-up
        self.wrapper.predict(22.0, 2.5, 0.1, 10.0)

        latencies = []
        for _ in range(50):
            res = self.wrapper.predict(22.0, 2.5, 0.1, 10.0)
            latencies.append(res.inference_time_ms)

        avg_lat = sum(latencies) / len(latencies)
        max_lat = max(latencies)
        print(f"\n[Test Benchmark] Avg Latency: {avg_lat:.4f} ms | Max Latency: {max_lat:.4f} ms")
        self.assertLess(avg_lat, 5.0, f"Average latency {avg_lat}ms exceeded 5ms budget!")
        self.assertLess(max_lat, 5.0, f"Max latency {max_lat}ms exceeded 5ms budget!")

    def test_03_healthy_classification(self):
        """Verify nominal network metrics classify as HEALTHY (0)."""
        pred = self.wrapper.predict(
            latency_ms=20.0,
            jitter_ms=2.0,
            packet_loss_pct=0.1,
            dns_time_ms=10.0,
        )
        self.assertEqual(pred.predicted_class, 0)
        self.assertEqual(pred.class_label, "HEALTHY")
        self.assertFalse(pred.is_anomalous)
        self.assertFalse(pred.is_critical)
        self.assertGreater(pred.probabilities["HEALTHY"], 0.80)

    def test_04_degraded_classification(self):
        """Verify high jitter / moderate packet drop classifies as DEGRADED (1)."""
        pred = self.wrapper.predict(
            latency_ms=130.0,
            jitter_ms=20.0,
            packet_loss_pct=10.0,
            dns_time_ms=70.0,
        )
        self.assertEqual(pred.predicted_class, 1)
        self.assertEqual(pred.class_label, "DEGRADED")
        self.assertTrue(pred.is_anomalous)
        self.assertFalse(pred.is_critical)
        self.assertGreater(pred.probabilities["DEGRADED"], 0.70)

    def test_05_critical_classification(self):
        """Verify severe packet loss & latency spike classifies as CRITICAL (2)."""
        pred = self.wrapper.predict(
            latency_ms=380.0,
            jitter_ms=65.0,
            packet_loss_pct=55.0,
            dns_time_ms=260.0,
        )
        self.assertEqual(pred.predicted_class, 2)
        self.assertEqual(pred.class_label, "CRITICAL")
        self.assertTrue(pred.is_anomalous)
        self.assertTrue(pred.is_critical)
        self.assertGreater(pred.probabilities["CRITICAL"], 0.80)

    def test_06_state_machine_endpoint_integration(self):
        """Verify evaluate_state_machine_endpoint correctly outputs failover & mesh recommendations."""
        # Scenario 1: Port A nominal, Port B nominal
        res_normal = self.wrapper.evaluate_state_machine_endpoint(
            port_a_metrics=[22.0, 2.5, 0.1, 10.0],
            port_b_metrics=[40.0, 5.0, 0.3, 18.0],
        )
        self.assertEqual(res_normal["recommendation"], "MAINTAIN_NOMINAL")
        self.assertEqual(res_normal["recommended_path"], "PORT_A")

        # Scenario 2: Port A critical, Port B nominal -> Failover to Port B
        res_failover = self.wrapper.evaluate_state_machine_endpoint(
            port_a_metrics=[380.0, 60.0, 50.0, 240.0],
            port_b_metrics=[40.0, 5.0, 0.3, 18.0],
        )
        self.assertEqual(res_failover["recommendation"], "FAILOVER_TO_PORT_B")
        self.assertEqual(res_failover["recommended_path"], "PORT_B")

        # Scenario 3: Both ports critical -> Activate Mesh Mode
        res_mesh = self.wrapper.evaluate_state_machine_endpoint(
            port_a_metrics=[400.0, 70.0, 60.0, 300.0],
            port_b_metrics=[380.0, 65.0, 55.0, 280.0],
        )
        self.assertEqual(res_mesh["recommendation"], "ACTIVATE_MESH_MODE")
        self.assertEqual(res_mesh["recommended_path"], "MESH")
        self.assertLess(res_mesh["combined_latency_ms"], 5.0)


if __name__ == "__main__":
    unittest.main()
