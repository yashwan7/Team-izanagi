"""
Unit tests for MqttTelemetryEngine and backend sensor telemetry endpoints.
"""

import unittest
from backend.merge_engine.mqtt_engine import MqttTelemetryEngine, mqtt_engine
from backend.merge_engine.service import (
    get_latest_sensors_endpoint,
    get_sensors_status_endpoint,
    publish_sensors_endpoint,
    SensorPublishRequest
)

class TestMqttEngine(unittest.TestCase):

    def setUp(self):
        self.engine = MqttTelemetryEngine(
            broker_host="broker.hivemq.com",
            broker_port=1883,
            topic="izanagi/sensors/data"
        )

    def test_ingest_standard_payload(self):
        payload = {
            "pulse_val": 84,
            "force_n": 2150,
            "hub_online": True,
            "lat": "12.871773",
            "lng": "77.576856"
        }
        res = self.engine.ingest_packet(payload)
        self.assertEqual(res["pulse_val"], 84)
        self.assertEqual(res["force_n"], 2150)
        self.assertTrue(res["hub_online"])
        self.assertEqual(res["lat"], "12.871773")
        self.assertEqual(res["lng"], "77.576856")
        self.assertEqual(self.engine.packet_count, 1)

    def test_ingest_alternative_keys_resilience(self):
        payload = {
            "pulse_bpm": 112,
            "force": 3200,
            "online": False,
            "latitude": "12.872200",
            "longitude": "77.576600"
        }
        res = self.engine.ingest_packet(payload)
        self.assertEqual(res["pulse_val"], 112)
        self.assertEqual(res["force_n"], 3200)
        self.assertFalse(res["hub_online"])
        self.assertEqual(res["lat"], "12.872200")
        self.assertEqual(res["lng"], "77.576600")

    def test_listener_dispatch(self):
        received_packets = []
        def listener(data):
            received_packets.append(data)

        self.engine.register_listener(listener)
        self.engine.ingest_packet({"pulse_val": 75, "force_n": 1800})

        self.assertEqual(len(received_packets), 1)
        self.assertEqual(received_packets[0]["pulse_val"], 75)

    def test_get_status(self):
        status = self.engine.get_status()
        self.assertIn("broker", status)
        self.assertIn("topic", status)
        self.assertIn("packet_count", status)
        self.assertIn("telemetry", status)

    def test_rest_endpoints(self):
        latest = get_latest_sensors_endpoint()
        self.assertIn("pulse_val", latest)
        self.assertIn("force_n", latest)

        status = get_sensors_status_endpoint()
        self.assertEqual(status["topic"], "izanagi/sensors/data")

if __name__ == "__main__":
    unittest.main()
