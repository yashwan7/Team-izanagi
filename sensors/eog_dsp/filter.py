"""
sensors/eog_dsp/filter.py
=========================
4th-order IIR Butterworth Digital Filters (Bandpass, Lowpass, Highpass at 100 Hz Fs)
Designed for Kshitij EOG Capsule Biopotential Stream Processing.

Filters:
  - ButterworthBandpassFilter: 4th-order 0.1 Hz to 10.0 Hz bandpass (Vertical EOG / Blinks).
  - ButterworthLowpassFilter:  4th-order 10.0 Hz lowpass (Horizontal EOG / Gaze step-voltage preservation).
  - ButterworthHighpassFilter: 4th-order 0.1 Hz highpass.

Eliminates:
  - DC electrode baseline wander / drift (< 0.1 Hz)
  - High-frequency EMG muscle artifacts & 50Hz/60Hz AC mains powerline interference (> 10 Hz)
"""

from dataclasses import dataclass
import math
from typing import List, Sequence, Tuple


@dataclass
class BiquadCoeffs:
    """Second-Order Section (Biquad) filter coefficients in Direct Form II."""
    b0: float
    b1: float
    b2: float
    a1: float
    a2: float


class BiquadSection:
    """
    Direct Form II Transposed Biquad Section.
    
    Difference equation:
        y[n] = b0 * x[n] + d1[n-1]
        d1[n] = b1 * x[n] - a1 * y[n] + d2[n-1]
        d2[n] = b2 * x[n] - a2 * y[n]
    """
    __slots__ = ('b0', 'b1', 'b2', 'a1', 'a2', 'd1', 'd2')

    def __init__(self, b0: float, b1: float, b2: float, a1: float, a2: float):
        self.b0 = float(b0)
        self.b1 = float(b1)
        self.b2 = float(b2)
        self.a1 = float(a1)
        self.a2 = float(a2)
        self.d1 = 0.0
        self.d2 = 0.0

    def process(self, x: float) -> float:
        y = self.b0 * x + self.d1
        self.d1 = self.b1 * x - self.a1 * y + self.d2
        self.d2 = self.b2 * x - self.a2 * y
        return y

    def reset(self) -> None:
        self.d1 = 0.0
        self.d2 = 0.0

    def frequency_response(self, freq_hz: float, fs_hz: float) -> complex:
        w = 2.0 * math.pi * freq_hz / fs_hz
        z = math.cos(w) - 1j * math.sin(w)
        num = self.b0 + self.b1 * z + self.b2 * (z ** 2)
        den = 1.0 + self.a1 * z + self.a2 * (z ** 2)
        return num / den if abs(den) > 1e-15 else complex(0.0, 0.0)


def design_biquad_butterworth_lowpass(fc: float, fs: float, q: float) -> BiquadCoeffs:
    """Designs a 2nd-order Butterworth lowpass biquad section using Bilinear Transform."""
    w0 = 2.0 * math.pi * fc / fs
    alpha = math.sin(w0) / (2.0 * q)
    cos_w0 = math.cos(w0)

    b0 = (1.0 - cos_w0) / 2.0
    b1 = 1.0 - cos_w0
    b2 = (1.0 - cos_w0) / 2.0
    a0 = 1.0 + alpha
    a1 = -2.0 * cos_w0
    a2 = 1.0 - alpha

    return BiquadCoeffs(
        b0=b0 / a0,
        b1=b1 / a0,
        b2=b2 / a0,
        a1=a1 / a0,
        a2=a2 / a0
    )


def design_biquad_butterworth_highpass(fc: float, fs: float, q: float) -> BiquadCoeffs:
    """Designs a 2nd-order Butterworth highpass biquad section using Bilinear Transform."""
    w0 = 2.0 * math.pi * fc / fs
    alpha = math.sin(w0) / (2.0 * q)
    cos_w0 = math.cos(w0)

    b0 = (1.0 + cos_w0) / 2.0
    b1 = -(1.0 + cos_w0)
    b2 = (1.0 + cos_w0) / 2.0
    a0 = 1.0 + alpha
    a1 = -2.0 * cos_w0
    a2 = 1.0 - alpha

    return BiquadCoeffs(
        b0=b0 / a0,
        b1=b1 / a0,
        b2=b2 / a0,
        a1=a1 / a0,
        a2=a2 / a0
    )


