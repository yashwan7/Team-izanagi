#include "buzzer.h"
#include "board.h"
#include "board_pins.h"
#include "fsl_gpio.h"

void Guardian_BuzzerBeep(uint32_t frequency_hz, uint32_t duration_ms)
{
    if (frequency_hz == 0U) {
        GPIO_PinWrite(GUARDIAN_BUZZER_GPIO, GUARDIAN_BUZZER_PIN, 0U);
        Guardian_DelayMs(duration_ms);
        return;
    }

    uint32_t half_period_us = 500000U / frequency_hz;
    uint32_t cycles = (frequency_hz * duration_ms) / 1000U;
    for (uint32_t i = 0U; i < cycles * 2U; ++i) {
        uint32_t level = GPIO_PinRead(GUARDIAN_BUZZER_GPIO, GUARDIAN_BUZZER_PIN);
        GPIO_PinWrite(GUARDIAN_BUZZER_GPIO, GUARDIAN_BUZZER_PIN, level ? 0U : 1U);
        SDK_DelayAtLeastUs(half_period_us, SystemCoreClock);
    }
    GPIO_PinWrite(GUARDIAN_BUZZER_GPIO, GUARDIAN_BUZZER_PIN, 0U);
}
