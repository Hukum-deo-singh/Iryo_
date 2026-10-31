/*
 * IRYO health device firmware  -  ESP32 DevKit V1
 * =====================================================================================
 * Measures SpO2, heart rate, temperature and height, cleans the values on the device, and sends
 * only the final numbers to Node-RED. The OLED guides the user. The RGB ring shows what is happening.
 *
 * LIBRARIES  (Arduino IDE > Tools > Manage Libraries; accept "install all dependencies")
 *   - SparkFun MAX3010x Pulse and Proximity Sensor Library
 *   - Adafruit SSD1306 (brings Adafruit GFX and Adafruit BusIO)
 *   - Adafruit NeoPixel
 *   - DHT sensor library by Adafruit (brings Adafruit Unified Sensor)
 *   Board package: "esp32 by Espressif Systems" (2.0.x or 3.x). Board: "ESP32 Dev Module".
 *
 * WIRING  (3.3 V parts use the 3V3 pin)
 *   Main I2C bus (SDA = GPIO21, SCL = GPIO22):
 *     OLED 0.96"  SSD1306 : GND-GND, VDD-3V3, SDA-GPIO21, SCK-GPIO22
 *     MAX30102            : GND-GND, VIN-3V3, SDA-GPIO21, SCL-GPIO22   (INT not connected)
 *   Temperature bus, its own pins (SDA = GPIO33, SCL = GPIO32):
 *     STTS22H             : GND-GND, 3V3-3V3, SDA-GPIO33, SCL-GPIO32   (INT not connected)
 *       Why a separate bus: the STTS22H boards default to address 0x3C, the same as the OLED.
 *       On its own bus they can never clash, and no soldering is needed.
 *   Backup temperature sensor:
 *     DHT11 (3-pin module): + to 3V3, - to GND, S/DATA to GPIO4
 *       A bare 4-pin DHT11 needs a 10k resistor between DATA and 3V3.
 *   Height sensor HC-SR04 : VCC-5V(VIN), GND-GND, TRIG-GPIO26, ECHO-GPIO27 through a divider
 *                           (ECHO ---[1k]--- GPIO27 ---[2k]--- GND). A 3.3 V sensor needs no divider.
 *   RGB ring WS2812       : 5V-VIN, GND-GND, DIN-GPIO18 through a 330 ohm resistor. Join all grounds.
 *   BOOT button (GPIO0 on the board) cancels a measurement.
 *   ON/OFF push button    : one leg to GPIO13, the other leg to GND (normally open, momentary).
 *   Mount the height sensor facing DOWN, SENSOR_MOUNT_HEIGHT_CM above the floor.
 *
 * WHERE THE HAND GOES
 *   Fix the MAX30102 and the STTS22H side by side, about 1 cm apart, facing up, with a small foam
 *   rest around them so the finger does not slide.
 *     1. Lay the pad of your INDEX finger flat on the MAX30102 window (the small dark square).
 *     2. Lay the pad of your MIDDLE finger on the STTS22H chip (the tiny black square on its board).
 *     3. Press gently, like resting on a button. Hold still until the ring fills.
 *   Backup (STTS22H missing): rest the same fingertip on the DHT11's plastic body instead.
 *   Cold or dry fingers read low. Rub the hands together first. A reading is accepted only when the
 *   temperature has risen clearly above the room temperature, so room air is never reported as body heat.
 *
 * WHEN A SENSOR IS UNAVAILABLE ("av-er")
 *   The device never crashes. It keeps retrying the sensor every 15 seconds and shows "av-er".
 *   Temperature: STTS22H first, then the DHT11. Heart rate and height are optional: if one is
 *   missing the reading is sent without it. If SpO2 or every temperature source is missing, the
 *   reading is NOT sent (the server needs both), the screen shows "av-er", and you can try again.
 *   A missing value is never replaced by an invented one.
 *
 * HOW A BUSY DAY WORKS (the ON/OFF button keeps the board cool)
 *   1. Morning: press the ON/OFF button (or switch the housing rocker on). The first start takes up to
 *      about a minute while the OLED counts through "Getting ready" (sensors, Wi-Fi, clock, server).
 *      The first visitor waits for this once. After "READY" every visit is instant.
 *   2. During the day nothing needs doing. After 10 idle minutes the device RESTS (slower CPU, OLED and
 *      ring off, Wi-Fi power saving). The first touch wakes it in under a second.
 *   3. When the crowd is gone: HOLD the button for 2 seconds. The OLED shows a progress bar so a stray tap
 *      does nothing. The device goes into STANDBY (deep sleep, nearly no heat).
 *      If everybody forgets, it switches itself to standby after 45 minutes with nobody.
 *   4. A visitor arrives later: press the button once. It starts and gets ready again.
 *   The housing rocker still cuts the power completely. Use it for nights and holidays.
 *   Until the button is wired, leave POWER_BUTTON_FITTED = false. Otherwise the device could go to
 *   standby with no way to wake it except switching the power off and on.
 *   All the timings are in the "rest mode / standby" settings below.
 *
 * ACCURACY: hobby sensors are NOT medical devices. The STTS22H is rated +-0.5 C in air, but the
 * finger is cooler than the body. Check against a trusted thermometer and set the CALIBRATION
 * offsets below. The DHT11 is only +-2 C and slow, so it is a backup, not a replacement.
 * =====================================================================================
 */

#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include <esp_task_wdt.h>
#include <esp_sleep.h>
#include <driver/rtc_io.h>
#include <driver/gpio.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>
#include <DHT.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

extern const char ROOT_CA_PEM[];  // defined at the bottom of this file

// ============================== USER SETTINGS ==============================
static const char *WIFI_SSID = "YOUR_WIFI_NAME";
static const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Your Node-RED address on Render, with https:// and no trailing slash.
static const char *NODERED_BASE_URL = "https://iryo-nodered.onrender.com";

// The ID printed on the device, and the key returned when you registered it. Keep the key secret.
static const char *DEVICE_ID = "IRYO-01";
static const char *DEVICE_KEY = "PASTE_DEVICE_KEY_HERE";

static const long TIME_ZONE_OFFSET_S = 19800;       // India (UTC+5:30), used for the greeting only
static const bool TLS_VERIFY = true;                // false skips server checks. Use only to debug.

static const float SENSOR_MOUNT_HEIGHT_CM = 220.0f; // height sensor to floor
static const float TEMP_CALIBRATION_OFFSET_C = 0.0f;
static const float SPO2_CALIBRATION_OFFSET = 0.0f;
static const float DHT_CALIBRATION_OFFSET_C = 0.0f;  // the DHT11 body is cooler or warmer than the skin; calibrate it too
static const bool DHT_FALLBACK_ENABLED = true;       // use the DHT11 when the STTS22H is not working
static const float MIN_RISE_ABOVE_AMBIENT_C = 2.0f;  // body contact must be this much warmer than the room
// ===========================================================================

// ------------------------------- pins and sizes -------------------------------
static const int PIN_SDA = 21;
static const int PIN_SCL = 22;
static const int PIN_LED = 18;
static const int PIN_TRIG = 26;
static const int PIN_ECHO = 27;
static const int PIN_BUTTON = 0;
static const int PIN_DHT = 4;
static const gpio_num_t PIN_POWER_BTN = GPIO_NUM_13;  // ON/OFF push button to GND (wakes the device from standby)
static const int PIN_TEMP_SDA = 33;  // STTS22H has its own I2C bus
static const int PIN_TEMP_SCL = 32;
static const int LED_COUNT = 16;
static const uint8_t LED_BRIGHTNESS = 40;           // low on purpose: a USB port cannot power a bright ring
static const uint8_t OLED_ADDRESS = 0x3C;

// ------------------------------- measurement rules -------------------------------
static const uint32_t FINGER_IR_MIN = 40000;        // below this there is no finger on the sensor
static const uint32_t FINGER_IR_SATURATED = 250000; // near the 18-bit limit: too much light or pressure
static const int SAMPLE_WINDOW = 100;               // 4 s of data at 25 samples per second
static const int SAMPLE_STEP = 25;                  // recompute once per second
static const int WINDOWS_NEEDED = 8;                // good one-second results needed
static const float SPO2_MAX_SPREAD = 4.0f;          // good results must agree within this
static const float HR_MAX_SPREAD = 15.0f;
static const float TEMP_MAX_SPREAD_C = 0.2f;        // temperature must settle within this over 6 s
static const int TEMP_WINDOW = 6;
static const uint32_t VITALS_TIMEOUT_MS = 90000;
static const uint32_t HEIGHT_WAIT_MS = 25000;

// ------------------------------- cloud timing -------------------------------
static const uint32_t PING_EVERY_MS = 5000;         // while waking the server
static const uint32_t WAKE_MAX_MS = 180000;         // give up waking after 3 minutes
static const uint32_t KEEP_AWAKE_EVERY_MS = 9UL * 60UL * 1000UL;
static const uint32_t RETRY_WAKE_EVERY_MS = 30000;
static const uint32_t WATCHDOG_S = 90;
static const int SEND_ATTEMPTS = 5;
static const uint32_t SEND_DEADLINE_MS = 110000;

// ------------------------------- rest mode (cooler when idle) -------------------------------
static const uint32_t REST_AFTER_MS = 10UL * 60UL * 1000UL; // idle time before resting; 0 turns rest mode off
static const uint32_t AUTO_STANDBY_MS = 45UL * 60UL * 1000UL; // idle time before standby; 0 turns it off
static const uint32_t LONG_PRESS_MS = 2000;                  // hold the button this long to switch off
static const bool POWER_BUTTON_FITTED = false;               // SET TO true AFTER wiring the ON/OFF button (GPIO13 to GND)
static const uint8_t CPU_ACTIVE_MHZ = 160;                   // normal speed (Wi-Fi and https are comfortable here)
static const uint8_t CPU_REST_MHZ = 80;                      // slowest speed Wi-Fi allows
static const bool REST_HEARTBEAT = true;                     // one dim blink every 4 s while resting

// ------------------------------- colours -------------------------------
#define COL_TEAL 0, 170, 150
#define COL_BLUE 30, 90, 255
#define COL_GREEN 0, 200, 70
#define COL_AMBER 255, 150, 0
#define COL_RED 255, 20, 20
#define COL_WHITE 200, 200, 200

// ------------------------------- hardware objects -------------------------------
static Adafruit_SSD1306 oled(128, 64, &Wire, -1);
static Adafruit_NeoPixel strip(LED_COUNT, PIN_LED, NEO_GRB + NEO_KHZ800);
static MAX30105 particleSensor;