class ButterworthBandpassFilter:
    """
    4th-order IIR Butterworth Bandpass Filter (0.1 Hz to 10.0 Hz) at 100 Hz sampling rate.
    
    Constructed by cascading two 2nd-order Butterworth highpass biquads (fc=0.1Hz)
    and two 2nd-order Butterworth lowpass biquads (fc=10.0Hz), achieving a true
    4th-order bandpass response.
    """

    def __init__(self, lowcut: float = 0.1, highcut: float = 10.0, fs: float = 100.0):
        self.lowcut = float(lowcut)
        self.highcut = float(highcut)
        self.fs = float(fs)
        
        # 4th-order Butterworth Q factors for paired conjugate poles
        self.q1 = 1.0 / (2.0 * math.cos(math.pi / 8.0))       # ~0.5411961
        self.q2 = 1.0 / (2.0 * math.cos(3.0 * math.pi / 8.0)) # ~1.3065630

        self.sections: List[BiquadSection] = []
        self._init_sections()

    def _init_sections(self) -> None:
        self.sections.clear()
        hp1 = design_biquad_butterworth_highpass(self.lowcut, self.fs, self.q1)
        hp2 = design_biquad_butterworth_highpass(self.lowcut, self.fs, self.q2)
        lp1 = design_biquad_butterworth_lowpass(self.highcut, self.fs, self.q1)
        lp2 = design_biquad_butterworth_lowpass(self.highcut, self.fs, self.q2)

        for c in (hp1, hp2, lp1, lp2):
            self.sections.append(BiquadSection(c.b0, c.b1, c.b2, c.a1, c.a2))

    def filter_sample(self, x: float) -> float:
        """Processes a single raw biopotential sample in real-time."""
        out = float(x)
        for section in self.sections:
            out = section.process(out)
        return out

    def filter_stream(self, samples: Sequence[float]) -> List[float]:
        """Filters an entire array/stream of samples sequentially."""
        return [self.filter_sample(s) for s in samples]

    def reset(self) -> None:
        """Resets all internal biquad delay states."""
        for section in self.sections:
            section.reset()

    def frequency_response(self, freq_hz: float) -> Tuple[float, float]:
        """
        Computes the theoretical magnitude (linear & dB) response at a given frequency.
        Returns: (gain_linear, gain_db)
        """
        h = 1.0 + 0j
        for section in self.sections:
            h *= section.frequency_response(freq_hz, self.fs)
        gain_linear = abs(h)
        gain_db = 20.0 * math.log10(gain_linear) if gain_linear > 1e-15 else -999.0
        return gain_linear, gain_db


class ButterworthLowpassFilter:
    """
    4th-order IIR Butterworth Lowpass Filter (10.0 Hz cutoff at 100 Hz Fs).
    Preserves DC step-voltage levels for horizontal eye-gaze tracking while filtering 50Hz/60Hz noise.
    """

    def __init__(self, cutoff: float = 10.0, fs: float = 100.0):
        self.cutoff = float(cutoff)
        self.fs = float(fs)
        self.q1 = 1.0 / (2.0 * math.cos(math.pi / 8.0))
        self.q2 = 1.0 / (2.0 * math.cos(3.0 * math.pi / 8.0))

        self.sections: List[BiquadSection] = []
        self._init_sections()

    def _init_sections(self) -> None:
        self.sections.clear()
        lp1 = design_biquad_butterworth_lowpass(self.cutoff, self.fs, self.q1)
        lp2 = design_biquad_butterworth_lowpass(self.cutoff, self.fs, self.q2)
        for c in (lp1, lp2):
            self.sections.append(BiquadSection(c.b0, c.b1, c.b2, c.a1, c.a2))

    def filter_sample(self, x: float) -> float:
        out = float(x)
        for section in self.sections:
            out = section.process(out)
        return out

    def filter_stream(self, samples: Sequence[float]) -> List[float]:
        return [self.filter_sample(s) for s in samples]

    def reset(self) -> None:
        for section in self.sections:
            section.reset()

    def frequency_response(self, freq_hz: float) -> Tuple[float, float]:
        h = 1.0 + 0j
        for section in self.sections:
            h *= section.frequency_response(freq_hz, self.fs)
        gain_linear = abs(h)
        gain_db = 20.0 * math.log10(gain_linear) if gain_linear > 1e-15 else -999.0
        return gain_linear, gain_db
