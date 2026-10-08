"""
dashboard/server.py
===================
Local HTTP Server for Kshitij Web Preview Dashboard.
Serves static dashboard assets and provides optional telemetry stream endpoints.

Usage:
    python -m dashboard.server --port 5000
"""

import argparse
import http.server
import os
import socketserver
import sys

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)

    def log_message(self, format, *args):
        # Clean logging
        pass


def serve(port: int = 5000):
    os.chdir(DASHBOARD_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("127.0.0.1", port), CustomHandler) as httpd:
        print(f"================================================================")
        print(f"  KSHITIJ WEB PREVIEW DASHBOARD RUNNING")
        print(f"  URL: http://localhost:{port}")
        print(f"  Local File: file:///{DASHBOARD_DIR.replace(os.sep, '/')}/index.html")
        print(f"================================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Kshitij Web Dashboard Server")
    parser.add_argument("--port", "-p", type=int, default=5000, help="Port to bind server (default: 5000)")
    args = parser.parse_args()
    serve(args.port)