// ------------------------------- state -------------------------------
static bool oledOk = false;
static bool fingerSensorOk = false;
static bool tempSensorOk = false;
static uint8_t tempAddress = 0;
static bool cloudReady = false;
static uint32_t lastCloudCheck = 0;
static uint32_t lastSensorCheck = 0;
static uint32_t bootNonce = 0;
static uint32_t messageCounter = 0;
static bool restMode = false;
static uint32_t lastActivity = 0;
static uint8_t cpuMhz = 240;
static bool oledAsleep = false;
static float ambientC = 25.0f;                      // room temperature, for the speed of sound
static uint32_t irBuffer[SAMPLE_WINDOW];
static uint32_t redBuffer[SAMPLE_WINDOW];

struct Reading {
  float spo2;
  float heartRate;
  bool heartRateValid;
  float tempC;
  float heightCm;
  bool heightValid;
  time_t measuredAt;
  char messageId[96];
};

enum MeasureResult { M_OK, M_CANCELLED, M_FINGER_LOST, M_TIMEOUT, M_SATURATED, M_SENSOR_FAULT, M_TEMP_UNSTABLE, M_OUT_OF_RANGE, M_TEMP_LOST };
enum HeightResult { H_OK, H_NO_PERSON, H_UNSTABLE, H_NO_SENSOR };
enum SendResult { SEND_OK, SEND_REJECTED, SEND_FAILED };
enum CloudState { CLOUD_DOWN, CLOUD_NODERED_ONLY, CLOUD_READY };

// =====================================================================================
//  Small helpers
// =====================================================================================

static void feedWatchdog() { esp_task_wdt_reset(); }

static void watchdogBegin() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t cfg = {};
  cfg.timeout_ms = WATCHDOG_S * 1000;
  cfg.idle_core_mask = 0;
  cfg.trigger_panic = true;
  esp_task_wdt_reconfigure(&cfg);
#else
  esp_task_wdt_init(WATCHDOG_S, true);
#endif
  esp_task_wdt_add(NULL);
}

static float medianOf(const float *values, int n) {
  float t[32];
  if (n > 32) n = 32;
  for (int i = 0; i < n; i++) t[i] = values[i];
  for (int i = 1; i < n; i++) {
    float v = t[i];
    int j = i - 1;
    while (j >= 0 && t[j] > v) {
      t[j + 1] = t[j];
      j--;
    }
    t[j + 1] = v;
  }
  return (n % 2) ? t[n / 2] : (t[n / 2 - 1] + t[n / 2]) / 2.0f;
}

static bool timeIsValid() { return time(nullptr) > 1700000000; }

static bool buttonPressed() {
  if (digitalRead(PIN_BUTTON) != LOW) return false;
  delay(30);
  return digitalRead(PIN_BUTTON) == LOW;
}

// =====================================================================================
//  RGB ring: one effect at a time, drawn from ledTick()
// =====================================================================================

enum LedMode { LED_OFF, LED_SOLID, LED_BREATHE, LED_SPIN, LED_BLINK, LED_PROGRESS };
static LedMode ledMode = LED_OFF;
static uint8_t ledR = 0, ledG = 0, ledB = 0;
static float ledProgress = 0.0f;
static bool ledCleared = false;

static void setLed(LedMode mode, uint8_t r, uint8_t g, uint8_t b) {
  ledCleared = false;
  ledMode = mode;
  ledR = r;
  ledG = g;
  ledB = b;
}

static void ledFill(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < LED_COUNT; i++) strip.setPixelColor(i, strip.Color(r, g, b));
}

static void ledTick() {
  static uint32_t last = 0;
  uint32_t now = millis();
  if (now - last < 30) return;
  last = now;
  switch (ledMode) {
    case LED_OFF:
      if (!ledCleared) {
        strip.clear();
        strip.show();
        ledCleared = true;
      }
      return;
    case LED_SOLID:
      ledFill(ledR, ledG, ledB);
      break;
    case LED_BREATHE: {
      float wave = (sinf(now / 520.0f) + 1.0f) / 2.0f;  // squared, so the glow looks smooth to the eye
      float k = 0.04f + 0.96f * wave * wave;
      ledFill(ledR * k, ledG * k, ledB * k);
      break;
    }
    case LED_SPIN: {
      int head = (now / 55) % LED_COUNT;
      for (int i = 0; i < LED_COUNT; i++) {
        int d = (head - i + LED_COUNT) % LED_COUNT;
        float k = d < 6 ? 1.0f / (1 << d) : 0.0f;
        strip.setPixelColor(i, strip.Color(ledR * k, ledG * k, ledB * k));
      }
      break;
    }
    case LED_BLINK:
      if ((now / 300) % 2) ledFill(ledR, ledG, ledB);
      else strip.clear();
      break;
    case LED_PROGRESS: {
      int lit = (int)(ledProgress * LED_COUNT + 0.5f);
      for (int i = 0; i < LED_COUNT; i++) strip.setPixelColor(i, i < lit ? strip.Color(ledR, ledG, ledB) : 0);
      break;
    }
  }
  strip.show();
}

/** Waits while keeping the LED animation and the watchdog alive. */
static void pauseMs(uint32_t ms) {
  uint32_t end = millis() + ms;
  while ((int32_t)(end - millis()) > 0) {
    ledTick();
    feedWatchdog();
    delay(10);
  }
}

static void rainbowIntro(uint32_t ms) {
  uint32_t end = millis() + ms;
  while ((int32_t)(end - millis()) > 0) {
    uint16_t base = (millis() * 20) & 0xFFFF;
    for (int i = 0; i < LED_COUNT; i++) strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(base + i * (65536 / LED_COUNT), 255, 255)));
    strip.show();
    feedWatchdog();
    delay(20);
  }
  strip.clear();
  strip.show();
}

// =====================================================================================
//  OLED
// =====================================================================================

/** Switches the panel off or on. Any screen drawn later wakes it again by itself. */
static void oledSleep(bool sleep) {
  if (!oledOk || oledAsleep == sleep) return;
  oled.ssd1306_command(sleep ? SSD1306_DISPLAYOFF : SSD1306_DISPLAYON);
  oledAsleep = sleep;
}

static void oledCentered(const char *text, int y, uint8_t size) {
  int w = (int)strlen(text) * 6 * size;
  int x = (128 - w) / 2;
  if (x < 0) x = 0;
  oled.setTextSize(size);
  oled.setCursor(x, y);
  oled.print(text);
}

/** Title on top, up to three lines below, optional progress bar at the bottom. */
static void oledScreen(const char *title, const char *a, const char *b = nullptr, const char *c = nullptr, float bar = -1.0f) {
  if (!oledOk) return;
  if (oledAsleep) oledSleep(false);
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print(title);
  // Small status marks on the right: W = Wi-Fi, C = cloud ready
  oled.setCursor(104, 0);
  oled.print(WiFi.status() == WL_CONNECTED ? "W" : "-");
  oled.print(cloudReady ? "C" : "-");
  oled.drawFastHLine(0, 10, 128, SSD1306_WHITE);
  if (a) oledCentered(a, 18, 1);
  if (b) oledCentered(b, 30, 1);
  if (c) oledCentered(c, 42, 1);
  if (bar >= 0.0f) {
    oled.drawRect(8, 55, 112, 8, SSD1306_WHITE);
    int w = (int)(108 * (bar > 1.0f ? 1.0f : bar));
    oled.fillRect(10, 57, w, 4, SSD1306_WHITE);
  }
  oled.display();
}

static void oledBig(const char *top, const char *big, const char *bottom) {
  if (!oledOk) return;
  if (oledAsleep) oledSleep(false);
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oledCentered(top, 4, 1);
  oledCentered(big, 22, 2);
  oledCentered(bottom, 52, 1);
  oled.display();
}

// =====================================================================================
//  Rest mode
// =====================================================================================

static void markActivity() { lastActivity = millis(); }

static void setCpu(uint8_t mhz) {
  if (cpuMhz == mhz) return;
  setCpuFrequencyMhz(mhz);
  cpuMhz = mhz;
}

static void enterRest() {
  if (restMode) return;
  restMode = true;
  setLed(LED_OFF, 0, 0, 0);
  strip.clear();
  strip.show();
  ledCleared = true;
  oledSleep(true);
  WiFi.setSleep(WIFI_PS_MAX_MODEM);
  setCpu(CPU_REST_MHZ);
  Serial.println("[power] rest mode on");
}

static void leaveRest() {
  if (!restMode) return;
  restMode = false;
  setCpu(CPU_ACTIVE_MHZ);
  WiFi.setSleep(WIFI_PS_MIN_MODEM);
  oledSleep(false);
  setLed(LED_BREATHE, COL_TEAL);
  Serial.println("[power] awake");
}

/** A single dim blink every few seconds, so a resting device does not look dead. */
static void restHeartbeat() {
  static uint32_t last = 0;
  if (!REST_HEARTBEAT || millis() - last < 4000) return;
  last = millis();
  strip.setPixelColor(0, strip.Color(0, 40, 36));
  strip.show();
  delay(40);
  strip.clear();
  strip.show();
}

// =====================================================================================
//  Standby (deep sleep) and the ON/OFF button
// =====================================================================================

/** Switches the device off. It sleeps almost without power until the button is pressed. Never returns. */
static void goStandby(const char *line1, const char *line2) {
  Serial.printf("[power] standby: %s\n", line1);
  leaveRest();
  setLed(LED_SOLID, COL_AMBER);
  oledScreen("Switching off", line1, line2, "Press the button to start");
  pauseMs(2800);

  oledSleep(true);
  setLed(LED_OFF, 0, 0, 0);
  strip.clear();
  strip.show();
  if (fingerSensorOk) particleSensor.shutDown();
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_OFF);

  // The button must be let go first, or the device would wake up straight away.
  uint32_t start = millis();
  while (digitalRead(PIN_POWER_BTN) == LOW && millis() - start < 10000) pauseMs(20);
  pauseMs(300);

  pinMode(PIN_LED, OUTPUT);                       // keep the LED data line quiet while sleeping
  digitalWrite(PIN_LED, LOW);
  gpio_hold_en((gpio_num_t)PIN_LED);
  gpio_deep_sleep_hold_en();
  rtc_gpio_init(PIN_POWER_BTN);
  rtc_gpio_set_direction(PIN_POWER_BTN, RTC_GPIO_MODE_INPUT_ONLY);
  rtc_gpio_pullup_en(PIN_POWER_BTN);
  rtc_gpio_pulldown_dis(PIN_POWER_BTN);
  esp_sleep_enable_ext0_wakeup(PIN_POWER_BTN, 0);  // wake when the button pulls the pin to GND
  Serial.flush();
  esp_deep_sleep_start();
}

