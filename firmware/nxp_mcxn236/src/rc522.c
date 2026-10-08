#include "rc522.h"
#include "board.h"
#include "board_pins.h"
#include "fsl_clock.h"
#include "fsl_gpio.h"
#include "fsl_lpspi.h"

#define RC522_VERSION_REG 0x37U

static bool s_present;

static uint8_t transfer(uint8_t tx_byte)
{
    uint8_t rx_byte = 0U;
    lpspi_transfer_t transfer = {
        .txData = &tx_byte,
        .rxData = &rx_byte,
        .dataSize = 1U,
        .configFlags = kLPSPI_MasterPcs0,
    };
    (void)LPSPI_MasterTransferBlocking(GUARDIAN_RC522_SPI_BASE, &transfer);
    return rx_byte;
}

static uint8_t read_register(uint8_t reg)
{
    GPIO_PinWrite(GUARDIAN_RC522_CS_GPIO, GUARDIAN_RC522_CS_PIN, 0U);
    (void)transfer((uint8_t)(((reg << 1U) & 0x7EU) | 0x80U));
    uint8_t value = transfer(0U);
    GPIO_PinWrite(GUARDIAN_RC522_CS_GPIO, GUARDIAN_RC522_CS_PIN, 1U);
    return value;
}

bool Guardian_Rc522Init(void)
{
    lpspi_master_config_t config;
    LPSPI_MasterGetDefaultConfig(&config);
    config.baudRate = 1000000U;
    config.whichPcs = kLPSPI_Pcs0;
    config.pcsFunc = kLPSPI_PcsAsCs;
    LPSPI_MasterInit(GUARDIAN_RC522_SPI_BASE, &config,
                     CLOCK_GetLPFlexCommClkFreq(GUARDIAN_RC522_SPI_INSTANCE));

    GPIO_PinWrite(GUARDIAN_RC522_RST_GPIO, GUARDIAN_RC522_RST_PIN, 0U);
    Guardian_DelayMs(10U);
    GPIO_PinWrite(GUARDIAN_RC522_RST_GPIO, GUARDIAN_RC522_RST_PIN, 1U);
    Guardian_DelayMs(50U);
    uint8_t version = Guardian_Rc522ReadVersion();
    s_present = version != 0x00U && version != 0xFFU;
    return s_present;
}

uint8_t Guardian_Rc522ReadVersion(void)
{
    return read_register(RC522_VERSION_REG);
}

bool Guardian_Rc522Present(void)
{
    return s_present;
}
