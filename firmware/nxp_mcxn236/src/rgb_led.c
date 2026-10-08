#include "rgb_led.h"
#include "board_pins.h"
#include "fsl_gpio.h"

static void set(uint32_t red, uint32_t green, uint32_t blue)
{
    GPIO_PinWrite(GUARDIAN_LED_RED_GPIO, GUARDIAN_LED_RED_PIN, red ? 0U : 1U);
    GPIO_PinWrite(GUARDIAN_LED_GREEN_GPIO, GUARDIAN_LED_GREEN_PIN, green ? 0U : 1U);
    GPIO_PinWrite(GUARDIAN_LED_BLUE_GPIO, GUARDIAN_LED_BLUE_PIN, blue ? 0U : 1U);
}

void Guardian_RgbLedSet(guardian_led_color_t color)
{
    switch (color) {
    case GUARDIAN_LED_RED: set(1U, 0U, 0U); break;
    case GUARDIAN_LED_GREEN: set(0U, 1U, 0U); break;
    case GUARDIAN_LED_BLUE: set(0U, 0U, 1U); break;
    case GUARDIAN_LED_YELLOW: set(1U, 1U, 0U); break;
    default: set(0U, 0U, 0U); break;
    }
}

void Guardian_RgbLedHeartbeat(void)
{
    uint32_t level = GPIO_PinRead(GUARDIAN_LED_GREEN_GPIO, GUARDIAN_LED_GREEN_PIN);
    GPIO_PinWrite(GUARDIAN_LED_GREEN_GPIO, GUARDIAN_LED_GREEN_PIN, level ? 0U : 1U);
}
