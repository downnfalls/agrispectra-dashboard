#include <WiFi.h>
#include "time.h"
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include <Preferences.h>
#include <WebSocketsClient.h>

#include <Adafruit_TSL2591.h>

#define sensor_t esp_camera_sensor_t
#include "esp_camera.h"
#undef sensor_t

// ========= WebSocket Client ============
WebSocketsClient webSocket;
const char *server_ip = "172.20.10.2";

// ===========================
// Select camera model in board_config.h
// ===========================
#include "board_config.h"
Preferences preferences;

// ===========================
// tsl light sensor
Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);

// ===========================
// Enter your WiFi credentials
// ===========================
const char *ssid = "June";
const char *password = "12345678";

// ===========================
// NTP 
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600; // Timezone +7
const int   daylightOffset_sec = 0;

// ===========================
// PIN & PWM Configuration with PCA9685
#define I2C_SDA 14
#define I2C_SCL 15
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

void setPWM_8bit(uint8_t channel, uint8_t brightness_8bit) {
  // convert 8-bit to 12-bit for PCA9685
  uint16_t pwm_12bit = map(brightness_8bit, 0, 255, 0, 4095);
  pwm.setPWM(channel, 0, pwm_12bit);
}

//============================
// Data Structures
struct Period {
  String timeStr;
  int value;
};

struct StageConfig {
  String stageName;
  float ppfd;
  int red, farRed, blue, white, leaf, diameter;
  Period periods[10]; 
  int periodCount = 0;
  int currentActiveValue = -1;
  float leafDensity; 
  int leafCount;
};

StageConfig savedStages[10];
int totalStages = 0;
  
// ===========================
// example value from model AL  
int current_leaf_count = 0;
int current_leaf_density = 0;
int active_ai_stage_idx = 0;

// ===========================
unsigned long lastPhotoTime = 0;
const unsigned long PHOTO_INTERVAL = 3600000; 

// PWM เดิม
int base_pwm_red = 0, base_pwm_blue = 0, base_pwm_white = 0, base_pwm_far_red = 0;

// ===========================
// Max PPFD Eff 75%
const float MAX_PPFD_WHITE = 112.5;
const float MAX_PPFD_DEEP_RED = 381.0;
const float MAX_PPFD_FAR_RED = 65.0025;
const float MAX_PPFD_BLUE = 125.0025;

// ===========================

// Light control fn (ratio, periodValue 1-100%)
void updateLights(int stageIdx, int targetPPFD) {
  if (targetPPFD <= 0) {
    setPWM_8bit(0, 0); setPWM_8bit(1, 0); setPWM_8bit(2, 0); setPWM_8bit(3, 0);
    return;
  }

  // base pwm 
  float target_ppfd_red = targetPPFD * savedStages[stageIdx].red / 100.0;
  float target_ppfd_far_red = targetPPFD * savedStages[stageIdx].farRed / 100.0;
  float target_ppfd_blue = targetPPFD * savedStages[stageIdx].blue / 100.0;
  float target_ppfd_white = targetPPFD * savedStages[stageIdx].white / 100.0;

  int base_pwm_red = constrain((int)(target_ppfd_red / MAX_PPFD_DEEP_RED * 255), 0, 255);
  int base_pwm_far_red = constrain((int)(target_ppfd_far_red / MAX_PPFD_FAR_RED * 255), 0, 255);
  int base_pwm_blue = constrain((int)(target_ppfd_blue / MAX_PPFD_BLUE * 255), 0, 255);
  int base_pwm_white = constrain((int)(target_ppfd_white / MAX_PPFD_WHITE * 255), 0, 255);   

  // base opne
  setPWM_8bit(0, base_pwm_white);
  setPWM_8bit(1, base_pwm_blue);
  setPWM_8bit(2, base_pwm_red);
  setPWM_8bit(3, base_pwm_far_red);
  
  delay(100); 

  // check
  adjustLightAndSendTelemetry(targetPPFD);
}

