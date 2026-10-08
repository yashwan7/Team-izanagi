cmake_minimum_required(VERSION 3.20)

# This is a bare-metal Cortex-M target, not a macOS executable. Set the
# platform before project() so CMake does not inject Darwin linker flags into
# the arm-none-eabi compiler probe.
set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)
project(secure_ota_guardian_mcxn236 C CXX ASM)

set(MCUX_SDK_ROOT "" CACHE PATH "Path to the extracted MCUXpresso SDK")
if(NOT MCUX_SDK_ROOT)
    message(FATAL_ERROR "Set MCUX_SDK_ROOT to the extracted MCUXpresso SDK")
endif()

if(EXISTS "${MCUX_SDK_ROOT}/mcuxsdk/devices/MCX/MCXN/MCXN236")
    # MCUXpresso SDK 26.x is delivered as separately pinned repositories by
    # the manifest. Keep these paths explicit so the project also works with
    # an SDK assembled from that manifest.
    set(MCUX_DEVICE "${MCUX_SDK_ROOT}/mcuxsdk/devices/MCX/MCXN/MCXN236")
    set(MCUX_DEVICE_PERIPH "${MCUX_DEVICE}")
    set(MCUX_DEVICE_PERIPH_SHARED "${MCUX_SDK_ROOT}/mcuxsdk/devices/MCX/MCXN/periph1")
    set(MCUX_DRIVERS "${MCUX_DEVICE}/drivers")
    set(MCUX_CMSIS "${MCUX_SDK_ROOT}/mcuxsdk/arch/arm/CMSIS/Core/Include")
    set(BOARD_EXAMPLE "${MCUX_SDK_ROOT}/examples2/_boards/frdmmcxn236")
    set(TFLM_ROOT "${MCUX_SDK_ROOT}/mcuxsdk/middleware/eiq/tensorflow-lite")
    set(MCUX_STARTUP "${MCUX_DEVICE}/gcc/startup_MCXN236.S")
    set(MCUX_COMMON_C "${MCUX_SDK_ROOT}/core/drivers/common/fsl_common.c")
    set(MCUX_COMMON_ARM_C "${MCUX_SDK_ROOT}/core/drivers/common/fsl_common_arm.c")
    set(MCUX_GPIO_C "${MCUX_SDK_ROOT}/core/drivers/gpio/fsl_gpio.c")
    set(MCUX_LPI2C_C "${MCUX_SDK_ROOT}/core/drivers/lpflexcomm/lpi2c/fsl_lpi2c.c")
    set(MCUX_LPSPI_C "${MCUX_SDK_ROOT}/core/drivers/lpflexcomm/lpspi/fsl_lpspi.c")
    set(MCUX_LPUART_C "${MCUX_SDK_ROOT}/core/drivers/lpflexcomm/lpuart/fsl_lpuart.c")
    set(MCUX_LPFLEXCOMM_C "${MCUX_SDK_ROOT}/core/drivers/lpflexcomm/fsl_lpflexcomm.c")
    set(MCUX_RESET_C "${MCUX_DEVICE}/drivers/fsl_reset.c")
    set(MCUX_SPC_C "${MCUX_SDK_ROOT}/core/drivers/mcx_spc/fsl_spc.c")
    set(MCUX_CORE_DRIVER_INCLUDES
        "${MCUX_SDK_ROOT}/core/drivers/common"
        "${MCUX_SDK_ROOT}/core/drivers/gpio"
        "${MCUX_SDK_ROOT}/core/drivers/lpflexcomm"
        "${MCUX_SDK_ROOT}/core/drivers/lpflexcomm/lpi2c"
        "${MCUX_SDK_ROOT}/core/drivers/lpflexcomm/lpspi"
        "${MCUX_SDK_ROOT}/core/drivers/lpflexcomm/lpuart"
        "${MCUX_SDK_ROOT}/core/drivers/port"
        "${MCUX_SDK_ROOT}/core/drivers/mcx_spc")
