# MCXN236 MCUboot single-slot layout

The stock FRDM-MCXN236 MCUboot example uses two equal 512 KiB slots:

- primary: `0x00000000`–`0x0007FFFF`
- secondary: `0x00080000`–`0x000FFFFF`
- MCUboot IFR: `0x01008000`–`0x0100FFFF`

With the 0x400-byte image header, the stock primary image capacity is
`0x80000 - 0x400 = 523264` bytes. The verified ML application is 633756
bytes, so two slots cannot fit in the 1 MiB main Flash.

The supported internal-Flash solution is `CONFIG_BOOT_MODE_SINGLE_APPLICATION_SLOT`:

- primary application area: `0x00000000`–`0x000FFFFF` (1 MiB)
- application vector table: `0x00000400`
- MCUboot remains in IFR at `0x01008000`
- on-chip erase sector: 8192 bytes, so `CONFIG_MCUBOOT_MAX_IMG_SECTORS=128`
- no secondary slot and no flash-remap/swap configuration

The NXP SDK MCUboot port requires the following corresponding source changes:

1. In the FRDM-MCXN236 `sblconfig.h`, select
   `CONFIG_BOOT_MODE_SINGLE_APPLICATION_SLOT`, remove the flash-remap defines,
   and set `CONFIG_MCUBOOT_MAX_IMG_SECTORS` to 128.
2. Set `BOOT_FLASH_CAND_APP` to `0x00100000` and omit the secondary
   `flash_area` initializer when single-slot mode is selected.
3. In NXP `sysflash.h`, map one primary slot and no secondary slot when
   `MCUBOOT_SINGLE_APPLICATION_SLOT` is defined.
4. Sign with a 0x100000 slot, 0x400 header, 16-byte alignment, 128 maximum
   sectors, `--pad-header`, `--pad`, and `--confirm` for the initial image.

The model payload is not regenerated or changed by this layout. The signed
image contains the existing raw application byte-for-byte at offset `0x400`.