// ===========================
int timeToMinutes(String timeStr) {
  int colonIndex = timeStr.indexOf(':');
  if (colonIndex == -1) return -1;
  int hours = timeStr.substring(0, colonIndex).toInt();
  int mins = timeStr.substring(colonIndex + 1).toInt();
  return (hours * 60) + mins;
}

// use period value to control light
int getActivePeriodValue(int stageIdx, String currentHourMinute) {
  int currentMins = timeToMinutes(currentHourMinute);
  if (currentMins == -1) return 0;

  int bestValue = 0;
  int maxBeforeCurrent = -1;
  int latestTimeOfDay = -1;
  int latestValueOfDay = 0;

  for (int p = 0; p < savedStages[stageIdx].periodCount; p++) {
    int pMins = timeToMinutes(savedStages[stageIdx].periods[p].timeStr);
    if (pMins == -1) continue;

    if (pMins <= currentMins && pMins > maxBeforeCurrent) {
      maxBeforeCurrent = pMins;
      bestValue = savedStages[stageIdx].periods[p].value;
    }

    if (pMins > latestTimeOfDay) {
      latestTimeOfDay = pMins;
      latestValueOfDay = savedStages[stageIdx].periods[p].value;
    }
  }

  if (maxBeforeCurrent != -1) {
    return bestValue;
  } else {
    return latestValueOfDay; 
  }
}

int current_stage;
void checkPeriodTimer() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return;

  char timeStringBuff[10];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%H:%M", &timeinfo);
  String nowTime = String(timeStringBuff);

  static String lastProcessedMinute = "";
  if (nowTime != lastProcessedMinute) {
    lastProcessedMinute = nowTime;

    current_stage = active_ai_stage_idx; 
    
    if (savedStages[current_stage].periodCount > 0) {
      int targetValue = getActivePeriodValue(current_stage, nowTime);
      
      if (targetValue != savedStages[current_stage].currentActiveValue) {
        Serial.printf("\n[Stage %s] Time is %s -> Switching to %d%%\n", savedStages[current_stage].stageName.c_str(), nowTime.c_str(), targetValue);
        savedStages[current_stage].currentActiveValue = targetValue * savedStages[current_stage].ppfd / 100;
        updateLights(current_stage, savedStages[current_stage].currentActiveValue); 
      }
    }
  }
}

bool isCapturing = false;

void captureAndSendAnalysis() {
  if (isCapturing) {
    Serial.println("[CAM] Busy... Ignored.");
    return;
  }
  isCapturing = true;
  Serial.println("\n[CAM] === Capture & Analysis Started ===");

  // --- MOCKUP: ตั้งค่า leaf ที่วิเคราะห์ได้ ---
  current_leaf_count = 4;
  current_leaf_density = 20;
  Serial.printf("[CAM] Mockup: leaf_count=%d, leaf_density=%d\n", 
                current_leaf_count, current_leaf_density);

  // --- สร้าง Analysis JSON (ตอนนี้พิมพ์ลง Serial อย่างเดียว) ---
  DynamicJsonDocument doc(512);
  doc["stage"] = (totalStages > 0) ? savedStages[active_ai_stage_idx].stageName : "No-Stage";
  doc["leaf_count"] = current_leaf_count;
  doc["leaf_density"] = current_leaf_density;

  String jsonPayload;
  serializeJson(doc, jsonPayload);
  Serial.println("[CAM] Analysis Generated (Ready for Client Tx): " + jsonPayload);

  // --- ประเมินว่า Stage ต้องเปลี่ยนไหม ---
  evaluateStageFromAI();

  // --- ถ่ายรูป ---
  Serial.println("[CAM] Capturing image...");
  camera_fb_t * fb = esp_camera_fb_get();
  if (fb) { esp_camera_fb_return(fb); delay(50); }

  fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAM] ERROR: Camera capture failed!");
    isCapturing = false;
    return;
  }
  
  Serial.printf("[CAM] Picture taken! Size: %zu bytes\n", fb->len);

  // ==========================================
  // TODO: เขียนโค้ดสำหรับส่งรูปภาพ (fb->buf, fb->len) ใหม่ตรงนี้
  // ==========================================
  

  esp_camera_fb_return(fb);
  Serial.println("[CAM] === Done ===\n");
  isCapturing = false;
}

