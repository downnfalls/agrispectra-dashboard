#include <WiFi.h>
#include "time.h"
#include <ArduinoJson.h>
#include <Wire.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_TSL2591.h>
#include <Adafruit_PWMServoDriver.h>

//--- pin define ---


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

WebSocketsClient webSocket;
Preferences preferences;
Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);

const char *server_ip = "192.168.1.122";
const int server_port = 8080;
const char *ssid = "Mango_2.4G";
const char *password = "84002201";
const char* ntpServer = "pool.ntp.org";


const long  gmtOffset_sec = 7 * 3600;
const int daylightOffset_sec = 0;

const int autoCapturePeriod = 1 * 60 * 60 * 1000;
const int lightDetectPeriod = 30 * 1000;
const int sendDataPeriod = 5 * 1000;

const float ppfd_adjust_limit = 50.0;

const float MAX_PPFD_WHITE = 112.5;
const float MAX_PPFD_DEEP_RED = 381.0;
const float MAX_PPFD_FAR_RED = 65.0025;
const float MAX_PPFD_BLUE = 125.0025;


const String server_url = "http://" + String(server_ip) + ":" + String(server_port);
int leaf_count = 0;
bool harvestable = false;
String current_stage = "Unknown";
String last_stage = "Unknown";

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

float light_sensor_result = 0;

unsigned long lastWiFiCheck = 0;
unsigned long lastPeriod = 0;
unsigned long lastPhotoPeriod = 0;
unsigned long lastMinutePeriod = 0;

JsonDocument configuration;



//-- function Get AI result  from ESPCAM -- 

void getAnalyseResult(){
  if (Serial2.available()){
    String incomingData = Serial2.readStringUntil('\n');
    Serial.println("Raw Data: " + incomingData); 
    
    JsonDocument resultAfterAnalyse;
    DeserializationError error = deserializeJson(resultAfterAnalyse, incomingData);

    // check json 
    if (error) {
      Serial.print("JSON Parse Failed: ");
      Serial.println(error.c_str());
      return; 
    }

    leaf_count = resultAfterAnalyse["leaf_count"];
    harvestable = resultAfterAnalyse["harvestable"];

    analyseStage(leaf_count, harvestable );
    
    
    
  }
}


void analyseStage(int leaf_count, bool havestable){
  
  String bestStage = "Unknown";
  int maxLeafReq = -1;

  for (JsonPair kv : configuration["stages"].as<JsonObject>()) {
    String stageName = kv.key().c_str();
    JsonObject reqs = kv.value().as<JsonObject>();

    // 1. จัดการเงื่อนไข Leaf Count
    bool hasLeafReq = reqs.containsKey("leaf") && !reqs["leaf"].isNull();
    int reqLeaf = hasLeafReq ? reqs["leaf"].as<int>() : 0;
    bool passLeaf = !hasLeafReq || (leaf_count >= reqLeaf);

    // 3. ตรวจสอบว่าผ่านทั้ง 2 เงื่อนไขหรือไม่
    if (passLeaf) {
      // 4. เลือกว่าจะเอา Stage ไหนเป็นตัวที่ดีที่สุด (Best Match)
      // กรณีนี้ ผมให้ความสำคัญกับ "ความต้องการที่สูงกว่า" เป็นหลัก
      // ถ้า Stage นี้ต้องการเงื่อนไขที่ "ยากกว่า" Stage เดิมที่เคยจำไว้ ให้ถือว่าเก่งขึ้น/โตขึ้น
      if (reqLeaf >= maxLeafReq) {
        maxLeafReq = reqLeaf;
        bestStage = stageName;
        }
      }
    }

  current_stage = bestStage;

  Serial.println("[Stage] Analyse Result: " + current_stage);

  
  }




void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch(type) {
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
        if (error) return;

        String action = data["action"].as<String>();

        if (action == "FORCE_RESCAN") {
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

            current_stage = "Unknown";
            last_stage = "Unknown";

            blueTarget = 0;
            blueCurrent = 0;
            redTarget = 0;
            redCurrent = 0;
            farRedTarget = 0;
            farRedCurrent = 0;
            whiteTarget = 0;
            whiteCurrent = 0;

            fullSpectrumCurrentPPFD = 0.0;

            Serial2.println("RESCAN");
            
          }
        }
      }
      break;
    case WStype_PING:
      Serial.println("🏓 [WS] PING");
      break;
    case WStype_PONG:
      Serial.println("🏓 [WS] PONG");
      break;
  }
}