/** A short tap is ignored. Holding shows a progress bar, and after LONG_PRESS_MS the device switches off. */
static void handlePowerButton() {
  static uint32_t downSince = 0;
  uint32_t now = millis();
  if (digitalRead(PIN_POWER_BTN) != LOW) {
    downSince = 0;
    return;
  }
  if (downSince == 0) {
    downSince = now;
    return;
  }
  uint32_t held = now - downSince;
  if (held < 150) return;  // contact bounce
  leaveRest();
  markActivity();
  if (held >= LONG_PRESS_MS) goStandby("Switched off by the button", "See you soon");
  char line[24];
  snprintf(line, sizeof(line), "%.1f of %.1f s", held / 1000.0, LONG_PRESS_MS / 1000.0);
  oledScreen("Switch off?", "Keep holding to", "switch the device off", line, (float)held / LONG_PRESS_MS);
}

// =====================================================================================
//  Wi-Fi, clock and HTTP
// =====================================================================================

static bool wifiConnect(uint32_t timeoutMs) {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    char line[24];
    snprintf(line, sizeof(line), "%lu s", (unsigned long)((millis() - start) / 1000));
    oledScreen("Wi-Fi", "Connecting...", WIFI_SSID, line);
    pauseMs(300);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] connected, IP %s\n", WiFi.localIP().toString().c_str());
    return true;
  }
  Serial.println("[wifi] could not connect");
  return false;
}

static bool syncClock(uint32_t timeoutMs) {
  if (timeIsValid()) return true;
  configTime(TIME_ZONE_OFFSET_S, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
  uint32_t start = millis();
  while (!timeIsValid() && millis() - start < timeoutMs) pauseMs(250);
  Serial.println(timeIsValid() ? "[time] synced" : "[time] not synced");
  return timeIsValid();
}

struct HttpResult {
  int code;
  char body[200];
};

static HttpResult httpRequestImpl(bool post, const char *path, const char *json, uint32_t timeoutMs) {
  HttpResult r;
  r.code = -1;
  r.body[0] = 0;
  if (WiFi.status() != WL_CONNECTED) return r;
  String url = String(NODERED_BASE_URL) + path;
  bool https = url.startsWith("https://");
  if (https && TLS_VERIFY && !syncClock(8000)) {
    Serial.println("[http] clock not synced, cannot verify the server");
    return r;
  }
  WiFiClientSecure secure;
  WiFiClient plain;
  HTTPClient http;
  bool started;
  if (https) {
    if (TLS_VERIFY) secure.setCACert(ROOT_CA_PEM);
    else secure.setInsecure();
    secure.setHandshakeTimeout(15);
    started = http.begin(secure, url);
  } else {
    started = http.begin(plain, url);
  }
  if (!started) return r;
  http.setReuse(false);
  http.setConnectTimeout(12000);
  http.setTimeout(timeoutMs);
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  http.addHeader("Accept", "application/json");
  http.addHeader("User-Agent", "IryoDevice/1.0");
  if (post) {
    http.addHeader("Content-Type", "application/json");
    r.code = http.POST((uint8_t *)json, strlen(json));
  } else {
    r.code = http.GET();
  }
  if (r.code > 0) {
    String body = http.getString();
    strncpy(r.body, body.c_str(), sizeof(r.body) - 1);
    r.body[sizeof(r.body) - 1] = 0;
  } else {
    Serial.printf("[http] error: %s\n", HTTPClient::errorToString(r.code).c_str());
  }
  http.end();
  return r;
}

static HttpResult httpRequest(bool post, const char *path, const char *json, uint32_t timeoutMs) {
  setCpu(CPU_ACTIVE_MHZ);  // the https handshake is slow at 80 MHz
  HttpResult r = httpRequestImpl(post, path, json, timeoutMs);
  if (restMode) setCpu(CPU_REST_MHZ);
  return r;
}

static CloudState pingCloud() {
  HttpResult r = httpRequest(false, "/iot/ping", nullptr, 7000);
  lastCloudCheck = millis();
  if (r.code != 200) return CLOUD_DOWN;
  return strstr(r.body, "\"backend\":true") ? CLOUD_READY : CLOUD_NODERED_ONLY;
}

/** Free hosting sleeps when idle. Ask every 5 s until both Node-RED and the backend answer. */
static bool warmCloud(uint32_t maxMs) {
  uint32_t start = millis();
  setLed(LED_BREATHE, COL_BLUE);
  while (millis() - start < maxMs) {
    if (WiFi.status() != WL_CONNECTED && !wifiConnect(15000)) {
      pauseMs(2000);
      continue;
    }
    uint32_t pingStart = millis();
    CloudState state = pingCloud();
    if (state == CLOUD_READY) {
      cloudReady = true;
      Serial.println("[cloud] ready");
      return true;
    }
    uint32_t elapsed = millis() - start;
    char line[24];
    snprintf(line, sizeof(line), "%lu s", (unsigned long)(elapsed / 1000));
    oledScreen("Starting up", "Waking the server", state == CLOUD_NODERED_ONLY ? "Node-RED up, backend..." : "Node-RED...", line, (float)elapsed / (float)maxMs);
    if (buttonPressed()) break;
    uint32_t used = millis() - pingStart;
    if (used < PING_EVERY_MS) pauseMs(PING_EVERY_MS - used);
  }
  cloudReady = false;
  Serial.println("[cloud] not ready");
  return false;
}

static void maintainCloud() {
  uint32_t now = millis();
  if (WiFi.status() != WL_CONNECTED) return;
  if (cloudReady && now - lastCloudCheck > KEEP_AWAKE_EVERY_MS) {
    cloudReady = (pingCloud() == CLOUD_READY);
  } else if (!cloudReady && now - lastCloudCheck > RETRY_WAKE_EVERY_MS) {
    cloudReady = (pingCloud() == CLOUD_READY);
  }
}

// =====================================================================================
//  Temperature: STTS22H on its own I2C bus, with the DHT11 as backup
//  (STTS22H registers checked against ST's reference driver)
// =====================================================================================

static TwoWire &tempBus = Wire1;
static DHT dht(PIN_DHT, DHT11);
enum TempSource { TS_NONE, TS_STTS, TS_DHT };
static TempSource lastTempSource = TS_NONE;
static bool dhtOk = false;
static int sttsFails = 0;
static int dhtFails = 0;

static void tempBusStart() {
  tempBus.begin(PIN_TEMP_SDA, PIN_TEMP_SCL, 100000);
  tempBus.setTimeOut(50);
}

static void tempBusRecover() {
  tempBus.end();
  delay(20);
  tempBusStart();
}

static bool sttsReadReg(uint8_t reg, uint8_t &value) {
  tempBus.beginTransmission(tempAddress);
  tempBus.write(reg);
  if (tempBus.endTransmission(false) != 0) return false;
  if (tempBus.requestFrom((int)tempAddress, 1) != 1) return false;
  value = tempBus.read();
  return true;
}

static bool sttsWriteReg(uint8_t reg, uint8_t value) {
  tempBus.beginTransmission(tempAddress);
  tempBus.write(reg);
  tempBus.write(value);
  return tempBus.endTransmission() == 0;
}

static bool sttsBegin() {
  // The chip can sit at four addresses (0x3C is the usual default), so look at all of them.
  static const uint8_t addresses[] = {0x3C, 0x3E, 0x38, 0x3F};
  tempAddress = 0;
  for (uint8_t a : addresses) {
    tempBus.beginTransmission(a);
    if (tempBus.endTransmission() != 0) continue;
    tempAddress = a;
    uint8_t id = 0;
    if (sttsReadReg(0x01, id) && id == 0xA0) break;  // WHO_AM_I must read 0xA0
    tempAddress = 0;
  }
  if (tempAddress == 0) return false;
  uint8_t ctrl = 0, reset = 0;
  if (!sttsReadReg(0x04, ctrl) || !sttsReadReg(0x0C, reset)) return false;
  if (!(ctrl & 0x04)) {                     // not free-running yet: reset first, as ST's driver does
    sttsWriteReg(0x0C, reset | 0x02);
    delay(2);
    sttsWriteReg(0x0C, reset & ~0x02);
    delay(2);
  }
  ctrl = (ctrl & ~(0x01 | 0x30 | 0x80)) | 0x04 | 0x40;  // free run at 25 Hz, block data update on
  if (!sttsWriteReg(0x04, ctrl)) return false;
  delay(80);
  sttsFails = 0;
  Serial.printf("[temp] STTS22H found at 0x%02X\n", tempAddress);
  return true;
}

static bool sttsRead(float &celsius) {
  for (int attempt = 0; attempt < 2; attempt++) {
    uint8_t low = 0, high = 0;
    if (sttsReadReg(0x06, low) && sttsReadReg(0x07, high)) {
      float c = (int16_t)((high << 8) | low) / 100.0f;
      if (c > -40.0f && c < 125.0f) {
        celsius = c;
        return true;
      }
    }
    delay(5);
  }
  return false;
}

/** True when the DHT11 answers. Its first reading needs a moment after power-up. */
static bool dhtProbe(int tries) {
  for (int i = 0; i < tries; i++) {
    float t = dht.readTemperature(false, true);
    if (!isnan(t) && t > -20.0f && t < 80.0f) return true;
    pauseMs(1200);
  }
  return false;
}

static bool temperatureAvailable() { return tempSensorOk || (DHT_FALLBACK_ENABLED && dhtOk); }

/** Prints every address that answers on a bus. Open the Serial Monitor at 115200 to read it. */
static void scanBus(TwoWire &bus, const char *name) {
  Serial.printf("[i2c] %s bus:", name);
  int found = 0;
  for (uint8_t a = 1; a < 127; a++) {
    bus.beginTransmission(a);
    if (bus.endTransmission() == 0) {
      Serial.printf(" 0x%02X", a);
      found++;
    }
  }
  Serial.println(found ? "" : " nothing found (check SDA, SCL, 3V3 and GND)");
}

/** One temperature reading from the best working source. Three bad reads in a row mark a source as lost. */
static bool readTemperature(float &c) {
  if (tempSensorOk) {
    if (sttsRead(c)) {
      sttsFails = 0;
      lastTempSource = TS_STTS;
      return true;
    }
    if (++sttsFails >= 3) {
      tempSensorOk = false;
      Serial.println("[temp] STTS22H lost, trying the DHT11");
      tempBusRecover();
    }
    return false;
  }
  if (DHT_FALLBACK_ENABLED && dhtOk) {
    float t = dht.readTemperature();
    if (!isnan(t) && t > -20.0f && t < 80.0f) {
      dhtFails = 0;
      lastTempSource = TS_DHT;
      c = t;
      return true;
    }
    if (++dhtFails >= 5) {
      dhtOk = false;
      Serial.println("[temp] DHT11 lost");
    }
  }
  return false;
}

// =====================================================================================
//  MAX30102 finger sensor
// =====================================================================================

static bool fingerSensorBegin() {
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) return false;
  // brightness 60, average 4, red+IR, 100 sps (25 effective), pulse width 411, range 4096
  particleSensor.setup(60, 4, 2, 100, 411, 4096);
  return true;
}

