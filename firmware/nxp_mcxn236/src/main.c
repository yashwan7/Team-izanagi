#include <stdint.h>

#include "app_config.h"
#include "board.h"
#include "button.h"
#include "buzzer.h"
#include "lcd_i2c.h"
#include "ml_inference.h"
#include "fsl_device_registers.h"
#include "rc522.h"
#include "rgb_led.h"
#include "telemetry.h"

extern uint32_t __data_section_table[];
extern uint32_t __data_section_table_end[];
extern uint32_t __bss_section_table[];
extern uint32_t __bss_section_table_end[];

/*
 * Bring-up entry for the full-internal-Flash image. The resident MCUboot
 * build still owns reset, but cannot accept this image because it is larger
 * than the configured 512-KiB slot. LinkServer can therefore start this
 * entry directly after halting the core, without changing the model.
 */
void Guardian_DebugDirectEntry(void)
{
    __disable_irq();

    for (uint32_t *table = __data_section_table; table < __data_section_table_end;
         table += 3U) {
        uint8_t *load = (uint8_t *)(uintptr_t)table[0];
        uint8_t *run = (uint8_t *)(uintptr_t)table[1];
        uint32_t size = table[2];
        for (uint32_t i = 0U; i < size; ++i) {
            run[i] = load[i];
        }
    }

    for (uint32_t *table = __bss_section_table; table < __bss_section_table_end;
         table += 2U) {
        uint8_t *run = (uint8_t *)(uintptr_t)table[0];
        uint32_t size = table[1];
        for (uint32_t i = 0U; i < size; ++i) {
            run[i] = 0U;
        }
    }

    Guardian_BoardInit();
    /* The resident bootloader owns the active vector table during this
       debugger-only path. Do not allow the board SysTick to fire through it. */
    SysTick->CTRL = 0U;
    Guardian_ButtonInit();
    Guardian_TelemetryInit();
    Guardian_MlRunDemo();

    for (;;) {
        __WFI();
    }
}

int main(void)
{
    /* MCUboot normally installs the application vector table before handoff.
       Keep the same invariant for a debugger-controlled direct start. */
    SCB->VTOR = 0x00000400U;
    __DSB();
    __ISB();

    Guardian_BoardInit();
    Guardian_ButtonInit();
    Guardian_TelemetryInit();

    Guardian_MlRunDemo();

    Guardian_RgbLedSet(GUARDIAN_LED_BLUE);
    bool lcd_ok = Guardian_LcdInit();
    bool rc522_ok = Guardian_Rc522Init();
    (void)Guardian_LcdWrite("OTA Guardian ready");
    Guardian_TelemetrySendStatus(0U, 0U, (uint8_t)(lcd_ok && rc522_ok));
    Guardian_BuzzerBeep(2200U, 60U);

    uint32_t last_heartbeat = Guardian_Millis();
    for (;;) {
        if (Guardian_ButtonPressed()) {
            Guardian_RgbLedSet(GUARDIAN_LED_YELLOW);
            Guardian_BuzzerBeep(1800U, 40U);
            Guardian_TelemetrySendStatus(0U, 1U, 0U);
            while (Guardian_ButtonPressed()) {
                Guardian_DelayMs(10U);
            }
        }
        if ((Guardian_Millis() - last_heartbeat) >= 1000U) {
            last_heartbeat = Guardian_Millis();
            Guardian_RgbLedHeartbeat();
            Guardian_TelemetrySendStatus(0U, 0U, (uint8_t)Guardian_Rc522Present());
        }
        Guardian_DelayMs(10U);
    }
}
