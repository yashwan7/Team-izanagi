#ifndef SECURE_OTA_GUARDIAN_RGB_LED_H
#define SECURE_OTA_GUARDIAN_RGB_LED_H

typedef enum {
    GUARDIAN_LED_OFF = 0,
    GUARDIAN_LED_RED,
    GUARDIAN_LED_GREEN,
    GUARDIAN_LED_BLUE,
    GUARDIAN_LED_YELLOW,
} guardian_led_color_t;

void Guardian_RgbLedSet(guardian_led_color_t color);
void Guardian_RgbLedHeartbeat(void);

#endif
