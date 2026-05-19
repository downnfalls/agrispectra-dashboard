#include <Adafruit_Sensor.h>
#include <Adafruit_TSL2591.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_task_wdt.h>
#include <time.h>

#define WDT_TIMEOUT 10

#define RXD2 16
#define TXD2 17

#define WHITE_PWM 18
#define RED_PWM 19
#define BLUE_PWM 33
#define FARRED_PWM 32

#define FREQUENCY 19000
#define RESOLUTION 12

#define I2C_SDA 21
#define I2C_SCL 22

#define WIFI_SSID "KUWIN-IOT"
#define WIFI_PASSWORD ""
#define SERVER_IP "140.99.98.15"
#define SERVER_PORT 8080
#define NTP_SERVER "pool.ntp.org"
#define TIMEZONE 7 * 3600

#define MAX_PPFD_WHITE 187.5      // 112.5
#define MAX_PPFD_DEEP_RED 635.0   // 381.0
#define MAX_PPFD_FAR_RED 108.3375 // 65.0025
#define MAX_PPFD_BLUE 208.3375    // 125.0025

WebSocketsClient webSocket;
Preferences preferences;
Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);

const int autoCapturePeriod = 1 * 60 * 60 * 1000;
const int lightDetectPeriod = 1 * 1000;
const int sendDataPeriod = 5 * 1000;

const float ppfd_adjust_limit = 50.0;

const String server_url =
    "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT);
int leaf_count = 0;
bool harvestable = false;
String current_stage = "Unknown";
String last_stage = "Unknown";
float last_period = 0.0;
float current_period = 0.0;

float blueTarget = 0.0;
float blueCurrent = 0.0;
float PWMBLUE = 0.0;

float redTarget = 0.0;
float redCurrent = 0.0;
float PWMRED = 0.0;

float farRedTarget = 0.0;
float farRedCurrent = 0.0;
float PWMFARRED = 0.0;

float whiteTarget = 0.0;
float whiteCurrent = 0.0;
float PWMWHITE = 0.0;

float fullSpectrumCurrentPPFD = 0.0;
float tsl_ppfd = 0.0;
JsonDocument configuration;

unsigned long long lastWiFiCheck = 0;
unsigned long long lastUpdateLight = 0;
unsigned long long lastDataSent = 0;
unsigned long long lastPhotoPeriod = 0;

bool emergency_stop = false;
bool capturing = false;

float readFullSpectrum() {
  uint32_t lum = tsl.getFullLuminosity();
  uint16_t ir = lum >> 16;
  uint16_t full = lum & 0xFFFF;

  float lux = tsl.calculateLux(full, ir);

  float current_blue = blueTarget;
  float current_red = redTarget;
  float current_white = whiteTarget;

  float total_visible_target = current_blue + current_red + current_white;

  float conversionFactor = 0.0;
  float visible_ppfd = 0.0;

  if (total_visible_target > 0.0) {
    float ratio_blue = current_blue / total_visible_target;
    float ratio_red = current_red / total_visible_target;
    float ratio_white = current_white / total_visible_target;

    conversionFactor =
        (ratio_blue * 68.0) + (ratio_red * 42.0) + (ratio_white * 60.0);
    visible_ppfd = lux / conversionFactor;
  }

  float current_farRed = farRedTarget;
  float total_ePPFD = visible_ppfd + current_farRed;

  return total_ePPFD;
}

void analyseStage(int leaf) {
  String bestStage = "Unknown";
  int maxLeafReq = -1;

  for (JsonPair kv : configuration["stages"].as<JsonObject>()) {
    String stageName = kv.key().c_str();
    JsonObject reqs = kv.value().as<JsonObject>();

    bool hasLeafReq = reqs.containsKey("leaf") && !reqs["leaf"].isNull();
    int reqLeaf = hasLeafReq ? reqs["leaf"].as<int>() : 0;
    bool passLeaf = !hasLeafReq || (leaf >= reqLeaf);

    if (passLeaf) {
      if (reqLeaf >= maxLeafReq) {
        maxLeafReq = reqLeaf;
        bestStage = stageName;
      }
    }
  }

  current_stage = bestStage;
  Serial.println("[Stage] Analyse Result: " + current_stage);
}

int timeToMinutes(const char *timeStr) {
  String t = String(timeStr);
  int colonIndex = t.indexOf(':');
  if (colonIndex == -1)
    return -1;
  int hours = t.substring(0, colonIndex).toInt();
  int mins = t.substring(colonIndex + 1).toInt();
  return (hours * 60) + mins;
}

