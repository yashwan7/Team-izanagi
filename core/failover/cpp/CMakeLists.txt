cmake_minimum_required(VERSION 3.14)
project(kshitij_failover_engine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

add_library(failover_core STATIC
    src/telemetry.cpp
    src/state_machine.cpp
    src/engine.cpp
)

add_executable(failover_demo
    src/main.cpp
)

target_link_libraries(failover_demo PRIVATE failover_core)
