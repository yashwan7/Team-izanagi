"""
Interactive CLI Dashboard for Kshitij Dual-Port Telemetry and Failover Engine.
Provides colorful live telemetry monitoring and interactive degradation triggers.
"""

import os
import sys
import time
import threading
from typing import Optional

try:
    import colorama
    from colorama import Fore, Back, Style
    colorama.init(autoreset=True)
except ImportError:
    class DummyColor:
        def __getattr__(self, name):
            return ""
    Fore = Style = Back = DummyColor()

from .engine import FailoverEngine
from .models import PortId, SystemState


def format_state_badge(state: SystemState, active_path: PortId) -> str:
    """Return color-coded state badge."""
    if state == SystemState.STATE_NORMAL:
        return f"{Back.GREEN}{Fore.BLACK} [ STATE_NORMAL ] {Style.RESET_ALL} (Path: {Fore.GREEN}{active_path.value}{Style.RESET_ALL})"
    elif state == SystemState.STATE_WARNING:
        return f"{Back.YELLOW}{Fore.BLACK} [ STATE_WARNING ] {Style.RESET_ALL} (Path: {Fore.YELLOW}{active_path.value}{Style.RESET_ALL})"
    elif state == SystemState.STATE_FAILOVER_B:
        return f"{Back.MAGENTA}{Fore.WHITE} [ FAILOVER_PORT_B ] {Style.RESET_ALL} (Path: {Fore.CYAN}{active_path.value}{Style.RESET_ALL})"
    elif state == SystemState.STATE_MESH_ACTIVE:
        return f"{Back.RED}{Fore.WHITE} [ MESH_ACTIVE ] {Style.RESET_ALL} (Path: {Fore.RED}{active_path.value}{Style.RESET_ALL})"
    return f"[{state.value}] ({active_path.value})"


def print_dashboard(engine: FailoverEngine):
    """Render terminal dashboard view."""
    status = engine.get_system_status()
    sample = engine.telemetry.get_latest_sample()
    evaluation = status.get("evaluation") or {}
    vector_8d = status.get("feature_vector_8d") or [0.0] * 8

    state = SystemState(status["current_state"])
    active_path = PortId(status["active_path"])

    port_a = sample.port_a if sample else None
    port_b = sample.port_b if sample else None

    # Clear screen on windows/posix or print dividing banner
    print("\033[H\033[J", end="")  # ANSI clear screen

    print(f"{Fore.CYAN}{'='*78}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}===  KSHITIJ // DUAL-PORT TELEMETRY & TinyML FAILOVER ENGINE  ==={Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'='*78}{Style.RESET_ALL}")
    print(f"Status: {format_state_badge(state, active_path)}")
    if evaluation.get("message"):
        print(f"Alert : {Fore.WHITE}{evaluation.get('message')}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'-'*78}{Style.RESET_ALL}")

    # Metrics Table
    print(f"{'METRIC':<18} | {'PORT A (Primary IP)':<26} | {'PORT B (Backup Path)':<26}")
    print(f"{'-'*18}-+-{'-'*26}-+-{'-'*26}")

    a_lat = f"{port_a.latency_ms:.2f} ms" if port_a else "--"
    b_lat = f"{port_b.latency_ms:.2f} ms" if port_b else "--"
    print(f"{'Latency':<18} | {a_lat:<26} | {b_lat:<26}")

    a_jit = f"{port_a.jitter_ms:.2f} ms" if port_a else "--"
    b_jit = f"{port_b.jitter_ms:.2f} ms" if port_b else "--"
    print(f"{'Jitter':<18} | {a_jit:<26} | {b_jit:<26}")

    a_loss = f"{port_a.packet_loss_pct:.2f} %" if port_a else "--"
    b_loss = f"{port_b.packet_loss_pct:.2f} %" if port_b else "--"
    print(f"{'Packet Loss':<18} | {a_loss:<26} | {b_loss:<26}")

    a_dns = f"{port_a.dns_time_ms:.2f} ms" if port_a else "--"
    b_dns = f"{port_b.dns_time_ms:.2f} ms" if port_b else "--"
    print(f"{'DNS Lookup':<18} | {a_dns:<26} | {b_dns:<26}")

    a_deg = evaluation.get("port_a_degradation_score", 0.0)
    b_deg = evaluation.get("port_b_degradation_score", 0.0)
    a_crit = evaluation.get("port_a_critical_score", 0.0)
    b_crit = evaluation.get("port_b_critical_score", 0.0)

    print(f"{'-'*18}-+-{'-'*26}-+-{'-'*26}")
    print(f"{'Degradation Score':<18} | {a_deg:<26.2f} | {b_deg:<26.2f}")
    print(f"{'Critical Score':<18} | {a_crit:<26.2f} | {b_crit:<26.2f}")
    print(f"{Fore.CYAN}{'-'*78}{Style.RESET_ALL}")

    print(f"{Fore.YELLOW}8-Dimensional Sliding Window Vector (50 Samples / 5.0s Mean):{Style.RESET_ALL}")
    print(f"[A_lat: {vector_8d[0]:.1f}, A_jit: {vector_8d[1]:.1f}, A_loss: {vector_8d[2]:.1f}%, A_dns: {vector_8d[3]:.1f}ms | B_lat: {vector_8d[4]:.1f}, B_jit: {vector_8d[5]:.1f}, B_loss: {vector_8d[6]:.1f}%, B_dns: {vector_8d[7]:.1f}ms]")

    active_deg = status.get("active_degradations") or {}
    if active_deg:
        print(f"{Fore.RED}Active Fault Injections: {active_deg}{Style.RESET_ALL}")

    print(f"{Fore.CYAN}{'='*78}{Style.RESET_ALL}")
    print(f"Commands: [1] Degrade A (>0.60) | [2] Failover Port B (>0.85/Crit) | [3] Mesh Mode | [4] Restore | [q] Exit")


def run_cli_loop(engine: Optional[FailoverEngine] = None):
    """Run interactive terminal CLI."""
    if engine is None:
        engine = FailoverEngine()
        engine.start()

    stop_event = threading.Event()

    def display_thread_func():
        while not stop_event.is_set():
            try:
                print_dashboard(engine)
            except Exception:
                pass
            time.sleep(0.50)

    t = threading.Thread(target=display_thread_func, daemon=True)
    t.start()

    print("\nPress Enter to enter command mode, or type commands directly:")

    while True:
        try:
            cmd = input().strip().lower()
            if cmd == "1":
                engine.inject_network_degradation(PortId.PORT_A, duration_sec=15.0, latency_spike_ms=160.0, packet_loss_spike_pct=14.0)
            elif cmd == "2":
                engine.inject_network_degradation(PortId.PORT_A, duration_sec=20.0, latency_spike_ms=320.0, packet_loss_spike_pct=42.0)
            elif cmd == "3":
                engine.inject_network_degradation(PortId.BOTH, duration_sec=25.0, latency_spike_ms=380.0, packet_loss_spike_pct=55.0)
            elif cmd == "4":
                engine.clear_degradation()
            elif cmd in ("q", "quit", "exit"):
                stop_event.set()
                engine.stop()
                print("\nExiting CLI...")
                break
        except (KeyboardInterrupt, EOFError):
            stop_event.set()
            engine.stop()
            break


if __name__ == "__main__":
    run_cli_loop()