int getCurrentPeriodValue() {
  JsonObject schedule =
      configuration["stages"][current_stage]["period"].as<JsonObject>();

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("[TIMER] Failed to obtain time from NTP");
    // ไม่ให้ ESP.restart() ตรงนี้บ่อยเกินไป ให้ return ค่า 0 ไปก่อนดีกว่า
    return 0;
  }

  int currentMins = (timeinfo.tm_hour * 60) + timeinfo.tm_min;

  int bestValue = 0;
  int maxBeforeCurrent = -1;

  int latestTimeOfDay = -1;
  int latestValueOfDay = 0;

  for (JsonPair kv : schedule) {
    int pMins = timeToMinutes(kv.key().c_str());
    if (pMins == -1)
      continue;

    int pVal = kv.value().as<int>();

    if (pMins <= currentMins && pMins > maxBeforeCurrent) {
      maxBeforeCurrent = pMins;
      bestValue = pVal;
    }

    if (pMins > latestTimeOfDay) {
      latestTimeOfDay = pMins;
      latestValueOfDay = pVal;
    }
  }

  if (maxBeforeCurrent != -1) {
    return bestValue;
  } else {
    return latestValueOfDay;
  }
}

void updateLights() {
  tsl_ppfd = readFullSpectrum();
  float lightPercent = getCurrentPeriodValue();

  float blue = configuration["stages"][current_stage]["blue"];
  float deepRed = configuration["stages"][current_stage]["red"];
  float farRed = configuration["stages"][current_stage]["farRed"];
  float white = configuration["stages"][current_stage]["white"];

  float target_ppfd = configuration["stages"][current_stage]["ppfd"];
  float current_limit_ppfd = target_ppfd * lightPercent / 100.0;

  float bluePPFD = current_limit_ppfd * blue / 100.0;
  float deepRedPPFD = current_limit_ppfd * deepRed / 100.0;
  float farRedPPFD = current_limit_ppfd * farRed / 100.0;
  float whitePPFD = current_limit_ppfd * white / 100.0;

  blueTarget = bluePPFD;
  redTarget = deepRedPPFD;
  farRedTarget = farRedPPFD;
  whiteTarget = whitePPFD;

  int bluePWM = bluePPFD * 4095 / MAX_PPFD_BLUE;
  int deepRedPWM = deepRedPPFD * 4095 / MAX_PPFD_DEEP_RED;
  int farRedPWM = farRedPPFD * 4095 / MAX_PPFD_FAR_RED;
  int whitePWM = whitePPFD * 4095 / MAX_PPFD_WHITE;

  fullSpectrumCurrentPPFD = bluePPFD + deepRedPPFD + whitePPFD + farRedPPFD;

  ledcWrite(WHITE_PWM, whitePWM);
  ledcWrite(RED_PWM, deepRedPWM);
  ledcWrite(BLUE_PWM, bluePWM);
  ledcWrite(FARRED_PWM, farRedPWM);

  PWMBLUE = bluePWM * 100.0 / 4095.0;
  PWMRED = deepRedPWM * 100.0 / 4095.0;
  PWMFARRED = farRedPWM * 100.0 / 4095.0;
  PWMWHITE = whitePWM * 100.0 / 4095.0;

  blueCurrent = bluePPFD;
  redCurrent = deepRedPPFD;
  farRedCurrent = farRedPPFD;
  whiteCurrent = whitePPFD;
}

void sendDataToServer() {
  HTTPClient http;

  // --- [FIX 1] ตั้งเวลา Timeout สำหรับ HTTP ป้องกัน Server ตอบกลับช้า ---
  http.setTimeout(3000);

  http.begin("http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) +
             "/hardware/state");
  http.addHeader("Content-Type", "application/json");

  String payload =
      "{\"stage\": \"" + (harvestable ? "Harvestable" : current_stage) +
      "\", \"leaf_count\": " + String(leaf_count) + ", \"total\": " + tsl_ppfd +
      ", \"white\": {\"value\": " + whiteCurrent +
      ", \"diff\": " + (whiteCurrent - whiteTarget) + ", \"pwm\": " + PWMWHITE +
      "}, \"blue\": {\"value\": " + blueCurrent +
      ", \"diff\": " + (blueCurrent - blueTarget) + ", \"pwm\": " + PWMBLUE +
      "}, \"red\": {\"value\": " + redCurrent +
      ", \"diff\": " + (redCurrent - redTarget) + ", \"pwm\": " + PWMRED +
      "}, \"farRed\": {\"value\": " + farRedCurrent +
      ", \"diff\": " + (farRedCurrent - farRedTarget) +
      ", \"pwm\": " + PWMFARRED + "}}";
  Serial.println(payload);

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    // สำเร็จ
  } else {
    Serial.print("Error sending telemetry: ");
    Serial.println(httpResponseCode);
  }

  http.end();
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
  case WStype_DISCONNECTED:
    Serial.println("🔴 [WS] Disconnected");
    break;
  case WStype_CONNECTED:
    Serial.println("🟢 [WS] Connected");
    break;
  case WStype_TEXT: {

    Serial.printf("📥 [WS] Received: %s\n", payload);

    JsonDocument data;
    DeserializationError error = deserializeJson(data, payload, length);
    if (error)
      return;

    String action = data["action"].as<String>();

    if (action == "EMERGENCY_STOP") {
      emergency_stop = true;
      ledcWrite(WHITE_PWM, 0);
      ledcWrite(RED_PWM, 0);
      ledcWrite(BLUE_PWM, 0);
      ledcWrite(FARRED_PWM, 0);
    } else if (action == "RESET") {
      ESP.restart();
    } else if (action == "FORCE_RESCAN") {
      Serial2.println("RESCAN");
      lastPhotoPeriod = millis();
    } else if (action == "DEPLOY_PROFILE") {
      JsonVariant profile = data["payload"];
      if (!profile.isNull()) {
        configuration = profile;
        String profileStr;
        serializeJson(profile, profileStr);

        preferences.begin("my-app", false);
        preferences.putString("config", profileStr);
        preferences.end();

        Serial2.println("RESCAN");
      }
    }
  } break;
  case WStype_PING:
    break;
  case WStype_PONG:
    break;
  }
}

