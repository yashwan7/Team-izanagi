"""
Synthetic Telemetry Generator for Dual-Port Network Simulation.
Generates metrics every 100ms for Port A (Primary IP) and Port B (Backup Path).
Supports network fault injection to simulate link degradation and failure.
"""

import math
import random
import threading
import time
from typing import Callable, List, Optional, Dict, Any
from .models import PortMetric, DualTelemetrySample, PortId, NetworkDegradationProfile


class TelemetryGenerator:
    """
    High-frequency synthetic network telemetry generator.
    Simulates physical link properties, jitter noise, and fault injection.
    """

    def __init__(
        self,
        interval_sec: float = 0.10,  # 100ms
        on_sample_callback: Optional[Callable[[DualTelemetrySample], None]] = None,
    ):
        self.interval_sec = interval_sec
        self.on_sample_callback = on_sample_callback

        # Baseline parameters: Port A (Primary)
        self.base_latency_a = 22.0
        self.base_jitter_a = 2.5
        self.base_loss_a = 0.1
        self.base_dns_a = 10.0

        # Baseline parameters: Port B (Backup Path - slightly higher latency/jitter)
        self.base_latency_b = 40.0
        self.base_jitter_b = 5.0
        self.base_loss_b = 0.3
        self.base_dns_b = 18.0

        # Internal state
        self._lock = threading.Lock()
        self._active_degradations: Dict[PortId, NetworkDegradationProfile] = {}
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._latest_sample: Optional[DualTelemetrySample] = None
        self._listeners: List[Callable[[DualTelemetrySample], None]] = []

        if on_sample_callback:
            self._listeners.append(on_sample_callback)

        # Simulation step counter
        self._step = 0

    def add_listener(self, listener: Callable[[DualTelemetrySample], None]) -> None:
        """Register a callback to receive every 100ms telemetry sample."""
        with self._lock:
            if listener not in self._listeners:
                self._listeners.append(listener)

    def remove_listener(self, listener: Callable[[DualTelemetrySample], None]) -> None:
        """Unregister a telemetry sample callback."""
        with self._lock:
            if listener in self._listeners:
                self._listeners.remove(listener)

    def inject_network_degradation(
        self,
        port: str | PortId = PortId.PORT_A,
        duration_sec: float = 10.0,
        latency_spike_ms: float = 280.0,
        packet_loss_spike_pct: float = 35.0,
        jitter_spike_ms: float = 25.0,
        dns_spike_ms: float = 120.0,
    ) -> NetworkDegradationProfile:
        """
        Simulate link degradation or failure by spiking latency and packet loss.

        :param port: 'PORT_A', 'PORT_B', or 'BOTH'
        :param duration_sec: Degradation duration in seconds (0 for indefinite)
        :param latency_spike_ms: Latency spike added to baseline (ms)
        :param packet_loss_spike_pct: Packet loss percentage added to baseline (%)
        :param jitter_spike_ms: Jitter spike (ms)
        :param dns_spike_ms: DNS lookup delay spike (ms)
        """
        port_enum = PortId(port) if isinstance(port, str) else port

        profile = NetworkDegradationProfile(
            port=port_enum,
            latency_spike_ms=latency_spike_ms,
            packet_loss_spike_pct=packet_loss_spike_pct,
            jitter_spike_ms=jitter_spike_ms,
            dns_spike_ms=dns_spike_ms,
            duration_sec=duration_sec,
            start_time=time.time(),
            active=True,
        )

        with self._lock:
            if port_enum == PortId.BOTH:
                self._active_degradations[PortId.PORT_A] = profile
                self._active_degradations[PortId.PORT_B] = profile
            else:
                self._active_degradations[port_enum] = profile

        return profile

    def clear_degradation(self, port: Optional[str | PortId] = None) -> None:
        """Clear active degradation profiles."""
        with self._lock:
            if port is None or port == PortId.BOTH or port == "BOTH":
                self._active_degradations.clear()
            else:
                port_enum = PortId(port) if isinstance(port, str) else port
                self._active_degradations.pop(port_enum, None)

    def get_active_degradations(self) -> Dict[str, Any]:
        """Return currently active degradation profiles."""
        with self._lock:
            now = time.time()
            active = {}
            for pid, prof in list(self._active_degradations.items()):
                if prof.duration_sec > 0 and (now - prof.start_time) > prof.duration_sec:
                    continue
                active[pid.value] = {
                    "latency_spike_ms": prof.latency_spike_ms,
                    "packet_loss_spike_pct": prof.packet_loss_spike_pct,
                    "remaining_sec": max(0.0, prof.duration_sec - (now - prof.start_time)) if prof.duration_sec > 0 else "indefinite",
                }
            return active

    def _generate_port_metric(self, port_id: PortId) -> PortMetric:
        """Generate synthetic telemetry metrics for a given port."""
        now = time.time()
        self._step += 1

        # Check for active degradation profile
        deg = self._active_degradations.get(port_id)
        if deg and deg.duration_sec > 0 and (now - deg.start_time) > deg.duration_sec:
            # Degradation expired
            self._active_degradations.pop(port_id, None)
            deg = None

        is_degraded = deg is not None and deg.active

        # Harmonic wave + gaussian noise for realistic fluctuation
        wave = math.sin(self._step * 0.1) * 2.0

        if port_id == PortId.PORT_A:
            base_lat = self.base_latency_a + wave + random.gauss(0, 1.2)
            base_jit = self.base_jitter_a + random.gauss(0, 0.4)
            base_loss = max(0.0, self.base_loss_a + random.gauss(0, 0.05))
            base_dns = self.base_dns_a + random.gauss(0, 1.0)
        else:
            base_lat = self.base_latency_b + wave * 1.5 + random.gauss(0, 2.0)
            base_jit = self.base_jitter_b + random.gauss(0, 0.6)
            base_loss = max(0.0, self.base_loss_b + random.gauss(0, 0.1))
            base_dns = self.base_dns_b + random.gauss(0, 1.5)

        if is_degraded:
            # Severe spikes with erratic packet drops
            loss_spike = deg.packet_loss_spike_pct + random.uniform(-3.0, 5.0)
            latency_spike = deg.latency_spike_ms + random.uniform(-20.0, 40.0)
            jitter_spike = deg.jitter_spike_ms + random.uniform(5.0, 15.0)
            dns_spike = deg.dns_spike_ms + random.uniform(10.0, 50.0)

            lat = max(1.0, base_lat + latency_spike)
            jit = max(0.5, base_jit + jitter_spike)
            loss = min(100.0, max(0.0, base_loss + loss_spike))
            dns = max(1.0, base_dns + dns_spike)
        else:
            lat = max(5.0, base_lat)
            jit = max(0.2, base_jit)
            loss = min(100.0, max(0.0, base_loss))
            dns = max(2.0, base_dns)

        return PortMetric(
            latency_ms=round(lat, 2),
            jitter_ms=round(jit, 2),
            packet_loss_pct=round(loss, 2),
            dns_time_ms=round(dns, 2),
        )

    def generate_sample(self) -> DualTelemetrySample:
        """Synchronously generate a single dual-port telemetry sample."""
        with self._lock:
            port_a = self._generate_port_metric(PortId.PORT_A)
            port_b = self._generate_port_metric(PortId.PORT_B)
            sample = DualTelemetrySample(
                timestamp=time.time(),
                port_a=port_a,
                port_b=port_b,
            )
            self._latest_sample = sample

        # Dispatch to listeners outside lock
        for listener in list(self._listeners):
            try:
                listener(sample)
            except Exception as e:
                pass

        return sample

    def get_latest_sample(self) -> Optional[DualTelemetrySample]:
        """Return the most recently generated telemetry sample."""
        return self._latest_sample

    def start(self) -> None:
        """Start the background generation thread (emits every 100ms)."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="TelemetryGeneratorThread")
        self._thread.start()

    def stop(self) -> None:
        """Stop the background generation thread."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
            self._thread = None

    def _run_loop(self) -> None:
        """Loop running every 100ms with drift compensation."""
        next_time = time.time()
        while self._running:
            self.generate_sample()
            next_time += self.interval_sec
            sleep_duration = next_time - time.time()
            if sleep_duration > 0:
                time.sleep(sleep_duration)
            else:
                next_time = time.time()
                time.sleep(0.01)
