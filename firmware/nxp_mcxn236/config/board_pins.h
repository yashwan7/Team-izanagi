#ifndef SECURE_OTA_GUARDIAN_BOARD_PINS_H
#define SECURE_OTA_GUARDIAN_BOARD_PINS_H

#include "fsl_device_registers.h"

/* Verified FRDM-MCXN236 onboard mappings from the NXP board examples. */
#define GUARDIAN_LED_RED_GPIO       GPIO4
#define GUARDIAN_LED_RED_PIN        18U
#define GUARDIAN_LED_BLUE_GPIO      GPIO4
#define GUARDIAN_LED_BLUE_PIN       17U
#define GUARDIAN_LED_GREEN_GPIO     GPIO4
#define GUARDIAN_LED_GREEN_PIN      19U
#define GUARDIAN_BUTTON_GPIO        GPIO0
#define GUARDIAN_BUTTON_PIN         20U

/* Verified board-example peripheral routes. External device CS/RST/IRQ and
 * buzzer pins are intentionally explicit and easy to change for the wiring. */
#define GUARDIAN_LCD_I2C_BASE       LPI2C2
#define GUARDIAN_LCD_I2C_INSTANCE   2U
#define GUARDIAN_LCD_I2C_ADDRESS    0x27U

#define GUARDIAN_RC522_SPI_BASE     LPSPI3
#define GUARDIAN_RC522_SPI_INSTANCE 3U
#define GUARDIAN_RC522_CS_GPIO      GPIO0
#define GUARDIAN_RC522_CS_PIN       16U
#define GUARDIAN_RC522_RST_GPIO     GPIO0
#define GUARDIAN_RC522_RST_PIN      17U
#define GUARDIAN_RC522_IRQ_GPIO     GPIO0
#define GUARDIAN_RC522_IRQ_PIN      18U

#define GUARDIAN_BUZZER_GPIO        GPIO0
#define GUARDIAN_BUZZER_PIN         21U

#define GUARDIAN_UART_BASE          LPUART4
#define GUARDIAN_UART_INSTANCE      4U
#define GUARDIAN_UART_BAUDRATE      115200U

#endif