void getAnalyseResult() {
  if (Serial2.available()) {
    String incomingData = Serial2.readStringUntil('\n');
    incomingData.trim();
    Serial.println("ESP CAM: " + incomingData);

    if (incomingData == "TAKING PHOTO") {

      Serial.println("SWITCHING TO FLASH MODE");

      capturing = true;

      ledcWrite(WHITE_PWM, 4095);
      ledcWrite(RED_PWM, 0);
      ledcWrite(BLUE_PWM, 0);
      ledcWrite(FARRED_PWM, 0);

    } else if (incomingData == "CAPTURE DONE") {

      Serial.println("CAPTURE DONE HERE");

      capturing = false;

      lastUpdateLight = millis();
      updateLights();

    } else {
      JsonDocument resultAfterAnalyse;
      DeserializationError error =
          deserializeJson(resultAfterAnalyse, incomingData);

      if (error)
        return;

      leaf_count = resultAfterAnalyse["leaf_count"];
      harvestable = resultAfterAnalyse["harvestable"];

      analyseStage(leaf_count);
    }
  }
}

void setup() {
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);
  // --- [FIX 3] ป้องกัน Serial2 รอข้อมูลนานเกินไปจนค้าง ---
  Serial2.setTimeout(200);

  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- ESP32 START ---");

  esp_task_wdt_config_t wdt_config = {.timeout_ms = WDT_TIMEOUT * 1000,
                                      .idle_core_mask =
                                          (1 << portNUM_PROCESSORS) - 1,
                                      .trigger_panic = true};
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);

  ledcAttach(WHITE_PWM, FREQUENCY, RESOLUTION);
  ledcAttach(RED_PWM, FREQUENCY, RESOLUTION);
  ledcAttach(BLUE_PWM, FREQUENCY, RESOLUTION);
  ledcAttach(FARRED_PWM, FREQUENCY, RESOLUTION);

  ledcWrite(WHITE_PWM, 0);
  ledcWrite(RED_PWM, 0);
  ledcWrite(BLUE_PWM, 0);
  ledcWrite(FARRED_PWM, 0);

  Serial.println("WiFi Connecting...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // --- [FIX 2.1] เปิดใช้งาน Auto Reconnect ---
  WiFi.setAutoReconnect(true);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset(); // เตะหมาตอนรอ WiFi ด้วย
  }
  Serial.println("\nWiFi Connected!");
  Serial.println(WiFi.localIP());

  configTime(7 * 3600, 0, "pool.ntp.org");

  Wire.begin(I2C_SDA, I2C_SCL);

  preferences.begin("my-app", true);
  String savedJson = preferences.getString("config", "{}");
  preferences.end();
  if (savedJson != "{}") {
    deserializeJson(configuration, savedJson);
    Serial.println("[Pref] Configuration Loaded!");
  } else {
    Serial.println("[Pref] No Configuration Found!");
  }

  if (!tsl.begin()) {
    Serial.println("No TSL2591 sensor found ... check your wiring?");
  } else {
    Serial.println("Found TSL2591 sensor");
    tsl.setGain(TSL2591_GAIN_LOW);
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  }

  webSocket.begin(SERVER_IP, SERVER_PORT, "/hardware/command");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  delay(2000);
}

void loop() {
  // Feed Watchdog ทุกรอบบิล
  esp_task_wdt_reset();

  getAnalyseResult();
  webSocket.loop();

  // --- [FIX 2.2] เปลี่ยนลอจิกเช็คเน็ตหลุด ไม่ให้ใช้ reconnect() แบบบล็อก ---
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck > 10000) {
    Serial.println("WiFi Drop, re-initiating connection...");
    WiFi.disconnect();
    esp_task_wdt_reset(); // เตะ watchdog ก่อนพยายามต่อใหม่
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    lastWiFiCheck = millis();
  }

  if (millis() - lastUpdateLight > lightDetectPeriod && !emergency_stop &&
      !capturing) {
    lastUpdateLight = millis();
    updateLights();
  }

  if (millis() - lastDataSent > sendDataPeriod) {
    lastDataSent = millis();
    if (WiFi.status() == WL_CONNECTED) {
      sendDataToServer();
    }
  }

  if (lastPhotoPeriod == 0 || millis() - lastPhotoPeriod > autoCapturePeriod) {
    lastPhotoPeriod = millis();
    Serial2.println("RESCAN");
  }
}