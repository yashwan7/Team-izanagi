#include "telemetry.hpp"
#include <cmath>
#include <random>
#include <algorithm>

namespace failover {

TelemetryGenerator::TelemetryGenerator(double interval_sec)
    : interval_sec_(interval_sec) {}

TelemetryGenerator::~TelemetryGenerator() {
    stop();
}

double TelemetryGenerator::getCurrentTimeSec() const {
    auto now = std::chrono::system_clock::now().time_since_epoch();
    return std::chrono::duration<double>(now).count();
}

void TelemetryGenerator::addListener(SampleCallback callback) {
    std::lock_guard<std::mutex> lock(mutex_);
    listeners_.push_back(callback);
}

void TelemetryGenerator::injectNetworkDegradation(
    PortId port,
    double duration_sec,
    double latency_spike_ms,
    double packet_loss_spike_pct,
    double jitter_spike_ms,
    double dns_spike_ms
) {
    std::lock_guard<std::mutex> lock(mutex_);
    NetworkDegradationProfile profile;
    profile.port = port;
    profile.duration_sec = duration_sec;
    profile.latency_spike_ms = latency_spike_ms;
    profile.packet_loss_spike_pct = packet_loss_spike_pct;
    profile.jitter_spike_ms = jitter_spike_ms;
    profile.dns_spike_ms = dns_spike_ms;
    profile.start_time = getCurrentTimeSec();
    profile.active = true;

    if (port == PortId::BOTH) {
        active_degradations_[PortId::PORT_A] = profile;
        active_degradations_[PortId::PORT_B] = profile;
    } else {
        active_degradations_[port] = profile;
    }
}

void TelemetryGenerator::clearDegradation(PortId port) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (port == PortId::BOTH) {
        active_degradations_.clear();
    } else {
        active_degradations_.erase(port);
    }
}

PortMetric TelemetryGenerator::generatePortMetric(PortId port_id) {
    double now = getCurrentTimeSec();
    step_++;

    auto it = active_degradations_.find(port_id);
    bool degraded = false;
    NetworkDegradationProfile deg;
    if (it != active_degradations_.end()) {
        if (it->second.duration_sec > 0 && (now - it->second.start_time) > it->second.duration_sec) {
            active_degradations_.erase(it);
        } else {
            degraded = true;
            deg = it->second;
        }
    }

    static std::mt19937 gen(1337);
    std::normal_distribution<double> d_lat(0, 1.5);
    std::normal_distribution<double> d_jit(0, 0.4);

    double wave = std::sin(step_ * 0.1) * 2.0;

    double lat = (port_id == PortId::PORT_A) ? (22.0 + wave + d_lat(gen)) : (40.0 + wave * 1.5 + d_lat(gen));
    double jit = (port_id == PortId::PORT_A) ? (2.5 + d_jit(gen)) : (5.0 + d_jit(gen));
    double loss = (port_id == PortId::PORT_A) ? 0.1 : 0.4;
    double dns = (port_id == PortId::PORT_A) ? 10.0 : 18.0;

    if (degraded) {
        lat += deg.latency_spike_ms;
        loss += deg.packet_loss_spike_pct;
        jit += deg.jitter_spike_ms;
        dns += deg.dns_spike_ms;
    }

    PortMetric m;
    m.latency_ms = std::max(1.0, lat);
    m.jitter_ms = std::max(0.2, jit);
    m.packet_loss_pct = std::min(100.0, std::max(0.0, loss));
    m.dns_time_ms = std::max(1.0, dns);
    return m;
}

DualTelemetrySample TelemetryGenerator::generateSample() {
    DualTelemetrySample sample;
    std::vector<SampleCallback> listeners_copy;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        sample.timestamp = getCurrentTimeSec();
        sample.port_a = generatePortMetric(PortId::PORT_A);
        sample.port_b = generatePortMetric(PortId::PORT_B);
        latest_sample_ = sample;
        listeners_copy = listeners_;
    }

    for (const auto& cb : listeners_copy) {
        if (cb) cb(sample);
    }

    return sample;
}

DualTelemetrySample TelemetryGenerator::getLatestSample() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return latest_sample_;
}

void TelemetryGenerator::start() {
    if (running_) return;
    running_ = true;
    worker_thread_ = std::thread(&TelemetryGenerator::runLoop, this);
}

void TelemetryGenerator::stop() {
    running_ = false;
    if (worker_thread_.joinable()) {
        worker_thread_.join();
    }
}

void TelemetryGenerator::runLoop() {
    while (running_) {
        generateSample();
        std::this_thread::sleep_for(std::chrono::milliseconds(static_cast<int>(interval_sec_ * 1000)));
    }
}

} // namespace failover
