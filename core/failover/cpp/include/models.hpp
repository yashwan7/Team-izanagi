#pragma once

#include <string>
#include <vector>
#include <chrono>

namespace failover {

enum class PortId {
    PORT_A,  // Primary IP
    PORT_B,  // Backup Path
    BOTH,
    MESH
};

inline std::string portToString(PortId id) {
    switch (id) {
        case PortId::PORT_A: return "PORT_A";
        case PortId::PORT_B: return "PORT_B";
        case PortId::BOTH: return "BOTH";
        case PortId::MESH: return "MESH";
    }
    return "UNKNOWN";
}

enum class SystemState {
    STATE_NORMAL,       // Healthy (Green)
    STATE_WARNING,      // Degrade > 0.60 (Yellow)
    STATE_FAILOVER_B,   // Degrade > 0.85 or Crit > 0.50 (Orange)
    STATE_MESH_ACTIVE   // Both ports critical (Red)
};

inline std::string stateToString(SystemState state) {
    switch (state) {
        case SystemState::STATE_NORMAL: return "STATE_NORMAL";
        case SystemState::STATE_WARNING: return "STATE_WARNING";
        case SystemState::STATE_FAILOVER_B: return "FAILOVER_PORT_B";
        case SystemState::STATE_MESH_ACTIVE: return "MESH_ACTIVE";
    }
    return "UNKNOWN";
}

struct PortMetric {
    double latency_ms{0.0};
    double jitter_ms{0.0};
    double packet_loss_pct{0.0};
    double dns_time_ms{0.0};

    std::vector<double> toVector() const {
        return {latency_ms, jitter_ms, packet_loss_pct, dns_time_ms};
    }
};

struct DualTelemetrySample {
    double timestamp{0.0};
    PortMetric port_a;
    PortMetric port_b;

    std::vector<double> to8DVector() const {
        return {
            port_a.latency_ms, port_a.jitter_ms, port_a.packet_loss_pct, port_a.dns_time_ms,
            port_b.latency_ms, port_b.jitter_ms, port_b.packet_loss_pct, port_b.dns_time_ms
        };
    }
};

struct HealthEvaluation {
    double timestamp{0.0};
    SystemState state{SystemState::STATE_NORMAL};
    PortId active_path{PortId::PORT_A};
    double port_a_degradation_score{0.0};
    double port_a_critical_score{0.0};
    double port_b_degradation_score{0.0};
    double port_b_critical_score{0.0};
    size_t window_samples_count{0};
    std::vector<double> feature_vector_8d_mean;
    std::string message;
    bool mesh_activated{false};
};

struct NetworkDegradationProfile {
    PortId port{PortId::PORT_A};
    double latency_spike_ms{280.0};
    double packet_loss_spike_pct{35.0};
    double jitter_spike_ms{25.0};
    double dns_spike_ms{120.0};
    double duration_sec{10.0};
    double start_time{0.0};
    bool active{true};
};

} // namespace failover
