#ifndef GUARDIAN_CONFIG_H
#define GUARDIAN_CONFIG_H

/* Change these three values for each demo image. MCUboot compares this
 * version from the signed image header when the image is built with imgtool. */
#define GUARDIAN_FW_VERSION_MAJOR 1U
#define GUARDIAN_FW_VERSION_MINOR 0U
#define GUARDIAN_FW_VERSION_PATCH 0U

#define GUARDIAN_FW_VERSION "1.0.0"

/* The relay pin was not present in any of the four imported projects. Keep
 * the driver disabled until the physical wire is confirmed. */
#define GUARDIAN_RELAY_PIN_CONFIRMED 0

#endif