/** Reads the next sample. Returns false if the sensor stops answering. */
static bool nextSample(uint32_t &red, uint32_t &ir) {
  uint32_t deadline = millis() + 400;
  while (!particleSensor.available()) {
    particleSensor.check();
    if (millis() > deadline) return false;
    delay(1);
  }
  red = particleSensor.getFIFORed();
  ir = particleSensor.getFIFOIR();
  particleSensor.nextSample();
  return true;
}

/** True when a finger has been resting on the sensor for a moment. */
static bool fingerDetected() {
  if (!fingerSensorOk) return false;
  static uint32_t since = 0;
  uint32_t red, ir;
  if (!nextSample(red, ir) || ir < FINGER_IR_MIN) {
    since = 0;
    return false;
  }
  if (since == 0) since = millis();
  return millis() - since > 600;
}

static void showFault(const char *a, const char *b, uint32_t ms = 4000) {
  Serial.printf("[fault] %s / %s\n", a, b);
  setLed(LED_BLINK, COL_RED);
  oledScreen("Problem", a, b);
  pauseMs(ms);
}

static void waitForFingerRemoved() {
  uint32_t quietSince = 0;
  uint32_t red, ir;
  uint32_t start = millis();
  while (millis() - start < 20000) {
    if (!nextSample(red, ir) || ir < FINGER_IR_MIN) {
      if (quietSince == 0) quietSince = millis();
      if (millis() - quietSince > 800) return;
    } else {
      quietSince = 0;
    }
    pauseMs(20);
  }
}

// =====================================================================================
//  Vitals: SpO2, heart rate and temperature, cleaned on the device
// =====================================================================================

static MeasureResult measureVitals(float &spo2Out, float &hrOut, float &tempOut) {
  setLed(LED_SPIN, COL_TEAL);
  float spo2Good[WINDOWS_NEEDED], hrGood[WINDOWS_NEEDED];
  int goodCount = 0, goodIndex = 0;
  float temps[TEMP_WINDOW];
  int tempCount = 0, tempIndex = 0;
  uint32_t start = millis(), lastTemp = 0, lastScreen = 0, lostSince = 0, saturatedSince = 0;
  int filled = 0;
  int sinceCompute = 0;
  float liveHr = 0;
  bool tempStable = false;
  bool tempTouchHint = false;
  float tempValue = 0;

  while (millis() - start < VITALS_TIMEOUT_MS) {
    // Read one sample and keep the window moving.
    uint32_t red, ir;
    if (!nextSample(red, ir)) return M_SENSOR_FAULT;
    if (buttonPressed()) return M_CANCELLED;
    uint32_t now = millis();

    if (ir < FINGER_IR_MIN) {
      if (lostSince == 0) lostSince = now;
      if (now - lostSince > 1500) return M_FINGER_LOST;
    } else {
      lostSince = 0;
    }
    if (ir > FINGER_IR_SATURATED) {
      if (saturatedSince == 0) saturatedSince = now;
      if (now - saturatedSince > 1500) return M_SATURATED;
    } else {
      saturatedSince = 0;
    }

    if (filled < SAMPLE_WINDOW) {
      redBuffer[filled] = red;
      irBuffer[filled] = ir;
      filled++;
    } else {
      memmove(redBuffer, redBuffer + 1, (SAMPLE_WINDOW - 1) * sizeof(uint32_t));
      memmove(irBuffer, irBuffer + 1, (SAMPLE_WINDOW - 1) * sizeof(uint32_t));
      redBuffer[SAMPLE_WINDOW - 1] = red;
      irBuffer[SAMPLE_WINDOW - 1] = ir;
      if (++sinceCompute >= SAMPLE_STEP) {
        sinceCompute = 0;
        int32_t spo2 = 0, hr = 0;
        int8_t spo2Valid = 0, hrValid = 0;
        maxim_heart_rate_and_oxygen_saturation(irBuffer, SAMPLE_WINDOW, redBuffer, &spo2, &spo2Valid, &hr, &hrValid);
        if (hrValid && hr >= 40 && hr <= 200) liveHr = (float)hr;
        if (spo2Valid && hrValid && spo2 >= 70 && spo2 <= 100 && hr >= 40 && hr <= 200) {
          spo2Good[goodIndex] = (float)spo2;
          hrGood[goodIndex] = (float)hr;
          goodIndex = (goodIndex + 1) % WINDOWS_NEEDED;
          if (goodCount < WINDOWS_NEEDED) goodCount++;
        }
      }
    }

    // Temperature once a second. It must settle, and it must be clearly warmer than the room.
    if (now - lastTemp >= 1000) {
      lastTemp = now;
      float c;
      if (readTemperature(c)) {
        temps[tempIndex] = c;
        tempIndex = (tempIndex + 1) % TEMP_WINDOW;
        if (tempCount < TEMP_WINDOW) tempCount++;
        if (tempCount == TEMP_WINDOW) {
          float lo = temps[0], hi = temps[0];
          for (int i = 1; i < TEMP_WINDOW; i++) {
            if (temps[i] < lo) lo = temps[i];
            if (temps[i] > hi) hi = temps[i];
          }
          float allowed = (lastTempSource == TS_DHT) ? 0.5f : TEMP_MAX_SPREAD_C;  // the DHT11 moves in whole degrees
          tempValue = medianOf(temps, TEMP_WINDOW);
          float contactFloor = max(30.0f, ambientC + MIN_RISE_ABOVE_AMBIENT_C);
          tempTouchHint = tempValue < contactFloor;
          tempStable = (hi - lo) <= allowed && !tempTouchHint;
        }
      } else if (!temperatureAvailable()) {
        return M_TEMP_LOST;
      } else {
        tempCount = 0;  // the source changed or stumbled: start the window again
        tempIndex = 0;
        tempStable = false;
      }
    }
    // The good results must agree with each other.
    bool vitalsSteady = false;
    if (goodCount == WINDOWS_NEEDED) {
      float sLo = spo2Good[0], sHi = spo2Good[0], hLo = hrGood[0], hHi = hrGood[0];
      for (int i = 1; i < WINDOWS_NEEDED; i++) {
        sLo = min(sLo, spo2Good[i]);
        sHi = max(sHi, spo2Good[i]);
        hLo = min(hLo, hrGood[i]);
        hHi = max(hHi, hrGood[i]);
      }
      vitalsSteady = (sHi - sLo) <= SPO2_MAX_SPREAD && (hHi - hLo) <= HR_MAX_SPREAD;
    }

    if (vitalsSteady && tempStable) {
      float spo2 = medianOf(spo2Good, WINDOWS_NEEDED) + SPO2_CALIBRATION_OFFSET;
      float hr = medianOf(hrGood, WINDOWS_NEEDED);
      float temp = tempValue + (lastTempSource == TS_DHT ? DHT_CALIBRATION_OFFSET_C : TEMP_CALIBRATION_OFFSET_C);
      if (spo2 > 100.0f) spo2 = 100.0f;
      if (spo2 < 70.0f || hr < 40.0f || hr > 200.0f || temp < 30.0f || temp > 43.0f) return M_OUT_OF_RANGE;
      spo2Out = spo2;
      hrOut = hr;
      tempOut = temp;
      return M_OK;
    }

    if (now - lastScreen > 250) {
      lastScreen = now;
      float progress = ((float)goodCount / WINDOWS_NEEDED) * 0.8f + (tempStable ? 0.2f : 0.0f);
      ledProgress = progress;
      char hrLine[24];
      if (liveHr > 0) snprintf(hrLine, sizeof(hrLine), "Heart rate %d", (int)liveHr);
      else snprintf(hrLine, sizeof(hrLine), "Reading...");
      oledScreen("Measuring", "Hold still", tempTouchHint ? "Touch the temp sensor" : "Keep finger steady", hrLine, progress);
      ledTick();
      feedWatchdog();
    }
  }
  return (goodCount == WINDOWS_NEEDED && !tempStable) ? M_TEMP_UNSTABLE : M_TIMEOUT;
}

// =====================================================================================
//  Height from the ultrasonic sensor
// =====================================================================================

/** Distance to the nearest surface in cm, or -1 when no echo came back. */
static float readDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  unsigned long us = pulseIn(PIN_ECHO, HIGH, 30000UL);  // 30 ms is about 5 m
  if (us == 0) return -1.0f;
  float speedCmPerUs = (331.3f + 0.606f * ambientC) / 10000.0f;  // sound is faster in warm air
  return (us * speedCmPerUs) / 2.0f;
}

static HeightResult measureHeight(float &heightOut) {
  setLed(LED_BREATHE, COL_TEAL);
  uint32_t start = millis();
  int present = 0;
  bool anyEcho = false;
  const float maxDistance = SENSOR_MOUNT_HEIGHT_CM - 60.0f;  // a person is taller than 60 cm
  while (millis() - start < HEIGHT_WAIT_MS) {
    float d = readDistanceCm();
    if (d > 0) anyEcho = true;
    present = (d > 20.0f && d < maxDistance) ? present + 1 : 0;
    char line[24];
    snprintf(line, sizeof(line), "%lu s", (unsigned long)((HEIGHT_WAIT_MS - (millis() - start)) / 1000));
    oledScreen("Height", "Stand straight", "under the sensor", line, present > 0 ? (float)present / 8.0f : 0.0f);
    if (buttonPressed()) return H_NO_PERSON;
    pauseMs(100);
    if (present >= 8) {
      float samples[20];
      int n = 0;
      for (int i = 0; i < 20; i++) {
        float v = readDistanceCm();
        if (v > 20.0f && v < 400.0f) samples[n++] = v;
        pauseMs(70);
      }
      if (n < 12) return H_UNSTABLE;
      float m = medianOf(samples, n);
      float kept[20];
      int k = 0;
      for (int i = 0; i < n; i++)
        if (fabsf(samples[i] - m) <= 2.5f) kept[k++] = samples[i];
      if (k < 12) return H_UNSTABLE;
      float height = SENSOR_MOUNT_HEIGHT_CM - medianOf(kept, k);
      if (height < 60.0f || height > 230.0f) return H_UNSTABLE;
      heightOut = height;
      return H_OK;
    }
  }
  return anyEcho ? H_NO_PERSON : H_NO_SENSOR;
}

// =====================================================================================
//  Sending the reading
// =====================================================================================

static int buildJson(char *buf, size_t size, const Reading &r) {
  int len = snprintf(buf, size, "{\"deviceId\":\"%s\",\"deviceKey\":\"%s\",\"spo2Percent\":%.1f,\"temperatureC\":%.2f", DEVICE_ID, DEVICE_KEY, r.spo2, r.tempC);
  if (r.heartRateValid && len < (int)size) len += snprintf(buf + len, size - len, ",\"heartRateBpm\":%.0f", r.heartRate);
  if (r.heightValid && len < (int)size) len += snprintf(buf + len, size - len, ",\"heightCm\":%.1f", r.heightCm);
  if (r.measuredAt > 1700000000 && len < (int)size) {
    struct tm t;
    gmtime_r(&r.measuredAt, &t);
    char iso[24];
    strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &t);
    len += snprintf(buf + len, size - len, ",\"measuredAt\":\"%s\"", iso);
  }
  if (len < (int)size) len += snprintf(buf + len, size - len, ",\"messageId\":\"%s\"}", r.messageId);
  return len;
}

