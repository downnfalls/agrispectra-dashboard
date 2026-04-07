#include "esp_camera.h"
#include <WiFi.h>
#include "time.h"
#include <ArduinoJson.h>
#include <WebSocketsServer.h>



const float MAX_PPF_WHITE = 90.0;     // 6500K
const float MAX_PPF_DEEP_RED = 305.0; // deep red
const float MAX_PPF_FAR_RED = 52.0;   // far red
const float MAX_PPF_BLUE = 100.0; // blue
// ===========================
// Select camera model in board_config.h
// ===========================
#include "board_config.h" 

// ===========================
// WiFi & NTP Credentials
// ===========================
const char *ssid = "June";
const char *password = "12345678";

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600; 
const int   daylightOffset_sec = 0;

WebSocketsServer webSocket = WebSocketsServer(8080);

void startCameraServer();
void setupLedFlash();

// ===========================
// PWM & Pin Configuration
// ===========================
// exsample
const int PIN_RED = 12;
const int PIN_FAR_RED = 13;
const int PIN_BLUE = 14;
const int PIN_WHITE = 15;

const int CH_RED = 1;
const int CH_FAR_RED = 2;
const int CH_BLUE = 3;
const int CH_WHITE = 4;

const int PWM_FREQ = 5000;
const int PWM_RES = 8; // 8-bit (0-255)

// ===========================
// Data Structures
// ===========================
struct Period {
  String timeStr;
  int value;
};

struct StageConfig {
  String stageName;
  int red, farRed, blue, white, leaf, diameter;
  Period periods[10]; 
  int periodCount = 0;
  int currentActiveValue = -1;
};

StageConfig savedStages[10];
int totalStages = 0;

// ===========================
// Helper Functions
// ===========================

int timeToMinutes(String t) {
  int colonIdx = t.indexOf(':');
  if (colonIdx == -1) return -1;
  int h = t.substring(0, colonIdx).toInt();
  int m = t.substring(colonIdx + 1).toInt();
  return (h * 60) + m;
}

float calculatePPF(int ppfd) {
  if (ppfd <= 0) return 0.0;
  return (ppfd * 0.6) / 0.75; 
}


void updateLights(int stageIdx, int targetPPFD) {
  // หากค่า PPFD = 0 ให้ปิดไฟทุกดวง
  if (targetPPFD <= 0) {
    ledcWrite(CH_RED, 0);
    ledcWrite(CH_FAR_RED, 0);
    ledcWrite(CH_BLUE, 0);
    ledcWrite(CH_WHITE, 0);
    Serial.println("💡 Lights OFF (PPFD = 0)");
    return;
  }

  //  PPF 
  float total_ppf = calculatePPF(targetPPFD);


  float target_red_ppf = total_ppf * (savedStages[stageIdx].red / 100.0);
  float target_farRed_ppf = total_ppf * (savedStages[stageIdx].farRed / 100.0);
  float target_blue_ppf = total_ppf * (savedStages[stageIdx].blue / 100.0);

  // pwm
  float pwm_red_pct = (target_red_ppf / MAX_PPF_DEEP_RED) * 100.0;
  float pwm_farRed_pct = (target_farRed_ppf / MAX_PPF_FAR_RED) * 100.0;
  float pwm_blue_pct = (target_blue_ppf / MAX_PPF_BLUE) * 100.0;

  // %PWM > 100% 
  if (pwm_red_pct > 100.0) pwm_red_pct = 100.0;
  if (pwm_farRed_pct > 100.0) pwm_farRed_pct = 100.0;
  if (pwm_blue_pct > 100.0) pwm_blue_pct = 100.0;


  float pwm_white_pct = 15.0;

 
  int pwm8_red = (pwm_red_pct / 100.0) * 255;
  int pwm8_farRed = (pwm_farRed_pct / 100.0) * 255;
  int pwm8_blue = (pwm_blue_pct / 100.0) * 255;
  int pwm8_white = (pwm_white_pct / 100.0) * 255;


  ledcWrite(CH_RED, pwm8_red);
  ledcWrite(CH_FAR_RED, pwm8_farRed);
  ledcWrite(CH_BLUE, pwm8_blue);
  ledcWrite(CH_WHITE, pwm8_white);

  Serial.println("=========================================");
  Serial.printf(" [Stage %d] Target PPFD: %d -> Total PPF: %.2f µmol/s\n", stageIdx + 1, targetPPFD, total_ppf);
  Serial.printf("   - Red (%.0f%%)   : PPF = %.2f -> PWM = %.0f%%\n", (float)savedStages[stageIdx].red, target_red_ppf, pwm_red_pct);
  Serial.printf("   - F-Red (%.0f%%) : PPF = %.2f -> PWM = %.0f%%\n", (float)savedStages[stageIdx].farRed, target_farRed_ppf, pwm_farRed_pct);
  Serial.printf("   - Blue (%.0f%%)  : PPF = %.2f -> PWM = %.0f%%\n", (float)savedStages[stageIdx].blue, target_blue_ppf, pwm_blue_pct);
  Serial.printf("   - White        : Fixed PWM = 15%%\n");
  Serial.println("=========================================");
}

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

    // หา Period ก่อนหน้าหรือเท่ากับเวลาปัจจุบัน ที่ใกล้ที่สุด
    if (pMins <= currentMins && pMins > maxBeforeCurrent) {
      maxBeforeCurrent = pMins;
      bestValue = savedStages[stageIdx].periods[p].value;
    }

    // เก็บค่าที่ดึกที่สุดของวันไว้เผื่อเวลาปัจจุบันเพิ่งพ้นเที่ยงคืน
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