void sendDataToServer(){
  HTTPClient http;
  
  // เปลี่ยน IP เป็นของเครื่อง Server
  http.begin("http://" + String(server_ip) + ":8080/hardware/state");
  http.addHeader("Content-Type", "application/json");

  // สร้าง JSON String ตามโครงสร้าง

  String payload = "{\"stage\": \""+(harvestable ? "Harvestable" : current_stage)+"\", \"leaf_count\": " + String(leaf_count) + ", \"total\": "+ light_sensor_result +", \"white\": {\"value\": "+ whiteCurrent +", \"diff\": "+ (whiteCurrent - whiteTarget) +", \"pwm\": "+ PWMWHITE +"}, \"blue\": {\"value\": "+ blueCurrent +", \"diff\": "+ (blueCurrent - blueTarget) +", \"pwm\": "+ PWMBLUE +"}, \"red\": {\"value\": "+ redCurrent+", \"diff\": "+ (redCurrent - redTarget) +", \"pwm\": "+ PWMRED +"}, \"farRed\": {\"value\": "+ farRedCurrent +", \"diff\": "+ (farRedCurrent - farRedTarget) +", \"pwm\": "+ PWMFARRED +"}}";
  Serial.println(payload);


  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    Serial.print("Telemetry Sent! Response code: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Error sending telemetry: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}


// ==========================================
//
//              LIGHT SENSOR
//
// ==========================================

float readFullSpectrum() {

  uint32_t lum = tsl.getFullLuminosity();
  
  uint16_t ir = lum >> 16;
  uint16_t full = lum & 0xFFFF;
  uint16_t visible = full - ir;

  float lux = tsl.calculateLux(full, ir);

  float blue = (float) configuration["stages"][current_stage]["blue"] / 100.0;
  float deepRed = (float) configuration["stages"][current_stage]["red"] / 100.0;
  float white = (float) configuration["stages"][current_stage]["white"] / 100.0;

  float conversionFactor = (blue * 68.0) + (deepRed * 42.0) + (white * 60.0);

  // Serial.printf("[SENSOR DEBUG] Lux: %f\n", lux);
  // Serial.printf("[SENSOR DEBUG] Blue: %f\n", blue);
  // Serial.printf("[SENSOR DEBUG] Deep Red: %f\n", deepRed);
  // Serial.printf("[SENSOR DEBUG] White: %f\n", white);
  // Serial.printf("[SENSOR DEBUG] Conversion Factor: %f\n", conversionFactor);

  if (conversionFactor <= 0.0) {
    return 0.0; 
  }

  float ppfd = lux / conversionFactor;

  // Serial.printf("💡 Lux: %.2f | Visible: %d | IR: %d | PPFD: %f\n", lux, visible, ir, ppfd);

  return ppfd;

}


// ==========================================
//
//              LIGHTING
//
// ==========================================

// Helper: Converts "HH:MM" string to total minutes since midnight
int timeToMinutes(const char* timeStr) {
  String t = String(timeStr);
  int colonIndex = t.indexOf(':');
  if (colonIndex == -1) return -1;
  int hours = t.substring(0, colonIndex).toInt();
  int mins = t.substring(colonIndex + 1).toInt();
  return (hours * 60) + mins;
}

// Main Function: Takes the JSON schedule and returns the current active value
int getCurrentPeriodValue() {

  JsonObject schedule = configuration["stages"][current_stage]["period"].as<JsonObject>();

  // 1. Get current time from NTP
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("[TIMER] Failed to obtain time from NTP");
    return 0; // Safe default fallback if time isn't synced
  }
  
  // Calculate current minutes since midnight
  int currentMins = (timeinfo.tm_hour * 60) + timeinfo.tm_min;

  // 2. Tracking variables
  int bestValue = 0;
  int maxBeforeCurrent = -1;
  
  int latestTimeOfDay = -1;
  int latestValueOfDay = 0;

  // 3. Iterate through every "HH:MM" key in the JSON object
  for (JsonPair kv : schedule) {
    int pMins = timeToMinutes(kv.key().c_str());
    if (pMins == -1) continue; // Skip invalid time formats
    
    int pVal = kv.value().as<int>(); // The target value (e.g., 100, 20)

    // Condition A: Find the closest period that has already passed TODAY
    if (pMins <= currentMins && pMins > maxBeforeCurrent) {
      maxBeforeCurrent = pMins;
      bestValue = pVal;
    }

    // Condition B: Keep track of the absolute latest period of the day (e.g., 23:30)
    if (pMins > latestTimeOfDay) {
      latestTimeOfDay = pMins;
      latestValueOfDay = pVal;
    }
  }

  // 4. Return the correct value
  if (maxBeforeCurrent != -1) {
    // We found a period that triggered earlier today
    return bestValue; 
  } else {
    // It's early morning (e.g., 09:00), no periods have triggered today yet.
    // Use the value from the last period of yesterday (e.g., 23:30).
    return latestValueOfDay; 
  }
}


void updateLights() {

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
  // Serial.println("0");

  

  if (last_stage == current_stage) {

    // Serial.println("1");

//    pwm.setPWM(2, 0, min(farRedPWM, 4095));
//    farRedCurrent = farRedPPFD;
//    PWMFARRED = farRedPWM * 100.0 / 4095.0;

    float ppfd = light_sensor_result; // PPFD ที่ sensor อ่านได้
    float expected_fullspectrum_ppfd = bluePPFD + deepRedPPFD + whitePPFD; // ค่า PPFD target ไม่รวม Far Red
    
    float divider = blue + deepRed + white + farRed;

    // float ppfd_adjustment = max(min(expected_fullspectrum_ppfd - ppfd, ppfd_adjust_limit), -ppfd_adjust_limit);
    // float adjusted_ppfd = expected_fullspectrum_ppfd + ppfd_adjustment;

    Serial.printf("Current: %f\n", fullSpectrumCurrentPPFD);
    Serial.printf("Expected: %f\n", expected_fullspectrum_ppfd);

    if (ppfd > expected_fullspectrum_ppfd || fullSpectrumCurrentPPFD - expected_fullspectrum_ppfd > ppfd_adjust_limit) { // ถ้าค่าที่อ่านได้ มากกว่าที่ต้องการ
      // Serial.println("2");

      float final_ppfd_blue = (fullSpectrumCurrentPPFD - 1) * blue / divider;
      float final_ppfd_red = (fullSpectrumCurrentPPFD - 1) * deepRed / divider;
      float final_ppfd_white = (fullSpectrumCurrentPPFD - 1) * white / divider;
      float final_ppfd_farRed = (fullSpectrumCurrentPPFD - 1) * farRed / divider;
          
      int final_pwm_blue = final_ppfd_blue * 4095 / MAX_PPFD_BLUE;
      int final_pwm_red = final_ppfd_red * 4095 / MAX_PPFD_DEEP_RED;
      int final_pwm_white = final_ppfd_white * 4095 / MAX_PPFD_WHITE;
      int final_pwm_farRed = final_ppfd_farRed * 4095 / MAX_PPFD_FAR_RED;

      if (expected_fullspectrum_ppfd - fullSpectrumCurrentPPFD < ppfd_adjust_limit &&
          final_pwm_blue  >= 0 &&
          final_pwm_red   >= 0 && 
          final_pwm_white >= 0 && 
          final_pwm_farRed >= 0
      ) {
        // เบาแสง
        fullSpectrumCurrentPPFD--;

        blueCurrent = final_ppfd_blue;
        redCurrent = final_ppfd_red;
        whiteCurrent = final_ppfd_white;
        farRedCurrent = final_ppfd_farRed;

        ledcWrite(WHITE_PWM, final_pwm_white);
        ledcWrite(RED_PWM, final_pwm_red);
        ledcWrite(BLUE_PWM, final_pwm_blue);
        ledcWrite(FARRED_PWM, final_pwm_farRed);
        
        
        PWMBLUE = final_pwm_blue * 100.0 / 4095.0;
        PWMRED = final_pwm_red * 100.0 / 4095.0;
        PWMWHITE = final_pwm_white * 100.0 / 4095.0;
        PWMFARRED = final_pwm_farRed * 100.0 / 4095.0;
      }
    } else if (ppfd < expected_fullspectrum_ppfd || expected_fullspectrum_ppfd - fullSpectrumCurrentPPFD > ppfd_adjust_limit) {

      float final_ppfd_blue = (fullSpectrumCurrentPPFD + 1) * blue / divider;
      float final_ppfd_red = (fullSpectrumCurrentPPFD + 1) * deepRed / divider;
      float final_ppfd_white = (fullSpectrumCurrentPPFD + 1) * white / divider;
      float final_ppfd_farRed = (fullSpectrumCurrentPPFD + 1) * farRed / divider;
          
      int final_pwm_blue = final_ppfd_blue * 4095 / MAX_PPFD_BLUE;
      int final_pwm_red = final_ppfd_red * 4095 / MAX_PPFD_DEEP_RED;
      int final_pwm_white = final_ppfd_white * 4095 / MAX_PPFD_WHITE;
      int final_pwm_farRed = final_ppfd_farRed * 4095 / MAX_PPFD_FAR_RED;

      if (fullSpectrumCurrentPPFD - expected_fullspectrum_ppfd < ppfd_adjust_limit &&
          final_pwm_blue  <= 4095 &&
          final_pwm_red   <= 4095 &&
          final_pwm_white <= 4095 && 
          final_pwm_farRed <= 4095
          
      ) {
        // เพิ่มแสง
        fullSpectrumCurrentPPFD++;

        blueCurrent = final_ppfd_blue;
        redCurrent = final_ppfd_red;
        whiteCurrent = final_ppfd_white;
        farRedCurrent = final_ppfd_farRed;

       ledcWrite(WHITE_PWM, final_pwm_white);
        ledcWrite(RED_PWM, final_pwm_red);
        ledcWrite(BLUE_PWM, final_pwm_blue);
        ledcWrite(FARRED_PWM, final_pwm_farRed);

        PWMBLUE = final_pwm_blue * 100.0 / 4095.0;
        PWMRED = final_pwm_red * 100.0 / 4095.0;
        PWMWHITE = final_pwm_white * 100.0 / 4095.0;
        PWMFARRED = final_pwm_farRed * 100.0 / 4095.0;
      }
    }

  } else {
    last_stage = current_stage;
    
    fullSpectrumCurrentPPFD = bluePPFD + deepRedPPFD + whitePPFD;
    Serial.printf("Initial Current: %f\n", fullSpectrumCurrentPPFD);

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
  

}

void setup() {
  // --- Serial 2 (ESP-32 CAM connector) ---

//  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println("\n--- Booting ESP32 ---");

  ledcAttach(WHITE_PWM, FREQUENCY, RESOLUTION);
  ledcAttach(RED_PWM, FREQUENCY, RESOLUTION);
  ledcAttach(BLUE_PWM, FREQUENCY, RESOLUTION);
  ledcAttach(FARRED_PWM, FREQUENCY, RESOLUTION);

  ledcWrite(WHITE_PWM, 0);
  ledcWrite(RED_PWM, 0);
  ledcWrite(BLUE_PWM, 0);
  ledcWrite(FARRED_PWM, 0);

  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_8_5dBm); 

  // WiFi Init
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // I2C & Hardware Init
  Wire.begin(I2C_SDA, I2C_SCL);

  // Preferences (Saved Config)
  preferences.begin("my-app", true); 
  String savedJson = preferences.getString("config", "{}");
  preferences.end();

  Serial.println(savedJson);
  
  if (savedJson != "{}") {
    deserializeJson(configuration, savedJson);
    Serial.println("[Pref] Configuration Loaded!");
  } else {
    Serial.println("[Pref] No Configuration Found!");
  }

  // TSL2591 Init (รวมโค้ดที่ซ้ำซ้อนกันให้เหลือชุดเดียว)
  if (!tsl.begin()) {
    Serial.println("No TSL2591 sensor found ... check your wiring?");
  } else {
    Serial.println("Found TSL2591 sensor");
    tsl.setGain(TSL2591_GAIN_LOW); 
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS); 
  }

  // WebSocket Init
  webSocket.begin(server_ip, server_port, "/hardware/command");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  Serial.println("Waiting for power to stabilize...");
  delay(2000);

  // เปิดใช้งานตัวจับไฟตกกลับคืนมาเพื่อความปลอดภัยของระบบระยะยาว
//  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);

  Serial.println("Setup Completed. Starting main loop...");

}

void loop() {
 webSocket.loop();
 getAnalyseResult();
  
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck > 10000) {
    WiFi.disconnect();
    WiFi.reconnect(); 
    lastWiFiCheck = millis();
  }

  if (millis() - lastPeriod > sendDataPeriod) {
    lastPeriod = millis();
    sendDataToServer();
  }

  if (millis() - lastPhotoPeriod > autoCapturePeriod) {
    lastPhotoPeriod = millis();
    Serial2.println("RESCAN");
  }

  if (millis() - lastMinutePeriod > 1000) {
    lastMinutePeriod = millis();

    light_sensor_result = readFullSpectrum();

    updateLights();
  }

}