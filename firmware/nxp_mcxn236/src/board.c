#include "board.h"
#include "board_pins.h"
#include "clock_config.h"
#include "fsl_clock.h"
#include "fsl_gpio.h"
#include "fsl_port.h"

static volatile uint32_t s_millis;

static port_pin_config_t pin_gpio_output(void)
{
    return (port_pin_config_t){
        .pullSelect = kPORT_PullDisable,
        .pullValueSelect = kPORT_LowPullResistor,
        .slewRate = kPORT_FastSlewRate,
        .passiveFilterEnable = kPORT_PassiveFilterDisable,
        .openDrainEnable = kPORT_OpenDrainDisable,
        .driveStrength = kPORT_HighDriveStrength,
        .mux = kPORT_MuxAlt0,
        .inputBuffer = kPORT_InputBufferEnable,
        .invertInput = kPORT_InputNormal,
        .lockRegister = kPORT_UnlockRegister,
    };
}

static port_pin_config_t pin_gpio_input(void)
{
    port_pin_config_t config = pin_gpio_output();
    config.pullSelect = kPORT_PullUp;
    config.driveStrength = kPORT_LowDriveStrength;
    return config;
}

static port_pin_config_t pin_alt2(bool open_drain)
{
    port_pin_config_t config = pin_gpio_input();
    config.pullSelect = open_drain ? kPORT_PullUp : kPORT_PullDisable;
    config.openDrainEnable = open_drain ? kPORT_OpenDrainEnable : kPORT_OpenDrainDisable;
    config.mux = kPORT_MuxAlt2;
    return config;
}

static void configure_pin(PORT_Type *port, uint32_t pin, port_pin_config_t config)
{
    PORT_SetPinConfig(port, pin, &config);
}

void Guardian_BoardInit(void)
{
    BOARD_InitBootClocks();
    CLOCK_AttachClk(kFRO12M_to_FLEXCOMM2);
    CLOCK_AttachClk(kFRO12M_to_FLEXCOMM3);
    CLOCK_AttachClk(kFRO12M_to_FLEXCOMM4);

    CLOCK_EnableClock(kCLOCK_Port0);
    CLOCK_EnableClock(kCLOCK_Port1);
    CLOCK_EnableClock(kCLOCK_Port4);
    CLOCK_EnableClock(kCLOCK_Gpio0);
    CLOCK_EnableClock(kCLOCK_Gpio4);

    port_pin_config_t output = pin_gpio_output();
    configure_pin(PORT4, 17U, output);
    configure_pin(PORT4, 18U, output);
    configure_pin(PORT4, 19U, output);
    configure_pin(PORT0, GUARDIAN_RC522_CS_PIN, output);
    configure_pin(PORT0, GUARDIAN_RC522_RST_PIN, output);
    configure_pin(PORT0, GUARDIAN_BUZZER_PIN, output);
    configure_pin(PORT0, GUARDIAN_RC522_IRQ_PIN, pin_gpio_input());
    configure_pin(PORT0, GUARDIAN_BUTTON_PIN, pin_gpio_input());

    configure_pin(PORT4, 0U, pin_alt2(true));
    configure_pin(PORT4, 1U, pin_alt2(true));
    configure_pin(PORT1, 0U, pin_alt2(false));
    configure_pin(PORT1, 1U, pin_alt2(false));
    configure_pin(PORT1, 2U, pin_alt2(false));
    configure_pin(PORT1, 8U, pin_alt2(false));
    configure_pin(PORT1, 9U, pin_alt2(false));

    GPIO_PinWrite(GPIO4, 17U, 1U);
    GPIO_PinWrite(GPIO4, 18U, 1U);
    GPIO_PinWrite(GPIO4, 19U, 1U);
    GPIO_PinWrite(GUARDIAN_RC522_CS_GPIO, GUARDIAN_RC522_CS_PIN, 1U);
    GPIO_PinWrite(GUARDIAN_RC522_RST_GPIO, GUARDIAN_RC522_RST_PIN, 1U);
    GPIO_PinWrite(GUARDIAN_BUZZER_GPIO, GUARDIAN_BUZZER_PIN, 0U);

    SysTick_Config(SystemCoreClock / 1000U);
}

void SysTick_Handler(void)
{
    ++s_millis;
}

uint32_t Guardian_Millis(void)
{
    return s_millis;
}

void Guardian_DelayMs(uint32_t milliseconds)
{
    uint32_t deadline = s_millis + milliseconds;
    while ((int32_t)(deadline - s_millis) > 0) {
        __WFI();
    }
}
