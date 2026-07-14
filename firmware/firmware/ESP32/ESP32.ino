#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <Wire.h>
#include <WiFi.h>
#include <time.h>
#include <ArduinoJson.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_TSL2591.h>
#include <esp_task_wdt.h>
#include <PZEM004Tv30.h>

#define WDT_TIMEOUT 15

#define RXD1 25
#define TXD1 26
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

#define WIFI_SSID "ENGSRCKU"
#define WIFI_PASSWORD "60176549"
#define SERVER_IP "140.99.98.15"
#define SERVER_PORT 8080
#define NTP_SERVER "pool.ntp.org"
#define TIMEZONE 7 * 3600

#define MAX_PPFD_WHITE 107.49 
#define MAX_PPFD_DEEP_RED 347.1066667 
#define MAX_PPFD_FAR_RED 108.3375 
#define MAX_PPFD_BLUE 122.4433333 

WebSocketsClient webSocket;
Preferences preferences;
Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);
PZEM004Tv30 pzem(Serial1, RXD1, TXD1);

const int autoCapturePeriod = 1 * 60 * 60 * 1000;
const int lightDetectPeriod = 1 * 1000;
const int sendDataPeriod = 5 * 1000;

const float ppfd_adjust_limit = 50.0;

const String server_url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT);
int leaf_count = 0;
float harvest_readiness = 0.0;
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
  uint16_t full = lum & 0xFFFF; // ใช้ค่า Raw Data แท้ๆ
  
  // ดึงค่า Target (%) จาก UI (สมมติว่าเป็นค่า 0 - 100)
  float current_blue = blueTarget; 
  float current_red = redTarget;   
  float current_white = whiteTarget; 
  
  float ppfd = 0.0;

  // ป้องกันการหารด้วย 0 กรณีปิดไฟหมด
  if (current_blue == 0.0 && current_red == 0.0 && current_white == 0.0) {
    return 0.0;
  }

  // --- Step 1: จำลองหาค่า Raw ที่ควรจะเป็น หากเปิดไฟตาม % นี้ ---
  // (นำ % การเปิดไฟ มาคูณกับค่า Raw สูงสุดที่เทสได้ของแต่ละสี)
  float exp_b = (current_blue / 100.0) * 406.0;
  float exp_r = (current_red / 100.0) * 5124.0;
  float exp_w = (current_white / 100.0) * 1509.0;
  float exp_total = exp_b + exp_r + exp_w;

  if (exp_total > 0.0) {
    // --- Step 2: หาสัดส่วนน้ำหนักแสงจริงที่กระแทกเข้าเซ็นเซอร์ ---
    float weight_b = exp_b / exp_total;
    float weight_r = exp_r / exp_total;
    float weight_w = exp_w / exp_total;

    // --- Step 3: คำนวณ Dynamic Factor ---
    // ค่าคงที่เกิดจาก: PPFD 100% (จากตาราง) ÷ Raw 100% (ที่คุณเพิ่งส่งมา)
    // Blue  : 123.41 / 406.0  = 0.30396
    // Red   : 342.88 / 5124.0 = 0.06691
    // White : 107.77 / 1509.0 = 0.07141
    float dynamic_factor = (weight_b * 0.30396) +
                           (weight_r * 0.06691) +
                           (weight_w * 0.07141);

    // --- Step 4: แปลงเป็น PPFD ขั้นสุดท้าย ---
    ppfd = full * dynamic_factor;
  }

  return ppfd * (1 + 0.14848485); 
}

