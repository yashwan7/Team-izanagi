/*
 * ============================================================================
 * Kshitij Project - Team Izanagi
 * NXP FRDM-MCXN236 OLED Display Receiver for J8 Header
 * ============================================================================
 *
 * Hardware Wiring (OLED SSD1306 128x64 I2C -> FRDM-MCXN236 Header J8):
 *   OLED Pin 1 (VCC / 3.3V) -> J8 Pin 1 (VDD_BOARD / 3.3V)
 *   OLED Pin 2 (GND)        -> J8 Pin 2 (GND)
 *   OLED Pin 3 (SCL)        -> J8 Pin 3 (P4_1 / FC2_I2C_SCL)
 *   OLED Pin 4 (SDA)        -> J8 Pin 4 (P4_0 / FC2_I2C_SDA)
 *
 * Serial Communication:
 *   USB Virtual COM (MCU-LINK CDC VCOM) @ 115200 baud.
 *   Receives real-time telemetry from core/failover/oled_bridge.py
 *
 * Required Arduino Libraries:
 *   - Adafruit_GFX
 *   - Adafruit_SSD1306
 * ============================================================================
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C   // Standard I2C address for SSD1306 (or 0x3D)

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// State variables
String g_state = "HEALTHY";
String g_path = "PORT_A";
float g_lat = 22.4;
float g_loss = 0.1;
float g_conf = 99.9;
float g_deg = 0.02;

// Custom 4-line text buffer
String g_line1 = "KSHITIJ FAILOVER";
String g_line2 = "ML: HEALTHY (99.9%)";
String g_line3 = "ROUTE: PORT_A [ACT]";
String g_line4 = "LAT:22.4ms LOSS:0.1%";

unsigned long last_update = 0;
bool packet_received = false;

void drawDashboard() {
  display.clearDisplay();

  // 1. Top Header Bar
  display.fillRect(0, 0, 128, 12, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(4, 2);
  display.print("KSHITIJ [");
  display.print(g_path);
  display.print("]");

  // 2. TinyML Status Badge
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 16);
  display.print("ML: ");
  if (g_state == "HEALTHY") {
    display.print("HEALTHY ");
  } else if (g_state == "DEGRADED") {
    display.print("! DEGRADED !");
  } else {
    display.print("!! CRITICAL !!");
  }
  display.print(" ");
  display.print(g_conf, 0);
  display.print("%");

  // 3. Telemetry Metrics
  display.setCursor(0, 28);
  display.print("RTT : ");
  display.print(g_lat, 1);
  display.print(" ms");

  display.setCursor(0, 39);
  display.print("LOSS: ");
  display.print(g_loss, 1);
  display.print(" %");

  // 4. Degradation Progress Meter (Bottom)
  display.drawRect(0, 52, 128, 10, SSD1306_WHITE);
  int barWidth = (int)(min(1.0f, max(0.0f, g_deg)) * 124.0f);
  if (barWidth > 0) {
    display.fillRect(2, 54, barWidth, 6, SSD1306_WHITE);
  }

  // Border flash on critical failover
  if (g_state == "CRITICAL" && (millis() / 500) % 2 == 0) {
    display.drawRect(0, 13, 128, 51, SSD1306_WHITE);
  }

  display.display();
}

void parseProtocol(String input) {
  input.trim();
  if (input.startsWith("OLED:")) {
    // Format: OLED:<STATE>|<PATH>|<LAT>|<LOSS>|<CONF>|<DEG>
    String data = input.substring(5);
    int p1 = data.indexOf('|');
    int p2 = data.indexOf('|', p1 + 1);
    int p3 = data.indexOf('|', p2 + 1);
    int p4 = data.indexOf('|', p3 + 1);
    int p5 = data.indexOf('|', p4 + 1);

    if (p1 != -1 && p2 != -1 && p3 != -1 && p4 != -1 && p5 != -1) {
      g_state = data.substring(0, p1);
      g_path  = data.substring(p1 + 1, p2);
      g_lat   = data.substring(p2 + 1, p3).toFloat();
      g_loss  = data.substring(p3 + 1, p4).toFloat();
      g_conf  = data.substring(p4 + 1, p5).toFloat();
      g_deg   = data.substring(p5 + 1).toFloat();
      packet_received = true;
      last_update = millis();
    }
  } else if (input.startsWith("L1:")) {
    g_line1 = input.substring(3);
  } else if (input.startsWith("L2:")) {
    g_line2 = input.substring(3);
  } else if (input.startsWith("L3:")) {
    g_line3 = input.substring(3);
  } else if (input.startsWith("L4:")) {
    g_line4 = input.substring(3);
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize I2C on J8 (P4_1 SCL, P4_0 SDA)
  Wire.begin();

  // Initialize SSD1306 OLED display
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("[ERROR] SSD1306 allocation failed. Check J8 pins 1-4 wiring."));
    for (;;); // Loop forever if display initialization failed
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(14, 15);
  display.println(F("KSHITIJ ENGINE"));
  display.setCursor(6, 30);
  display.println(F("NXP FRDM-MCXN236"));
  display.setCursor(12, 45);
  display.println(F("OLED J8 ACTIVE"));
  display.display();
  delay(1200);

  drawDashboard();
}

void loop() {
  // Read incoming serial telemetry lines
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    if (line.length() > 0) {
      parseProtocol(line);
      drawDashboard();
    }
  }

  // Refresh display every 500ms
  if (millis() - last_update > 500) {
    drawDashboard();
    last_update = millis();
  }
}
