#pragma once

#include "telemetry.hpp"
#include "state_machine.hpp"
#include <memory>

namespace failover {

class FailoverEngine {
public:
    FailoverEngine();
    ~FailoverEngine();

    void start();
    void stop();

    void injectDegradation(PortId port, double duration_sec, double lat_spike, double loss_spike);
    void clearDegradation(PortId port = PortId::BOTH);

    TelemetryGenerator& getTelemetry() { return telemetry_; }
    FailoverStateMachine& getStateMachine() { return state_machine_; }

private:
    TelemetryGenerator telemetry_;
    FailoverStateMachine state_machine_;
};

} // namespace failover
