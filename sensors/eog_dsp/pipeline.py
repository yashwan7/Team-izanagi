"""
sensors/eog_dsp/pipeline.py
===========================
End-to-End Real-Time EOG DSP Pipeline for Kshitij.

Combines:
  1. 4th-order Butterworth Bandpass Filter (0.1Hz - 10Hz) for Vertical (Blinks)
  2. 4th-order Butterworth Lowpass Filter (10Hz) for Horizontal (Gaze Step Voltages)
  3. Gaze Step-Voltage Shift Detector (LEFT/RIGHT/CENTER)
  4. Pulse-width Blink Detector (100ms - 400ms)
  5. Command State Machine Engine
"""

from dataclasses import dataclass
from typing import Callable, List, Optional, Tuple

from .detector import CommandEvent, EOGCommandEngine, GazeDirection
from .filter import ButterworthBandpassFilter, ButterworthLowpassFilter


@dataclass
class ProcessedFrame:
    timestamp_s: float
    raw_vertical_uv: float
    raw_horizontal_uv: float
    filtered_vertical_uv: float
    filtered_horizontal_uv: float
    gaze: GazeDirection
    command: Optional[CommandEvent]


class EOGDSPPipeline:
    """
    Complete real-time DSP pipeline processing streaming 100Hz biopotential frames.
    """

    def __init__(
        self,
        lowcut: float = 0.1,
        highcut: float = 10.0,
        fs: float = 100.0,
        blink_threshold: float = 50.0,
        gaze_left_threshold: float = 60.0,
        gaze_right_threshold: float = -60.0,
        on_command_callback: Optional[Callable[[CommandEvent], None]] = None
    ):
        self.fs = float(fs)
        # Vertical: Bandpass filter 0.1 - 10.0 Hz eliminates baseline wander and 50Hz noise for clean blinks
        self.vertical_filter = ButterworthBandpassFilter(lowcut=lowcut, highcut=highcut, fs=fs)
        # Horizontal: Lowpass filter 10.0 Hz preserves DC step-voltage level for eye gaze direction
        self.horizontal_filter = ButterworthLowpassFilter(cutoff=highcut, fs=fs)

        self.engine = EOGCommandEngine(
            multi_blink_window_s=1.5,
            inter_blink_timeout_s=0.55,
            blink_threshold=blink_threshold,
            gaze_left_threshold=gaze_left_threshold,
            gaze_right_threshold=gaze_right_threshold,
            fs=fs,
            on_command_callback=on_command_callback
        )
        self.sample_count = 0

    def process_sample(
        self,
        raw_vertical_uv: float,
        raw_horizontal_uv: float,
        timestamp_s: Optional[float] = None
    ) -> ProcessedFrame:
        """
        Process a single streaming sample pair (Vertical, Horizontal) at 100Hz.
        """
        if timestamp_s is None:
            t = self.sample_count / self.fs
        else:
            t = float(timestamp_s)

        self.sample_count += 1

        # 1. Digital Filtering
        filt_v = self.vertical_filter.filter_sample(raw_vertical_uv)
        filt_h = self.horizontal_filter.filter_sample(raw_horizontal_uv)

        # 2. Detector & Command Engine
        cmd = self.engine.process_frame(filt_v, filt_h, timestamp=t)
        current_gaze = self.engine.gaze_detector.current_gaze

        return ProcessedFrame(
            timestamp_s=t,
            raw_vertical_uv=raw_vertical_uv,
            raw_horizontal_uv=raw_horizontal_uv,
            filtered_vertical_uv=filt_v,
            filtered_horizontal_uv=filt_h,
            gaze=current_gaze,
            command=cmd
        )

    def reset(self) -> None:
        self.vertical_filter.reset()
        self.horizontal_filter.reset()
        self.engine.reset()
        self.sample_count = 0
