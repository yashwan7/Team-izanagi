/*
 * MCXN236 MCUboot configuration fragment used by the verified deployment.
 * Apply these settings to the MCUXpresso SDK board file:
 * examples2/_boards/frdmmcxn236/ota_examples/mcuboot_opensource/sblconfig.h
 *
 * This repository intentionally does not vendor the MCUXpresso SDK or a
 * private signing key.
 */

/* Replace the stock dual-slot/remap mode with one primary application slot. */
#define CONFIG_BOOT_MODE_SINGLE_APPLICATION_SLOT

/* 1 MiB / 8 KiB erase sectors; reserve the full 128-sector image table. */
#define CONFIG_MCUBOOT_MAX_IMG_SECTORS 128

/* Remove these stock dual-slot/remap definitions from the board file: */
/* #define CONFIG_MCUBOOT_FLASH_REMAP_BY_SWAP */
/* #define CONFIG_BOOT_MODE_FLASH_REMAP */
