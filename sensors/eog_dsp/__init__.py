"""
sensors/eog_dsp package
=======================
EOG (Electrooculography) Biopotential Digital Signal Processing and Command Engine.
Designed for Kshitij capsule assistive bio-interface.
"""

from .filter import (
    BiquadCoeffs,
    BiquadSection,
    ButterworthBandpassFilter,
    design_biquad_butterworth_highpass,
    design_biquad_butterworth_lowpass,
)
from .detector import (
    BlinkDetector,
    BlinkEvent,
    CommandEvent,
    EOGCommandEngine,
    GazeDetector,
    GazeDirection,
)
from .pipeline import EOGDSPPipeline, ProcessedFrame
from .simulator import EOGSample, EOGSimulator

__all__ = [
    "ButterworthBandpassFilter",
    "BiquadSection",
    "BiquadCoeffs",
    "design_biquad_butterworth_lowpass",
    "design_biquad_butterworth_highpass",
    "BlinkDetector",
    "BlinkEvent",
    "GazeDetector",
    "GazeDirection",
    "CommandEvent",
    "EOGCommandEngine",
    "EOGDSPPipeline",
    "ProcessedFrame",
    "EOGSimulator",
    "EOGSample",
]
