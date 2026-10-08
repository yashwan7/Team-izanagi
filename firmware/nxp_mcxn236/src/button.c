#include "button.h"
#include "board_pins.h"
#include "fsl_gpio.h"

void Guardian_ButtonInit(void)
{
    /* Pin mux and pull-up are configured by Guardian_BoardInit. */
}

bool Guardian_ButtonPressed(void)
{
    return GPIO_PinRead(GUARDIAN_BUTTON_GPIO, GUARDIAN_BUTTON_PIN) == 0U;
}