/** Retries with growing waits. The same messageId is reused, so a retry never saves a reading twice. */
static SendResult sendReading(const Reading &r, int &lastCode) {
  char json[420];
  int len = buildJson(json, sizeof(json), r);
  if (len <= 0 || len >= (int)sizeof(json)) return SEND_REJECTED;
  static const uint32_t waits[] = {3000, 5000, 8000, 12000, 15000};
  uint32_t deadline = millis() + SEND_DEADLINE_MS;
  lastCode = -1;
  for (int attempt = 0; attempt < SEND_ATTEMPTS; attempt++) {
    char line[24];
    snprintf(line, sizeof(line), "Attempt %d of %d", attempt + 1, SEND_ATTEMPTS);
    oledScreen("Sending", "Saving your result", line);
    setLed(LED_SPIN, COL_BLUE);
    if (wifiConnect(15000)) {
      HttpResult h = httpRequest(true, "/iot/readings", json, 25000);
      lastCode = h.code;
      Serial.printf("[send] attempt %d -> HTTP %d %s\n", attempt + 1, h.code, h.body);
      if (h.code == 200 || h.code == 201) {
        cloudReady = true;
        return SEND_OK;
      }
      if (h.code == 400 || h.code == 401 || h.code == 403 || h.code == 404 || h.code == 409 || h.code == 422) return SEND_REJECTED;
    }
    if (attempt == SEND_ATTEMPTS - 1 || millis() > deadline) break;
    oledScreen("Sending", "Server is busy", "Trying again...", line);
    setLed(LED_BREATHE, COL_AMBER);
    pauseMs(waits[attempt]);
  }
  return SEND_FAILED;
}

// =====================================================================================
//  One full session: finger, then height, then send
// =====================================================================================

static void runSession() {
  Serial.println("[session] finger detected, measuring");
  float spo2 = 0, hr = 0, temp = 0;
  MeasureResult m = measureVitals(spo2, hr, temp);
  if (m == M_CANCELLED) {
    setLed(LED_OFF, 0, 0, 0);
    oledScreen("Cancelled", "Measurement stopped");
    waitForFingerRemoved();
    return;
  }
  if (m != M_OK) {
    switch (m) {
      case M_FINGER_LOST: showFault("Finger moved", "Keep it steady, retry"); break;
      case M_SATURATED: showFault("Sensor too bright", "Ease pressure, cover it"); break;
      case M_SENSOR_FAULT:
        showFault("av-er", "Finger sensor lost");
        fingerSensorOk = false;
        break;
      case M_TEMP_LOST: showFault("av-er", "No temperature sensor"); break;
      case M_TEMP_UNSTABLE: showFault("Temperature unsteady", "Keep contact, retry"); break;
      case M_OUT_OF_RANGE: showFault("Odd reading", "Warm hands, try again"); break;
      default: showFault("No steady reading", "Press gently, retry"); break;
    }
    waitForFingerRemoved();
    return;
  }

  Reading r;
  memset(&r, 0, sizeof(r));
  r.spo2 = spo2;
  r.heartRate = hr;
  r.heartRateValid = true;
  r.tempC = temp;
  r.measuredAt = time(nullptr);
  Serial.printf("[vitals] SpO2 %.1f  HR %.0f  Temp %.2f (%s)\n", spo2, hr, temp, lastTempSource == TS_DHT ? "DHT11" : "STTS22H");

  setLed(LED_SOLID, COL_GREEN);
  oledScreen("Done", "Finger step complete", "Now step under the", "height sensor");
  pauseMs(1200);
  float height = 0;
  HeightResult h = measureHeight(height);
  if (h == H_OK) {
    r.heightCm = height;
    r.heightValid = true;
    Serial.printf("[height] %.1f cm\n", height);
  } else {
    Serial.printf("[height] skipped (%d)\n", (int)h);
    oledScreen("Height skipped", h == H_NO_SENSOR ? "No height sensor" : "Nobody measured", "Sending the rest");
    pauseMs(1200);
  }

  snprintf(r.messageId, sizeof(r.messageId), "%s-%08lx-%lu", DEVICE_ID, (unsigned long)bootNonce, (unsigned long)++messageCounter);
  int code = 0;
  SendResult s = sendReading(r, code);
  if (s == SEND_OK) {
    char a[24], b[24], c[24];
    snprintf(a, sizeof(a), "SpO2 %.0f%%  HR %.0f", r.spo2, r.heartRate);
    snprintf(b, sizeof(b), "Temp %.1f C%s", r.tempC, lastTempSource == TS_DHT ? " (DHT)" : "");
    if (r.heightValid) snprintf(c, sizeof(c), "Height %.0f cm", r.heightCm);
    else snprintf(c, sizeof(c), "Saved. Open the app");
    setLed(LED_SOLID, COL_GREEN);
    oledScreen("Saved", a, b, c);
    pauseMs(6000);
  } else if (s == SEND_REJECTED) {
    if (code == 401) showFault("Device key wrong", "Check DEVICE_KEY", 6000);
    else if (code == 403) showFault("Device is disabled", "Contact support", 6000);
    else if (code == 404) showFault("Device not found", "Check DEVICE_ID", 6000);
    else showFault("Result rejected", "Please measure again", 6000);
  } else {
    cloudReady = false;
    showFault("Could not save", "Server busy, try again", 6000);
  }
  setLed(LED_OFF, 0, 0, 0);
  waitForFingerRemoved();
}

// =====================================================================================
//  Idle screen, sensor checks, setup and loop
// =====================================================================================

static void greetingText(char *out, size_t size) {
  if (!timeIsValid()) {
    snprintf(out, size, "Hello!");
    return;
  }
  time_t now = time(nullptr);
  struct tm t;
  localtime_r(&now, &t);
  const char *word = t.tm_hour < 12 ? "Good morning" : (t.tm_hour < 18 ? "Good afternoon" : "Good evening");
  snprintf(out, size, "%s", word);
}

static void showIdle() {
  static uint32_t lastChange = 0;
  static int slide = 0;
  if (millis() - lastChange < 3500 && lastChange != 0) return;
  lastChange = millis();
  slide = (slide + 1) % 4;
  char greet[24];
  greetingText(greet, sizeof(greet));
  if (slide == 0) oledBig(greet, "IRYO", "Your health companion");
  else if (slide == 1) oledScreen("Step 1", "Open the Iryo app", "Go to the Device tab", "and tap Connect");
  else if (slide == 2) oledBig("Your Device ID", DEVICE_ID, "Type it in the app");
  else oledScreen("Step 2", "Place a finger on", "the sensor and hold", "still (within 2 min)");
}

/** One line of the start-up checklist, with a progress bar. */
static void setupStep(int step, const char *label) {
  char line[24];
  snprintf(line, sizeof(line), "Step %d of 4", step);
  setLed(LED_BREATHE, COL_BLUE);
  oledScreen("Getting ready", label, line, "First start: about a minute", step / 4.0f);
  pauseMs(500);
}

/** The signal that the first visitor has been waiting for. */
static void showReady() {
  char greet[24];
  greetingText(greet, sizeof(greet));
  setLed(LED_SOLID, COL_GREEN);
  oledBig(greet, "READY", "Place your finger");
  pauseMs(1800);
}

static void maintainSensors() {
  if (millis() - lastSensorCheck < 15000) return;
  lastSensorCheck = millis();
  if (!fingerSensorOk) fingerSensorOk = fingerSensorBegin();          // a loose wire recovers by itself
  if (!tempSensorOk) tempSensorOk = sttsBegin();
  if (!tempSensorOk && !dhtOk && DHT_FALLBACK_ENABLED) dhtOk = dhtProbe(2);
  float c;
  if (restMode) setCpu(CPU_ACTIVE_MHZ);  // the DHT11 is timing-sensitive
  bool read = temperatureAvailable() && readTemperature(c);
  if (restMode) setCpu(CPU_REST_MHZ);
  if (read) {
    Serial.printf("[temp] %s reads %.2f C (room baseline %.1f C)\n", lastTempSource == TS_DHT ? "DHT11" : "STTS22H", c, ambientC);
    if (c > -10.0f && c < 50.0f) ambientC = 0.8f * ambientC + 0.2f * c;  // room temperature, for the height sensor and the contact check
  } else if (!temperatureAvailable()) {
    Serial.println("[temp] av-er: no temperature sensor answering");
  }
}

static void showReadiness() {
  char a[24], b[24];
  snprintf(a, sizeof(a), "Finger sensor: %s", fingerSensorOk ? "OK" : "av-er");
  snprintf(b, sizeof(b), "Temp: %s", tempSensorOk ? "STTS22H OK" : (dhtOk ? "DHT11 backup" : "av-er"));
  oledScreen("Self check", a, b, "Height: optional");
  Serial.printf("[boot] finger=%d stts22h=%d dht11=%d\n", fingerSensorOk, tempSensorOk, dhtOk);
  pauseMs(2000);
}

void setup() {
  Serial.begin(115200);
  bool fromStandby = esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0;
  rtc_gpio_deinit(PIN_POWER_BTN);
  pinMode(PIN_POWER_BTN, INPUT_PULLUP);
  gpio_hold_dis((gpio_num_t)PIN_LED);
  gpio_deep_sleep_hold_dis();
  for (uint32_t t0 = millis(); digitalRead(PIN_POWER_BTN) == LOW && millis() - t0 < 4000;) delay(10);  // let go of the start button
  cpuMhz = getCpuFrequencyMhz();
  setCpu(CPU_ACTIVE_MHZ);  // 160 MHz is plenty and runs cooler than 240
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);
  bootNonce = esp_random();

  strip.begin();
  strip.setBrightness(LED_BRIGHTNESS);
  strip.clear();
  strip.show();
  watchdogBegin();

  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);
  Wire.setTimeOut(50);
  tempBusStart();
  dht.begin();
  scanBus(Wire, "main (expect 0x3C OLED, 0x57 MAX30102)");
  scanBus(tempBus, "temperature (expect one of 0x3C 0x3E 0x38 0x3F)");
  oledOk = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  if (!oledOk) Serial.println("[oled] not found, continuing without a screen");

  rainbowIntro(fromStandby ? 1000 : 1600);
  oledBig("Welcome to", "IRYO", "Getting ready...");
  pauseMs(1200);

  setupStep(1, "Checking sensors");
  for (int i = 0; i < 3 && !fingerSensorOk; i++) fingerSensorOk = fingerSensorBegin();
  for (int i = 0; i < 3 && !tempSensorOk; i++) {
    tempSensorOk = sttsBegin();
    if (!tempSensorOk) delay(100);
  }
  if (DHT_FALLBACK_ENABLED) dhtOk = dhtProbe(3);
  showReadiness();
  if (!fingerSensorOk || !temperatureAvailable()) setLed(LED_BLINK, COL_AMBER);

  setupStep(2, "Connecting Wi-Fi");
  if (wifiConnect(25000)) {
    setupStep(3, "Setting the clock");
    syncClock(15000);
    setupStep(4, "Waking the server");
    warmCloud(WAKE_MAX_MS);
  }
  Serial.printf("[boot] device %s ready. fingerSensor=%d temp=%d dht=%d cloud=%d wokeFromStandby=%d\n", DEVICE_ID, fingerSensorOk, tempSensorOk, dhtOk, cloudReady, fromStandby);
  if (fingerSensorOk && temperatureAvailable()) showReady();
  setLed(LED_BREATHE, COL_TEAL);
  markActivity();
}

