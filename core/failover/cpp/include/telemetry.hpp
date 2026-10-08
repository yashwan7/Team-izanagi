#pragma once

#include "models.hpp"
#include <functional>
#include <mutex>
#include <thread>
#include <atomic>
#include <map>
#include <vector>

namespace failover {

class TelemetryGenerator {
public:
    using SampleCallback = std::function<void(const DualTelemetrySample&)>;

    TelemetryGenerator(double interval_sec = 0.10);
    ~TelemetryGenerator();

    void addListener(SampleCallback callback);
    void injectNetworkDegradation(
        PortId port = PortId::PORT_A,
        double duration_sec = 10.0,
        double latency_spike_ms = 280.0,
        double packet_loss_spike_pct = 35.0,
        double jitter_spike_ms = 25.0,
        double dns_spike_ms = 120.0
    );
    void clearDegradation(PortId port = PortId::BOTH);

    DualTelemetrySample generateSample();
    DualTelemetrySample getLatestSample() const;

    void start();
    void stop();

private:
    void runLoop();
    PortMetric generatePortMetric(PortId port_id);
    double getCurrentTimeSec() const;

    double interval_sec_;
    std::atomic<bool> running_{false};
    std::thread worker_thread_;
    mutable std::mutex mutex_;

    DualTelemetrySample latest_sample_;
    std::vector<SampleCallback> listeners_;
    std::map<PortId, NetworkDegradationProfile> active_degradations_;
    uint64_t step_{0};
};

} // namespace failover
