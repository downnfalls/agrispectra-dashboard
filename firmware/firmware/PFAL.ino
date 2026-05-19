#include <WiFi.h>
#include "time.h"
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// แก้ไขการชนกันของชื่อ sensor_t ระหว่าง Camera และ Adafruit
#define sensor_t adafruit_sensor_t
#include <Adafruit_Sensor.h>
#include <Adafruit_TSL2591.h>
#undef sensor_t

// ==========================================
// [AI] นำเข้า Library ของ Edge Impulse AI
// ==========================================
#include <kriangdet-project-1_inferencing.h> // แก้ชื่อให้ตรงกับ ZIP ของคุณถ้ามีการเปลี่ยน
#include "edge-impulse-sdk/dsp/image/image.hpp"

#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H
#define CAMERA_MODEL_AI_THINKER 
#endif

// Pin Definitions
#define I2C_SDA 14
#define I2C_SCL 15
#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM  0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM    5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22
#define LED_GPIO_NUM   4

// Global Objects
WebSocketsClient webSocket;
Preferences preferences;
Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

// --- Configurations ---
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

// --- Variables Init ---

const String server_url = "http://" + String(server_ip) + ":" + String(server_port);
int leaf_count = 0;
bool harvestable = false;
String current_stage = "Unknown";
String last_stage = "Unknown";

// [AI] Variables สำหรับเก็บสถิติ
int plant_count = 0;
int ready_count = 0;
float avg_leaves_per_plant = 0.0;

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

// ==========================================
// [AI] Data Callback สำหรับ Edge Impulse
// ==========================================
static uint8_t *ei_camera_frame_buffer;

int ei_camera_get_data(size_t offset, size_t length, float *out_ptr) {
  size_t pixel_ix = offset * 3;
  size_t pixels_left = length;
  size_t out_ptr_ix = 0;

  while (pixels_left != 0) {
    out_ptr[out_ptr_ix] = (ei_camera_frame_buffer[pixel_ix] << 16) + (ei_camera_frame_buffer[pixel_ix + 1] << 8) + ei_camera_frame_buffer[pixel_ix + 2];
    out_ptr_ix++;
    pixel_ix += 3;
    pixels_left--;
  }
  return 0;
}

// --- Functions ---
camera_fb_t* takePhoto() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (fb) esp_camera_fb_return(fb); // Clear buffer

  fb = esp_camera_fb_get();
  
  if (!fb) {
    Serial.println("5");
    Serial.println("[CAM] Error: Capture Failed");
    return NULL;
  }
  
  return fb; 
}