void loop() {
  feedWatchdog();
  ledTick();
  if (POWER_BUTTON_FITTED) handlePowerButton();
  maintainSensors();

  // Nobody around for a while: dim everything and slow down so the board stays cool.
  if (REST_AFTER_MS > 0 && !restMode && millis() - lastActivity > REST_AFTER_MS) enterRest();
  if (POWER_BUTTON_FITTED && AUTO_STANDBY_MS > 0 && millis() - lastActivity > AUTO_STANDBY_MS) goStandby("No visitors for a while", "Saving power");

  if (WiFi.status() != WL_CONNECTED) {
    if (!restMode) {
      setLed(LED_BREATHE, COL_AMBER);
      oledScreen("No Wi-Fi", "Reconnecting...", WIFI_SSID);
    }
    wifiConnect(10000);
    if (restMode) oledSleep(true);  // the connect screen switched it on
    return;
  }
  maintainCloud();

  if (!fingerSensorOk || !temperatureAvailable()) {
    if (!restMode) {
      setLed(LED_BLINK, COL_AMBER);
      oledScreen("av-er", "Sensor not available", fingerSensorOk ? "" : "Finger sensor", temperatureAvailable() ? "" : "Temperature sensor");
    }
    pauseMs(500);  // maintainSensors() keeps retrying every 15 seconds
    return;
  }

  if (fingerDetected()) {
    leaveRest();
    markActivity();
    runSession();
    markActivity();
    setLed(LED_BREATHE, COL_TEAL);
    return;
  }

  if (restMode) {
    restHeartbeat();
    pauseMs(40);
    return;
  }
  setLed(LED_BREATHE, cloudReady ? 0 : 255, cloudReady ? 170 : 150, cloudReady ? 150 : 0);
  showIdle();
  pauseMs(40);
}

// =====================================================================================
//  Trusted root certificates for the https check (Let's Encrypt, Google Trust Services, GlobalSign,
//  Sectigo, SSL.com, DigiCert). Hosting providers may use any of these. Do not edit.
// =====================================================================================
const char ROOT_CA_PEM[] =
// ISRG Root X1
"-----BEGIN CERTIFICATE-----\n"
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n"
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n"
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n"
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n"
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n"
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n"
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n"
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n"
"A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n"
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n"
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n"
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n"
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n"
"OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\n"
"jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\n"
"qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\n"
"rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n"
"HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\n"
"hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\n"
"ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n"
"3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\n"
"NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\n"
"ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\n"
"TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC\n"
"jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc\n"
"oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq\n"
"4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA\n"
"mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d\n"
"emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=\n"
"-----END CERTIFICATE-----\n"

// ISRG Root X2
"-----BEGIN CERTIFICATE-----\n"
"MIICGzCCAaGgAwIBAgIQQdKd0XLq7qeAwSxs6S+HUjAKBggqhkjOPQQDAzBPMQsw\n"
"CQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2gg\n"
"R3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMjAeFw0yMDA5MDQwMDAwMDBaFw00\n"
"MDA5MTcxNjAwMDBaME8xCzAJBgNVBAYTAlVTMSkwJwYDVQQKEyBJbnRlcm5ldCBT\n"
"ZWN1cml0eSBSZXNlYXJjaCBHcm91cDEVMBMGA1UEAxMMSVNSRyBSb290IFgyMHYw\n"
"EAYHKoZIzj0CAQYFK4EEACIDYgAEzZvVn4CDCuwJSvMWSj5cz3es3mcFDR0HttwW\n"
"+1qLFNvicWDEukWVEYmO6gbf9yoWHKS5xcUy4APgHoIYOIvXRdgKam7mAHf7AlF9\n"
"ItgKbppbd9/w+kHsOdx1ymgHDB/qo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T\n"
"AQH/BAUwAwEB/zAdBgNVHQ4EFgQUfEKWrt5LSDv6kviejM9ti6lyN5UwCgYIKoZI\n"
"zj0EAwMDaAAwZQIwe3lORlCEwkSHRhtFcP9Ymd70/aTSVaYgLXTWNLxBo1BfASdW\n"
"tL4ndQavEi51mI38AjEAi/V3bNTIZargCyzuFJ0nN6T5U6VR5CmD1/iQMVtCnwr1\n"
"/q4AaOeMSQ+2b1tbFfLn\n"
"-----END CERTIFICATE-----\n"

// GTS Root R1
"-----BEGIN CERTIFICATE-----\n"
"MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw\n"
"CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU\n"
"MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw\n"
"MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp\n"
"Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA\n"
"A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo\n"
"27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w\n"
"Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw\n"
"TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl\n"
"qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH\n"
"szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8\n"
"Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk\n"
"MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92\n"
"wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p\n"
"aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN\n"
"VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID\n"
"AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E\n"
"FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb\n"
"C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe\n"
"QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy\n"
"h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4\n"
"7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J\n"
"ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef\n"
"MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/\n"
"Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT\n"
"6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ\n"
"0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm\n"
"2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb\n"
"bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c\n"
"-----END CERTIFICATE-----\n"

// GTS Root R2
"-----BEGIN CERTIFICATE-----\n"
"MIIFVzCCAz+gAwIBAgINAgPlrsWNBCUaqxElqjANBgkqhkiG9w0BAQwFADBHMQsw\n"
"CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU\n"
"MBIGA1UEAxMLR1RTIFJvb3QgUjIwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw\n"
"MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp\n"
"Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjIwggIiMA0GCSqGSIb3DQEBAQUA\n"
"A4ICDwAwggIKAoICAQDO3v2m++zsFDQ8BwZabFn3GTXd98GdVarTzTukk3LvCvpt\n"
"nfbwhYBboUhSnznFt+4orO/LdmgUud+tAWyZH8QiHZ/+cnfgLFuv5AS/T3KgGjSY\n"
"6Dlo7JUle3ah5mm5hRm9iYz+re026nO8/4Piy33B0s5Ks40FnotJk9/BW9BuXvAu\n"
"MC6C/Pq8tBcKSOWIm8Wba96wyrQD8Nr0kLhlZPdcTK3ofmZemde4wj7I0BOdre7k\n"
"RXuJVfeKH2JShBKzwkCX44ofR5GmdFrS+LFjKBC4swm4VndAoiaYecb+3yXuPuWg\n"
"f9RhD1FLPD+M2uFwdNjCaKH5wQzpoeJ/u1U8dgbuak7MkogwTZq9TwtImoS1mKPV\n"
"+3PBV2HdKFZ1E66HjucMUQkQdYhMvI35ezzUIkgfKtzra7tEscszcTJGr61K8Yzo\n"
"dDqs5xoic4DSMPclQsciOzsSrZYuxsN2B6ogtzVJV+mSSeh2FnIxZyuWfoqjx5RW\n"
"Ir9qS34BIbIjMt/kmkRtWVtd9QCgHJvGeJeNkP+byKq0rxFROV7Z+2et1VsRnTKa\n"
"G73VululycslaVNVJ1zgyjbLiGH7HrfQy+4W+9OmTN6SpdTi3/UGVN4unUu0kzCq\n"
"gc7dGtxRcw1PcOnlthYhGXmy5okLdWTK1au8CcEYof/UVKGFPP0UJAOyh9OktwID\n"
"AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E\n"
"FgQUu//KjiOfT5nK2+JopqUVJxce2Q4wDQYJKoZIhvcNAQEMBQADggIBAB/Kzt3H\n"
"vqGf2SdMC9wXmBFqiN495nFWcrKeGk6c1SuYJF2ba3uwM4IJvd8lRuqYnrYb/oM8\n"
"0mJhwQTtzuDFycgTE1XnqGOtjHsB/ncw4c5omwX4Eu55MaBBRTUoCnGkJE+M3DyC\n"
"B19m3H0Q/gxhswWV7uGugQ+o+MePTagjAiZrHYNSVc61LwDKgEDg4XSsYPWHgJ2u\n"
"NmSRXbBoGOqKYcl3qJfEycel/FVL8/B/uWU9J2jQzGv6U53hkRrJXRqWbTKH7QMg\n"
"yALOWr7Z6v2yTcQvG99fevX4i8buMTolUVVnjWQye+mew4K6Ki3pHrTgSAai/Gev\n"
"HyICc/sgCq+dVEuhzf9gR7A/Xe8bVr2XIZYtCtFenTgCR2y59PYjJbigapordwj6\n"
"xLEokCZYCDzifqrXPW+6MYgKBesntaFJ7qBFVHvmJ2WZICGoo7z7GJa7Um8M7YNR\n"
"TOlZ4iBgxcJlkoKM8xAfDoqXvneCbT+PHV28SSe9zE8P4c52hgQjxcCMElv924Sg\n"
"JPFI/2R80L5cFtHvma3AH/vLrrw4IgYmZNralw4/KBVEqE8AyvCazM90arQ+POuV\n"
"7LXTWtiBmelDGDfrs7vRWGJB82bSj6p4lVQgw1oudCvV0b4YacCs1aTPObpRhANl\n"
"6WLAYv7YTVWW4tAR+kg0Eeye7QUd5MjWHYbL\n"
"-----END CERTIFICATE-----\n"

// GTS Root R3
"-----BEGIN CERTIFICATE-----\n"
"MIICCTCCAY6gAwIBAgINAgPluILrIPglJ209ZjAKBggqhkjOPQQDAzBHMQswCQYD\n"
"VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG\n"
"A1UEAxMLR1RTIFJvb3QgUjMwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw\n"
"WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz\n"
"IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjMwdjAQBgcqhkjOPQIBBgUrgQQAIgNi\n"
"AAQfTzOHMymKoYTey8chWEGJ6ladK0uFxh1MJ7x/JlFyb+Kf1qPKzEUURout736G\n"
"jOyxfi//qXGdGIRFBEFVbivqJn+7kAHjSxm65FSWRQmx1WyRRK2EE46ajA2ADDL2\n"
"4CejQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW\n"
"BBTB8Sa6oC2uhYHP0/EqEr24Cmf9vDAKBggqhkjOPQQDAwNpADBmAjEA9uEglRR7\n"
"VKOQFhG/hMjqb2sXnh5GmCCbn9MN2azTL818+FsuVbu/3ZL3pAzcMeGiAjEA/Jdm\n"
"ZuVDFhOD3cffL74UOO0BzrEXGhF16b0DjyZ+hOXJYKaV11RZt+cRLInUue4X\n"
"-----END CERTIFICATE-----\n"

