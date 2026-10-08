#ifndef SECURE_OTA_GUARDIAN_RC522_H
#define SECURE_OTA_GUARDIAN_RC522_H

#include <stdbool.h>
#include <stdint.h>

bool Guardian_Rc522Init(void);
uint8_t Guardian_Rc522ReadVersion(void);
bool Guardian_Rc522Present(void);

#endif