void analyseStage(int leaf, float growth) {
  String bestStage = "Unknown";
  
  // เก็บคุณสมบัติของ Stage ที่ดีที่สุด ณ ตอนนี้
  int bestConditionCount = -1; // จำนวนเงื่อนไขที่ตรวจเช็ก (ยิ่งเยอะยิ่งเจาะจง)
  int bestLeafReq = -1;
  float bestGrowReq = -1.0;

  for (JsonPair kv : configuration["stages"].as<JsonObject>()) {
    String stageName = kv.key().c_str();
    JsonObject reqs = kv.value().as<JsonObject>();

    bool hasLeafReq = reqs.containsKey("leaf") && !reqs["leaf"].isNull();
    bool hasGrowReq = reqs.containsKey("growth") && !reqs["growth"].isNull();
    int reqLeaf = hasLeafReq ? reqs["leaf"].as<int>() : 0;
    float reqGrow = hasGrowReq ? reqs["growth"].as<float>() : 0.0;

    // 1. ตรวจสอบว่าผ่านเงื่อนไขพื้นฐานไหม
    bool passLeaf = !hasLeafReq || (leaf >= reqLeaf);
    bool passGrow = !hasGrowReq || (growth >= reqGrow);

    if (passLeaf && passGrow) {
      // นับว่า Stage นี้มีเงื่อนไขระบุไว้กี่อย่าง (0, 1, หรือ 2)
      int currentConditionCount = (hasLeafReq ? 1 : 0) + (hasGrowReq ? 1 : 0);

      bool isBetter = false;

      // 2. เปรียบเทียบเพื่อหา "Best Stage"
      if (currentConditionCount > bestConditionCount) {
        // เคสที่ 1: Stage นี้มีความจำเพาะเจาะจงมากกว่า (เช่น เช็กทั้ง 2 เงื่อนไข ชนะแบบเช็กเงื่อนไขเดียว)
        isBetter = true;
      } 
      else if (currentConditionCount == bestConditionCount) {
        // เคสที่ 2: จำนวนเงื่อนไขเท่ากัน ให้ดูว่าค่าตัวเลขใครสูงกว่า (เจริญเติบโตไปไกลกว่า)
        if (hasLeafReq && reqLeaf > bestLeafReq) isBetter = true;
        if (hasGrowReq && reqGrow > bestGrowReq) isBetter = true;
      }

      // ถ้า Stage นี้ดีกว่าตัวเก่า ให้ update ค่า
      if (isBetter) {
        bestConditionCount = currentConditionCount;
        bestLeafReq = reqLeaf;
        bestGrowReq = reqGrow;
        bestStage = stageName;
      }
    }
  }

  current_stage = bestStage;
  Serial.println("[Stage] Analyse Result: " + current_stage);
}

int timeToMinutes(const char* timeStr) {
  String t = String(timeStr);
  int colonIndex = t.indexOf(':');
  if (colonIndex == -1) return -1;
  int hours = t.substring(0, colonIndex).toInt();
  int mins = t.substring(colonIndex + 1).toInt();
  return (hours * 60) + mins;
}

int getCurrentPeriodValue() {
  JsonObject schedule = configuration["stages"][current_stage]["period"].as<JsonObject>();

  struct tm timeinfo;
  
  // --- [FIXED] ลด Timeout ลงเหลือแค่ 100ms ป้องกันการ Block ลูปจน WDT เตะเมื่อ WiFi หลุด ---
  if (!getLocalTime(&timeinfo, 100)) {
    Serial.println("[TIMER] Failed to obtain time from NTP (using 0)");
    return 0; 
  }
  
  int currentMins = (timeinfo.tm_hour * 60) + timeinfo.tm_min;

  int bestValue = 0;
  int maxBeforeCurrent = -1;
  
  int latestTimeOfDay = -1;
  int latestValueOfDay = 0;

  for (JsonPair kv : schedule) {
    int pMins = timeToMinutes(kv.key().c_str());
    if (pMins == -1) continue; 
    
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
  
  http.setTimeout(3000); 

  http.begin("http://" + String(SERVER_IP) + ":"+ String(SERVER_PORT) +"/hardware/state");
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"stage\": \""+(harvest_readiness >= 100.0 ? "Harvestable" : current_stage)+"\", \"leaf_count\": " + String(leaf_count) + ", \"harvest_readiness\": " + String(harvest_readiness) + ", \"total\": "+ tsl_ppfd + ", \"power_watts\": "+ (isnan(pzem.power()) ? 0.0 : pzem.power()) + ", \"white\": {\"value\": "+ whiteCurrent +", \"diff\": "+ (whiteCurrent - whiteTarget) +", \"pwm\": "+ PWMWHITE +"}, \"blue\": {\"value\": "+ blueCurrent +", \"diff\": "+ (blueCurrent - blueTarget) +", \"pwm\": "+ PWMBLUE +"}, \"red\": {\"value\": "+ redCurrent+", \"diff\": "+ (redCurrent - redTarget) +", \"pwm\": "+ PWMRED +"}, \"farRed\": {\"value\": "+ farRedCurrent +", \"diff\": "+ (farRedCurrent - farRedTarget) +", \"pwm\": "+ PWMFARRED +"}}";
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

      if (action == "EMERGENCY_STOP") {
        emergency_stop = true;
        ledcWrite(WHITE_PWM, 0);
        ledcWrite(RED_PWM, 0);
        ledcWrite(BLUE_PWM, 0);
        ledcWrite(FARRED_PWM, 0);
      }
      else if (action == "RESET") {
        ESP.restart();
      }
      else if (action == "FORCE_RESCAN") {
        Serial2.println("RESCAN");
        lastPhotoPeriod = millis();
      } 
      else if (action == "DEPLOY_PROFILE") {
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
    }
    break;
    case WStype_PING:
      break;
    case WStype_PONG:
      break;
  }
}

