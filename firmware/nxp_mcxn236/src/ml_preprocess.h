#ifndef SECURE_OTA_GUARDIAN_ML_PREPROCESS_H
#define SECURE_OTA_GUARDIAN_ML_PREPROCESS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define GUARDIAN_ML_FEATURE_COUNT 22U
#define GUARDIAN_ML_INPUT_SCALE 0.11253108829259872f
#define GUARDIAN_ML_INPUT_ZERO_POINT 74

void Guardian_MlQuantizeFeatures(const float raw_features[GUARDIAN_ML_FEATURE_COUNT],
                                 int8_t quantized_features[GUARDIAN_ML_FEATURE_COUNT]);

#ifdef __cplusplus
}
#endif

#endif