void analysePhoto(camera_fb_t* myPhoto) {
  
  // =========================================================================
  // [AI] รันโมเดลทำนายภาพก่อนส่งขึ้น Server
  // =========================================================================
  Serial.println("[AI] Starting Inference...");

  // 1. แปลง JPEG เป็น RGB (ใช้ PSRAM)
  uint8_t *full_rgb_buf = (uint8_t*)heap_caps_malloc(myPhoto->width * myPhoto->height * 3, MALLOC_CAP_SPIRAM);
  if (!full_rgb_buf) {
    Serial.println("[AI] ERR: Failed to allocate PSRAM for Full RGB!");
    return;
  }

  bool converted = fmt2rgb888(myPhoto->buf, myPhoto->len, PIXFORMAT_JPEG, full_rgb_buf);
  if (!converted) {
    Serial.println("[AI] ERR: JPEG format decoding failed!");
    free(full_rgb_buf);
    return;
  }

  // 2. ย่อขนาดภาพให้เข้ากับโมเดล (ใช้ PSRAM)
  size_t ei_buf_size = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT * 3;
  ei_camera_frame_buffer = (uint8_t*)heap_caps_malloc(ei_buf_size, MALLOC_CAP_SPIRAM);
  if (!ei_camera_frame_buffer) {
    Serial.println("[AI] ERR: Failed to allocate PSRAM for EI buffer!");
    free(full_rgb_buf);
    return;
  }

  ei::image::processing::crop_and_interpolate_rgb888(
      full_rgb_buf, myPhoto->width, myPhoto->height,
      ei_camera_frame_buffer, EI_CLASSIFIER_INPUT_WIDTH, EI_CLASSIFIER_INPUT_HEIGHT);

  free(full_rgb_buf);

  // 3. เตรียมข้อมูลให้ AI
  signal_t signal;
  signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
  signal.get_data = &ei_camera_get_data;

  // 4. รัน AI
  ei_impulse_result_t result = { 0 };
  EI_IMPULSE_ERROR res = run_classifier(&signal, &result, false);

  if (res != EI_IMPULSE_OK) {
    Serial.printf("[AI] ERR: Failed to run classifier (%d)\n", res);
    free(ei_camera_frame_buffer);
    return;
  }

  // 5. นับค่าใหม่ที่ได้จาก AI (รีเซ็ตก่อนเริ่มนับ)
  leaf_count = 0;
  plant_count = 0;
  ready_count = 0;
  avg_leaves_per_plant = 0.0;

  #if EI_CLASSIFIER_OBJECT_DETECTION == 1
    for (uint32_t i = 0; i < result.bounding_boxes_count; i++) {
        ei_impulse_result_bounding_box_t bb = result.bounding_boxes[i];
        if (bb.value == 0) continue; 

        if (strcmp(bb.label, "leaf") == 0) leaf_count++;
        else if (strcmp(bb.label, "plant") == 0) plant_count++;
        else if (strcmp(bb.label, "ready") == 0) ready_count++;
    }
  #endif

  // 6. คำนวณค่าเฉลี่ย
  if (plant_count > 0) {
      avg_leaves_per_plant = (float)leaf_count / plant_count;
  }

  harvestable = (ready_count > 0);

  Serial.printf("[AI] Stats -> Plant: %d, Leaf: %d, Ready: %d | Avg Leaf/Plant: %.2f\n", 
                 plant_count, leaf_count, ready_count, avg_leaves_per_plant);

  free(ei_camera_frame_buffer); // คืนพื้นที่แรม AI
  // =========================================================================

  String bestStage = "Unknown";
  int maxLeafReq = -1;

  for (JsonPair kv : configuration["stages"].as<JsonObject>()) {
    String stageName = kv.key().c_str();
    JsonObject reqs = kv.value().as<JsonObject>();

    // 1. จัดการเงื่อนไข Leaf Count (ตอนนี้ใช้ leaf_count จาก AI แล้ว)
    bool hasLeafReq = reqs.containsKey("leaf") && !reqs["leaf"].isNull();
    int reqLeaf = hasLeafReq ? reqs["leaf"].as<int>() : 0;
    bool passLeaf = !hasLeafReq || (leaf_count >= reqLeaf);

    // 3. ตรวจสอบว่าผ่านทั้ง 2 เงื่อนไขหรือไม่
    if (passLeaf) {
      // 4. เลือกว่าจะเอา Stage ไหนเป็นตัวที่ดีที่สุด (Best Match)
      if (reqLeaf >= maxLeafReq) {
        maxLeafReq = reqLeaf;
        bestStage = stageName;
      }
    }
  }

  current_stage = bestStage;

  Serial.println("[Stage] Analyse Result: " + current_stage);
  
}