// ===========================
void evaluateStageFromAI() {
  Serial.println("[STAGE] Evaluating Stage...");
  Serial.printf("[STAGE] Current: leaf=%d, density=%d\n", 
                current_leaf_count, current_leaf_density);

  int matched_stage = 0;
  for (int i = 0; i < totalStages; i++) {
    Serial.printf("[STAGE] Check %s: need leaf>=%d, density>=%.2f\n",
                  savedStages[i].stageName.c_str(), 
                  savedStages[i].leafCount, savedStages[i].leafDensity);
    if (current_leaf_count >= savedStages[i].leafCount && 
        current_leaf_density >= savedStages[i].leafDensity) {
      matched_stage = i;
    }
  }
  
  Serial.printf("[STAGE] Matched: %s\n", savedStages[matched_stage].stageName.c_str());

  if (active_ai_stage_idx != matched_stage) {
    active_ai_stage_idx = matched_stage;
    Serial.printf("[STAGE] >>> CHANGED to: %s <<<\n", 
                  savedStages[active_ai_stage_idx].stageName.c_str());
    checkPeriodTimer();
  } else {
    Serial.println("[STAGE] No change needed.");
  }
}

// feedback loop 
void adjustLightAndSendTelemetry(int targetTotalPPFD) {
  if (targetTotalPPFD <= 0) {
    Serial.println("[LIGHT] Target PPFD=0, Lights OFF.");
    return;
  }
  Serial.printf("\n[LIGHT] Target PPFD: %d\n", targetTotalPPFD);

  float w_ratio = savedStages[active_ai_stage_idx].white / 100.0;
  float r_ratio = savedStages[active_ai_stage_idx].red / 100.0;
  float b_ratio = savedStages[active_ai_stage_idx].blue / 100.0;
  float fr_ratio = savedStages[active_ai_stage_idx].farRed / 100.0;
  float conversion_factor = (60.0 * w_ratio) + (42.0 * r_ratio) + (68.0 * b_ratio);

  int adj_r = base_pwm_red, adj_w = base_pwm_white, adj_b = base_pwm_blue;
  float actual_total_ppfd = 0;

  Serial.println("[LIGHT] Starting compensation loop...");
  for (int step = 0; step <= 50; step++) {
    uint32_t lum = tsl.getFullLuminosity();
    actual_total_ppfd = (lum & 0xFFFF) * conversion_factor;

    if (actual_total_ppfd >= targetTotalPPFD * 0.98) {
      Serial.printf("[LIGHT] Target reached at step %d (%.2f PPFD)\n", 
                    step, actual_total_ppfd);
      break;
    }
    if (step < 50) {
      bool inc = false;
      if (r_ratio > 0 && adj_r < 255 && adj_r < base_pwm_red + 50)   { adj_r++; inc = true; }
      if (w_ratio > 0 && adj_w < 255 && adj_w < base_pwm_white + 50) { adj_w++; inc = true; }
      if (b_ratio > 0 && adj_b < 255 && adj_b < base_pwm_blue + 50)  { adj_b++; inc = true; }
      if (!inc) { Serial.println("[LIGHT] Max PWM reached."); break; }
      setPWM_8bit(0, adj_w); setPWM_8bit(1, adj_b); setPWM_8bit(2, adj_r);
      delay(150);
    }
  }

  delay(100);
  actual_total_ppfd = (tsl.getFullLuminosity() & 0xFFFF) * conversion_factor;

  // สร้าง JSON แบบ flat (ตอนนี้พิมพ์ลง Serial อย่างเดียว)
  DynamicJsonDocument doc(1024);
  doc["total"] = actual_total_ppfd;

  JsonObject wInfo = doc.createNestedObject("white");
  wInfo["value"] = actual_total_ppfd * w_ratio;
  wInfo["diff"]  = (actual_total_ppfd * w_ratio) - (targetTotalPPFD * w_ratio);

  JsonObject bInfo = doc.createNestedObject("blue");
  bInfo["value"] = actual_total_ppfd * b_ratio;
  bInfo["diff"]  = (actual_total_ppfd * b_ratio) - (targetTotalPPFD * b_ratio);

  JsonObject rInfo = doc.createNestedObject("red");
  rInfo["value"] = actual_total_ppfd * r_ratio;
  rInfo["diff"]  = (actual_total_ppfd * r_ratio) - (targetTotalPPFD * r_ratio);

  JsonObject frInfo = doc.createNestedObject("farRed");
  frInfo["value"] = actual_total_ppfd * fr_ratio;
  frInfo["diff"]  = (actual_total_ppfd * fr_ratio) - (targetTotalPPFD * fr_ratio);

  String outputPayload;
  serializeJson(doc, outputPayload);
  Serial.println("[LIGHT] Telemetry Generated (Ready for Client Tx): " + outputPayload);
}