void getAnalyseResult() {
  if (Serial2.available()){
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

      if (incomingData.indexOf("{") != -1) {
        JsonDocument resultAfterAnalyse;
        DeserializationError error = deserializeJson(resultAfterAnalyse, incomingData);

        if (error) return;

        leaf_count = resultAfterAnalyse["leaf_count"];
        harvest_readiness = resultAfterAnalyse["harvestable"];

        analyseStage(leaf_count, harvest_readiness);
      }
    }

    Serial2.println("PONG");
  }
}

bool isSendingData = false;

// ฟังก์ชันนี้จะรันวนลูปแยกต่างหากบน Core 0
void telemetryTask(void *pvParameters) {
  for (;;) { // วนลูป Infinity เหมือน loop()
    
    // ย้ายการเช็คเวลามาไว้ในนี้
    if (millis() - lastDataSent > sendDataPeriod) {
      lastDataSent = millis();

      if (WiFi.status() == WL_CONNECTED && !isSendingData) {
        isSendingData = true;
        
        sendDataToServer(); // ตอนนี้การรอ HTTP จะไม่กระทบ loop() หลักแล้ว
        
        isSendingData = false;
      }
    }
    
    // **ข้อควรระวังสำคัญ:** ใน FreeRTOS ต้องสั่งหน่วงเวลาเล็กน้อยเสมอเพื่อคืน CPU 
    // ไม่งั้น Watchdog ของ Core 0 จะเตะเอาได้
    vTaskDelay(100 / portTICK_PERIOD_MS); 
  }
}

void setup() {
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);
  Serial2.setTimeout(200); 

  Serial1.begin(9600, SERIAL_8N1, RXD1, TXD1);
  Serial1.setTimeout(200); 
  
  Serial.begin(115200);
  delay(1000); 
  Serial.println("\n--- ESP32 START ---");

  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT * 1000, 
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1, 
    .trigger_panic = true 
  };
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
  
  // ให้ WiFi จัดการ Reconnect เองอัตโนมัติเบื้องหลัง
  WiFi.setAutoReconnect(true); 
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset(); 
  }
  Serial.println("\nWiFi Connected!");
  Serial.println(WiFi.localIP());

  configTime(7 * 3600, 0, "pool.ntp.org");

  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setTimeOut(100);

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

  // --- เพิ่มคำสั่งนี้เพื่อสตาร์ท Task พื้นหลัง ---
  xTaskCreatePinnedToCore(
    telemetryTask,    
    "TelemetryTask",  
    8192,             // <--- FIX: INCREASED RAM from 4096 to 8192
    NULL,             
    1,                
    NULL,             
    0                 
  );

  delay(2000);
}

void loop() {
  // Feed Watchdog
  esp_task_wdt_reset();

  // Serial.println("111");

  webSocket.loop();

  // Serial.println("222");

  getAnalyseResult();

  // Serial.println("333");

  // --- [FIXED] เปลี่ยนการรีคอนเนค WiFi ---
  // เมื่อเปิด setAutoReconnect(true) ไว้แล้ว เราแค่เช็คสถานะก็พอ 
  // หากอยากช่วยกระตุ้น ให้ใช้ WiFi.reconnect() แทนการ disconnect() และ begin() สลับไปมา 
  // เพราะการเรียกฟังก์ชันเหล่านี้ในลูปมีโอกาสเกิด Blocking จน WDT ทำงานไม่ทัน
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck > 10000) {
    Serial.println("WiFi Drop, letting AutoReconnect handle it (or re-initiating softly)...");
    WiFi.reconnect(); 
    lastWiFiCheck = millis();
  }

  // Serial.println("444");

  if (millis() - lastUpdateLight > lightDetectPeriod && !emergency_stop && !capturing) {
    lastUpdateLight = millis();
    updateLights();
  }

  // Serial.println("555");

  if (lastPhotoPeriod == 0 || millis() - lastPhotoPeriod > autoCapturePeriod) {
    lastPhotoPeriod = millis();
    Serial2.println("RESCAN");
  }

  // Serial.println("777");

  delay(10);
}