// GTS Root R4
"-----BEGIN CERTIFICATE-----\n"
"MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD\n"
"VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG\n"
"A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw\n"
"WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz\n"
"IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi\n"
"AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi\n"
"QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR\n"
"HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW\n"
"BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D\n"
"9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8\n"
"p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD\n"
"-----END CERTIFICATE-----\n"

// GlobalSign Root CA - R3
"-----BEGIN CERTIFICATE-----\n"
"MIIDXzCCAkegAwIBAgILBAAAAAABIVhTCKIwDQYJKoZIhvcNAQELBQAwTDEgMB4G\n"
"A1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjMxEzARBgNVBAoTCkdsb2JhbFNp\n"
"Z24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMDkwMzE4MTAwMDAwWhcNMjkwMzE4\n"
"MTAwMDAwWjBMMSAwHgYDVQQLExdHbG9iYWxTaWduIFJvb3QgQ0EgLSBSMzETMBEG\n"
"A1UEChMKR2xvYmFsU2lnbjETMBEGA1UEAxMKR2xvYmFsU2lnbjCCASIwDQYJKoZI\n"
"hvcNAQEBBQADggEPADCCAQoCggEBAMwldpB5BngiFvXAg7aEyiie/QV2EcWtiHL8\n"
"RgJDx7KKnQRfJMsuS+FggkbhUqsMgUdwbN1k0ev1LKMPgj0MK66X17YUhhB5uzsT\n"
"gHeMCOFJ0mpiLx9e+pZo34knlTifBtc+ycsmWQ1z3rDI6SYOgxXG71uL0gRgykmm\n"
"KPZpO/bLyCiR5Z2KYVc3rHQU3HTgOu5yLy6c+9C7v/U9AOEGM+iCK65TpjoWc4zd\n"
"QQ4gOsC0p6Hpsk+QLjJg6VfLuQSSaGjlOCZgdbKfd/+RFO+uIEn8rUAVSNECMWEZ\n"
"XriX7613t2Saer9fwRPvm2L7DWzgVGkWqQPabumDk3F2xmmFghcCAwEAAaNCMEAw\n"
"DgYDVR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFI/wS3+o\n"
"LkUkrk1Q+mOai97i3Ru8MA0GCSqGSIb3DQEBCwUAA4IBAQBLQNvAUKr+yAzv95ZU\n"
"RUm7lgAJQayzE4aGKAczymvmdLm6AC2upArT9fHxD4q/c2dKg8dEe3jgr25sbwMp\n"
"jjM5RcOO5LlXbKr8EpbsU8Yt5CRsuZRj+9xTaGdWPoO4zzUhw8lo/s7awlOqzJCK\n"
"6fBdRoyV3XpYKBovHd7NADdBj+1EbddTKJd+82cEHhXXipa0095MJ6RMG3NzdvQX\n"
"mcIfeg7jLQitChws/zyrVQ4PkX4268NXSb7hLi18YIvDQVETI53O9zJrlAGomecs\n"
"Mx86OyXShkDOOyyGeMlhLxS67ttVb9+E7gUJTb0o2HLO02JQZR7rkpeDMdmztcpH\n"
"WD9f\n"
"-----END CERTIFICATE-----\n"

// GlobalSign ECC Root CA - R5
"-----BEGIN CERTIFICATE-----\n"
"MIICHjCCAaSgAwIBAgIRYFlJ4CYuu1X5CneKcflK2GwwCgYIKoZIzj0EAwMwUDEk\n"
"MCIGA1UECxMbR2xvYmFsU2lnbiBFQ0MgUm9vdCBDQSAtIFI1MRMwEQYDVQQKEwpH\n"
"bG9iYWxTaWduMRMwEQYDVQQDEwpHbG9iYWxTaWduMB4XDTEyMTExMzAwMDAwMFoX\n"
"DTM4MDExOTAzMTQwN1owUDEkMCIGA1UECxMbR2xvYmFsU2lnbiBFQ0MgUm9vdCBD\n"
"QSAtIFI1MRMwEQYDVQQKEwpHbG9iYWxTaWduMRMwEQYDVQQDEwpHbG9iYWxTaWdu\n"
"MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAER0UOlvt9Xb/pOdEh+J8LttV7HpI6SFkc\n"
"8GIxLcB6KP4ap1yztsyX50XUWPrRd21DosCHZTQKH3rd6zwzocWdTaRvQZU4f8ke\n"
"hOvRnkmSh5SHDDqFSmafnVmTTZdhBoZKo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYD\n"
"VR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUPeYpSJvqB8ohREom3m7e0oPQn1kwCgYI\n"
"KoZIzj0EAwMDaAAwZQIxAOVpEslu28YxuglB4Zf4+/2a4n0Sye18ZNPLBSWLVtmg\n"
"515dTguDnFt2KaAJJiFqYgIwcdK1j1zqO+F4CYWodZI7yFz9SO8NdCKoCOJuxUnO\n"
"xwy8p2Fp8fc74SrL+SvzZpA3\n"
"-----END CERTIFICATE-----\n"

// USERTrust RSA Certification Authority
"-----BEGIN CERTIFICATE-----\n"
"MIIF3jCCA8agAwIBAgIQAf1tMPyjylGoG7xkDjUDLTANBgkqhkiG9w0BAQwFADCB\n"
"iDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0pl\n"
"cnNleSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNV\n"
"BAMTJVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTAw\n"
"MjAxMDAwMDAwWhcNMzgwMTE4MjM1OTU5WjCBiDELMAkGA1UEBhMCVVMxEzARBgNV\n"
"BAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNleSBDaXR5MR4wHAYDVQQKExVU\n"
"aGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMTJVVTRVJUcnVzdCBSU0EgQ2Vy\n"
"dGlmaWNhdGlvbiBBdXRob3JpdHkwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK\n"
"AoICAQCAEmUXNg7D2wiz0KxXDXbtzSfTTK1Qg2HiqiBNCS1kCdzOiZ/MPans9s/B\n"
"3PHTsdZ7NygRK0faOca8Ohm0X6a9fZ2jY0K2dvKpOyuR+OJv0OwWIJAJPuLodMkY\n"
"tJHUYmTbf6MG8YgYapAiPLz+E/CHFHv25B+O1ORRxhFnRghRy4YUVD+8M/5+bJz/\n"
"Fp0YvVGONaanZshyZ9shZrHUm3gDwFA66Mzw3LyeTP6vBZY1H1dat//O+T23LLb2\n"
"VN3I5xI6Ta5MirdcmrS3ID3KfyI0rn47aGYBROcBTkZTmzNg95S+UzeQc0PzMsNT\n"
"79uq/nROacdrjGCT3sTHDN/hMq7MkztReJVni+49Vv4M0GkPGw/zJSZrM233bkf6\n"
"c0Plfg6lZrEpfDKEY1WJxA3Bk1QwGROs0303p+tdOmw1XNtB1xLaqUkL39iAigmT\n"
"Yo61Zs8liM2EuLE/pDkP2QKe6xJMlXzzawWpXhaDzLhn4ugTncxbgtNMs+1b/97l\n"
"c6wjOy0AvzVVdAlJ2ElYGn+SNuZRkg7zJn0cTRe8yexDJtC/QV9AqURE9JnnV4ee\n"
"UB9XVKg+/XRjL7FQZQnmWEIuQxpMtPAlR1n6BB6T1CZGSlCBst6+eLf8ZxXhyVeE\n"
"Hg9j1uliutZfVS7qXMYoCAQlObgOK6nyTJccBz8NUvXt7y+CDwIDAQABo0IwQDAd\n"
"BgNVHQ4EFgQUU3m/WqorSs9UgOHYm8Cd8rIDZsswDgYDVR0PAQH/BAQDAgEGMA8G\n"
"A1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEMBQADggIBAFzUfA3P9wF9QZllDHPF\n"
"Up/L+M+ZBn8b2kMVn54CVVeWFPFSPCeHlCjtHzoBN6J2/FNQwISbxmtOuowhT6KO\n"
"VWKR82kV2LyI48SqC/3vqOlLVSoGIG1VeCkZ7l8wXEskEVX/JJpuXior7gtNn3/3\n"
"ATiUFJVDBwn7YKnuHKsSjKCaXqeYalltiz8I+8jRRa8YFWSQEg9zKC7F4iRO/Fjs\n"
"8PRF/iKz6y+O0tlFYQXBl2+odnKPi4w2r78NBc5xjeambx9spnFixdjQg3IM8WcR\n"
"iQycE0xyNN+81XHfqnHd4blsjDwSXWXavVcStkNr/+XeTWYRUc+ZruwXtuhxkYze\n"
"Sf7dNXGiFSeUHM9h4ya7b6NnJSFd5t0dCy5oGzuCr+yDZ4XUmFF0sbmZgIn/f3gZ\n"
"XHlKYC6SQK5MNyosycdiyA5d9zZbyuAlJQG03RoHnHcAP9Dc1ew91Pq7P8yF1m9/\n"
"qS3fuQL39ZeatTXaw2ewh0qpKJ4jjv9cJ2vhsE/zB+4ALtRZh8tSQZXq9EfX7mRB\n"
"VXyNWQKV3WKdwrnuWih0hKWbt5DHDAff9Yk2dDLWKMGwsAvgnEzDHNb842m1R0aB\n"
"L6KCq9NjRHDEjf8tM7qtj3u1cIiuPhnPQCjY/MiQu12ZIvVS5ljFH4gxQ+6IHdfG\n"
"jjxDah2nGN59PRbxYvnKkKj9\n"
"-----END CERTIFICATE-----\n"

