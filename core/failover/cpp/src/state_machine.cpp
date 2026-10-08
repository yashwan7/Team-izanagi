#include "state_machine.hpp"
#include <numeric>
#include <algorithm>
#include <chrono>

namespace failover {

FailoverStateMachine::FailoverStateMachine(size_t window_size, double eval_interval_sec)
    : window_size_(window_size), eval_interval_sec_(eval_interval_sec) {}

FailoverStateMachine::~FailoverStateMachine() {
    stop();
}

void FailoverStateMachine::ingestSample(const DualTelemetrySample& sample) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (window_.size() >= window_size_) {
        window_.pop_front();
    }
    window_.push_back(sample);
}

std::vector<double> FailoverStateMachine::getSlidingWindow8DVector() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (window_.empty()) return std::vector<double>(8, 0.0);

    std::vector<double> sums(8, 0.0);
    for (const auto& s : window_) {
        auto v = s.to8DVector();
        for (size_t i = 0; i < 8; ++i) {
            sums[i] += v[i];
        }
    }
    for (size_t i = 0; i < 8; ++i) {
        sums[i] /= window_.size();
    }
    return sums;
}

std::pair<double, double> FailoverStateMachine::calculatePortScores(
    const std::vector<double>& lats,
    const std::vector<double>& jits,
    const std::vector<double>& losses,
    const std::vector<double>& dnss
) {
    if (lats.empty()) return {0.0, 0.0};

    double mean_lat = std::accumulate(lats.begin(), lats.end(), 0.0) / lats.size();
    double mean_jit = std::accumulate(jits.begin(), jits.end(), 0.0) / jits.size();
    double mean_loss = std::accumulate(losses.begin(), losses.end(), 0.0) / losses.size();
    double mean_dns = std::accumulate(dnss.begin(), dnss.end(), 0.0) / dnss.size();

    double norm_lat = std::min(1.0, std::max(0.0, (mean_lat - 22.0) / (220.0 - 22.0)));
    double norm_jit = std::min(1.0, std::max(0.0, (mean_jit - 3.0) / (30.0 - 3.0)));
    double norm_loss = std::min(1.0, std::max(0.0, mean_loss / 20.0));
    double norm_dns = std::min(1.0, std::max(0.0, (mean_dns - 12.0) / (100.0 - 12.0)));

    double deg_score = (0.45 * norm_loss) + (0.35 * norm_lat) + (0.10 * norm_jit) + (0.10 * norm_dns);

    size_t bad_count = 0;
    for (size_t i = 0; i < lats.size(); ++i) {
        if (losses[i] >= 25.0 || lats[i] >= 260.0) bad_count++;
    }
    double bad_ratio = static_cast<double>(bad_count) / lats.size();

    double crit_score = std::max({
        std::min(1.0, mean_loss / 45.0),
        std::min(1.0, std::max(0.0, (mean_lat - 50.0) / 350.0)),
        bad_ratio
    });

    return {std::min(1.0, std::max(0.0, deg_score)), std::min(1.0, std::max(0.0, crit_score))};
}

