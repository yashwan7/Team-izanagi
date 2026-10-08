/**
 * @file eog_dsp.cpp
 * @brief Embedded C++ DSP Module Implementation for Kshitij EOG Capsule
 */

#include "eog_dsp.hpp"
#include <numeric>

namespace kshitij::sensors::eog {

static constexpr double PI = 3.14159265358979323846;

static BiquadSection designLowpassBiquad(double fc, double fs, double q) {
    double w0 = 2.0 * PI * fc / fs;
    double alpha = std::sin(w0) / (2.0 * q);
    double cos_w0 = std::cos(w0);

    double b0 = (1.0 - cos_w0) / 2.0;
    double b1 = 1.0 - cos_w0;
    double b2 = (1.0 - cos_w0) / 2.0;
    double a0 = 1.0 + alpha;
    double a1 = -2.0 * cos_w0;
    double a2 = 1.0 - alpha;

    return BiquadSection(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

static BiquadSection designHighpassBiquad(double fc, double fs, double q) {
    double w0 = 2.0 * PI * fc / fs;
    double alpha = std::sin(w0) / (2.0 * q);
    double cos_w0 = std::cos(w0);

    double b0 = (1.0 + cos_w0) / 2.0;
    double b1 = -(1.0 + cos_w0);
    double b2 = (1.0 + cos_w0) / 2.0;
    double a0 = 1.0 + alpha;
    double a1 = -2.0 * cos_w0;
    double a2 = 1.0 - alpha;

    return BiquadSection(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

// ============================================================================
// ButterworthBandpassFilter
// ============================================================================
ButterworthBandpassFilter::ButterworthBandpassFilter(double lowcut_, double highcut_, double fs_)
    : lowcut(lowcut_), highcut(highcut_), fs(fs_) {
    double q1 = 1.0 / (2.0 * std::cos(PI / 8.0));
    double q2 = 1.0 / (2.0 * std::cos(3.0 * PI / 8.0));

    sections.push_back(designHighpassBiquad(lowcut, fs, q1));
    sections.push_back(designHighpassBiquad(lowcut, fs, q2));
    sections.push_back(designLowpassBiquad(highcut, fs, q1));
    sections.push_back(designLowpassBiquad(highcut, fs, q2));
}

double ButterworthBandpassFilter::filterSample(double x) {
    double out = x;
    for (auto& s : sections) {
        out = s.process(out);
    }
    return out;
}

void ButterworthBandpassFilter::reset() {
    for (auto& s : sections) {
        s.reset();
    }
}

// ============================================================================
// ButterworthLowpassFilter
// ============================================================================
ButterworthLowpassFilter::ButterworthLowpassFilter(double cutoff_, double fs_)
    : cutoff(cutoff_), fs(fs_) {
    double q1 = 1.0 / (2.0 * std::cos(PI / 8.0));
    double q2 = 1.0 / (2.0 * std::cos(3.0 * PI / 8.0));

    sections.push_back(designLowpassBiquad(cutoff, fs, q1));
    sections.push_back(designLowpassBiquad(cutoff, fs, q2));
}

double ButterworthLowpassFilter::filterSample(double x) {
    double out = x;
    for (auto& s : sections) {
        out = s.process(out);
    }
    return out;
}

void ButterworthLowpassFilter::reset() {
    for (auto& s : sections) {
        s.reset();
    }
}

// ============================================================================
// BlinkDetector
// ============================================================================
BlinkDetector::BlinkDetector(double threshold_, double minMs_, double maxMs_, double fs_)
    : threshold(threshold_), minDurationMs(minMs_), maxDurationMs(maxMs_), fs(fs_) {}

std::optional<BlinkEvent> BlinkDetector::processSample(double sample, double timestamp) {
    double t = (timestamp >= 0.0) ? timestamp : (static_cast<double>(currentSampleIdx) / fs);
    std::optional<BlinkEvent> result = std::nullopt;

    if (!inPulse) {
        if (sample >= threshold) {
            inPulse = true;
            pulseStartIdx = currentSampleIdx;
            pulsePeakIdx = currentSampleIdx;
            pulsePeakVal = sample;
        }
    } else {
        if (sample > pulsePeakVal) {
            pulsePeakVal = sample;
            pulsePeakIdx = currentSampleIdx;
        }

        if (sample < (threshold * 0.5)) {
            inPulse = false;
            double durationSamples = static_cast<double>(currentSampleIdx - pulseStartIdx);
            double durationMs = (durationSamples / fs) * 1000.0;

            if (durationMs >= minDurationMs && durationMs <= maxDurationMs) {
                result = BlinkEvent{
                    static_cast<double>(pulseStartIdx) / fs,
                    static_cast<double>(pulsePeakIdx) / fs,
                    static_cast<double>(currentSampleIdx) / fs,
                    durationMs,
                    pulsePeakVal
                };
            }
        }
    }

    currentSampleIdx++;
    return result;
}

void BlinkDetector::reset() {
    inPulse = false;
    pulseStartIdx = 0;
    pulsePeakIdx = 0;
    pulsePeakVal = 0.0;
    currentSampleIdx = 0;
}

// ============================================================================
// GazeDetector
// ============================================================================
GazeDetector::GazeDetector(double leftThresh_, double rightThresh_, size_t window_, double fs_)
    : gazeLeftThreshold(leftThresh_), gazeRightThreshold(rightThresh_), windowSize(window_), fs(fs_) {}

GazeDirection GazeDetector::processSample(double horizontalSample) {
    buffer.push_back(horizontalSample);
    if (buffer.size() > windowSize) {
        buffer.pop_front();
    }

    double avg = std::accumulate(buffer.begin(), buffer.end(), 0.0) / static_cast<double>(buffer.size());

    if (avg >= gazeLeftThreshold) {
        currentGaze = GazeDirection::LEFT;
    } else if (avg <= gazeRightThreshold) {
        currentGaze = GazeDirection::RIGHT;
    } else {
        currentGaze = GazeDirection::CENTER;
    }
    return currentGaze;
}

void GazeDetector::reset() {
    buffer.clear();
    currentGaze = GazeDirection::CENTER;
}

// ============================================================================
// EOGCommandEngine
// ============================================================================
EOGCommandEngine::EOGCommandEngine(
    double multiBlinkWindowS_,
    double interBlinkTimeoutS_,
    double blinkThreshold_,
    double gazeLeftThresh_,
    double gazeRightThresh_,
    double fs_,
    CommandCallback callback
)
    : multiBlinkWindowS(multiBlinkWindowS_),
      interBlinkTimeoutS(interBlinkTimeoutS_),
      fs(fs_),
      blinkDetector(blinkThreshold_, 100.0, 400.0, fs_),
      gazeDetector(gazeLeftThresh_, gazeRightThresh_, 5, fs_),
      onCommandCallback(callback) {}

std::optional<CommandEvent> EOGCommandEngine::processFrame(double verticalFiltered, double horizontalFiltered, double timestamp) {
    double t = (timestamp >= 0.0) ? timestamp : (static_cast<double>(currentSampleIdx) / fs);
    currentSampleIdx++;

    GazeDirection gaze = gazeDetector.processSample(horizontalFiltered);
    auto blinkOpt = blinkDetector.processSample(verticalFiltered, t);

    std::optional<CommandEvent> cmd = std::nullopt;

    if (blinkOpt.has_value()) {
        const auto& blink = blinkOpt.value();

        // Prune older than 1.5s
        std::vector<BlinkEvent> fresh;
        for (const auto& b : blinkHistory) {
            if ((blink.endTime - b.startTime) <= multiBlinkWindowS) {
                fresh.push_back(b);
            }
        }
        fresh.push_back(blink);
        blinkHistory = std::move(fresh);

        size_t count = blinkHistory.size();

        if (count == 1) {
            if (gaze == GazeDirection::LEFT) {
                cmd = CommandEvent{t, "WATER", GazeDirection::LEFT, 1, "Gaze LEFT + 1 blink"};
                blinkHistory.clear();
            } else if (gaze == GazeDirection::RIGHT) {
                cmd = CommandEvent{t, "BATHROOM", GazeDirection::RIGHT, 1, "Gaze RIGHT + 1 blink"};
                blinkHistory.clear();
            }
        } else if (count >= 3) {
            cmd = CommandEvent{t, "PAIN", GazeDirection::CENTER, 3, "3 blinks within window"};
            blinkHistory.clear();
        }
    }

    if (!cmd.has_value() && blinkHistory.size() == 2) {
        double timeSinceLast = t - blinkHistory.back().endTime;
        double totalSpan = t - blinkHistory.front().startTime;

        if (timeSinceLast >= interBlinkTimeoutS || totalSpan >= multiBlinkWindowS) {
            cmd = CommandEvent{t, "CALL_NURSE", GazeDirection::CENTER, 2, "2 blinks within 1.5s confirmed"};
            blinkHistory.clear();
        }
    }

    if (cmd.has_value()) {
        lastEmittedCommand = cmd;
        if (onCommandCallback) {
            onCommandCallback(cmd.value());
        }
    }

    return cmd;
}

void EOGCommandEngine::reset() {
    blinkDetector.reset();
    gazeDetector.reset();
    blinkHistory.clear();
    currentSampleIdx = 0;
    lastEmittedCommand = std::nullopt;
}

// ============================================================================
// EOGDSPPipeline
// ============================================================================
EOGDSPPipeline::EOGDSPPipeline(
    double lowcut,
    double highcut,
    double fs_,
    double blinkThreshold,
    double gazeLeftThreshold,
    double gazeRightThreshold
)
    : fs(fs_),
      verticalFilter(lowcut, highcut, fs_),
      horizontalFilter(highcut, fs_),
      engine(1.5, 0.55, blinkThreshold, gazeLeftThreshold, gazeRightThreshold, fs_) {}

std::optional<CommandEvent> EOGDSPPipeline::processSample(double rawVertical, double rawHorizontal, double timestamp) {
    double t = (timestamp >= 0.0) ? timestamp : (static_cast<double>(sampleCount) / fs);
    sampleCount++;

    double filtV = verticalFilter.filterSample(rawVertical);
    double filtH = horizontalFilter.filterSample(rawHorizontal);

    return engine.processFrame(filtV, filtH, t);
}

void EOGDSPPipeline::reset() {
    verticalFilter.reset();
    horizontalFilter.reset();
    engine.reset();
    sampleCount = 0;
}

} // namespace kshitij::sensors::eog
