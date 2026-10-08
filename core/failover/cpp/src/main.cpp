#include "engine.hpp"
#include <iostream>
#include <thread>
#include <chrono>

int main() {
    std::cout << "=== Kshitij C++ Dual-Port Failover Engine ===" << std::endl;
    failover::FailoverEngine engine;

    engine.getStateMachine().registerWarningCallback([](const failover::HealthEvaluation& eval) {
        std::cout << "[CALLBACK] STATE_WARNING triggered! Degradation Score: "
                  << eval.port_a_degradation_score << std::endl;
    });

    engine.getStateMachine().registerFailoverCallback([](const failover::HealthEvaluation& eval) {
        std::cout << "[CALLBACK] FAILOVER_PORT_B executed! Path switched to: "
                  << failover::portToString(eval.active_path) << std::endl;
    });

    engine.getStateMachine().registerMeshCallback([](const failover::HealthEvaluation& eval) {
        std::cout << "[CALLBACK] MESH_ACTIVE triggered! Both ports critical." << std::endl;
    });

    engine.start();
    std::cout << "Engine running. Baseline nominal for 2 seconds..." << std::endl;
    std::this_thread::sleep_for(std::chrono::seconds(2));

    std::cout << "\n>>> Simulating Port A degradation..." << std::endl;
    engine.injectDegradation(failover::PortId::PORT_A, 5.0, 300.0, 40.0);

    std::this_thread::sleep_for(std::chrono::seconds(6));

    std::cout << "\n>>> Stopping engine." << std::endl;
    engine.stop();
    return 0;
}
