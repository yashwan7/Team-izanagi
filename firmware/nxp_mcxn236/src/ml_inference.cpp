#include "ml_inference.h"

#include <stdint.h>

#include "board.h"
#include "fsl_device_registers.h"
#include "model_data.h"
#include "telemetry.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/schema/schema_generated.h"

namespace {

constexpr size_t kTensorArenaSize = 32U * 1024U;
alignas(16) uint8_t g_tensor_arena[kTensorArenaSize];

constexpr int8_t kDemoInput[22] = {
    59, 70, 69, 71, 68, 73, 70, 70, 74, 88, 71,
    94, 81, 75, 68, 86, 98, 71, 87, 75, 74, 74};

const char *class_name(int index)
{
    static const char *const names[] = {"CRITICAL", "DEGRADING", "HEALTHY"};
    return (index >= 0 && index < 3) ? names[index] : "UNKNOWN";
}

uint32_t start_cycles()
{
    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
    DWT->CYCCNT = 0U;
    DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
    return DWT->CYCCNT;
}

}  // namespace

extern "C" void Guardian_MlRunDemo(void)
{
    Guardian_TelemetryPrint("[ML] INT8 TFLM demo start\r\n");

    const tflite::Model *model = tflite::GetModel(g_nirantara_model);
    if (model == nullptr || model->version() != TFLITE_SCHEMA_VERSION) {
        Guardian_TelemetryPrint("[ML] model/schema error\r\n");
        return;
    }

    tflite::MicroMutableOpResolver<2> resolver;
    if (resolver.AddFullyConnected() != kTfLiteOk || resolver.AddSoftmax() != kTfLiteOk) {
        Guardian_TelemetryPrint("[ML] resolver error\r\n");
        return;
    }

    tflite::MicroInterpreter interpreter(model, resolver, g_tensor_arena,
                                         kTensorArenaSize);
    if (interpreter.AllocateTensors() != kTfLiteOk) {
        Guardian_TelemetryPrint("[ML] tensor allocation error\r\n");
        return;
    }

    TfLiteTensor *input = interpreter.input(0);
    TfLiteTensor *output = interpreter.output(0);
    if (input == nullptr || output == nullptr || input->type != kTfLiteInt8 ||
        output->type != kTfLiteInt8 || input->bytes != sizeof(kDemoInput) ||
        output->bytes != 3U) {
        Guardian_TelemetryPrint("[ML] tensor interface error\r\n");
        return;
    }

    for (size_t i = 0U; i < sizeof(kDemoInput); ++i) {
        input->data.int8[i] = kDemoInput[i];
    }

    uint32_t before = start_cycles();
    if (interpreter.Invoke() != kTfLiteOk) {
        Guardian_TelemetryPrint("[ML] invoke error\r\n");
        return;
    }
    uint32_t cycles = DWT->CYCCNT - before;

    int best_index = 0;
    for (int i = 1; i < 3; ++i) {
        if (output->data.int8[i] > output->data.int8[best_index]) {
            best_index = i;
        }
    }

    Guardian_TelemetryPrint("[ML] class=");
    Guardian_TelemetryPrint(class_name(best_index));
    Guardian_TelemetryPrint(" arena=");
    Guardian_TelemetryPrintU32((uint32_t)interpreter.arena_used_bytes());
    Guardian_TelemetryPrint(" bytes output_int8=[");
    for (int i = 0; i < 3; ++i) {
        if (i != 0) {
            Guardian_TelemetryPrint(",");
        }
        Guardian_TelemetryPrintI32(output->data.int8[i]);
    }
    Guardian_TelemetryPrint("] cycles=");
    Guardian_TelemetryPrintU32(cycles);
    Guardian_TelemetryPrint(" us=");
    Guardian_TelemetryPrintU32(SystemCoreClock == 0U ? 0U :
                               (uint32_t)(((uint64_t)cycles * 1000000ULL) /
                                          SystemCoreClock));
    Guardian_TelemetryPrint("\r\n");
}
