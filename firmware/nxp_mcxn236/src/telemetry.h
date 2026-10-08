#ifndef SECURE_OTA_GUARDIAN_TELEMETRY_H
#define SECURE_OTA_GUARDIAN_TELEMETRY_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    GUARDIAN_TELEM_STATUS = 0x01,
    GUARDIAN_TELEM_LOG = 0x02,
    GUARDIAN_TELEM_UPDATE_REQUEST = 0x10,
} guardian_telemetry_type_t;

void Guardian_TelemetryInit(void);
void Guardian_TelemetryPrint(const char *text);
void Guardian_TelemetryPrintU32(uint32_t value);
void Guardian_TelemetryPrintI32(int32_t value);
bool Guardian_TelemetrySend(guardian_telemetry_type_t type, const uint8_t *payload, uint16_t length);
bool Guardian_TelemetrySendStatus(uint8_t active_bank, uint8_t update_state, uint8_t verification_state);

#ifdef __cplusplus
}
#endif

#endif