// ===========================
bool parseAndApplyJSON(String jsonString) {
  DynamicJsonDocument doc(4096); 
  DeserializationError error = deserializeJson(doc, jsonString);

  if (error) return false;

  JsonObject root = doc.as<JsonObject>();
  totalStages = 0;

  Serial.println("\n=== NEW CONFIGURATION LOADED ===");

  for (JsonPair kv : root) {
    String keyName = kv.key().c_str();

    // ข้าม Key ที่ไม่ใช่ Stage
    if (keyName == "profile_id" || keyName == "profile_name" || keyName == "action") {
      Serial.println("Skipped Non-Stage Key: " + keyName);
      continue; 
    }

    if (totalStages >= 10) break; 

    String stageName = keyName;
    JsonObject stageData = kv.value().as<JsonObject>();

    savedStages[totalStages].stageName = stageName;
    savedStages[totalStages].red = stageData["red"] | 0;
    savedStages[totalStages].farRed = stageData["farRed"] | 0;
    savedStages[totalStages].blue = stageData["blue"] | 0;
    savedStages[totalStages].white = stageData["white"] | 0;
    
    if (stageData["leaf"].isNull()) {
        savedStages[totalStages].leafCount = 0;
    } else {
        savedStages[totalStages].leafCount = stageData["leaf"];
    }
    
    savedStages[totalStages].leafDensity = stageData["leaf_density"] | 0.0;
    savedStages[totalStages].ppfd = stageData["ppfd"] | 0;
    savedStages[totalStages].currentActiveValue = -1; 

    Serial.printf("Stage: %s | PPFD: %.2f | R:%d, FR:%d, B:%d, W:%d | Leaf: %d, Density: %.2f\n", 
                  stageName.c_str(), savedStages[totalStages].ppfd,
                  savedStages[totalStages].red, savedStages[totalStages].farRed, 
                  savedStages[totalStages].blue, savedStages[totalStages].white, 
                  savedStages[totalStages].leafCount, savedStages[totalStages].leafDensity);

    JsonObject periodObj = stageData["period"];
    int pIndex = 0;
    for (JsonPair pkv : periodObj) {
      if (pIndex >= 10) break;
      savedStages[totalStages].periods[pIndex].timeStr = pkv.key().c_str(); 
      savedStages[totalStages].periods[pIndex].value = pkv.value().as<int>(); 
      
      Serial.printf("  -> Period: %s = %d%%\n", savedStages[totalStages].periods[pIndex].timeStr.c_str(), savedStages[totalStages].periods[pIndex].value);
      pIndex++;
    }
    savedStages[totalStages].periodCount = pIndex;
    totalStages++;
  }
  Serial.println("================================\n");
  
  active_ai_stage_idx = 0; 
  checkPeriodTimer(); 
  
  return true;
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("🔴 [WS] Disconnected from Go Server");
      break;
      
    case WStype_CONNECTED:
      Serial.println("🟢 [WS] Connected to Go Server!");
      break;
      
    case WStype_TEXT:
      // ปริ้นข้อความดิบๆ ที่ Go ส่งมาออกทางหน้าจอเลย
      Serial.printf("📥 [WS] Raw Message Received: %s\n", payload);
      break;
      
    case WStype_PING:
      Serial.println("🏓 [WS] Received PING from Server");
      break;
      
    case WStype_PONG:
      Serial.println("🏓 [WS] Received PONG from Server");
      break;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  // --- Setup PWM with PCA9685 ---
  Wire.begin(I2C_SDA, I2C_SCL);
  pwm.begin();
  pwm.setOscillatorFrequency(27000000); 
  pwm.setPWMFreq(1000); 

  setPWM_8bit(0, 0); // White
  setPWM_8bit(1, 0); // Blue
  setPWM_8bit(2, 0); // Deep Red
  setPWM_8bit(3, 0); // Far-Red

  // --- Setup TSL2591 Light Sensor ---
  if (!tsl.begin()) {
    Serial.println("No TSL2591 sensor found ... check your wiring?");
  } else {
    Serial.println("Found TSL2591 sensor");
    tsl.setGain(TSL2591_GAIN_LOW); 
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS); 
  }

  // --- Setup Camera ---
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_HD; 
  config.pixel_format = PIXFORMAT_JPEG;  
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 4;
  config.fb_count = 1;

  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 12;
      config.fb_count = 1;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    config.frame_size = FRAMESIZE_240X240;
