"""
State Machine and TinyML Evaluator for Link Health and Failover.
Maintains an 8-dimensional sliding window over the last 5 seconds (50 samples).
Evaluates link health every 500ms:
- Degradation score > 0.60 -> STATE_WARNING (Yellow)
- Degradation score > 0.85 OR Critical > 0.50 -> Immediate Path Failover to Port B
- Both ports critical -> Trigger software callback to activate Mesh Mode (MESH_ACTIVE)
"""

import collections
import statistics
import threading
import time
from typing import Callable, Deque, Dict, List, Optional, Tuple, Any

from .models import (
    DualTelemetrySample,
    HealthEvaluation,
    PortId,
    SystemState,
)


class FailoverStateMachine:
    """
    Sliding window telemetry state machine.
    Evaluates 8D feature vector over the last 50 samples (5.0s window at 100ms sampling rate).
    """

    def __init__(
        self,
        window_size: int = 50,
        eval_interval_sec: float = 0.50,  # 500ms evaluation interval
        recovery_hold_count: int = 3,       # Stabilize before auto-failback to primary
    ):
        self.window_size = window_size
        self.eval_interval_sec = eval_interval_sec
        self.recovery_hold_count = recovery_hold_count

        # 50-sample sliding window
        self._window: Deque[DualTelemetrySample] = collections.deque(maxlen=window_size)
        self._lock = threading.Lock()

        # State tracking
        self.current_state = SystemState.STATE_NORMAL
        self.active_path = PortId.PORT_A
        self._healthy_a_streak = 0
        self._latest_evaluation: Optional[HealthEvaluation] = None
        self._evaluation_history: Deque[HealthEvaluation] = collections.deque(maxlen=100)

        # Software Callbacks
        self._on_warning_callbacks: List[Callable[[Dict[str, Any]], None]] = []
        self._on_failover_callbacks: List[Callable[[Dict[str, Any]], None]] = []
        self._on_mesh_activate_callbacks: List[Callable[[Dict[str, Any]], None]] = []
        self._on_state_change_callbacks: List[Callable[[SystemState, SystemState, HealthEvaluation], None]] = []

        # Background evaluation thread
        self._running = False
        self._thread: Optional[threading.Thread] = None

        # Optional TinyML TFLite Classifier
        self._tinyml_classifier = None

    def attach_tinyml_classifier(self, classifier: Optional[Any] = None) -> Any:
        """Attach an INT8 TinyML TFLite anomaly classifier for live streaming inference."""
        with self._lock:
            if classifier is None:
                try:
                    from ml.network_anomaly.inference import AnomalyInferenceWrapper
                    self._tinyml_classifier = AnomalyInferenceWrapper()
                except Exception:
                    self._tinyml_classifier = None
            else:
                self._tinyml_classifier = classifier
            return self._tinyml_classifier

    def register_mesh_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register software callback triggered when Mesh Mode is activated."""
        with self._lock:
            if callback not in self._on_mesh_activate_callbacks:
                self._on_mesh_activate_callbacks.append(callback)

    def register_warning_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register callback triggered when STATE_WARNING is emitted."""
        with self._lock:
            if callback not in self._on_warning_callbacks:
                self._on_warning_callbacks.append(callback)

    def register_failover_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register callback triggered when path failover executes."""
        with self._lock:
            if callback not in self._on_failover_callbacks:
                self._on_failover_callbacks.append(callback)

    def register_state_change_callback(self, callback: Callable[[SystemState, SystemState, HealthEvaluation], None]) -> None:
        """Register callback for any state transition."""
        with self._lock:
            if callback not in self._on_state_change_callbacks:
                self._on_state_change_callbacks.append(callback)

    def ingest_sample(self, sample: DualTelemetrySample) -> None:
        """Add a 100ms sample to the 50-sample sliding window."""
        with self._lock:
            self._window.append(sample)

    def get_sliding_window_8d_vector(self) -> List[float]:
        """
        Compute the 8-dimensional feature vector over the current sliding window.
        Returns [A_lat, A_jit, A_loss, A_dns, B_lat, B_jit, B_loss, B_dns] mean values.
        """
        with self._lock:
            if not self._window:
                return [0.0] * 8

            samples = list(self._window)

        # Compute column-wise means
        means = [0.0] * 8
        count = len(samples)
        for s in samples:
            vec = s.to_8d_vector()
            for i in range(8):
                means[i] += vec[i]

        return [round(m / count, 3) for m in means]

    def get_sliding_window_matrix(self) -> List[List[float]]:
        """Return the recent (N x 8) feature matrix (up to 50 rows)."""
        with self._lock:
            return [s.to_8d_vector() for s in self._window]

    def calculate_port_scores(self, metrics_lat: List[float], metrics_jit: List[float],
                             metrics_loss: List[float], metrics_dns: List[float]) -> Tuple[float, float]:
        """
        Compute TinyML heuristic degradation score and critical score for a port.
        Returns: (degradation_score, critical_score) in [0.0, 1.0].
        """
        if not metrics_lat:
            return 0.0, 0.0

        mean_lat = statistics.mean(metrics_lat)
        mean_jit = statistics.mean(metrics_jit)
        mean_loss = statistics.mean(metrics_loss)
        mean_dns = statistics.mean(metrics_dns)

        # Latency normalized degradation factor (baseline 20ms, severe 220ms)
        norm_lat = min(1.0, max(0.0, (mean_lat - 22.0) / (220.0 - 22.0)))
        # Jitter normalized factor (baseline 2.5ms, severe 30ms)
        norm_jit = min(1.0, max(0.0, (mean_jit - 3.0) / (30.0 - 3.0)))
        # Packet loss normalized factor (baseline 0%, severe 20%)
        norm_loss = min(1.0, max(0.0, mean_loss / 20.0))
        # DNS lookup delay factor (baseline 10ms, severe 100ms)
        norm_dns = min(1.0, max(0.0, (mean_dns - 12.0) / (100.0 - 12.0)))

        # Composite degradation score (loss & latency weighted highest)
        deg_score = (0.45 * norm_loss) + (0.35 * norm_lat) + (0.10 * norm_jit) + (0.10 * norm_dns)

        # Ratio of critical anomalies in the sliding window (loss >= 25% or latency >= 260ms)
        bad_loss_samples = sum(1 for loss in metrics_loss if loss >= 25.0)
        bad_lat_samples = sum(1 for lat in metrics_lat if lat >= 260.0)
        window_len = len(metrics_lat)
        bad_ratio = max(bad_loss_samples / window_len, bad_lat_samples / window_len)

        # Critical failure score (spikes above 0.50 when packet loss > 22.5% or latency > 225ms)
        crit_score = max(
            min(1.0, mean_loss / 45.0),
            min(1.0, max(0.0, (mean_lat - 50.0) / 350.0)),
            bad_ratio
        )

        return round(min(1.0, max(0.0, deg_score)), 3), round(min(1.0, max(0.0, crit_score)), 3)

    def evaluate_health(self) -> HealthEvaluation:
        """
        Evaluate link health based on the 8D sliding window:
        - If degradation score > 0.60 -> STATE_WARNING (Yellow)
        - If degradation score > 0.85 OR critical > 0.50 -> Failover to Port B
        - If both ports are critical -> Activate Mesh Mode (MESH_ACTIVE)
        """
        with self._lock:
            samples = list(self._window)
            window_len = len(samples)
            current_state_before = self.current_state

        if window_len == 0:
            evaluation = HealthEvaluation(
                timestamp=time.time(),
                state=self.current_state,
                active_path=self.active_path,
                port_a_degradation_score=0.0,
                port_a_critical_score=0.0,
                port_b_degradation_score=0.0,
                port_b_critical_score=0.0,
                window_samples_count=0,
                feature_vector_8d_mean=[0.0] * 8,
                message="Awaiting telemetry samples",
            )
            return evaluation

        # Unpack 8 dimensions
        lat_a = [s.port_a.latency_ms for s in samples]
        jit_a = [s.port_a.jitter_ms for s in samples]
        loss_a = [s.port_a.packet_loss_pct for s in samples]
        dns_a = [s.port_a.dns_time_ms for s in samples]

        lat_b = [s.port_b.latency_ms for s in samples]
        jit_b = [s.port_b.jitter_ms for s in samples]
        loss_b = [s.port_b.packet_loss_pct for s in samples]
        dns_b = [s.port_b.dns_time_ms for s in samples]

        deg_a, crit_a = self.calculate_port_scores(lat_a, jit_a, loss_a, dns_a)
        deg_b, crit_b = self.calculate_port_scores(lat_b, jit_b, loss_b, dns_b)

        mean_8d = [
            round(statistics.mean(lat_a), 2),
            round(statistics.mean(jit_a), 2),
            round(statistics.mean(loss_a), 2),
            round(statistics.mean(dns_a), 2),
            round(statistics.mean(lat_b), 2),
            round(statistics.mean(jit_b), 2),
            round(statistics.mean(loss_b), 2),
            round(statistics.mean(dns_b), 2),
        ]

        new_state = self.current_state
        new_path = self.active_path
        mesh_activated = False
        message = ""

        # Failover / Warning Decision Logic
        both_critical = (crit_a > 0.50 and crit_b > 0.50) or (deg_a > 0.85 and deg_b > 0.85)

        if both_critical:
            # Rule 3: If both ports are critical -> trigger software callback to activate Mesh Mode (MESH_ACTIVE)
            new_state = SystemState.STATE_MESH_ACTIVE
            new_path = PortId.MESH
            mesh_activated = True
            message = f"CRITICAL: Both Port A (crit={crit_a:.2f}) and Port B (crit={crit_b:.2f}) failed. Activating Mesh Mode."

        elif (deg_a > 0.85 or crit_a > 0.50) and (crit_b <= 0.50 and deg_b <= 0.85):
            # Rule 2: If degradation score > 0.85 OR critical > 0.50 -> execute immediate path failover to Port B
            new_state = SystemState.STATE_FAILOVER_B
            new_path = PortId.PORT_B
            message = f"FAILOVER: Port A failed (deg={deg_a:.2f}, crit={crit_a:.2f}). Rerouted traffic to Port B."

        elif self.active_path == PortId.PORT_B and (deg_a <= 0.60 and crit_a <= 0.50):
            # Auto-recovery back to Primary Port A if Port A is consistently healthy
            self._healthy_a_streak += 1
            if self._healthy_a_streak >= self.recovery_hold_count:
                new_state = SystemState.STATE_NORMAL
                new_path = PortId.PORT_A
                message = f"RECOVERY: Port A stabilized (deg={deg_a:.2f}). Restored primary path to Port A."
            else:
                new_state = SystemState.STATE_FAILOVER_B
                new_path = PortId.PORT_B
                message = f"MONITORING: Port A recovering ({self._healthy_a_streak}/{self.recovery_hold_count}). Staying on Port B."

        elif self.active_path == PortId.MESH and (crit_a <= 0.40 or crit_b <= 0.40):
            # Recovery from Mesh Mode
            if crit_a <= 0.40 and deg_a <= 0.60:
                new_state = SystemState.STATE_NORMAL
                new_path = PortId.PORT_A
                message = f"MESH RESTORATION: Primary Port A recovered (crit={crit_a:.2f}). Returning to Port A."
            else:
                new_state = SystemState.STATE_FAILOVER_B
                new_path = PortId.PORT_B
                message = f"MESH RESTORATION: Backup Port B recovered (crit={crit_b:.2f}). Switching to Port B."

        elif deg_a > 0.60 and crit_a <= 0.50:
            # Rule 1: If degradation score > 0.60 -> emit STATE_WARNING (Yellow)
            self._healthy_a_streak = 0
            if self.active_path == PortId.PORT_A:
                new_state = SystemState.STATE_WARNING
                new_path = PortId.PORT_A
                message = f"WARNING: Port A link quality degraded (score={deg_a:.2f} > 0.60)."
            else:
                # Already failed over to B
                new_state = SystemState.STATE_FAILOVER_B
                new_path = PortId.PORT_B
                message = f"PORT B ACTIVE: Port A still in warning state (score={deg_a:.2f})."

        else:
            # Normal Healthy State
            self._healthy_a_streak += 1
            new_state = SystemState.STATE_NORMAL
            new_path = PortId.PORT_A
            message = f"HEALTHY: Dual links nominal. Port A active (deg={deg_a:.2f}, crit={crit_a:.2f})."

        # Optional TinyML Inference evaluation
        tinyml_preds = None
        if self._tinyml_classifier is not None and window_len > 0:
            try:
                mean_a = [mean_8d[0], mean_8d[1], mean_8d[2], mean_8d[3]]
                mean_b = [mean_8d[4], mean_8d[5], mean_8d[6], mean_8d[7]]
                tinyml_preds = self._tinyml_classifier.evaluate_state_machine_endpoint(mean_a, mean_b)
            except Exception:
                pass

        evaluation = HealthEvaluation(
            timestamp=time.time(),
            state=new_state,
            active_path=new_path,
            port_a_degradation_score=deg_a,
            port_a_critical_score=crit_a,
            port_b_degradation_score=deg_b,
            port_b_critical_score=crit_b,
            window_samples_count=window_len,
            feature_vector_8d_mean=mean_8d,
            message=message,
            mesh_activated=mesh_activated,
            tinyml_predictions=tinyml_preds,
        )

        with self._lock:
            self.current_state = new_state
            self.active_path = new_path
            self._latest_evaluation = evaluation
            self._evaluation_history.append(evaluation)

        # Trigger Callbacks
        self._dispatch_callbacks(current_state_before, new_state, evaluation)

        return evaluation

    def _dispatch_callbacks(
        self,
        old_state: SystemState,
        new_state: SystemState,
        eval_result: HealthEvaluation,
    ) -> None:
        """Dispatch software callbacks based on state rules and transitions."""
        payload = {
            "timestamp": eval_result.timestamp,
            "old_state": old_state.value,
            "new_state": new_state.value,
            "active_path": eval_result.active_path.value,
            "port_a_degradation": eval_result.port_a_degradation_score,
            "port_a_critical": eval_result.port_a_critical_score,
            "port_b_degradation": eval_result.port_b_degradation_score,
            "port_b_critical": eval_result.port_b_critical_score,
            "feature_vector_8d": eval_result.feature_vector_8d_mean,
            "message": eval_result.message,
        }

        # 1. State change callback
        if old_state != new_state:
            for cb in list(self._on_state_change_callbacks):
                try:
                    cb(old_state, new_state, eval_result)
                except Exception:
                    pass

        # 2. Warning callback if warning score > 0.60
        if eval_result.port_a_degradation_score > 0.60 or new_state == SystemState.STATE_WARNING:
            for cb in list(self._on_warning_callbacks):
                try:
                    cb(payload)
                except Exception:
                    pass

        # 3. Failover callback if transitioning to Port B
        if new_state == SystemState.STATE_FAILOVER_B and old_state != SystemState.STATE_FAILOVER_B:
            for cb in list(self._on_failover_callbacks):
                try:
                    cb(payload)
                except Exception:
                    pass

        # 4. Mesh Mode Callback if both ports are critical
        if eval_result.mesh_activated or new_state == SystemState.STATE_MESH_ACTIVE:
            for cb in list(self._on_mesh_activate_callbacks):
                try:
                    cb(payload)
                except Exception:
                    pass

    def get_latest_evaluation(self) -> Optional[HealthEvaluation]:
        """Return the most recent health evaluation."""
        with self._lock:
            return self._latest_evaluation

    def get_history(self) -> List[HealthEvaluation]:
        """Return evaluation history."""
        with self._lock:
            return list(self._evaluation_history)

    def start(self) -> None:
        """Start the background state evaluation loop (runs every 500ms)."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._eval_loop, daemon=True, name="StateMachineEvalThread")
        self._thread.start()

    def stop(self) -> None:
        """Stop the background evaluation loop."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
            self._thread = None

    def _eval_loop(self) -> None:
        """Runs evaluation every 500ms."""
        next_time = time.time()
        while self._running:
            self.evaluate_health()
            next_time += self.eval_interval_sec
            sleep_duration = next_time - time.time()
            if sleep_duration > 0:
                time.sleep(sleep_duration)
            else:
                next_time = time.time()
                time.sleep(0.05)
