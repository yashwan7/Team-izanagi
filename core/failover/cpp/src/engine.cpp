#include "engine.hpp"

namespace failover {

FailoverEngine::FailoverEngine()
    : telemetry_(0.10), state_machine_(50, 0.50) {
    telemetry_.addListener([this](const DualTelemetrySample& sample) {
        state_machine_.ingestSample(sample);
    });
}

FailoverEngine::~FailoverEngine() {
    stop();
}

void FailoverEngine::start() {
    telemetry_.start();
    state_machine_.start();
}

void FailoverEngine::stop() {
    telemetry_.stop();
    state_machine_.stop();
}

void FailoverEngine::injectDegradation(PortId port, double duration_sec, double lat_spike, double loss_spike) {
    telemetry_.injectNetworkDegradation(port, duration_sec, lat_spike, loss_spike);
}

void FailoverEngine::clearDegradation(PortId port) {
    telemetry_.clearDegradation(port);
}

} // namespace failover
