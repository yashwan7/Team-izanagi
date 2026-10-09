#!/usr/bin/env python3
"""
========================================================================================
IZANAGI TACTICAL EDGE TELEMETRY SIMULATOR & LIVE MQTT PUBLISHER
========================================================================================
Publishes real-time sensor packets directly to HiveMQ public broker.
Broker:   broker.hivemq.com
Port:     1883 (TCP)
Topic:    izanagi/sensors/data

Payload Format:
{
  "pulse_val": number,
  "force_n": number,
  "hub_online": boolean,
  "lat": "12.871773",
  "lng": "77.576856"
}

Usage:
    python3 hardware/mqtt_telemetry_publisher.py
    python3 hardware/mqtt_telemetry_publisher.py --interval 0.5
    python3 hardware/mqtt_telemetry_publisher.py --tachycardia
========================================================================================
"""

import sys
import time
import math
import json
import random
import argparse
from typing import Dict, Any

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("[ERROR] paho-mqtt is required. Install it using: pip install paho-mqtt")
    sys.exit(1)

BROKER_HOST = "broker.hivemq.com"
BROKER_PORT = 1883
TOPIC = "izanagi/sensors/data"

LAT_BROOKES_HAVEN = "12.871773"
LNG_BROOKES_HAVEN = "77.576856"

class SensorStreamSimulator:
    def __init__(self, interval: float = 1.0, tachycardia: bool = False):
        self.interval = interval
        self.tachycardia = tachycardia
        self.hub_online = True
        self.packet_count = 0
        self.step = 0

        # Initialize Paho MQTT client
        client_id = f"Izanagi_Publisher_{random.randint(1000, 9999)}"
        if hasattr(mqtt, "CallbackAPIVersion"):
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
        else:
            self.client = mqtt.Client(client_id=client_id)

        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect

    def on_connect(self, client, userdata, flags, rc, properties=None):
        rc_val = getattr(rc, "value", rc)
        if rc_val == 0 or str(rc) == "Success":
            print(f"\033[92m[✓ CONNECTED]\033[0m Successfully connected to HiveMQ ({BROKER_HOST}:{BROKER_PORT})")
            print(f"[STREAMING] Target Topic: \033[96m{TOPIC}\033[0m")
            print(f"[LOCATION]  Coordinates: \033[93m{LAT_BROOKES_HAVEN}, {LNG_BROOKES_HAVEN}\033[0m (Brookes Haven Layout)")
            print("-" * 75)
        else:
            print(f"\033[91m[ERROR]\033[0m Connection rejected with code: {rc}")

    def on_disconnect(self, client, userdata, flags, rc=None, properties=None):
        print("\033[93m[DISCONNECTED]\033[0m Disconnected from HiveMQ broker.")

    def generate_packet(self) -> Dict[str, Any]:
        self.step += 1
        t = self.step * 0.2

        # 1. Pulse Rate Calculation (Physiological breathing drift + jitter)
        if self.tachycardia:
            base_hr = 124.0
            variation = math.sin(t) * 8.0 + random.uniform(-3, 3)
        else:
            base_hr = 74.0
            # Respiratory sinus arrhythmia modulation
            variation = math.sin(t * 0.8) * 4.5 + random.uniform(-1.5, 1.5)

        pulse_val = max(45, min(180, int(round(base_hr + variation))))

        # 2. Bed Force Gauge (0 - 4095 ADC)
        # Normal resting bed load: ~1800 - 2000 ADC (~45-50 kg / 450 N)
        # Occasional slight shift/restlessness every 20-30 cycles
        is_restless = (self.step % 35) in [15, 16, 17]
        if is_restless:
            force_base = 3150
            force_noise = random.randint(-150, 250)
        else:
            force_base = 1840
            force_noise = random.randint(-40, 40)

        force_n = max(0, min(4095, force_base + force_noise))

        # 3. Geo coordinate drift (micro-meter GPS accuracy simulation)
        lat_drift = 12.871773 + math.sin(t * 0.1) * 0.000015
        lng_drift = 77.576856 + math.cos(t * 0.1) * 0.000015

        payload = {
            "pulse_val": pulse_val,
            "force_n": force_n,
            "hub_online": self.hub_online,
            "lat": f"{lat_drift:.6f}",
            "lng": f"{lng_drift:.6f}"
        }
        return payload

    def run(self):
        print(f"[INIT] Connecting to {BROKER_HOST}:{BROKER_PORT}...")
        try:
            self.client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            print(f"[FATAL] Connection error: {e}")
            return

        time.sleep(1.0)
        print("[INFO] Telemetry stream started. Press Ctrl+C to terminate.\n")

        try:
            while True:
                payload = self.generate_packet()
                payload_str = json.dumps(payload)

                info = self.client.publish(TOPIC, payload_str, qos=0)
                info.wait_for_publish(timeout=2.0)
                self.packet_count += 1

                # Visual Terminal Output
                pulse_color = "\033[91m" if payload["pulse_val"] > 100 else "\033[92m"
                hub_status = "\033[92mONLINE\033[0m" if payload["hub_online"] else "\033[91mOFFLINE\033[0m"

                print(
                    f"[{time.strftime('%H:%M:%S')}] Pkt #{self.packet_count:04d} | "
                    f"Pulse: {pulse_color}{payload['pulse_val']:3d} BPM\033[0m | "
                    f"Force: \033[93m{payload['force_n']:4d}/4095\033[0m | "
                    f"Hub: {hub_status} | "
                    f"GPS: ({payload['lat']}, {payload['lng']})"
                )

                time.sleep(self.interval)

        except KeyboardInterrupt:
            print("\n[STOPPING] Shutting down telemetry publisher...")
        finally:
            self.client.loop_stop()
            self.client.disconnect()
            print("[EXIT] MQTT Telemetry Publisher closed cleanly.")

def main():
    parser = argparse.ArgumentParser(description="Izanagi MQTT Sensor Telemetry Streamer")
    parser.add_argument("--interval", type=float, default=1.0, help="Publish interval in seconds (default: 1.0)")
    parser.add_argument("--tachycardia", action="store_true", help="Simulate acute tachycardia (>115 BPM)")
    args = parser.parse_args()

    sim = SensorStreamSimulator(interval=args.interval, tachycardia=args.tachycardia)
    sim.run()

if __name__ == "__main__":
    main()