// USERTrust ECC Certification Authority
"-----BEGIN CERTIFICATE-----\n"
"MIICjzCCAhWgAwIBAgIQXIuZxVqUxdJxVt7NiYDMJjAKBggqhkjOPQQDAzCBiDEL\n"
"MAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNl\n"
"eSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMT\n"
"JVVTRVJUcnVzdCBFQ0MgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTAwMjAx\n"
"MDAwMDAwWhcNMzgwMTE4MjM1OTU5WjCBiDELMAkGA1UEBhMCVVMxEzARBgNVBAgT\n"
"Ck5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNleSBDaXR5MR4wHAYDVQQKExVUaGUg\n"
"VVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMTJVVTRVJUcnVzdCBFQ0MgQ2VydGlm\n"
"aWNhdGlvbiBBdXRob3JpdHkwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQarFRaqflo\n"
"I+d61SRvU8Za2EurxtW20eZzca7dnNYMYf3boIkDuAUU7FfO7l0/4iGzzvfUinng\n"
"o4N+LZfQYcTxmdwlkWOrfzCjtHDix6EznPO/LlxTsV+zfTJ/ijTjeXmjQjBAMB0G\n"
"A1UdDgQWBBQ64QmG1M8ZwpZ2dEl23OA1xmNjmjAOBgNVHQ8BAf8EBAMCAQYwDwYD\n"
"VR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAwNoADBlAjA2Z6EWCNzklwBBHU6+4WMB\n"
"zzuqQhFkoJ2UOQIReVx7Hfpkue4WQrO/isIJxOzksU0CMQDpKmFHjFJKS04YcPbW\n"
"RNZu9YO6bVi9JNlWSOrvxKJGgYhqOkbRqZtNyWHa0V1Xahg=\n"
"-----END CERTIFICATE-----\n"

// SSL.com TLS RSA Root CA 2022
"-----BEGIN CERTIFICATE-----\n"
"MIIFiTCCA3GgAwIBAgIQb77arXO9CEDii02+1PdbkTANBgkqhkiG9w0BAQsFADBO\n"
"MQswCQYDVQQGEwJVUzEYMBYGA1UECgwPU1NMIENvcnBvcmF0aW9uMSUwIwYDVQQD\n"
"DBxTU0wuY29tIFRMUyBSU0EgUm9vdCBDQSAyMDIyMB4XDTIyMDgyNTE2MzQyMloX\n"
"DTQ2MDgxOTE2MzQyMVowTjELMAkGA1UEBhMCVVMxGDAWBgNVBAoMD1NTTCBDb3Jw\n"
"b3JhdGlvbjElMCMGA1UEAwwcU1NMLmNvbSBUTFMgUlNBIFJvb3QgQ0EgMjAyMjCC\n"
"AiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANCkCXJPQIgSYT41I57u9nTP\n"
"L3tYPc48DRAokC+X94xI2KDYJbFMsBFMF3NQ0CJKY7uB0ylu1bUJPiYYf7ISf5OY\n"
"t6/wNr/y7hienDtSxUcZXXTzZGbVXcdotL8bHAajvI9AI7YexoS9UcQbOcGV0ins\n"
"S657Lb85/bRi3pZ7QcacoOAGcvvwB5cJOYF0r/c0WRFXCsJbwST0MXMwgsadugL3\n"
"PnxEX4MN8/HdIGkWCVDi1FW24IBydm5MR7d1VVm0U3TZlMZBrViKMWYPHqIbKUBO\n"
"L9975hYsLfy/7PO0+r4Y9ptJ1O4Fbtk085zx7AGL0SDGD6C1vBdOSHtRwvzpXGk3\n"
"R2azaPgVKPC506QVzFpPulJwoxJF3ca6TvvC0PeoUidtbnm1jPx7jMEWTO6Af77w\n"
"dr5BUxIzrlo4QqvXDz5BjXYHMtWrifZOZ9mxQnUjbvPNQrL8VfVThxc7wDNY8VLS\n"
"+YCk8OjwO4s4zKTGkH8PnP2L0aPP2oOnaclQNtVcBdIKQXTbYxE3waWglksejBYS\n"
"d66UNHsef8JmAOSqg+qKkK3ONkRN0VHpvB/zagX9wHQfJRlAUW7qglFA35u5CCoG\n"
"AtUjHBPW6dvbxrB6y3snm/vg1UYk7RBLY0ulBY+6uB0rpvqR4pJSvezrZ5dtmi2f\n"
"gTIFZzL7SAg/2SW4BCUvAgMBAAGjYzBhMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0j\n"
"BBgwFoAU+y437uOEeicuzRk1sTN8/9REQrkwHQYDVR0OBBYEFPsuN+7jhHonLs0Z\n"
"NbEzfP/UREK5MA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsFAAOCAgEAjYlt\n"
"hEUY8U+zoO9opMAdrDC8Z2awms22qyIZZtM7QbUQnRC6cm4pJCAcAZli05bg4vsM\n"
"QtfhWsSWTVTNj8pDU/0quOr4ZcoBwq1gaAafORpR2eCNJvkLTqVTJXojpBzOCBvf\n"
"R4iyrT7gJ4eLSYwfqUdYe5byiB0YrrPRpgqU+tvT5TgKa3kSM/tKWTcWQA673vWJ\n"
"DPFs0/dRa1419dvAJuoSc06pkZCmF8NsLzjUo3KUQyxi4U5cMj29TH0ZR6LDSeeW\n"
"P4+a0zvkEdiLA9z2tmBVGKaBUfPhqBVq6+AL8BQx1rmMRTqoENjwuSfr98t67wVy\n"
"lrXEj5ZzxOhWc5y8aVFjvO9nHEMaX3cZHxj4HCUp+UmZKbaSPaKDN7EgkaibMOlq\n"
"bLQjk2UEqxHzDh1TJElTHaE/nUiSEeJ9DU/1172iWD54nR4fK/4huxoTtrEoZP2w\n"
"AgDHbICivRZQIA9ygV/MlP+7mea6kMvq+cYMwq7FGc4zoWtcu358NFcXrfA/rs3q\n"
"r5nsLFR+jM4uElZI7xc7P0peYNLcdDa8pUNjyw9bowJWCZ4kLOGGgYz+qxcs+sji\n"
"Mho6/4UIyYOf8kpIEFR3N+2ivEC+5BB09+Rbu7nzifmPQdjH5FCQNYA+HLhNkNPU\n"
"98OwoX6EyneSMSy4kLGCenROmxMmtNVQZlR4rmA=\n"
"-----END CERTIFICATE-----\n"

// SSL.com TLS ECC Root CA 2022
"-----BEGIN CERTIFICATE-----\n"
"MIICOjCCAcCgAwIBAgIQFAP1q/s3ixdAW+JDsqXRxDAKBggqhkjOPQQDAzBOMQsw\n"
"CQYDVQQGEwJVUzEYMBYGA1UECgwPU1NMIENvcnBvcmF0aW9uMSUwIwYDVQQDDBxT\n"
"U0wuY29tIFRMUyBFQ0MgUm9vdCBDQSAyMDIyMB4XDTIyMDgyNTE2MzM0OFoXDTQ2\n"
"MDgxOTE2MzM0N1owTjELMAkGA1UEBhMCVVMxGDAWBgNVBAoMD1NTTCBDb3Jwb3Jh\n"
"dGlvbjElMCMGA1UEAwwcU1NMLmNvbSBUTFMgRUNDIFJvb3QgQ0EgMjAyMjB2MBAG\n"
"ByqGSM49AgEGBSuBBAAiA2IABEUpNXP6wrgjzhR9qLFNoFs27iosU8NgCTWyJGYm\n"
"acCzldZdkkAZDsalE3D07xJRKF3nzL35PIXBz5SQySvOkkJYWWf9lCcQZIxPBLFN\n"
"SeR7T5v15wj4A4j3p8OSSxlUgaNjMGEwDwYDVR0TAQH/BAUwAwEB/zAfBgNVHSME\n"
"GDAWgBSJjy+j6CugFFR781a4Jl9nOAuc0DAdBgNVHQ4EFgQUiY8vo+groBRUe/NW\n"
"uCZfZzgLnNAwDgYDVR0PAQH/BAQDAgGGMAoGCCqGSM49BAMDA2gAMGUCMFXjIlbp\n"
"15IkWE8elDIPDAI2wv2sdDJO4fscgIijzPvX6yv/N33w7deedWo1dlJF4AIxAMeN\n"
"b0Igj762TVntd00pxCAgRWSGOlDGxK0tk/UYfXLtqc/ErFc2KAhl3zx5Zn6g6g==\n"
"-----END CERTIFICATE-----\n"

// DigiCert Global Root G2
"-----BEGIN CERTIFICATE-----\n"
"MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh\n"
"MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3\n"
"d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH\n"
"MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT\n"
"MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j\n"
"b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG\n"
"9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI\n"
"2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx\n"
"1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ\n"
"q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz\n"
"tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ\n"
"vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP\n"
"BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV\n"
"5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY\n"
"1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4\n"
"NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG\n"
"Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91\n"
"8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe\n"
"pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl\n"
"MrY=\n"
"-----END CERTIFICATE-----\n"

// DigiCert Global Root CA
"-----BEGIN CERTIFICATE-----\n"
"MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh\n"
"MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3\n"
"d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD\n"
"QTAeFw0wNjExMTAwMDAwMDBaFw0zMTExMTAwMDAwMDBaMGExCzAJBgNVBAYTAlVT\n"
"MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j\n"
"b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IENBMIIBIjANBgkqhkiG\n"
"9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4jvhEXLeqKTTo1eqUKKPC3eQyaKl7hLOllsB\n"
"CSDMAZOnTjC3U/dDxGkAV53ijSLdhwZAAIEJzs4bg7/fzTtxRuLWZscFs3YnFo97\n"
"nh6Vfe63SKMI2tavegw5BmV/Sl0fvBf4q77uKNd0f3p4mVmFaG5cIzJLv07A6Fpt\n"
"43C/dxC//AH2hdmoRBBYMql1GNXRor5H4idq9Joz+EkIYIvUX7Q6hL+hqkpMfT7P\n"
"T19sdl6gSzeRntwi5m3OFBqOasv+zbMUZBfHWymeMr/y7vrTC0LUq7dBMtoM1O/4\n"
"gdW7jVg/tRvoSSiicNoxBN33shbyTApOB6jtSj1etX+jkMOvJwIDAQABo2MwYTAO\n"
"BgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUA95QNVbR\n"
"TLtm8KPiGxvDl7I90VUwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUw\n"
"DQYJKoZIhvcNAQEFBQADggEBAMucN6pIExIK+t1EnE9SsPTfrgT1eXkIoyQY/Esr\n"
"hMAtudXH/vTBH1jLuG2cenTnmCmrEbXjcKChzUyImZOMkXDiqw8cvpOp/2PV5Adg\n"
"06O/nVsJ8dWO41P0jmP6P6fbtGbfYmbW0W5BjfIttep3Sp+dWOIrWcBAI+0tKIJF\n"
"PnlUkiaY4IBIqDfv8NZ5YBberOgOzW6sRBc4L0na4UU+Krk2U886UAb3LujEV0ls\n"
"YSEY1QSteDwsOoBrp+uvFRTp2InBuThs4pFsiv9kuXclVzDAGySj4dzp30d8tbQk\n"
"CAUw7C29C79Fv1C5qfPrmAESrciIxpg0X40KPMbp1ZWVbd4=\n"
"-----END CERTIFICATE-----\n";
