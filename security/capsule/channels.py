"""
security/capsule/channels.py
============================
Communication Channel Transports for Kshitij Case Capsules.

Provides:
  1. MockSerialChannel: In-memory duplex UART/Serial transport with frame delimiter
     and error/tamper injection capabilities.
  2. WebSocketChannel / Server: Local TCP/WebSocket transport for streaming signed delta capsules.
"""

import asyncio
from collections import deque
import json
import socket
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple, Union


class MockSerialChannel:
    """
    Simulates a hardware UART / USB-Serial communication channel.
    Operates with framed messages (newline delimited '\\n' or length-prefixed).
    """

    def __init__(self, baud_rate: int = 115200, latency_ms: float = 2.0):
        self.baud_rate = baud_rate
        self.latency_ms = latency_ms
        self._tx_buffer: deque = deque()
        self._rx_buffer: deque = deque()
        self._lock = threading.Lock()
        self.total_bytes_transmitted = 0
        self.total_frames_transmitted = 0

    def write_frame(self, frame_str: str) -> int:
        """Writes a framed message (appends '\\n' delimiter)."""
        data_bytes = (frame_str.strip() + "\n").encode("utf-8")
        with self._lock:
            self._rx_buffer.append(data_bytes)
            self.total_bytes_transmitted += len(data_bytes)
            self.total_frames_transmitted += 1
        return len(data_bytes)

    def read_frame(self, timeout_s: float = 1.0) -> Optional[str]:
        """Reads a framed message from the RX queue."""
        t_start = time.time()
        while (time.time() - t_start) < timeout_s:
            with self._lock:
                if self._rx_buffer:
                    raw_bytes = self._rx_buffer.popleft()
                    return raw_bytes.decode("utf-8").strip()
            time.sleep(0.005)
        return None

    def inject_tampering(self, tamper_func: Optional[Callable[[str], str]] = None) -> bool:
        """Tamper with the next frame currently pending in the RX queue for testing."""
        with self._lock:
            if not self._rx_buffer:
                return False
            raw_bytes = self._rx_buffer.popleft()
            msg = raw_bytes.decode("utf-8").strip()

            if tamper_func:
                tampered_msg = tamper_func(msg)
            else:
                # Default tamper: modify payload field or flip bits
                try:
                    data = json.loads(msg)
                    if "payload" in data and isinstance(data["payload"], dict):
                        data["payload"]["tampered"] = True
                        if "delta" in data["payload"]:
                            data["payload"]["delta"]["heart_rate_bpm"] = 999
                    tampered_msg = json.dumps(data)
                except Exception:
                    tampered_msg = msg + "_CORRUPTED"

            self._rx_buffer.appendleft((tampered_msg + "\n").encode("utf-8"))
            return True

    def clear(self) -> None:
        with self._lock:
            self._tx_buffer.clear()
            self._rx_buffer.clear()


class MockSocketChannelServer:
    """
    Lightweight zero-dependency TCP Socket / Streaming Server on localhost
    for broadcasting signed patient capsules to local clients/dashboards.
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 8765):
        self.host = host
        self.port = port
        self.server_socket: Optional[socket.socket] = None
        self.clients: List[socket.socket] = []
        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def start(self) -> None:
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(5)
        self.server_socket.settimeout(0.5)
        self.is_running = True

        self._thread = threading.Thread(target=self._accept_loop, daemon=True)
        self._thread.start()

    def _accept_loop(self) -> None:
        while self.is_running:
            try:
                client_sock, _ = self.server_socket.accept()
                with self._lock:
                    self.clients.append(client_sock)
            except socket.timeout:
                continue
            except Exception:
                break

    def broadcast(self, message: str) -> int:
        """Broadcasts a signed capsule JSON line to all connected clients."""
        payload = (message.strip() + "\n").encode("utf-8")
        dead_clients = []
        sent_count = 0

        with self._lock:
            for client in self.clients:
                try:
                    client.sendall(payload)
                    sent_count += 1
                except Exception:
                    dead_clients.append(client)

            for dead in dead_clients:
                self.clients.remove(dead)
                try:
                    dead.close()
                except Exception:
                    pass

        return sent_count

    def stop(self) -> None:
        self.is_running = False
        with self._lock:
            for c in self.clients:
                try:
                    c.close()
                except Exception:
                    pass
            self.clients.clear()

        if self.server_socket:
            try:
                self.server_socket.close()
            except Exception:
                pass