void updateLights(int stageIdx, int intensityPercent) {

  int r = (savedStages[stageIdx].red * intensityPercent) / 100;
  int fr = (savedStages[stageIdx].farRed * intensityPercent) / 100;
  int b = (savedStages[stageIdx].blue * intensityPercent) / 100;
  int w = (savedStages[stageIdx].white * intensityPercent) / 100;

  ledcWrite(CH_RED, r);
  ledcWrite(CH_FAR_RED, fr);
  ledcWrite(CH_BLUE, b);
  ledcWrite(CH_WHITE, w);

  Serial.printf(" Lights Updated -> R:%d, FR:%d, B:%d, W:%d (Intensity: %d%%)\n", r, fr, b, w, intensityPercent);
}

// ===========================
// Core Logic
// ===========================
void checkPeriodTimer() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return;

  char timeStringBuff[10];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%H:%M", &timeinfo);
  String nowTime = String(timeStringBuff);

  static String lastProcessedMinute = "";
  if (nowTime != lastProcessedMinute) {
    lastProcessedMinute = nowTime;
    
    for (int i = 0; i < totalStages; i++) {
      if (savedStages[i].periodCount > 0) {
        int targetValue = getActivePeriodValue(i, nowTime);
        
        if (targetValue != savedStages[i].currentActiveValue) {
          Serial.printf("\n🔄 [Stage %d] Time is %s -> Switching to %d%%\n", i+1, nowTime.c_str(), targetValue);
          savedStages[i].currentActiveValue = targetValue;
          updateLights(i, targetValue); 
        }
      }
    }
  }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    Serial.println("\n--- New JSON Data Received ---");
    
    DynamicJsonDocument doc(4096); 
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
      Serial.print("Error Read JSON: ");
      Serial.println(error.c_str());
      return;
    }

    JsonObject root = doc.as<JsonObject>();
    totalStages = 0;

    for (JsonPair kv : root) {
      String stageName = kv.key().c_str();
      JsonObject stageData = kv.value().as<JsonObject>();

      savedStages[totalStages].stageName = stageName;
      savedStages[totalStages].red = stageData["red"];
      savedStages[totalStages].farRed = stageData["farRed"];
      savedStages[totalStages].blue = stageData["blue"];
      savedStages[totalStages].white = stageData["white"];
      savedStages[totalStages].leaf = stageData["leaf"];
      savedStages[totalStages].diameter = stageData["diameter"];
      savedStages[totalStages].currentActiveValue = -1; // รีเซ็ตเพื่อให้ฟังก์ชันเวลาอัปเดตไฟทันที

      JsonObject periodObj = stageData["period"];
      int pIndex = 0;
      for (JsonPair pkv : periodObj) {
        savedStages[totalStages].periods[pIndex].timeStr = pkv.key().c_str(); 
        savedStages[totalStages].periods[pIndex].value = pkv.value().as<int>(); 
        pIndex++;
      }
      savedStages[totalStages].periodCount = pIndex;

      Serial.printf("Saved %s -> R:%d, FR:%d, B:%d, W:%d | Periods: %d\n", 
                    stageName.c_str(), savedStages[totalStages].red, savedStages[totalStages].farRed, 
                    savedStages[totalStages].blue, savedStages[totalStages].white, pIndex);
      
      totalStages++;
    }
    

    checkPeriodTimer(); 
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  // --- Setup PWM ---
  ledcSetup(CH_RED, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_RED, CH_RED);
  
  ledcSetup(CH_FAR_RED, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_FAR_RED, CH_FAR_RED);

  ledcSetup(CH_BLUE, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_BLUE, CH_BLUE);

  ledcSetup(CH_WHITE, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_WHITE, CH_WHITE);

  // ปิดไฟก่อน
  updateLights(0, 0);

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
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG;  
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 10;
      config.fb_count = 2;
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

#if defined(CAMERA_MODEL_ESP_EYE)
  pinMode(13, INPUT_PULLUP);
  pinMode(14, INPUT_PULLUP);
#endif

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);        
    s->set_brightness(s, 1);   
    s->set_saturation(s, -2);  
  }
  if (config.pixel_format == PIXFORMAT_JPEG) {
    s->set_framesize(s, FRAMESIZE_QVGA);
  }

#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);
#endif

#if defined(CAMERA_MODEL_ESP32S3_EYE)
  s->set_vflip(s, 1);
#endif

#if defined(LED_GPIO_NUM)
  setupLedFlash();
#endif

  // --- Setup WiFi ---
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // --- Setup NTP Time ---
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Waiting for NTP time sync...");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nTime Synced!");

  startCameraServer();

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");

  // --- Setup WebSocket ---
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
  checkPeriodTimer(); 
}