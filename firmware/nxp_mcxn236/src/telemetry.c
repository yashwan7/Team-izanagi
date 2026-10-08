#include "telemetry.h"
#include "board_pins.h"
#include "fsl_clock.h"
#include "fsl_lpuart.h"

#define TELEMETRY_SOF 0xA5U

static uint16_t crc16_update(uint16_t crc, uint8_t value)
{
    crc ^= value;
    for (uint8_t bit = 0U; bit < 8U; ++bit) {
        crc = (crc & 1U) ? (uint16_t)((crc >> 1U) ^ 0xA001U) : (uint16_t)(crc >> 1U);
    }
    return crc;
}

static void put(uint8_t value)
{
    while ((LPUART_GetStatusFlags(GUARDIAN_UART_BASE) & kLPUART_TxDataRegEmptyFlag) == 0U) {
    }
    LPUART_WriteByte(GUARDIAN_UART_BASE, value);
}

void Guardian_TelemetryInit(void)
{
    lpuart_config_t config;
    LPUART_GetDefaultConfig(&config);
    config.baudRate_Bps = GUARDIAN_UART_BAUDRATE;
    config.enableTx = true;
    config.enableRx = true;
    (void)LPUART_Init(GUARDIAN_UART_BASE, &config, CLOCK_GetLPFlexCommClkFreq(GUARDIAN_UART_INSTANCE));
}

void Guardian_TelemetryPrint(const char *text)
{
    if (text == NULL) {
        return;
    }
    while (*text != '\0') {
        put((uint8_t)*text++);
    }
}

void Guardian_TelemetryPrintU32(uint32_t value)
{
    char digits[10];
    uint32_t count = 0U;
    do {
        digits[count++] = (char)('0' + (value % 10U));
        value /= 10U;
    } while (value != 0U && count < sizeof(digits));
    while (count != 0U) {
        put((uint8_t)digits[--count]);
    }
}

void Guardian_TelemetryPrintI32(int32_t value)
{
    if (value < 0) {
        put((uint8_t)'-');
        Guardian_TelemetryPrintU32((uint32_t)(-(value + 1)) + 1U);
    } else {
        Guardian_TelemetryPrintU32((uint32_t)value);
    }
}

bool Guardian_TelemetrySend(guardian_telemetry_type_t type, const uint8_t *payload, uint16_t length)
{
    if (length > 512U || (payload == NULL && length != 0U)) {
        return false;
    }
    uint8_t header[4] = { TELEMETRY_SOF, (uint8_t)type, (uint8_t)length, (uint8_t)(length >> 8U) };
    put(header[0]);
    put(header[1]);
    put(header[2]);
    put(header[3]);
    for (uint16_t i = 0U; i < length; ++i) {
        put(payload[i]);
    }
    uint16_t crc = 0xFFFFU;
    for (uint8_t i = 1U; i < sizeof(header); ++i) {
        crc = crc16_update(crc, header[i]);
    }
    for (uint16_t i = 0U; i < length; ++i) {
        crc = crc16_update(crc, payload[i]);
    }
    put((uint8_t)crc);
    put((uint8_t)(crc >> 8U));
    return true;
}

bool Guardian_TelemetrySendStatus(uint8_t active_bank, uint8_t update_state, uint8_t verification_state)
{
    const uint8_t status[3] = { active_bank, update_state, verification_state };
    return Guardian_TelemetrySend(GUARDIAN_TELEM_STATUS, status, sizeof(status));
}
