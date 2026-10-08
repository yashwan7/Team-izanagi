#include <cstdarg>
#include <cstddef>

/* TFLM's prebuilt NXP archive retains its debug-log entry points even when
 * the application uses its own UART diagnostics. Keep these callbacks
 * allocation-free and silent; application errors are reported explicitly by
 * ml_inference.cpp through Guardian_TelemetryPrint(). */
extern "C" void DebugLog(const char *, va_list)
{
}

extern "C" int DebugVsnprintf(char *, size_t, const char *, va_list)
{
    return 0;
}