#if CONFIG_IDF_TARGET_ESP32S3
    config.fb_count = 2;
#endif
  }

  esp_err_t err = esp_camera_init(&config);
 
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    Serial.println("Restarting ESP32 in 3 seconds...");
    delay(3000);
    ESP.restart(); 
  }

  esp_camera_sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1); 
    s->set_saturation(s, -2);
  }

  if (config.pixel_format == PIXFORMAT_JPEG) {
    s->set_framesize(s, FRAMESIZE_VGA); 
  }

  // --- Setup WiFi ---
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);
  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("Device IP: ");
  Serial.println(WiFi.localIP());

  // --- Setup Time (NTP) --- 
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("NTP Time configured.");

  // --- Load Preferences at Startup ---
  preferences.begin("my-app", true); 
  String savedJson = preferences.getString("config", "{}");
  preferences.end();

  if (savedJson != "{}") {
    Serial.println("\n--- Loading Saved Config from Flash ---");
    parseAndApplyJSON(savedJson);
    Serial.println("-> Successfully loaded and applied saved config");
  } else {
    Serial.println("\n--- No Saved Config Found in Flash ---");
  }


  // WebSocket init
  webSocket.begin(server_ip, 8080, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

unsigned long lastWiFiCheck = 0; 

void loop() {
  // เช็คสถานะ WiFi ทุกๆ 10 วินาที ถ้าหลุดให้พยายามต่อใหม่
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck > 10000) {
    Serial.println("WiFi disconnected! Trying to reconnect...");
    WiFi.disconnect();
    WiFi.reconnect(); 
    lastWiFiCheck = millis();
  }
   
  checkPeriodTimer();  

  // จับเวลาทุกๆ 1 ชั่วโมงถ่ายรูป (3600000 ms)
  if (millis() - lastPhotoTime >= PHOTO_INTERVAL) {
    lastPhotoTime = millis();
    Serial.println("Auto Capture Triggered (1 Hour Interval)");
    captureAndSendAnalysis(); 
  }
}