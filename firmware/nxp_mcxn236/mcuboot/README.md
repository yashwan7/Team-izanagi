# MCUboot single-application-slot configuration

The stock FRDM-MCXN236 SDK MCUboot configuration divides the 1 MiB main Flash
into two 512 KiB slots. After the 0x400-byte image header, that leaves only
523,264 bytes for an application, which is less than the verified 633,756-byte
raw ML application.

The verified solution uses the SDK's
`CONFIG_BOOT_MODE_SINGLE_APPLICATION_SLOT` mode. Apply
`sblconfig_single_slot.h` to the SDK board configuration, then make the
following corresponding source changes in the SDK board example:

1. Set the candidate application boundary to `0x00100000`.
2. Omit the `APP_SECONDARY` `flash_area` initializer in single-slot mode.
3. Make the NXP `sysflash.h` mapping expose one primary slot and no secondary
   slot when `MCUBOOT_SINGLE_APPLICATION_SLOT` is defined.
4. Keep MCUboot in IFR at `0x01008000`; do not enable the stock flash-remap
   definitions.
5. Build MCUboot with the single-slot configuration and sign the application
   with the repository's single-slot signing script.

The exact layout and rationale are documented in
`docs/mcuboot_single_slot_partition.md`. The application linker script is
`linker/mcxn236_ml_fullflash.ld`; it starts the application at `0x400` and
allows the full remaining 1 MiB main Flash region.

Single-slot mode does not provide an in-place secondary staging slot. Updates
therefore require a programmer, bootloader serial recovery, or another
explicitly supported provisioning path.