HealthEvaluation FailoverStateMachine::evaluateHealth() {
    std::vector<DualTelemetrySample> samples_copy;
    SystemState prev_state;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        samples_copy.assign(window_.begin(), window_.end());
        prev_state = current_state_;
    }

    HealthEvaluation eval;
    auto now = std::chrono::system_clock::now().time_since_epoch();
    eval.timestamp = std::chrono::duration<double>(now).count();
    eval.window_samples_count = samples_copy.size();

    if (samples_copy.empty()) {
        eval.state = prev_state;
        eval.active_path = active_path_;
        eval.message = "Awaiting samples";
        return eval;
    }

    std::vector<double> lat_a, jit_a, loss_a, dns_a;
    std::vector<double> lat_b, jit_b, loss_b, dns_b;

    for (const auto& s : samples_copy) {
        lat_a.push_back(s.port_a.latency_ms);
        jit_a.push_back(s.port_a.jitter_ms);
        loss_a.push_back(s.port_a.packet_loss_pct);
        dns_a.push_back(s.port_a.dns_time_ms);

        lat_b.push_back(s.port_b.latency_ms);
        jit_b.push_back(s.port_b.jitter_ms);
        loss_b.push_back(s.port_b.packet_loss_pct);
        dns_b.push_back(s.port_b.dns_time_ms);
    }

    auto [deg_a, crit_a] = calculatePortScores(lat_a, jit_a, loss_a, dns_a);
    auto [deg_b, crit_b] = calculatePortScores(lat_b, jit_b, loss_b, dns_b);

    eval.port_a_degradation_score = deg_a;
    eval.port_a_critical_score = crit_a;
    eval.port_b_degradation_score = deg_b;
    eval.port_b_critical_score = crit_b;
    eval.feature_vector_8d_mean = getSlidingWindow8DVector();

    SystemState new_state = prev_state;
    PortId new_path = active_path_;
    bool mesh_activated = false;
    std::string msg;

    bool both_critical = (crit_a > 0.50 && crit_b > 0.50) || (deg_a > 0.85 && deg_b > 0.85);

    if (both_critical) {
        new_state = SystemState.STATE_MESH_ACTIVE;
        new_path = PortId::MESH;
        mesh_activated = true;
        msg = "CRITICAL: Both Port A and Port B critical. Mesh Mode activated.";
    } else if ((deg_a > 0.85 || crit_a > 0.50) && (crit_b <= 0.50 && deg_b <= 0.85)) {
        new_state = SystemState::STATE_FAILOVER_B;
        new_path = PortId::PORT_B;
        msg = "FAILOVER: Port A failed. Routed traffic to Port B.";
    } else if (active_path_ == PortId::PORT_B && (deg_a <= 0.60 && crit_a <= 0.50)) {
        healthy_a_streak_++;
        if (healthy_a_streak_ >= 3) {
            new_state = SystemState::STATE_NORMAL;
            new_path = PortId::PORT_A;
            msg = "RECOVERY: Port A stabilized. Restored primary path.";
        } else {
            new_state = SystemState::STATE_FAILOVER_B;
            new_path = PortId::PORT_B;
            msg = "Port A recovering, remaining on Port B.";
        }
    } else if (deg_a > 0.60 && crit_a <= 0.50) {
        healthy_a_streak_ = 0;
        if (active_path_ == PortId::PORT_A) {
            new_state = SystemState::STATE_WARNING;
            new_path = PortId::PORT_A;
            msg = "WARNING: Port A degradation score > 0.60.";
        }
    } else {
        healthy_a_streak_++;
        new_state = SystemState::STATE_NORMAL;
        new_path = PortId::PORT_A;
        msg = "HEALTHY: Nominal state.";
    }

    eval.state = new_state;
    eval.active_path = new_path;
    eval.message = msg;
    eval.mesh_activated = mesh_activated;

    std::vector<Callback> warn_cbs, fail_cbs, mesh_cbs;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        current_state_ = new_state;
        active_path_ = new_path;
        warn_cbs = warning_callbacks_;
        fail_cbs = failover_callbacks_;
        mesh_cbs = mesh_callbacks_;
    }

    if (new_state == SystemState::STATE_WARNING) {
        for (auto& cb : warn_cbs) if (cb) cb(eval);
    }
    if (new_state == SystemState::STATE_FAILOVER_B && prev_state != SystemState::STATE_FAILOVER_B) {
        for (auto& cb : fail_cbs) if (cb) cb(eval);
    }
    if (mesh_activated || new_state == SystemState::STATE_MESH_ACTIVE) {
        for (auto& cb : mesh_cbs) if (cb) cb(eval);
    }

    return eval;
}

void FailoverStateMachine::registerWarningCallback(Callback cb) {
    std::lock_guard<std::mutex> lock(mutex_);
    warning_callbacks_.push_back(cb);
}

void FailoverStateMachine::registerFailoverCallback(Callback cb) {
    std::lock_guard<std::mutex> lock(mutex_);
    failover_callbacks_.push_back(cb);
}

void FailoverStateMachine::registerMeshCallback(Callback cb) {
    std::lock_guard<std::mutex> lock(mutex_);
    mesh_callbacks_.push_back(cb);
}

void FailoverStateMachine::start() {
    if (running_) return;
    running_ = true;
    worker_thread_ = std::thread(&FailoverStateMachine::evalLoop, this);
}

void FailoverStateMachine::stop() {
    running_ = false;
    if (worker_thread_.joinable()) {
        worker_thread_.join();
    }
}

void FailoverStateMachine::evalLoop() {
    while (running_) {
        evaluateHealth();
        std::this_thread::sleep_for(std::chrono::milliseconds(static_cast<int>(eval_interval_sec_ * 1000)));
    }
}

} // namespace failover
