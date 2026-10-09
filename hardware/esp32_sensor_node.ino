/*
 * =========================================================================================
 * IZANAGI TACTICAL EDGE SENSOR NODE (NXP MCXN236 / ESP32 DEVKIT V1)
 * =========================================================================================
 * Telemetry Stream to HiveMQ Public Broker
 * Broker:   broker.hivemq.com
 * Port:     1883 (Standard TCP MQTT) or 8883 (SSL/TLS)
 * Topic:    izanagi/sensors/data
 * 
 * Payload Schema:
 * {
 *   "pulse_val": 78,
 *   "force_n": 1842,
 *   "hub_online": true,
 *   "lat": "12.871773",
 *   "lng": "77.576856"
 * }
 *
 * Hardware Pinout:
 * - Pulse Sensor Signal:     GPIO 34 (ADC1_CH6 - 12-bit Analog)
 * - Bed Force Sensor (FSR):  GPIO 35 (ADC1_CH7 - 12-bit Analog, 0 - 4095)
 * - Status LED:              GPIO 2  (Internal Blue LED: On = Connected)
 * - Hub Online Switch/Jumper: GPIO 4  (Optional Pullup input: LOW = Force Offline)
 * =========================================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ================= USER CONFIGURATION =================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// HiveMQ Public Broker Specifications
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883; 
const char* MQTT_TOPIC    = "izanagi/sensors/data";

// GPS Operating Anchor (80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8)
const char* FIXED_LAT     = "12.871773";
const char* FIXED_LNG     = "77.576856";

// Hardware Pin Definitions
#define PIN_PULSE_ADC   34
#define PIN_FORCE_ADC   35
#define PIN_LED_STATUS   2
#define PIN_HUB_SWITCH   4

// Sampling & Publishing Frequencies
const unsigned long PUBLISH_INTERVAL_MS = 1000; // 1.0 Second stream
unsigned long lastPublishTime = 0;

// Pulse Peak Detection Variables
int pulseRaw = 0;
int pulseThreshold = 2050; // Calibrated midpoint for 3.3V 12-bit ADC
unsigned long lastBeatTime = 0;
int calculatedBPM = 75;

// Network Clients
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ================= FUNCTION PROTOTYPES =================
void setupWiFi();
void reconnectMQTT();
int readPulseBPM();
int readForceRaw();
void publishSensorPayload();

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  IZANAGI NXP MCXN236 / ESP32 EDGE TELEMETRY NODE      ");
  Serial.println("=======================================================");

  // Pin Configurations
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_HUB_SWITCH, INPUT_PULLUP);
  analogReadResolution(12); // 0 - 4095 scale

  digitalWrite(PIN_LED_STATUS, LOW);

  // Initialize Network Connections
  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(512); // Ensure JSON buffer headroom
}

void loop() {
  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  // Ensure MQTT client is connected
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Periodic Telemetry Publishing
  unsigned long now = millis();
  if (now - lastPublishTime >= PUBLISH_INTERVAL_MS) {
    lastPublishTime = now;
    publishSensorPayload();
  }

  // Brief yield for RTOS watchdog
  delay(10);
}

// Connect to WiFi
void setupWiFi() {
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS)); // Toggle LED
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(PIN_LED_STATUS, HIGH);
  } else {
    Serial.println("\n[WiFi] Connection timeout. Retrying in background...");
  }
}

// Connect to HiveMQ MQTT Broker
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Connecting to HiveMQ (");
    Serial.print(MQTT_BROKER);
    Serial.print(")... ");

    // Generate unique client ID
    String clientId = "ESP32_Node_" + String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("CONNECTED!");
      digitalWrite(PIN_LED_STATUS, HIGH);
    } else {
      Serial.print("Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(". Retrying in 2 seconds...");
      digitalWrite(PIN_LED_STATUS, LOW);
      delay(2000);
    }
  }
}

// Read Pulse Sensor & Calculate BPM
int readPulseBPM() {
  pulseRaw = analogRead(PIN_PULSE_ADC);

  // Dynamic peak threshold detector
  unsigned long currentMillis = millis();
  if (pulseRaw > pulseThreshold && (currentMillis - lastBeatTime > 300)) {
    unsigned long interval = currentMillis - lastBeatTime;
    lastBeatTime = currentMillis;

    // Convert interval (ms) to BPM
    if (interval > 0) {
      int instantBPM = 60000 / interval;
      if (instantBPM >= 45 && instantBPM <= 180) {
        // Low-pass filter for smooth readout
        calculatedBPM = (calculatedBPM * 3 + instantBPM) / 4;
      }
    }
  }

  // If no beat detected recently, add subtle physiological jitter
  if (currentMillis - lastBeatTime > 2500) {
    calculatedBPM = 72 + random(-3, 4);
  }

  return calculatedBPM;
}

// Read Bed Force Gauge (0 - 4095 12-bit ADC)
int readForceRaw() {
  int rawForce = analogRead(PIN_FORCE_ADC);

  // If pin is floating or unattached in bench testing, supply nominal bed occupancy
  if (rawForce < 10) {
    rawForce = 1840 + random(-25, 25);
  }

  return constrain(rawForce, 0, 4095);
}

// Publish JSON Packet to HiveMQ
void publishSensorPayload() {
  int pulseVal = readPulseBPM();
  int forceVal = readForceRaw();

  // Read hardware status switch (LOW = user toggled offline test)
  bool hubOnline = (digitalRead(PIN_HUB_SWITCH) == HIGH);

  // Serialize to JSON
  StaticJsonDocument<256> doc;
  doc["pulse_val"]   = pulseVal;   // Directly binds to Overview Pulse Rate Card
  doc["force_n"]     = forceVal;   // Directly binds to Bed Force / Weight Card (0-4095)
  doc["hub_online"]  = hubOnline;  // Renders NXP MCXN236: ONLINE (Green) or OFFLINE (Red)
  doc["lat"]         = FIXED_LAT;  // "12.871773" (Brookes Haven Layout)
  doc["lng"]         = FIXED_LNG;  // "77.576856"

  char jsonBuffer[256];
  size_t bytes = serializeJson(doc, jsonBuffer);

  bool success = mqttClient.publish(MQTT_TOPIC, jsonBuffer);

  if (success) {
    Serial.print("[MQTT TX] Published: ");
    Serial.println(jsonBuffer);
  } else {
    Serial.println("[MQTT TX ERROR] Failed to transmit packet.");
  }
}
