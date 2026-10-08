#include "lcd_i2c.h"
#include "board.h"
#include "board_pins.h"
#include "fsl_clock.h"
#include "fsl_common.h"
#include "fsl_lpi2c.h"

static bool s_lcd_ready;

static status_t tx(uint8_t value)
{
    lpi2c_master_transfer_t transfer = {
        .flags = kLPI2C_TransferDefaultFlag,
        .slaveAddress = GUARDIAN_LCD_I2C_ADDRESS,
        .direction = kLPI2C_Write,
        .subaddress = 0U,
        .subaddressSize = 0U,
        .data = &value,
        .dataSize = 1U,
    };
    return LPI2C_MasterTransferBlocking(GUARDIAN_LCD_I2C_BASE, &transfer);
}

static bool write_nibble(uint8_t nibble, bool rs)
{
    uint8_t base = (uint8_t)((nibble & 0xF0U) | (rs ? 0x01U : 0U));
    return tx((uint8_t)(base | 0x04U)) == kStatus_Success &&
           tx(base) == kStatus_Success;
}

static bool command(uint8_t value)
{
    return write_nibble(value, false) && write_nibble((uint8_t)(value << 4U), false);
}

bool Guardian_LcdInit(void)
{
    lpi2c_master_config_t config;
    LPI2C_MasterGetDefaultConfig(&config);
    config.baudRate_Hz = 100000U;
    LPI2C_MasterInit(GUARDIAN_LCD_I2C_BASE, &config,
                     CLOCK_GetLPFlexCommClkFreq(GUARDIAN_LCD_I2C_INSTANCE));
    Guardian_DelayMs(40U);
    bool ok = write_nibble(0x30U, false);
    Guardian_DelayMs(5U);
    ok = write_nibble(0x30U, false) && ok;
    ok = write_nibble(0x20U, false) && ok;
    ok = command(0x28U) && ok;
    ok = command(0x0CU) && ok;
    ok = command(0x06U) && ok;
    ok = command(0x01U) && ok;
    Guardian_DelayMs(2U);
    s_lcd_ready = ok;
    return ok;
}

bool Guardian_LcdWrite(const char *text)
{
    if (!s_lcd_ready || text == NULL) {
        return false;
    }
    while (*text != '\0') {
        uint8_t value = (uint8_t)*text++;
        if (!write_nibble(value, true) || !write_nibble((uint8_t)(value << 4U), true)) {
            return false;
        }
    }
    return true;
}