else()
    # Compatibility with the older monolithic SDK layout.
    set(MCUX_DEVICE "${MCUX_SDK_ROOT}/devices/MCXN236")
    set(MCUX_DEVICE_PERIPH "${MCUX_DEVICE}/periph1")
    set(MCUX_DEVICE_PERIPH_SHARED "${MCUX_DEVICE}/periph1")
    set(MCUX_DRIVERS "${MCUX_DEVICE}/drivers")
    set(MCUX_CMSIS "${MCUX_SDK_ROOT}/CMSIS/Core/Include")
    set(BOARD_EXAMPLE "${MCUX_SDK_ROOT}/boards/frdmmcxn236/demo_apps/led_blinky")
    set(TFLM_ROOT "${MCUX_SDK_ROOT}/middleware/eiq/tensorflow-lite")
    set(MCUX_STARTUP "${MCUX_DEVICE}/mcuxpresso/startup_mcxn236.c")
    set(MCUX_COMMON_C "${MCUX_DRIVERS}/fsl_common.c")
    set(MCUX_COMMON_ARM_C "${MCUX_DRIVERS}/fsl_common_arm.c")
    set(MCUX_GPIO_C "${MCUX_DRIVERS}/fsl_gpio.c")
    set(MCUX_LPI2C_C "${MCUX_DRIVERS}/fsl_lpi2c.c")
    set(MCUX_LPSPI_C "${MCUX_DRIVERS}/fsl_lpspi.c")
    set(MCUX_LPUART_C "${MCUX_DRIVERS}/fsl_lpuart.c")
    set(MCUX_LPFLEXCOMM_C "${MCUX_DRIVERS}/fsl_lpflexcomm.c")
    set(MCUX_RESET_C "${MCUX_DRIVERS}/fsl_reset.c")
    set(MCUX_SPC_C "${MCUX_DRIVERS}/fsl_spc.c")
    set(MCUX_CORE_DRIVER_INCLUDES "")
endif()

set(TFLM_LIBRARY "${TFLM_ROOT}/lib/cm33/armgcc/libtflm.a")
if(NOT EXISTS "${TFLM_LIBRARY}")
    message(FATAL_ERROR "MCXN236 TFLM library not found: ${TFLM_LIBRARY}")
endif()

# The original 512-KiB MCUboot application linker script is retained for OTA
# work. The ML demo uses the device's full 1-MiB internal Flash as one image;
# this is intentionally a separate build variant because the existing
# two-slot 512-KiB MCUboot contract cannot contain this 548,336-byte model.
option(GUARDIAN_ML_FULL_INTERNAL_FLASH
       "Build the ML demo against the full 1-MiB internal Flash image"
       ON)

set(APP_ORIGIN 0x00000400)
if(GUARDIAN_ML_FULL_INTERNAL_FLASH)
    set(APP_LENGTH 0x000FFC00)
    set(APP_LINKER "${CMAKE_CURRENT_SOURCE_DIR}/linker/mcxn236_ml_fullflash.ld")
else()
    set(APP_LENGTH 0x0007FC00)
    set(APP_LINKER "${CMAKE_CURRENT_SOURCE_DIR}/linker/mcxn236_mcuboot_app.ld")
endif()
set(RAM_ORIGIN 0x20000000)
set(RAM_LENGTH 0x00038000)

add_executable(${PROJECT_NAME}
    src/main.c
    src/board.c
    src/rgb_led.c
    src/lcd_i2c.c
    src/rc522.c
    src/button.c
    src/buzzer.c
    src/telemetry.c
    src/ml_preprocess.c
    src/ml_inference.cpp
    src/tflm_debug_log.cpp
    src/model_data.cc
    ${MCUX_DEVICE}/system_MCXN236.c
    ${MCUX_STARTUP}
    ${BOARD_EXAMPLE}/clock_config.c
    ${MCUX_DRIVERS}/fsl_clock.c
    ${MCUX_COMMON_C}
    ${MCUX_COMMON_ARM_C}
    ${MCUX_GPIO_C}
    ${MCUX_LPI2C_C}
    ${MCUX_LPSPI_C}
    ${MCUX_LPUART_C}
    ${MCUX_LPFLEXCOMM_C}
    ${MCUX_RESET_C}
    ${MCUX_SPC_C}
)

