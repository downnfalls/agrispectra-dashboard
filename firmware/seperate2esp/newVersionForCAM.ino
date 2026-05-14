#include <WiFi.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"



#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H
#define CAMERA_MODEL_AI_THINKER 
#endif

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
const char *server_ip = "172.20.10.4";
const int server_port = 8080;
const char *ssid = "June";
const char *password = "12345678";

// --- Variables Init ---

const String server_url = "http://" + String(server_ip) + ":" + String(server_port);
JsonDocument resultAfterAnalyse;

// --- Functions ---
camera_fb_t* takePhoto() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (fb) esp_camera_fb_return(fb); // Clear buffer

  fb = esp_camera_fb_get();
  
  if (!fb) {
    // Serial.println("5");
    // Serial.println("[CAM] Error: Capture Failed");
    return NULL;
  }
  
  return fb; 
}


//-- function Send result After AI -- 

void sendAnalyseResult(int leaf_count,bool harvestable){

   resultAfterAnalyse["leaf_count"] = leaf_count;
   resultAfterAnalyse["harvestable"] = harvestable;
   serializeJson(resultAfterAnalyse, Serial); 
  
  //  Serial.println();
   
   
}


void analyseAndUpload() {
  camera_fb_t* myPhoto = takePhoto();
  if (myPhoto == NULL) return;

  // Serial.printf("[SYSTEM] Got image, size: %zu bytes\n", myPhoto->len);

  HTTPClient http;
  http.setTimeout(15000); 
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
      // Serial.printf("[HTTP] POST Result: %d\n", httpResponseCode);
      // Serial.println("[HTTP] Response: " + http.getString());

      // ส่งกลับไปให้บอร์ด Main หลังจากส่งรูปขึ้น Server สำเร็จแล้วเท่านั้น
      int fake_leaf_count = 22;  
      bool fake_harvestable = false;
      sendAnalyseResult(fake_leaf_count, fake_harvestable);
      
    } else {
      // Serial.printf("[HTTP] POST Failed, error: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    
    free(payload); 
  } else {
    // Serial.println("[SYSTEM] Error: Not enough memory for payload");
  }

  http.end();
  esp_camera_fb_return(myPhoto); 
  // Serial.println("[SYSTEM] Memory returned.");
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
  // Serial.println("\n--- Booting ESP32-CAM ---");

  // 2. ตั้งค่าโหมดและลดกำลังส่ง WiFi **ก่อน** สั่งเชื่อมต่อ
  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_8_5dBm); 

  // WiFi Init
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);
  
  // Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    // Serial.print(".");
  }
  
  //  Serial.println("\nWiFi connected");
  //   Serial.println("WIFI IP : ");
  //   Serial.println(WiFi.localIP());


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
  config.xclk_freq_hz = 10000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.frame_size = FRAMESIZE_UXGA;
  config.jpeg_quality = 8;
  config.fb_count = 1;

  // Serial.println("Initializing Camera...");
  esp_err_t err = esp_camera_init(&config); 
  if (err != ESP_OK) {
    // Serial.printf("Camera init failed 0x%x\n", err);
    delay(3000);
    ESP.restart();
  }

  // Camera Sensor Settings
  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1);
    }
    s->set_framesize(s, FRAMESIZE_UXGA);
    s->set_brightness(s, -2);
    s->set_ae_level(s, -2);
  }

  // 3. นำ analyseAndUpload(); และ updateLights(); ออกจากตรงนี้
  // แล้วพักระบบสัก 2 วินาทีเพื่อให้กระแสไฟในคาปาซิเตอร์กลับมาเต็มและนิ่ง
  // Serial.println("Waiting for power to stabilize...");
  delay(2000);

  // เปิดใช้งานตัวจับไฟตกกลับคืนมาเพื่อความปลอดภัยของระบบระยะยาว
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);

  // Serial.println("Setup Completed. Starting main loop...");

  analyseAndUpload();
}

// ==========================================
//
//           ESP-CAM MAIN LOGIC
//
// ==========================================

void loop() {
  
  
 if (Serial.available()) {

   String incomingCommand = Serial.readStringUntil('\n');
   incomingCommand.trim();
   if(incomingCommand == "RESCAN"){
     analyseAndUpload();
     }

      

      // analyseAndUpload();
  }


}

  