void analyseAndUpload() {

  camera_fb_t* myPhoto = takePhoto();

  if (myPhoto == NULL) return;

  analysePhoto(myPhoto);

  Serial.printf("[SYSTEM] Got image, size: %zu bytes\n", myPhoto->len);

  HTTPClient http;
  http.begin(server_url + "/hardware/upload-image");

  // จัดการ Multipart Form Data แบบ Manual เพื่อรองรับ ESP32 Core รุ่นใหม่
  String boundary = "----ESP32Boundary" + String(millis(), HEX);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  String head = "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"scan.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  size_t totalLen = head.length() + myPhoto->len + tail.length();
  uint8_t *payload = (uint8_t *)malloc(totalLen);
  
  if (payload) {

    memcpy(payload, head.c_str(), head.length());
    memcpy(payload + head.length(), myPhoto->buf, myPhoto->len);
    memcpy(payload + head.length() + myPhoto->len, tail.c_str(), tail.length());

    int httpResponseCode = http.POST(payload, totalLen);

    if (httpResponseCode > 0) {
      Serial.printf("[HTTP] POST Result: %d\n", httpResponseCode);
      Serial.println("[HTTP] Response: " + http.getString());
    } else {
      Serial.printf("[HTTP] POST Failed, error: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    free(payload); // คืนพื้นที่ที่ใช้พักข้อมูล Multipart
  } else {
    Serial.println("[SYSTEM] Error: Not enough memory for payload");
  }

  http.end();

  esp_camera_fb_return(myPhoto); // คืนพื้นที่ Frame Buffer ของกล้อง
  Serial.println("[SYSTEM] Memory returned.");
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
          analyseAndUpload();
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

            analyseAndUpload();
            
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

void sendDataToServer() {
  HTTPClient http;
  
  // เปลี่ยน IP เป็นของเครื่อง Server
  http.begin("http://" + String(server_ip) + ":8080/hardware/state");
  http.addHeader("Content-Type", "application/json");

  // สร้าง JSON String ตามโครงสร้าง (ใช้ leaf_count ที่ได้จาก AI)
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

  if (conversionFactor <= 0.0) {
    return 0.0; 
  }

  float ppfd = lux / conversionFactor;

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

    pwm.setPWM(2, 0, min(farRedPWM, 4095));
    farRedCurrent = farRedPPFD;
    PWMFARRED = farRedPWM * 100.0 / 4095.0;

    float ppfd = light_sensor_result; // PPFD ที่ sensor อ่านได้
    float expected_fullspectrum_ppfd = bluePPFD + deepRedPPFD + whitePPFD; // ค่า PPFD target ไม่รวม Far Red
    
    float divider = blue + deepRed + white;

    // float ppfd_adjustment = max(min(expected_fullspectrum_ppfd - ppfd, ppfd_adjust_limit), -ppfd_adjust_limit);
    // float adjusted_ppfd = expected_fullspectrum_ppfd + ppfd_adjustment;

    Serial.printf("Current: %f\n", fullSpectrumCurrentPPFD);
    Serial.printf("Expected: %f\n", expected_fullspectrum_ppfd);

    if (ppfd > expected_fullspectrum_ppfd || fullSpectrumCurrentPPFD - expected_fullspectrum_ppfd > ppfd_adjust_limit) { // ถ้าค่าที่อ่านได้ มากกว่าที่ต้องการ
      // Serial.println("2");

      float final_ppfd_blue = (fullSpectrumCurrentPPFD - 1) * blue / divider;
      float final_ppfd_red = (fullSpectrumCurrentPPFD - 1) * deepRed / divider;
      float final_ppfd_white = (fullSpectrumCurrentPPFD - 1) * white / divider;
          
      int final_pwm_blue = final_ppfd_blue * 4095 / MAX_PPFD_BLUE;
      int final_pwm_red = final_ppfd_red * 4095 / MAX_PPFD_DEEP_RED;
      int final_pwm_white = final_ppfd_white * 4095 / MAX_PPFD_WHITE;

      if (expected_fullspectrum_ppfd - fullSpectrumCurrentPPFD < ppfd_adjust_limit &&
          final_pwm_blue  >= 0 &&
          final_pwm_red   >= 0 && 
          final_pwm_white >= 0
      ) {
        // เบาแสง
        fullSpectrumCurrentPPFD--;

        blueCurrent = final_ppfd_blue;
        redCurrent = final_ppfd_red;
        whiteCurrent = final_ppfd_white;

        pwm.setPWM(0, 0, max(0, min(final_pwm_blue, 4095)));
        pwm.setPWM(1, 0, max(0, min(final_pwm_red, 4095)));
        pwm.setPWM(3, 0, max(0, min(final_pwm_white, 4095)));
        
        PWMBLUE = final_pwm_blue * 100.0 / 4095.0;
        PWMRED = final_pwm_red * 100.0 / 4095.0;
        PWMWHITE = final_pwm_white * 100.0 / 4095.0;
      }
    } else if (ppfd < expected_fullspectrum_ppfd || expected_fullspectrum_ppfd - fullSpectrumCurrentPPFD > ppfd_adjust_limit) {

      float final_ppfd_blue = (fullSpectrumCurrentPPFD + 1) * blue / divider;
      float final_ppfd_red = (fullSpectrumCurrentPPFD + 1) * deepRed / divider;
      float final_ppfd_white = (fullSpectrumCurrentPPFD + 1) * white / divider;
          
      int final_pwm_blue = final_ppfd_blue * 4095 / MAX_PPFD_BLUE;
      int final_pwm_red = final_ppfd_red * 4095 / MAX_PPFD_DEEP_RED;
      int final_pwm_white = final_ppfd_white * 4095 / MAX_PPFD_WHITE;

      if (fullSpectrumCurrentPPFD - expected_fullspectrum_ppfd < ppfd_adjust_limit &&
          final_pwm_blue  <= 4095 &&
          final_pwm_red   <= 4095 &&
          final_pwm_white <= 4095
      ) {
        // เพิ่มแสง
        fullSpectrumCurrentPPFD++;

        blueCurrent = final_ppfd_blue;
        redCurrent = final_ppfd_red;
        whiteCurrent = final_ppfd_white;

        pwm.setPWM(0, 0, max(0, min(final_pwm_blue, 4095)));
        pwm.setPWM(1, 0, max(0, min(final_pwm_red, 4095)));
        pwm.setPWM(3, 0, max(0, min(final_pwm_white, 4095)));

        PWMBLUE = final_pwm_blue * 100.0 / 4095.0;
        PWMRED = final_pwm_red * 100.0 / 4095.0;
        PWMWHITE = final_pwm_white * 100.0 / 4095.0;
      }
    }

  } else {
    last_stage = current_stage;
    
    fullSpectrumCurrentPPFD = bluePPFD + deepRedPPFD + whitePPFD;
    Serial.printf("Initial Current: %f\n", fullSpectrumCurrentPPFD);

    pwm.setPWM(0, 0, min(bluePWM, 4095));
    pwm.setPWM(1, 0, min(deepRedPWM, 4095));
    pwm.setPWM(2, 0, min(farRedPWM, 4095));
    pwm.setPWM(3, 0, min(whitePWM, 4095));

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

// ==========================================
//
//              ESP-CAM SETUP
//
// ==========================================

void setup() {
  // 1. ปิดตัวจับไฟตก (Brownout Detector) ชั่วคราว เพื่อให้รอดพ้นจังหวะไฟกระชากตอนบูท
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println("\n--- Booting ESP32-CAM ---");

  // 2. ตั้งค่าโหมดและลดกำลังส่ง WiFi **ก่อน** สั่งเชื่อมต่อ
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
  pwm.begin();
  pwm.setPWMFreq(1000);

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

  // TSL2591 Init
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

  // Camera Init
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
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 10;
  config.fb_count = 1;

  Serial.println("Initializing Camera...");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed 0x%x\n", err);
    delay(3000);
    ESP.restart();
  }

  // Camera Sensor Settings
  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1);
    }
    s->set_framesize(s, FRAMESIZE_QVGA);
  }

  Serial.println("Waiting for power to stabilize...");
  delay(2000);

  // เปิดใช้งานตัวจับไฟตกกลับคืนมาเพื่อความปลอดภัยของระบบระยะยาว
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);

  Serial.println("Setup Completed. Starting main loop...");

  analyseAndUpload();
}

// ==========================================
//
//           ESP-CAM MAIN LOGIC
//
// ==========================================

void loop() {
  webSocket.loop();
  
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
    analyseAndUpload();
  }

  if (millis() - lastMinutePeriod > 1000) {
    lastMinutePeriod = millis();

    light_sensor_result = readFullSpectrum();

    updateLights();
  }
}