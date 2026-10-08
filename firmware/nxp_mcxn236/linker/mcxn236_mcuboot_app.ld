/*
 * Secure OTA Guardian application image linker script.
 *
 * MCUboot owns the first 0x400 bytes of the primary slot. The application
 * vector table therefore begins at 0x00000400 and occupies at most 0x7FC00
 * bytes before the 512 KiB slot boundary.
 */

ENTRY(ResetISR)

MEMORY
{
    PROGRAM_FLASH (rx) : ORIGIN = 0x00000400, LENGTH = 0x0007FC00
    Ram0          (rwx) : ORIGIN = 0x20000000, LENGTH = 0x00038000
}

SECTIONS
{
    .text : ALIGN(4)
    {
        FILL(0xff)
        __vectors_start__ = ABSOLUTE(.);
        KEEP(*(.isr_vector))
        . = ALIGN(4);
        __section_table_start = .;
        __data_section_table = .;
        LONG(LOADADDR(.data));
        LONG(ADDR(.data));
        LONG(SIZEOF(.data));
        __data_section_table_end = .;
        __bss_section_table = .;
        LONG(ADDR(.bss));
        LONG(SIZEOF(.bss));
        __bss_section_table_end = .;
        __section_table_end = .;
        *(.after_vectors*)
        *(.text*)
        *(.rodata .rodata.* .constdata .constdata.*)
        . = ALIGN(4);
    } > PROGRAM_FLASH

    .ARM.extab : ALIGN(4)
    {
        *(.ARM.extab* .gnu.linkonce.armextab.*)
    } > PROGRAM_FLASH

    .ARM.exidx : ALIGN(4)
    {
        __exidx_start = .;
        *(.ARM.exidx* .gnu.linkonce.armexidx.*)
        __exidx_end = .;
    } > PROGRAM_FLASH

    _etext = .;

    .data : ALIGN(4)
    {
        _data = .;
        PROVIDE(__start_data_RAM = .);
        PROVIDE(__start_data_Ram0 = .);
        *(vtable)
        *(.data*)
        *(.ramfunc*)
        . = ALIGN(4);
        _edata = .;
        PROVIDE(__end_data_RAM = .);
        PROVIDE(__end_data_Ram0 = .);
    } > Ram0 AT>PROGRAM_FLASH

    .bss (NOLOAD) : ALIGN(4)
    {
        _bss = .;
        PROVIDE(__start_bss_RAM = .);
        PROVIDE(__start_bss_Ram0 = .);
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
        PROVIDE(__end_bss_RAM = .);
        PROVIDE(__end_bss_Ram0 = .);
        PROVIDE(end = .);
    } > Ram0

    .noinit (NOLOAD) : ALIGN(4)
    {
        _noinit = .;
        *(.noinit*)
        . = ALIGN(4);
        _end_noinit = .;
    } > Ram0

    .heap (NOLOAD) : ALIGN(8)
    {
        _pvHeapStart = .;
        . += 0x00004000;
        _pvHeapLimit = .;
    } > Ram0

    .stack (ORIGIN(Ram0) + LENGTH(Ram0) - 0x00002000) (NOLOAD) : ALIGN(8)
    {
        /* Keep the initial MSP at the top of the verified 224 KiB SRAM. */
        _vStackBase = .;
        . += 0x00002000;
        _vStackTop = .;
    } > Ram0

    ASSERT(__vectors_start__ == 0x00000400, "Application vector table must remain at 0x400")
    ASSERT(ORIGIN(PROGRAM_FLASH) + LENGTH(PROGRAM_FLASH) <= 0x00080000, "Application exceeds primary MCUboot slot")
}
