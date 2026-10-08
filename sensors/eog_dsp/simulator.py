"""
sensors/eog_dsp/simulator.py
============================
Realistic Raw EOG (Electrooculography) Biopotential Stream Simulator at 100Hz.

Simulates 2-channel biopotential signals (Vertical & Horizontal EOG) containing:
  - Baseline wander / electrode drift (< 0.1 Hz)
  - 50Hz/60Hz AC mains powerline interference
  - High-frequency EMG muscle noise
  - Calibrated Blink Pulses (100ms - 400ms duration, 200-300 uV amplitude)
  - Step-voltage Saccade Gaze Shifts (LEFT: positive shift, RIGHT: negative shift)
"""

from dataclasses import dataclass
import math
import random
from typing import List, Tuple


@dataclass
class EOGSample:
    sample_index: int
    timestamp_s: float
    raw_vertical_uv: float     # Raw vertical channel with noise and baseline wander
    raw_horizontal_uv: float   # Raw horizontal channel with noise and baseline wander
    true_blink: bool           # Ground truth label for evaluation
    true_gaze: str             # Ground truth gaze ("CENTER", "LEFT", "RIGHT")


class EOGSimulator:
    """
    Generates synthetic 100Hz raw EOG biopotential sample streams.
    """

    def __init__(
        self,
        fs: float = 100.0,
        baseline_drift_freq_hz: float = 0.03,
        baseline_drift_amp_uv: float = 80.0,
        mains_noise_freq_hz: float = 50.0,
        mains_noise_amp_uv: float = 25.0,
        emg_noise_std_uv: float = 5.0,
        seed: int = 42
    ):
        self.fs = float(fs)
        self.dt = 1.0 / self.fs
        self.drift_freq = float(baseline_drift_freq_hz)
        self.drift_amp = float(baseline_drift_amp_uv)
        self.mains_freq = float(mains_noise_freq_hz)
        self.mains_amp = float(mains_noise_amp_uv)
        self.emg_std = float(emg_noise_std_uv)
        self.rng = random.Random(seed)

    def _generate_noise(self, t: float) -> Tuple[float, float]:
        """Generates baseline drift, 50Hz AC hum, and EMG Gaussian noise for 2 channels."""
        # Baseline drift (< 0.1 Hz)
        drift_v = self.drift_amp * math.sin(2.0 * math.pi * self.drift_freq * t + 0.2)
        drift_h = self.drift_amp * 0.7 * math.cos(2.0 * math.pi * self.drift_freq * t * 0.8)

        # 50Hz Mains hum
        mains_v = self.mains_amp * math.sin(2.0 * math.pi * self.mains_freq * t)
        mains_h = self.mains_amp * math.sin(2.0 * math.pi * self.mains_freq * t + 0.5)

        # EMG muscle noise (Gaussian)
        emg_v = self.rng.gauss(0.0, self.emg_std)
        emg_h = self.rng.gauss(0.0, self.emg_std)

        noise_v = drift_v + mains_v + emg_v
        noise_h = drift_h + mains_h + emg_h
        return noise_v, noise_h

    def _blink_pulse(self, t_rel: float, duration_s: float, amplitude_uv: float) -> float:
        """
        Raised cosine / Gaussian bell pulse for a blink.
        t_rel is time relative to pulse start (0 to duration_s).
        """
        if 0.0 <= t_rel <= duration_s:
            # Raised cosine window: smoothly rises from 0 to amplitude and returns to 0
            return 0.5 * amplitude_uv * (1.0 - math.cos(2.0 * math.pi * t_rel / duration_s))
        return 0.0

    def generate_scenario_nurse(self, duration_s: float = 3.0) -> List[EOGSample]:
        """
        Scenario 1: 2 blinks within 1.5s (at t=0.6s and t=1.2s) -> triggers 'CALL_NURSE'.
        """
        samples: List[EOGSample] = []
        n_samples = int(duration_s * self.fs)
        
        # Blink 1: at t=0.6s, duration 200ms, amp 250 uV
        # Blink 2: at t=1.2s, duration 220ms, amp 260 uV
        for i in range(n_samples):
            t = i * self.dt
            noise_v, noise_h = self._generate_noise(t)
            
            # Blink biopotentials
            b1 = self._blink_pulse(t - 0.60, duration_s=0.20, amplitude_uv=250.0)
            b2 = self._blink_pulse(t - 1.20, duration_s=0.22, amplitude_uv=260.0)
            blink_sig = b1 + b2
            
            is_blink = (0.60 <= t <= 0.80) or (1.20 <= t <= 1.42)
            
            samples.append(EOGSample(
                sample_index=i,
                timestamp_s=t,
                raw_vertical_uv=blink_sig + noise_v,
                raw_horizontal_uv=noise_h,
                true_blink=is_blink,
                true_gaze="CENTER"
            ))
        return samples

    def generate_scenario_pain(self, duration_s: float = 3.0) -> List[EOGSample]:
        """
        Scenario 2: 3 blinks within 1.5s (at t=0.4s, t=0.8s, t=1.2s) -> triggers 'PAIN'.
        """
        samples: List[EOGSample] = []
        n_samples = int(duration_s * self.fs)
        
        for i in range(n_samples):
            t = i * self.dt
            noise_v, noise_h = self._generate_noise(t)
            
            b1 = self._blink_pulse(t - 0.40, duration_s=0.18, amplitude_uv=240.0)
            b2 = self._blink_pulse(t - 0.80, duration_s=0.20, amplitude_uv=250.0)
            b3 = self._blink_pulse(t - 1.20, duration_s=0.19, amplitude_uv=260.0)
            blink_sig = b1 + b2 + b3
            
            is_blink = (0.40 <= t <= 0.58) or (0.80 <= t <= 1.00) or (1.20 <= t <= 1.39)
            
            samples.append(EOGSample(
                sample_index=i,
                timestamp_s=t,
                raw_vertical_uv=blink_sig + noise_v,
                raw_horizontal_uv=noise_h,
                true_blink=is_blink,
                true_gaze="CENTER"
            ))
        return samples

    def generate_scenario_water(self, duration_s: float = 3.0) -> List[EOGSample]:
        """
        Scenario 3: Gaze LEFT (positive step-voltage shift +120 uV starting t=0.4s) + 1 blink at t=0.8s -> triggers 'WATER'.
        """
        samples: List[EOGSample] = []
        n_samples = int(duration_s * self.fs)
        
        for i in range(n_samples):
            t = i * self.dt
            noise_v, noise_h = self._generate_noise(t)
            
            # Saccade to LEFT step-voltage (+120 uV starting at t=0.4s)
            gaze_step = 120.0 if t >= 0.40 else 0.0
            gaze_str = "LEFT" if t >= 0.40 else "CENTER"
            
            # Single blink at t=0.8s (duration 220ms)
            b1 = self._blink_pulse(t - 0.80, duration_s=0.22, amplitude_uv=250.0)
            is_blink = (0.80 <= t <= 1.02)
            
            samples.append(EOGSample(
                sample_index=i,
                timestamp_s=t,
                raw_vertical_uv=b1 + noise_v,
                raw_horizontal_uv=gaze_step + noise_h,
                true_blink=is_blink,
                true_gaze=gaze_str
            ))
        return samples

    def generate_scenario_bathroom(self, duration_s: float = 3.0) -> List[EOGSample]:
        """
        Scenario 4: Gaze RIGHT (negative step-voltage shift -120 uV starting t=0.4s) + 1 blink at t=0.8s -> triggers 'BATHROOM'.
        """
        samples: List[EOGSample] = []
        n_samples = int(duration_s * self.fs)
        
        for i in range(n_samples):
            t = i * self.dt
            noise_v, noise_h = self._generate_noise(t)
            
            # Saccade to RIGHT step-voltage (-120 uV starting at t=0.4s)
            gaze_step = -120.0 if t >= 0.40 else 0.0
            gaze_str = "RIGHT" if t >= 0.40 else "CENTER"
            
            # Single blink at t=0.8s (duration 220ms)
            b1 = self._blink_pulse(t - 0.80, duration_s=0.22, amplitude_uv=250.0)
            is_blink = (0.80 <= t <= 1.02)
            
            samples.append(EOGSample(
                sample_index=i,
                timestamp_s=t,
                raw_vertical_uv=b1 + noise_v,
                raw_horizontal_uv=gaze_step + noise_h,
                true_blink=is_blink,
                true_gaze=gaze_str
            ))
        return samples

    def generate_scenario_invalid_artifacts(self, duration_s: float = 3.0) -> List[EOGSample]:
        """
        Scenario 5: Artifacts that must NOT trigger blinks:
          - Ultra-short EMG spike (40ms, < 100ms)
          - Long sustained artifact / slow baseline shift (800ms, > 400ms)
        """
        samples: List[EOGSample] = []
        n_samples = int(duration_s * self.fs)
        
        for i in range(n_samples):
            t = i * self.dt
            noise_v, noise_h = self._generate_noise(t)
            
            # Spike 1: 40ms pulse at t=0.5s (too short for blink)
            spike_short = self._blink_pulse(t - 0.50, duration_s=0.04, amplitude_uv=300.0)
            # Pulse 2: 800ms pulse at t=1.2s (too long for blink)
            pulse_long = self._blink_pulse(t - 1.20, duration_s=0.80, amplitude_uv=300.0)
            
            artifact_v = spike_short + pulse_long
            
            samples.append(EOGSample(
                sample_index=i,
                timestamp_s=t,
                raw_vertical_uv=artifact_v + noise_v,
                raw_horizontal_uv=noise_h,
                true_blink=False,
                true_gaze="CENTER"
            ))
        return samples
