/**
 * @file eog_dsp.hpp
 * @brief Embedded C++ DSP Module for Kshitij EOG Capsule
 * 
 * Implements:
 *   1. 4th-order IIR Butterworth Bandpass & Lowpass Filters (Biquad Direct Form II Transposed)
 *   2. Real-time Pulse Duration Blink Detector (100ms <= duration <= 400ms)
 *   3. Eye Gaze Step-Voltage Detector (LEFT, RIGHT, CENTER)
 *   4. Command Engine:
 *      - 2 blinks within 1.5s -> CALL_NURSE
 *      - 3 blinks within 1.5s -> PAIN
 *      - LEFT  + 1 blink     -> WATER
 *      - RIGHT + 1 blink     -> BATHROOM
 */

#ifndef SENSORS_EOG_DSP_HPP_
#define SENSORS_EOG_DSP_HPP_

#include <cmath>
#include <cstdint>
#include <string>
#include <vector>
#include <deque>
#include <functional>
#include <optional>

namespace kshitij::sensors::eog {

enum class GazeDirection {
    CENTER,
    LEFT,
    RIGHT
};

inline const char* gazeToString(GazeDirection dir) {
    switch (dir) {
        case GazeDirection::LEFT: return "LEFT";
        case GazeDirection::RIGHT: return "RIGHT";
        case GazeDirection::CENTER: default: return "CENTER";
    }
}

struct BlinkEvent {
    double startTime;     // in seconds
    double peakTime;      // in seconds
    double endTime;       // in seconds
    double durationMs;    // in milliseconds
    double peakAmplitude; // in microvolts
};

struct CommandEvent {
    double timestamp;     // in seconds
    std::string command;  // "CALL_NURSE", "PAIN", "WATER", "BATHROOM"
    GazeDirection gaze;
    int blinkCount;
    std::string details;
};

/**
 * @brief Direct Form II Transposed Biquad Section
 */
class BiquadSection {
public:
    double b0, b1, b2, a1, a2;
    double d1{0.0}, d2{0.0};

    BiquadSection(double b0_, double b1_, double b2_, double a1_, double a2_)
        : b0(b0_), b1(b1_), b2(b2_), a1(a1_), a2(a2_) {}

    inline double process(double x) {
        double y = b0 * x + d1;
        d1 = b1 * x - a1 * y + d2;
        d2 = b2 * x - a2 * y;
        return y;
    }

    inline void reset() {
        d1 = 0.0;
        d2 = 0.0;
    }
};

/**
 * @brief 4th-order IIR Butterworth Bandpass Filter (0.1 Hz to 10.0 Hz at Fs = 100 Hz)
 */
class ButterworthBandpassFilter {
private:
    std::vector<BiquadSection> sections;
    double lowcut;
    double highcut;
    double fs;

public:
    ButterworthBandpassFilter(double lowcut_ = 0.1, double highcut_ = 10.0, double fs_ = 100.0);

    double filterSample(double x);
    void reset();
};

/**
 * @brief 4th-order IIR Butterworth Lowpass Filter (10.0 Hz at Fs = 100 Hz)
 */
class ButterworthLowpassFilter {
private:
    std::vector<BiquadSection> sections;
    double cutoff;
    double fs;

public:
    ButterworthLowpassFilter(double cutoff_ = 10.0, double fs_ = 100.0);

    double filterSample(double x);
    void reset();
};

/**
 * @brief Blink Detector enforcing 100ms <= duration <= 400ms
 */
class BlinkDetector {
public:
    double threshold;
    double minDurationMs;
    double maxDurationMs;
    double fs;

    bool inPulse{false};
    uint64_t pulseStartIdx{0};
    uint64_t pulsePeakIdx{0};
    double pulsePeakVal{0.0};
    uint64_t currentSampleIdx{0};

    BlinkDetector(double threshold_ = 50.0, double minMs_ = 100.0, double maxMs_ = 400.0, double fs_ = 100.0);

    std::optional<BlinkEvent> processSample(double sample, double timestamp = -1.0);
    void reset();
};

/**
 * @brief Gaze Direction Detector from Horizontal Step Voltages
 */
class GazeDetector {
public:
    double gazeLeftThreshold;
    double gazeRightThreshold;
    size_t windowSize;
    double fs;

    std::deque<double> buffer;
    GazeDirection currentGaze{GazeDirection::CENTER};

    GazeDetector(double leftThresh_ = 60.0, double rightThresh_ = -60.0, size_t window_ = 5, double fs_ = 100.0);

    GazeDirection processSample(double horizontalSample);
    void reset();
};

/**
 * @brief EOG Command State Machine Engine
 */
class EOGCommandEngine {
public:
    double multiBlinkWindowS;
    double interBlinkTimeoutS;
    double fs;

    BlinkDetector blinkDetector;
    GazeDetector gazeDetector;

    std::vector<BlinkEvent> blinkHistory;
    uint64_t currentSampleIdx{0};
    std::optional<CommandEvent> lastEmittedCommand;

    using CommandCallback = std::function<void(const CommandEvent&)>;
    CommandCallback onCommandCallback;

    EOGCommandEngine(
        double multiBlinkWindowS_ = 1.5,
        double interBlinkTimeoutS_ = 0.55,
        double blinkThreshold_ = 50.0,
        double gazeLeftThresh_ = 60.0,
        double gazeRightThresh_ = -60.0,
        double fs_ = 100.0,
        CommandCallback callback = nullptr
    );

    std::optional<CommandEvent> processFrame(double verticalFiltered, double horizontalFiltered, double timestamp = -1.0);
    void reset();
};

/**
 * @brief Full Real-time DSP Pipeline
 */
class EOGDSPPipeline {
public:
    double fs;
    ButterworthBandpassFilter verticalFilter;
    ButterworthLowpassFilter horizontalFilter;
    EOGCommandEngine engine;
    uint64_t sampleCount{0};

    EOGDSPPipeline(
        double lowcut = 0.1,
        double highcut = 10.0,
        double fs_ = 100.0,
        double blinkThreshold = 50.0,
        double gazeLeftThreshold = 60.0,
        double gazeRightThreshold = -60.0
    );

    std::optional<CommandEvent> processSample(double rawVertical, double rawHorizontal, double timestamp = -1.0);
    void reset();
};

} // namespace kshitij::sensors::eog

#endif // SENSORS_EOG_DSP_HPP_
