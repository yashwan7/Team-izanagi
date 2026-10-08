#pragma once

#include "models.hpp"
#include <deque>
#include <functional>
#include <mutex>
#include <thread>
#include <atomic>
#include <vector>

namespace failover {

class FailoverStateMachine {
public:
    using Callback = std::function<void(const HealthEvaluation&)>;

    FailoverStateMachine(size_t window_size = 50, double eval_interval_sec = 0.50);
    ~FailoverStateMachine();

    void ingestSample(const DualTelemetrySample& sample);
    HealthEvaluation evaluateHealth();

    std::vector<double> getSlidingWindow8DVector() const;

    void registerWarningCallback(Callback cb);
    void registerFailoverCallback(Callback cb);
    void registerMeshCallback(Callback cb);

    void start();
    void stop();

    SystemState getCurrentState() const { return current_state_; }
    PortId getActivePath() const { return active_path_; }

private:
    void evalLoop();
    std::pair<double, double> calculatePortScores(
        const std::vector<double>& lats,
        const std::vector<double>& jits,
        const std::vector<double>& losses,
        const std::vector<double>& dnss
    );

    size_t window_size_;
    double eval_interval_sec_;
    std::deque<DualTelemetrySample> window_;
    mutable std::mutex mutex_;

    SystemState current_state_{SystemState::STATE_NORMAL};
    PortId active_path_{PortId::PORT_A};
    int healthy_a_streak_{0};

    std::atomic<bool> running_{false};
    std::thread worker_thread_;

    std::vector<Callback> warning_callbacks_;
    std::vector<Callback> failover_callbacks_;
    std::vector<Callback> mesh_callbacks_;
};

} // namespace failover
