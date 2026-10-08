/*
 * Full-internal-Flash ML demo image.
 *
 * This is deliberately separate from mcxn236_mcuboot_app.ld. The MCXN236
 * has 1 MiB of program Flash, but the existing MCUboot configuration divides
 * it into two 512-KiB OTA slots. A 548,336-byte TFLite model cannot fit in
 * either slot, so this image uses the full Flash as one directly addressable
 * application image. The existing signed dual-slot OTA linker contract is
 * not changed by this file.
 */

ENTRY(Reset_Handler)

MEMORY
{
    PROGRAM_FLASH (rx) : ORIGIN = 0x00000400, LENGTH = 0x000FFC00
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
        KEEP(*(.init))
        KEEP(*(.fini))
        . = ALIGN(4);
    } > PROGRAM_FLASH

    .preinit_array : ALIGN(4)
    {
        PROVIDE_HIDDEN(__preinit_array_start = .);
        KEEP(*(.preinit_array*))
        PROVIDE_HIDDEN(__preinit_array_end = .);
    } > PROGRAM_FLASH

    .init_array : ALIGN(4)
    {
        PROVIDE_HIDDEN(__init_array_start = .);
        KEEP(*(SORT(.init_array.*)))
        KEEP(*(.init_array*))
        PROVIDE_HIDDEN(__init_array_end = .);
    } > PROGRAM_FLASH

    .fini_array : ALIGN(4)
    {
        PROVIDE_HIDDEN(__fini_array_start = .);
        KEEP(*(SORT(.fini_array.*)))
        KEEP(*(.fini_array*))
        PROVIDE_HIDDEN(__fini_array_end = .);
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
        _vStackBase = .;
        . += 0x00002000;
        _vStackTop = .;
    } > Ram0

    /* Symbols expected by the MCUXpresso CMSIS startup file. */
    PROVIDE(__StackLimit = _vStackBase);
    PROVIDE(__StackTop = _vStackTop);
    /* MCUXpresso's nano/newlib startup checks __stack before using its
       fallback stack address. Keep it consistent with the vector table. */
    PROVIDE(__stack = __StackTop);
    PROVIDE(__HeapBase = _pvHeapStart);
    PROVIDE(__HeapLimit = _pvHeapLimit);
    PROVIDE(__heap_limit = _pvHeapLimit);
    PROVIDE(__etext = _etext);
    PROVIDE(__data_start__ = _data);
    PROVIDE(__data_end__ = _edata);
    PROVIDE(__bss_start__ = _bss);
    PROVIDE(__bss_end__ = _ebss);
    PROVIDE(g_pfnVectors = __vectors_start__);
    PROVIDE(__Vectors = __vectors_start__);

    ASSERT(__vectors_start__ == 0x00000400, "Application vector table must remain at 0x400")
    ASSERT(ORIGIN(PROGRAM_FLASH) + LENGTH(PROGRAM_FLASH) <= 0x00100000, "Application exceeds MCXN236 1-MiB internal Flash")
}
