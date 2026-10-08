"""
Entry point for Kshitij Dual-Port Telemetry & Failover Engine.
Supports CLI mode, REST API mode, or simultaneous both mode.
"""

import argparse
import sys
import threading
import uvicorn

from .engine import FailoverEngine
from .cli import run_cli_loop
from .api import app, get_engine


def main():
    parser = argparse.ArgumentParser(description="Kshitij Dual-Port Failover & Telemetry Engine")
    parser.add_argument(
        "--mode",
        choices=["cli", "api", "both"],
        default="both",
        help="Run mode: 'cli' (terminal dashboard), 'api' (FastAPI REST server), or 'both' (default)",
    )
    parser.add_argument("--host", default="0.0.0.0", help="API server host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="API server port (default: 8000)")
    args = parser.parse_args()

    engine = get_engine()

    if args.mode == "api":
        print(f"Starting Kshitij Failover REST API on http://{args.host}:{args.port}")
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")

    elif args.mode == "cli":
        run_cli_loop(engine)

    elif args.mode == "both":
        # Run API in a background daemon thread
        print(f"Starting background REST API on http://{args.host}:{args.port}...")
        api_thread = threading.Thread(
            target=lambda: uvicorn.run(app, host=args.host, port=args.port, log_level="warning"),
            daemon=True,
        )
        api_thread.start()
        print("Launching live interactive CLI...")
        run_cli_loop(engine)


if __name__ == "__main__":
    main()
