#include "ml_preprocess.h"

#include <math.h>

static const float kScalerMean[GUARDIAN_ML_FEATURE_COUNT] = {
    29.5f, 21.48022882f, 6.095676972f, 1.37868037f, 64.39597059f,
    18.56151864f, 5.108007147f, 0.878327081f, 56.83224166f, 88.53682083f,
    37.31881146f, 1.250311177f, 0.6213541667f, 36.00415104f, 12.97159752f,
    77.594591f, 0.1243020833f, 0.08958333333f, 0.2336354167f, 0.99496875f,
    0.9980729167f, 0.0000625f};

static const float kScalerScale[GUARDIAN_ML_FEATURE_COUNT] = {
    17.31810228f, 23.477476f, 8.050159031f, 2.750508304f, 62.18772442f,
    19.79328524f, 6.825744017f, 1.987165059f, 52.85007442f, 18.90607888f,
    28.22881704f, 0.6256097637f, 0.4850496534f, 18.69383982f, 0.002490225401f,
    0.002501197597f, 0.3299258635f, 0.2855838926f, 0.5228805556f, 0.07075264323f,
    0.04385623882f, 0.007905447094f};

void Guardian_MlQuantizeFeatures(const float raw_features[GUARDIAN_ML_FEATURE_COUNT],
                                 int8_t quantized_features[GUARDIAN_ML_FEATURE_COUNT])
{
    for (uint32_t i = 0U; i < GUARDIAN_ML_FEATURE_COUNT; ++i) {
        float standardized = (raw_features[i] - kScalerMean[i]) / kScalerScale[i];
        long quantized = lroundf(standardized / GUARDIAN_ML_INPUT_SCALE) +
                         GUARDIAN_ML_INPUT_ZERO_POINT;
        if (quantized < -128L) {
            quantized = -128L;
        } else if (quantized > 127L) {
            quantized = 127L;
        }
        quantized_features[i] = (int8_t)quantized;
    }
}
