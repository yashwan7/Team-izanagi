"""
Unified Failover Engine for Kshitij.
Coordinates Telemetry Generation (100ms) with State Machine Link Health Evaluations (500ms).
"""

import logging
import threading
import time
from typing import Callable, Dict, Any, Optional, List

from .models import (
    DualTelemetrySample,
    HealthEvaluation,
    PortId,
    SystemState,
    NetworkDegradationProfile,
)
from .telemetry import TelemetryGenerator
from .state_machine import FailoverStateMachine

logger = logging.getLogger("FailoverEngine")


class FailoverEngine:
    """
    Main controller for the Dual-Port Telemetry & TinyML Failover Engine.
    """

    def __init__(
        self,
        telemetry_interval_sec: float = 0.10,  # 100ms
        eval_interval_sec: float = 0.50,       # 500ms
        window_size: int = 50,                 # 50 samples (5.0s)
    ):
        self.state_machine = FailoverStateMachine(
            window_size=window_size,
            eval_interval_sec=eval_interval_sec,
        )
        self.telemetry = TelemetryGenerator(
            interval_sec=telemetry_interval_sec,
            on_sample_callback=self._handle_telemetry_sample,
        )

        self._lock = threading.Lock()
        self._running = False
        self._events_log: List[Dict[str, Any]] = []

        # Wire internal transition logger
        self.state_machine.register_state_change_callback(self._on_internal_state_transition)

        # Wire default mesh callback logger
        self.state_machine.register_mesh_callback(self._default_mesh_callback)

    def _handle_telemetry_sample(self, sample: DualTelemetrySample) -> None:
        """Route incoming 100ms telemetry samples directly into state machine sliding window."""
        self.state_machine.ingest_sample(sample)

    def _on_internal_state_transition(
        self,
        old_state: SystemState,
        new_state: SystemState,
        evaluation: HealthEvaluation,
    ) -> None:
        """Log state transitions."""
        event = {
            "timestamp": time.time(),
            "iso_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "old_state": old_state.value,
            "new_state": new_state.value,
            "active_path": evaluation.active_path.value,
            "message": evaluation.message,
            "scores": {
                "port_a_deg": evaluation.port_a_degradation_score,
                "port_a_crit": evaluation.port_a_critical_score,
                "port_b_deg": evaluation.port_b_degradation_score,
                "port_b_crit": evaluation.port_b_critical_score,
            },
        }
        with self._lock:
            self._events_log.append(event)
            if len(self._events_log) > 200:
                self._events_log.pop(0)

        logger.info(f"Transition: [{old_state.value}] -> [{new_state.value}] via {evaluation.active_path.value} | {evaluation.message}")

    def _default_mesh_callback(self, payload: Dict[str, Any]) -> None:
        """Default software callback executed when Mesh Mode is activated."""
        logger.warning(f"*** MESH ACTIVATION CALLBACK INVOKED ***: {payload['message']}")

    # Delegate Callback Registrations
    def on_mesh_activate(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register custom software callback for Mesh Mode activation."""
        self.state_machine.register_mesh_callback(callback)

    def on_failover(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register callback for failover event."""
        self.state_machine.register_failover_callback(callback)

    def on_warning(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register callback for warning state."""
        self.state_machine.register_warning_callback(callback)

    def on_state_change(self, callback: Callable[[SystemState, SystemState, HealthEvaluation], None]) -> None:
        """Register callback for any state change."""
        self.state_machine.register_state_change_callback(callback)

    # Lifecycle Control
    def start(self) -> None:
        """Start both the telemetry generator and the state machine evaluation loops."""
        if self._running:
            return
        self._running = True
        self.telemetry.start()
        self.state_machine.start()
        logger.info("FailoverEngine started successfully.")

    def stop(self) -> None:
        """Stop all background worker threads."""
        self._running = False
        self.telemetry.stop()
        self.state_machine.stop()
        logger.info("FailoverEngine stopped.")

    # High-level Control Actions
    def inject_network_degradation(
        self,
        port: str | PortId = PortId.PORT_A,
        duration_sec: float = 10.0,
        latency_spike_ms: float = 280.0,
        packet_loss_spike_pct: float = 35.0,
        jitter_spike_ms: float = 25.0,
        dns_spike_ms: float = 120.0,
    ) -> NetworkDegradationProfile:
        """Trigger simulated network degradation on specified port(s)."""
        return self.telemetry.inject_network_degradation(
            port=port,
            duration_sec=duration_sec,
            latency_spike_ms=latency_spike_ms,
            packet_loss_spike_pct=packet_loss_spike_pct,
            jitter_spike_ms=jitter_spike_ms,
            dns_spike_ms=dns_spike_ms,
        )

    def clear_degradation(self, port: Optional[str | PortId] = None) -> None:
        """Clear active degradation and restore nominal baseline network link."""
        self.telemetry.clear_degradation(port)

    def get_system_status(self) -> Dict[str, Any]:
        """Aggregate snapshot of current engine telemetry, state, and sliding window features."""
        latest_eval = self.state_machine.get_latest_evaluation()
        latest_sample = self.telemetry.get_latest_sample()
        active_deg = self.telemetry.get_active_degradations()

        return {
            "current_state": self.state_machine.current_state.value,
            "active_path": self.state_machine.active_path.value,
            "latest_sample": latest_sample.model_dump() if latest_sample else None,
            "evaluation": latest_eval.model_dump() if latest_eval else None,
            "feature_vector_8d": self.state_machine.get_sliding_window_8d_vector(),
            "active_degradations": active_deg,
            "running": self._running,
        }

    def get_event_history(self) -> List[Dict[str, Any]]:
        """Return history of state transitions."""
        with self._lock:
            return list(self._events_log)
