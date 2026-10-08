"""
sensors/eog_dsp/cli.py
======================
CLI Stream Generator and Real-Time EOG DSP Pipeline Runner for Kshitij.

Usage:
    python -m sensors.eog_dsp.cli --scenario nurse
    python -m sensors.eog_dsp.cli --scenario pain --realtime
    python -m sensors.eog_dsp.cli --scenario water --json
    python -m sensors.eog_dsp.cli --scenario bathroom
    python -m sensors.eog_dsp.cli --scenario all
"""

import argparse
import json
import sys
import time
from typing import List

from .detector import CommandEvent
from .pipeline import EOGDSPPipeline
from .simulator import EOGSample, EOGSimulator


def render_ascii_meter(val: float, min_val: float = -150.0, max_val: float = 300.0, width: int = 24) -> str:
    """Renders a compact ASCII bar meter for live visual telemetry."""
    clamped = max(min_val, min(max_val, val))
    norm = (clamped - min_val) / (max_val - min_val)
    pos = int(norm * (width - 1))
    bar = ["."] * width
    zero_pos = int((-min_val) / (max_val - min_val) * (width - 1))
    if 0 <= zero_pos < width:
        bar[zero_pos] = "|"
    bar[pos] = "#"
    return "[" + "".join(bar) + "]"


def run_scenario(scenario_name: str, realtime: bool = False, output_json: bool = False) -> List[CommandEvent]:
    sim = EOGSimulator(fs=100.0)
    pipeline = EOGDSPPipeline(fs=100.0)
    
    scenarios = {
        "nurse": ("CALL_NURSE (2 Blinks within 1.5s)", sim.generate_scenario_nurse(3.0)),
        "pain": ("PAIN (3 Blinks within 1.5s)", sim.generate_scenario_pain(3.0)),
        "water": ("WATER (Gaze LEFT + 1 Blink)", sim.generate_scenario_water(3.0)),
        "bathroom": ("BATHROOM (Gaze RIGHT + 1 Blink)", sim.generate_scenario_bathroom(3.0)),
        "artifacts": ("Artifact Rejection Test (Spikes & Slow Drifts)", sim.generate_scenario_invalid_artifacts(3.0)),
    }

    if scenario_name not in scenarios:
        print(f"Error: Unknown scenario '{scenario_name}'. Available: {list(scenarios.keys())}")
        sys.exit(1)

    title, samples = scenarios[scenario_name]
    detected_commands: List[CommandEvent] = []

    if not output_json:
        print("=" * 78)
        print(f"  KSHITIJ EOG BIOPOTENTIAL STREAM GENERATOR & DSP PIPELINE")
        print(f"  Scenario: {title}")
        print(f"  Sampling Rate: 100 Hz | Filter: 4th-Order Butterworth Bandpass (0.1 - 10.0 Hz)")
        print("=" * 78)
        print(f"{'Time':>6} | {'Raw V (uV)':>10} | {'Filt V (uV)':>11} | {'Filt H (uV)':>11} | {'Gaze':>6} | {'Event / Trigger'}")
        print("-" * 78)

    t_start = time.perf_counter()

    for idx, sample in enumerate(samples):
        frame = pipeline.process_sample(
            raw_vertical_uv=sample.raw_vertical_uv,
            raw_horizontal_uv=sample.raw_horizontal_uv,
            timestamp_s=sample.timestamp_s
        )

        event_str = ""
        if frame.command:
            detected_commands.append(frame.command)
            event_str = f"*** TRIGGER: [{frame.command.command}] ({frame.command.details}) ***"

        if output_json:
            payload = {
                "sample_idx": idx,
                "timestamp_s": round(frame.timestamp_s, 3),
                "raw_vertical_uv": round(frame.raw_vertical_uv, 2),
                "raw_horizontal_uv": round(frame.raw_horizontal_uv, 2),
                "filtered_vertical_uv": round(frame.filtered_vertical_uv, 2),
                "filtered_horizontal_uv": round(frame.filtered_horizontal_uv, 2),
                "gaze": frame.gaze.value,
                "command": frame.command.command if frame.command else None,
                "details": frame.command.details if frame.command else None,
            }
            print(json.dumps(payload))
        else:
            filt_v_meter = render_ascii_meter(frame.filtered_vertical_uv, min_val=-50.0, max_val=300.0, width=12)
            print(f"{frame.timestamp_s:6.2f}s | {frame.raw_vertical_uv:10.1f} | {frame.filtered_vertical_uv:7.1f} {filt_v_meter} | {frame.filtered_horizontal_uv:11.1f} | {frame.gaze.value:>6} | {event_str}")

        if realtime:
            time.sleep(1.0 / 100.0)

    elapsed_ms = (time.perf_counter() - t_start) * 1000.0

    if not output_json:
        print("-" * 78)
        print(f"Stream completed in {elapsed_ms:.1f}ms ({len(samples)} samples processed at {len(samples)/(elapsed_ms/1000.0):.0f} samples/sec).")
        print(f"Total Commands Detected: {len(detected_commands)}")
        for cmd in detected_commands:
            print(f"  -> [{cmd.timestamp:5.2f}s] COMMAND: {cmd.command:<12} (Gaze: {cmd.gaze.value}, Blinks: {cmd.blink_count})")
        print("=" * 78)

    return detected_commands


def main():
    parser = argparse.ArgumentParser(
        description="Kshitij EOG Biopotential DSP Stream Generator & Command Engine CLI"
    )
    parser.add_argument(
        "--scenario", "-s",
        choices=["nurse", "pain", "water", "bathroom", "artifacts", "all"],
        default="nurse",
        help="Predefined biopotential simulation scenario to run"
    )
    parser.add_argument(
        "--realtime", "-r",
        action="store_true",
        help="Stream samples in real-time at 100 Hz cadence"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output raw JSON stream for IPC or pipeline consumption"
    )

    args = parser.parse_args()

    if args.scenario == "all":
        all_scenarios = ["nurse", "pain", "water", "bathroom", "artifacts"]
        for sc in all_scenarios:
            run_scenario(sc, realtime=False, output_json=args.json)
            if not args.json:
                print("\n")
    else:
        run_scenario(args.scenario, realtime=args.realtime, output_json=args.json)


if __name__ == "__main__":
    main()
