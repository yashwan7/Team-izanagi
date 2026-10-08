#ifndef SECURE_OTA_GUARDIAN_LCD_I2C_H
#define SECURE_OTA_GUARDIAN_LCD_I2C_H

#include <stdbool.h>

bool Guardian_LcdInit(void);
bool Guardian_LcdWrite(const char *text);

#endif
