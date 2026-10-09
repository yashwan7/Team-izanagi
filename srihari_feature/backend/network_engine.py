import time
import random
from typing import Dict, Any
from backend.models import NetworkStatus, NetworkTelemetry

class NetworkFailoverEngine:
    def __init__(self):
        self.port_a = NetworkTelemetry(
            port_name="Port A (Primary Eth0)",
            latency_ms=18.4,
            jitter_ms=2.1,
            packet_loss_pct=0.0,
            dns_time_ms=12.0
        )
        self.port_b = NetworkTelemetry(
            port_name="Port B (Backup Sat/LTE)",
            latency_ms=45.2,
            jitter_ms=4.8,
            packet_loss_pct=0.1,
            dns_time_ms=28.0
        )
        self.active_state = "PORT_A_ACTIVE"
        self.degradation_score = 0.08
        self.is_degradation_injected = False
        self.last_switch = "System Boot"

    def inject_network_degradation(self, scenario: str = "PORT_A_FAILURE"):
        """
        Simulates link failure by spiking latency and packet loss on Port A or both.
        """
        self.is_degradation_injected = True
        if scenario == "PORT_A_FAILURE":
            self.port_a.latency_ms = 450.0 + random.uniform(10, 80)
            self.port_a.jitter_ms = 85.0 + random.uniform(5, 20)
            self.port_a.packet_loss_pct = 28.5 + random.uniform(5, 15)
            self.port_a.dns_time_ms = 280.0
            self.evaluate_state_machine()
        elif scenario == "TOTAL_DISCONNECT":
            # Both ports degrade -> Mesh Mode
            self.port_a.latency_ms = 999.0
            self.port_a.packet_loss_pct = 85.0
            self.port_b.latency_ms = 850.0
            self.port_b.packet_loss_pct = 75.0
            self.evaluate_state_machine()
        elif scenario == "RESTORE_HEALTHY":
            self.restore_healthy()

    def restore_healthy(self):
        self.is_degradation_injected = False
        self.port_a = NetworkTelemetry(
            port_name="Port A (Primary Eth0)",
            latency_ms=19.2 + random.uniform(-2, 3),
            jitter_ms=2.5 + random.uniform(-0.5, 0.5),
            packet_loss_pct=0.0,
            dns_time_ms=14.0
        )
        self.port_b = NetworkTelemetry(
            port_name="Port B (Backup Sat/LTE)",
            latency_ms=46.0 + random.uniform(-3, 3),
            jitter_ms=5.0,
            packet_loss_pct=0.1,
            dns_time_ms=30.0
        )
        self.degradation_score = 0.05
        self.active_state = "PORT_A_ACTIVE"
        self.last_switch = f"Restored to Port A ({time.strftime('%H:%M:%S')})"

    def evaluate_state_machine(self):
        """
        Evaluates health score:
        - If degradation score > 0.60 -> emit STATE_WARNING
        - If degradation score > 0.85 -> execute immediate failover to Port B
        - If both ports critical -> trigger MESH_ACTIVE
        """
        # Port A loss & latency penalty
        loss_score_a = min(self.port_a.packet_loss_pct / 30.0, 1.0)
        lat_score_a = min(self.port_a.latency_ms / 300.0, 1.0)
        score_a = round(0.6 * loss_score_a + 0.4 * lat_score_a, 2)
        
        # Port B penalty
        loss_score_b = min(self.port_b.packet_loss_pct / 30.0, 1.0)
        lat_score_b = min(self.port_b.latency_ms / 300.0, 1.0)
        score_b = round(0.6 * loss_score_b + 0.4 * lat_score_b, 2)

        self.degradation_score = score_a

        if score_a > 0.85 and score_b > 0.65:
            if self.active_state != "MESH_ACTIVE":
                self.active_state = "MESH_ACTIVE"
                self.last_switch = f"Dual-port collapse -> MESH ACTIVATED ({time.strftime('%H:%M:%S')})"
        elif score_a > 0.85:
            if self.active_state != "PORT_B_ACTIVE":
                self.active_state = "PORT_B_ACTIVE"
                self.last_switch = f"Port A failed -> Failover to Port B ({time.strftime('%H:%M:%S')})"
        elif score_a > 0.60:
            self.active_state = "STATE_WARNING"
        else:
            self.active_state = "PORT_A_ACTIVE"

    def get_status(self) -> NetworkStatus:
        # Micro fluctuations for realistic live telemetry
        if not self.is_degradation_injected:
            self.port_a.latency_ms = round(18.0 + random.uniform(-1.5, 2.0), 1)
            self.port_a.jitter_ms = round(2.0 + random.uniform(-0.4, 0.6), 1)
        return NetworkStatus(
            active_state=self.active_state,
            port_a=self.port_a,
            port_b=self.port_b,
            degradation_score=self.degradation_score,
            last_switch=self.last_switch,
            mesh_nodes_online=4
        )

network_engine = NetworkFailoverEngine()
