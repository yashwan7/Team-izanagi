"""
sensors/eog_dsp/detector.py
===========================
Blink Detection, Gaze Direction Tracking, and Command Mapping Engine for Kshitij EOG Capsule.

Implements:
1. Blink Detection Logic:
   - Filters amplitude peaks and measures pulse width (rising/falling crossing).
   - Valid blink duration: 100ms <= duration <= 400ms.
   - Rejects artifacts < 100ms (high frequency EMG spikes) or > 400ms (eyelid closures/drift).

2. Eye Gaze Direction Logic:
   - Detects sustained step-voltage shifts:
     * Voltage shift above GAZE_LEFT_THRESHOLD  -> 'LEFT'
     * Voltage shift below GAZE_RIGHT_THRESHOLD -> 'RIGHT'
     * Baseline / Neutral -> 'CENTER'

3. Command Mapping Engine:
   - 2 blinks within 1.5s -> 'CALL_NURSE'
   - 3 blinks within 1.5s -> 'PAIN'
   - 'LEFT' + 1 blink     -> 'WATER'
   - 'RIGHT' + 1 blink    -> 'BATHROOM'
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, List, Optional


class GazeDirection(str, Enum):
    CENTER = "CENTER"
    LEFT = "LEFT"
    RIGHT = "RIGHT"


@dataclass
class BlinkEvent:
    start_time: float      # in seconds
    peak_time: float       # in seconds
    end_time: float        # in seconds
    duration_ms: float     # in milliseconds
    peak_amplitude: float  # in microvolts (uV) or signal units


@dataclass
class CommandEvent:
    timestamp: float       # in seconds
    command: str           # e.g., 'CALL_NURSE', 'PAIN', 'WATER', 'BATHROOM'
    gaze: GazeDirection
    blink_count: int
    details: str = ""


class BlinkDetector:
    """
    Detects blinks based on biopotential pulse duration and amplitude threshold.
    Validates that pulse duration is strictly between 100ms and 400ms.
    """

    def __init__(
        self,
        threshold: float = 50.0,
        min_duration_ms: float = 100.0,
        max_duration_ms: float = 400.0,
        fs: float = 100.0
    ):
        self.threshold = float(threshold)
        self.min_duration_ms = float(min_duration_ms)
        self.max_duration_ms = float(max_duration_ms)
        self.fs = float(fs)

        self.in_pulse = False
        self.pulse_start_idx = 0
        self.pulse_peak_idx = 0
        self.pulse_peak_val = 0.0
        self.current_sample_idx = 0

    def process_sample(self, sample: float, timestamp: Optional[float] = None) -> Optional[BlinkEvent]:
        """
        Process a single filtered EOG biopotential sample.
        Returns a BlinkEvent if a valid blink pulse just completed.
        """
        if timestamp is None:
            t = self.current_sample_idx / self.fs
        else:
            t = float(timestamp)

        val = float(sample)
        detected_blink: Optional[BlinkEvent] = None

        if not self.in_pulse:
            if val >= self.threshold:
                self.in_pulse = True
                self.pulse_start_idx = self.current_sample_idx
                self.pulse_peak_idx = self.current_sample_idx
                self.pulse_peak_val = val
        else:
            # Inside pulse: track peak
            if val > self.pulse_peak_val:
                self.pulse_peak_val = val
                self.pulse_peak_idx = self.current_sample_idx

            # Check for falling edge below threshold (or zero crossing)
            if val < (self.threshold * 0.5):
                self.in_pulse = False
                duration_samples = self.current_sample_idx - self.pulse_start_idx
                duration_ms = (duration_samples / self.fs) * 1000.0

                start_t = self.pulse_start_idx / self.fs
                peak_t = self.pulse_peak_idx / self.fs
                end_t = self.current_sample_idx / self.fs

                # Enforce blink duration constraints: 100ms <= duration <= 400ms
                if self.min_duration_ms <= duration_ms <= self.max_duration_ms:
                    detected_blink = BlinkEvent(
                        start_time=start_t,
                        peak_time=peak_t,
                        end_time=end_t,
                        duration_ms=duration_ms,
                        peak_amplitude=self.pulse_peak_val
                    )

        self.current_sample_idx += 1
        return detected_blink

    def reset(self) -> None:
        self.in_pulse = False
        self.pulse_start_idx = 0
        self.pulse_peak_idx = 0
        self.pulse_peak_val = 0.0
        self.current_sample_idx = 0


class GazeDetector:
    """
    Tracks eye gaze direction (LEFT, RIGHT, CENTER) from step-voltage shifts.
    """

    def __init__(
        self,
        gaze_left_threshold: float = 60.0,
        gaze_right_threshold: float = -60.0,
        smoothing_window_samples: int = 5,
        fs: float = 100.0
    ):
        self.gaze_left_threshold = float(gaze_left_threshold)
        self.gaze_right_threshold = float(gaze_right_threshold)
        self.window_size = int(max(1, smoothing_window_samples))
        self.fs = float(fs)

        self.buffer: List[float] = []
        self.current_gaze: GazeDirection = GazeDirection.CENTER

    def process_sample(self, horizontal_sample: float) -> GazeDirection:
        """
        Process horizontal EOG sample and update gaze direction.
        """
        self.buffer.append(float(horizontal_sample))
        if len(self.buffer) > self.window_size:
            self.buffer.pop(0)

        avg_val = sum(self.buffer) / len(self.buffer)

        if avg_val >= self.gaze_left_threshold:
            self.current_gaze = GazeDirection.LEFT
        elif avg_val <= self.gaze_right_threshold:
            self.current_gaze = GazeDirection.RIGHT
        else:
            self.current_gaze = GazeDirection.CENTER

        return self.current_gaze

    def reset(self) -> None:
        self.buffer.clear()
        self.current_gaze = GazeDirection.CENTER


class EOGCommandEngine:
    """
    State machine that fuses filtered blink events and gaze direction to emit Kshitij commands:
      - 2 blinks within 1.5s -> 'CALL_NURSE'
      - 3 blinks within 1.5s -> 'PAIN'
      - 'LEFT'  + 1 blink     -> 'WATER'
      - 'RIGHT' + 1 blink     -> 'BATHROOM'
    """

    def __init__(
        self,
        multi_blink_window_s: float = 1.5,
        inter_blink_timeout_s: float = 0.55,
        blink_threshold: float = 50.0,
        gaze_left_threshold: float = 60.0,
        gaze_right_threshold: float = -60.0,
        fs: float = 100.0,
        on_command_callback: Optional[Callable[[CommandEvent], None]] = None
    ):
        self.multi_blink_window_s = float(multi_blink_window_s)
        self.inter_blink_timeout_s = float(inter_blink_timeout_s)
        self.fs = float(fs)
        self.on_command_callback = on_command_callback

        self.blink_detector = BlinkDetector(threshold=blink_threshold, fs=fs)
        self.gaze_detector = GazeDetector(
            gaze_left_threshold=gaze_left_threshold,
            gaze_right_threshold=gaze_right_threshold,
            fs=fs
        )

        self.blink_history: List[BlinkEvent] = []
        self.pending_gaze_at_first_blink: GazeDirection = GazeDirection.CENTER
        self.current_sample_idx = 0
        self.last_emitted_command: Optional[CommandEvent] = None
        self.emitted_commands: List[CommandEvent] = []

    def process_frame(
        self,
        vertical_filtered: float,
        horizontal_filtered: float,
        timestamp: Optional[float] = None
    ) -> Optional[CommandEvent]:
        """
        Process a single synchronized (vertical, horizontal) EOG sample frame.
        """
        if timestamp is None:
            t = self.current_sample_idx / self.fs
        else:
            t = float(timestamp)

        self.current_sample_idx += 1

        # 1. Update Gaze Direction
        current_gaze = self.gaze_detector.process_sample(horizontal_filtered)

        # 2. Check for Blink Pulse
        blink = self.blink_detector.process_sample(vertical_filtered, timestamp=t)
        
        triggered_command: Optional[CommandEvent] = None

        if blink is not None:
            # Prune blinks outside the 1.5s multi-blink window relative to current blink
            self.blink_history = [
                b for b in self.blink_history
                if (blink.end_time - b.start_time) <= self.multi_blink_window_s
            ]
            self.blink_history.append(blink)

            count = len(self.blink_history)

            # Check Gaze + Single Blink Commands immediately
            if count == 1:
                self.pending_gaze_at_first_blink = current_gaze
                if current_gaze == GazeDirection.LEFT:
                    triggered_command = CommandEvent(
                        timestamp=t,
                        command="WATER",
                        gaze=GazeDirection.LEFT,
                        blink_count=1,
                        details="Gaze LEFT + 1 blink"
                    )
                    self.blink_history.clear()
                elif current_gaze == GazeDirection.RIGHT:
                    triggered_command = CommandEvent(
                        timestamp=t,
                        command="BATHROOM",
                        gaze=GazeDirection.RIGHT,
                        blink_count=1,
                        details="Gaze RIGHT + 1 blink"
                    )
                    self.blink_history.clear()

            elif count == 2:
                # 2 blinks registered in window. Will trigger CALL_NURSE on timeout or PAIN if 3rd arrives.
                pass

            elif count >= 3:
                # 3 blinks reached -> Immediate PAIN command
                triggered_command = CommandEvent(
                    timestamp=t,
                    command="PAIN",
                    gaze=GazeDirection.CENTER,
                    blink_count=3,
                    details="3 blinks within window"
                )
                self.blink_history.clear()

        # 3. Check for window expiration / inter-blink timeout on pending 2-blink sequence
        if triggered_command is None and len(self.blink_history) == 2:
            time_since_last_blink = t - self.blink_history[-1].end_time
            total_span = t - self.blink_history[0].start_time

            # If inter-blink timeout passed or window closing, commit CALL_NURSE
            if time_since_last_blink >= self.inter_blink_timeout_s or total_span >= self.multi_blink_window_s:
                triggered_command = CommandEvent(
                    timestamp=t,
                    command="CALL_NURSE",
                    gaze=GazeDirection.CENTER,
                    blink_count=2,
                    details="2 blinks within 1.5s confirmed"
                )
                self.blink_history.clear()

        if triggered_command is not None:
            self.last_emitted_command = triggered_command
            self.emitted_commands.append(triggered_command)
            if self.on_command_callback:
                self.on_command_callback(triggered_command)

        return triggered_command

    def reset(self) -> None:
        self.blink_detector.reset()
        self.gaze_detector.reset()
        self.blink_history.clear()
        self.pending_gaze_at_first_blink = GazeDirection.CENTER
        self.current_sample_idx = 0
        self.last_emitted_command = None
        self.emitted_commands.clear()
