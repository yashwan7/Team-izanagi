"""
Dual-Port Network Telemetry and TinyML Failover Engine for Kshitij
Core package exports.
"""

from .models import (
    PortMetric,
    DualTelemetrySample,
    HealthEvaluation,
    SystemState,
    PortId,
    NetworkDegradationProfile,
)
from .telemetry import TelemetryGenerator
from .state_machine import FailoverStateMachine
from .engine import FailoverEngine

__all__ = [
    "PortMetric",
    "DualTelemetrySample",
    "HealthEvaluation",
    "SystemState",
    "PortId",
    "NetworkDegradationProfile",
    "TelemetryGenerator",
    "FailoverStateMachine",
    "FailoverEngine",
]
