#ifndef SECURE_OTA_GUARDIAN_BOARD_H
#define SECURE_OTA_GUARDIAN_BOARD_H

#include <stdint.h>

void Guardian_BoardInit(void);
uint32_t Guardian_Millis(void);
void Guardian_DelayMs(uint32_t milliseconds);

#endif
