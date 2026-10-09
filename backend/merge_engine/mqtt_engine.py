"""
MqttTelemetryEngine
Unified background MQTT ingestion & forwarding service for Izanagi.
Connects to HiveMQ broker (broker.hivemq.com), subscribes to `izanagi/sensors/data`,
maintains verified telemetry state, and bridges updates to FastAPI WebSockets.
"""

import json
import time
import logging
from typing import Optional, Dict, Any, Callable, List
from threading import Lock

try:
    import paho.mqtt.client as mqtt
    PAHO_AVAILABLE = True
except ImportError:
    PAHO_AVAILABLE = False
    mqtt = None

logger = logging.getLogger("mqtt_engine")
logger.setLevel(logging.INFO)

DEFAULT_BROKER_HOST = "broker.hivemq.com"
DEFAULT_BROKER_PORT = 1883
DEFAULT_TOPIC = "izanagi/sensors/data"

class MqttTelemetryEngine:
    def __init__(
        self,
        broker_host: str = DEFAULT_BROKER_HOST,
        broker_port: int = DEFAULT_BROKER_PORT,
        topic: str = DEFAULT_TOPIC
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.topic = topic

        self.client: Optional[Any] = None
        self.is_connected: bool = False
        self.is_running: bool = False
        self.lock = Lock()

        # Telemetry State
        self.packet_count: int = 0
        self.last_packet_time: Optional[float] = None
        self.current_telemetry: Dict[str, Any] = {
            "pulse_val": 74,
            "force_n": 1840,
            "hub_online": True,
            "lat": "12.871773",
            "lng": "77.576856",
            "timestamp": time.time(),
            "source": "INITIAL_CALIBRATION"
        }
        self.history: List[Dict[str, Any]] = []

        # Callbacks registered by service/subsystems
        self.listeners: List[Callable[[Dict[str, Any]], None]] = []

    def register_listener(self, callback: Callable[[Dict[str, Any]], None]):
        """Register an async or sync callback to receive new telemetry packets."""
        with self.lock:
            if callback not in self.listeners:
                self.listeners.append(callback)

    def start(self):
        """Starts the background MQTT client connection."""
        if not PAHO_AVAILABLE:
            logger.warning("[MQTT Engine] paho-mqtt not available. Running in local simulation mode.")
            return

        if self.is_running:
            return

        try:
            client_id = f"kshitij_backend_{int(time.time())}"
            # Support Paho 2.x and 1.x API versions
            if hasattr(mqtt, "CallbackAPIVersion"):
                self.client = mqtt.Client(
                    mqtt.CallbackAPIVersion.VERSION2,
                    client_id=client_id,
                    clean_session=True
                )
            else:
                self.client = mqtt.Client(client_id=client_id, clean_session=True)

            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            self.client.on_message = self._on_message

            self.client.connect_async(self.broker_host, self.broker_port, keepalive=60)
            self.client.loop_start()
            self.is_running = True
            logger.info(f"[MQTT Engine] Started background loop for {self.broker_host}:{self.broker_port}")
        except Exception as e:
            logger.error(f"[MQTT Engine] Failed to start MQTT client: {e}")

    def stop(self):
        """Stops the MQTT client connection."""
        if self.client and self.is_running:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception:
                pass
            self.is_running = False
            self.is_connected = False
            logger.info("[MQTT Engine] Stopped.")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        rc_code = getattr(rc, "value", rc)
        if rc_code == 0 or str(rc) == "Success":
            self.is_connected = True
            logger.info(f"[MQTT Engine] Connected to {self.broker_host}:{self.broker_port}. Subscribing to {self.topic}")
            client.subscribe(self.topic, qos=0)
        else:
            self.is_connected = False
            logger.warning(f"[MQTT Engine] Connection returned code {rc}")

    def _on_disconnect(self, client, userdata, disconnect_flags, rc=None, properties=None):
        self.is_connected = False
        logger.info("[MQTT Engine] Disconnected from broker.")

    def _on_message(self, client, userdata, msg):
        try:
            payload_str = msg.payload.decode("utf-8")
            data = json.loads(payload_str)
            self.ingest_packet(data, source="HARM_SENSOR_NODE")
        except Exception as e:
            logger.warning(f"[MQTT Engine] Error decoding incoming packet: {e}")

    def ingest_packet(self, data: Dict[str, Any], source: str = "EDGE_NODE") -> Dict[str, Any]:
        """Ingests, parses, normalizes, and stores incoming telemetry data."""
        raw_pulse = data.get("pulse_val") or data.get("pulse_bpm") or data.get("pulse") or 72
        raw_force = data.get("force_n") if "force_n" in data else data.get("force", 1840)
        
        if "hub_online" in data:
            raw_hub = data["hub_online"]
        elif "online" in data:
            raw_hub = data["online"]
        elif "hubOnline" in data:
            raw_hub = data["hubOnline"]
        else:
            raw_hub = True

        raw_lat = data.get("lat") or data.get("latitude") or "12.871773"
        raw_lng = data.get("lng") or data.get("longitude") or "77.576856"

        try:
            pulse_val = int(raw_pulse)
        except Exception:
            pulse_val = 72

        try:
            force_n = int(raw_force)
        except Exception:
            force_n = 1840

        hub_online = bool(raw_hub) if isinstance(raw_hub, bool) else str(raw_hub).lower() == "true"

        normalized = {
            "pulse_val": pulse_val,
            "force_n": force_n,
            "hub_online": hub_online,
            "lat": str(raw_lat),
            "lng": str(raw_lng),
            "timestamp": time.time(),
            "source": source
        }

        with self.lock:
            self.current_telemetry = normalized
            self.packet_count += 1
            self.last_packet_time = time.time()
            self.history.append(normalized)
            if len(self.history) > 50:
                self.history.pop(0)

            listeners_copy = list(self.listeners)

        # Notify registered listeners
        for listener in listeners_copy:
            try:
                listener(normalized)
            except Exception as e:
                logger.error(f"[MQTT Engine] Listener error: {e}")

        return normalized

    def publish_telemetry(self, telemetry_data: Dict[str, Any]) -> bool:
        """Publishes telemetry payload to the MQTT topic."""
        # Normalize and ingest locally first
        normalized = self.ingest_packet(telemetry_data, source="LOCAL_PUBLISHER")

        if self.client and self.is_connected:
            try:
                payload_json = json.dumps(normalized)
                self.client.publish(self.topic, payload_json, qos=0)
                logger.info(f"[MQTT Engine] Published packet to {self.topic}")
                return True
            except Exception as e:
                logger.error(f"[MQTT Engine] Publish failed: {e}")
                return False
        return False

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive status of MQTT Engine."""
        with self.lock:
            return {
                "broker": f"{self.broker_host}:{self.broker_port}",
                "topic": self.topic,
                "is_running": self.is_running,
                "is_connected": self.is_connected,
                "packet_count": self.packet_count,
                "last_packet_time": self.last_packet_time,
                "telemetry": dict(self.current_telemetry),
                "history_length": len(self.history)
            }

# Singleton instance
mqtt_engine = MqttTelemetryEngine()