target_include_directories(${PROJECT_NAME} PRIVATE
    src
    config
    "${MCUX_DEVICE}"
    "${MCUX_DEVICE_PERIPH}"
    "${MCUX_DEVICE_PERIPH_SHARED}"
    "${MCUX_DRIVERS}"
    "${MCUX_CMSIS}"
    "${BOARD_EXAMPLE}"
    ${MCUX_CORE_DRIVER_INCLUDES}
    "${TFLM_ROOT}"
    "${TFLM_ROOT}/third_party/flatbuffers/include"
    "${TFLM_ROOT}/third_party/gemmlowp"
    "${TFLM_ROOT}/third_party/cmsis_nn"
    "${TFLM_ROOT}/third_party/cmsis_nn/Include"
)

target_compile_definitions(${PROJECT_NAME} PRIVATE
    CPU_MCXN236VDF
    MCXN236VDF
    __MCUXPRESSO
    FSL_SDK_ENABLE_DRIVER_CACHE_CONTROL=0
    TF_LITE_STATIC_MEMORY
    KERNELS_OPTIMIZED_FOR_SPEED
)

target_compile_options(${PROJECT_NAME} PRIVATE
    -mcpu=cortex-m33
    -mthumb
    -mfpu=fpv5-sp-d16
    -mfloat-abi=hard
    -ffunction-sections
    -fdata-sections
    -fno-common
    -Wall
    -Wextra
)

set_source_files_properties(src/ml_inference.cpp src/model_data.cc PROPERTIES
    COMPILE_OPTIONS "-fno-exceptions;-fno-rtti;-std=c++17")

# Keep the guardian sources strict, while allowing the unmodified MCUXpresso
# SDK sources to carry the warnings present in this SDK release.
set(GUARDIAN_SOURCES
    src/main.c src/board.c src/rgb_led.c src/lcd_i2c.c src/rc522.c
    src/button.c src/buzzer.c src/telemetry.c)
set_source_files_properties(${GUARDIAN_SOURCES} PROPERTIES COMPILE_OPTIONS "-Werror")

target_link_options(${PROJECT_NAME} PRIVATE
    -mcpu=cortex-m33
    -mthumb
    -mfpu=fpv5-sp-d16
    -mfloat-abi=hard
    "-T${APP_LINKER}"
    -Wl,--gc-sections
    -Wl,--print-memory-usage
    -Wl,-Map=${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}.map
    --specs=nano.specs
    --specs=nosys.specs
)

if(GUARDIAN_ML_FULL_INTERNAL_FLASH)
    # Retain the debugger-only bring-up entry used when the resident
    # MCUboot two-slot image cannot accept the full-Flash ML image.
    target_link_options(${PROJECT_NAME} PRIVATE
        -Wl,--undefined=Guardian_DebugDirectEntry)
endif()

target_link_libraries(${PROJECT_NAME} PRIVATE "${TFLM_LIBRARY}" m)

set_target_properties(${PROJECT_NAME} PROPERTIES
    OUTPUT_NAME "secure_ota_guardian_mcxn236"
    SUFFIX ".elf"
)

if(NOT CMAKE_OBJCOPY)
    find_program(CMAKE_OBJCOPY arm-none-eabi-objcopy REQUIRED)
endif()
if(NOT CMAKE_SIZE_TOOL)
    find_program(CMAKE_SIZE_TOOL arm-none-eabi-size REQUIRED)
endif()

add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:${PROJECT_NAME}> ${CMAKE_CURRENT_BINARY_DIR}/secure_ota_guardian_mcxn236.raw.bin
    COMMAND ${CMAKE_SIZE_TOOL} $<TARGET_FILE:${PROJECT_NAME}>
    COMMENT "Generating raw MCUboot application image"
)
