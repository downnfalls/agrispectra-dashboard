#include <WiFi.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <esp_task_wdt.h>

#include <prefal-real_inferencing.h>

#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H
#define CAMERA_MODEL_AI_THINKER 
#endif

#define WDT_TIMEOUT 60

// Pin Definitions
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

// --- Configurations ---
const char *server_ip = "140.99.98.15";
const int server_port = 8080;
const char *ssid = "ENGSRCKU";
const char *password = "60176549";

// --- Variables Init ---
const String server_url = "http://" + String(server_ip) + ":" + String(server_port);
JsonDocument resultAfterAnalyse;

// [AI] Variables สำหรับเก็บสถิติ
int final_leaf_count = 0;
float final_harvest_readiness = 0.0;
float avg_leaves_per_plant = 0.0;

// --- Functions ---
camera_fb_t* takePhoto() {

  Serial.println("TAKING PHOTO");

  delay(2000);

  camera_fb_t * fb = esp_camera_fb_get();
  if (fb) esp_camera_fb_return(fb); // Clear buffer

  fb = esp_camera_fb_get();

  Serial.println("CAPTURE DONE");
  
  if (!fb) {
    return NULL;
  }
  return fb; 
}

void sendAnalyseResult(int lc, float h){

   resultAfterAnalyse["leaf_count"] = lc;
   resultAfterAnalyse["harvestable"] = h;
   
   serializeJson(resultAfterAnalyse, Serial); 
   Serial.println(); 
}

void analyseAndUpload() {

  Serial.println("ANALYSING...");

  camera_fb_t* myPhoto = takePhoto();
  if (myPhoto == NULL) {

    Serial.println("[CAM] Capture Failed");
    return;
  }

  Serial.println("UPLOADING...");

  HTTPClient http;
  http.setTimeout(20000); 
  http.begin(server_url + "/hardware/upload-image");

  String boundary = "----ESP32Boundary" + String(millis(), HEX);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("Connection", "close");

  String head = "--" + boundary + "\r\n"
                "Content-Disposition: form-data; name=\"image\"; filename=\"scan.jpg\"\r\n"
                "Content-Type: image/jpeg\r\n\r\n";
                
  String tail = "\r\n--" + boundary + "--\r\n";

  size_t totalLen = head.length() + myPhoto->len + tail.length();
  
  uint8_t *payload = (uint8_t *)ps_malloc(totalLen);
  
  if (payload) {
    memcpy(payload, head.c_str(), head.length());
    memcpy(payload + head.length(), myPhoto->buf, myPhoto->len);
    memcpy(payload + head.length() + myPhoto->len, tail.c_str(), tail.length());

    int httpResponseCode = http.POST(payload, totalLen);

    if (httpResponseCode > 0) {
      Serial.printf("HTTP Response code: %d\n", httpResponseCode);
      
      // 1. อ่านข้อความที่ Backend ตอบกลับมา
      String response = http.getString();
      Serial.println("Response body: " + response);
      // 2. ใช้ ArduinoJson เพื่อแกะข้อมูล (Parse JSON)
      // หมายเหตุ: โค้ดนี้สำหรับ ArduinoJson เวอร์ชัน 7
      // (ถ้าคุณใช้ ArduinoJson เวอร์ชัน 6 ให้เปลี่ยนบรรทัดนี้เป็น DynamicJsonDocument doc(512); )
      JsonDocument doc; 
      DeserializationError error = deserializeJson(doc, response);
      if (!error) {
          // 3. ดึงค่าตัวแปรออกมาใช้งาน
          int leaf_count = doc["leaf_count"];
          float harvest_readiness = doc["harvest_readiness"];
          Serial.printf("👉 Leaf Count = %d\n", leaf_count);
          Serial.printf("👉 Harvest Readiness = %.2f\n", harvest_readiness);
          // 💡 ตรงนี้คุณสามารถเอาตัวแปร leaf_count และ harvest_readiness 
          // ไปเข้าเงื่อนไข if-else หรือคำนวณพื้นที่ต่อตามต้องการได้เลยครับ

          final_leaf_count = leaf_count;
          final_harvest_readiness = harvest_readiness;

          sendAnalyseResult(final_leaf_count, final_harvest_readiness);
      } else {
          Serial.print("JSON Parse failed: ");
          Serial.println(error.c_str());
      }
    } else {
      // ถ้าขึ้น Error -11 จะมาตกที่ตรงนี้ครับ
      Serial.printf("Error on sending POST: %d\n", httpResponseCode); 
    }
    
    free(payload); 
  }

  http.end();
  esp_camera_fb_return(myPhoto); 

  Serial.println("UPLOAD DONE.");
}

void blink() {
  ledcWrite(4, 10);
  delay(10);
  ledcWrite(4, 0);
}

// ==========================================
//              ESP-CAM SETUP
// ==========================================

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);

  ledcAttach(4, 5000, 8);
  ledcWrite(4, 0);

  esp_task_wdt_deinit();

  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT * 1000, 
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1, 
    .trigger_panic = true 
  };
  
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  
  // ปิดโหมด Debug เพื่อไม่ให้ ESP32 พ่น Log ของระบบแทรกไปกับ JSON
  // Serial.setDebugOutput(true); 
  
  // ป้องกัน Serial อ่านข้อมูลค้าง
  Serial.setTimeout(200);

  WiFi.mode(WIFI_STA);

  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  Serial.println(WiFi.localIP());

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
  config.xclk_freq_hz = 10000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.frame_size = FRAMESIZE_QXGA;
  config.jpeg_quality = 8;
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config); 
  if (err != ESP_OK) {
    delay(3000);
    ESP.restart();
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1);
    }
    s->set_framesize(s, FRAMESIZE_QXGA);
    s->set_brightness(s, -2);
    s->set_ae_level(s, -2);
  }

  delay(2000);
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);
}

// ==========================================
//           ESP-CAM MAIN LOGIC
// ==========================================

unsigned long long lastPeriod = 0;

void loop() {

  esp_task_wdt_reset();

  if (millis() - lastPeriod > 5000) {
    lastPeriod = millis();
    Serial.println("Heartbeat...");
  }
  
  if (Serial.available()) {
    String incomingCommand = Serial.readStringUntil('\n');
    incomingCommand.trim();
    
    if(incomingCommand == "RESCAN"){
      Serial.println("RECEIVED RESCAN SIGNAL");
      analyseAndUpload();
    }

    else if (incomingCommand = "PONG") {
      blink();
    }
  }

  delay(10);
}