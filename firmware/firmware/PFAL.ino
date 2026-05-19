#include "esp_camera.h"
#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <esp_task_wdt.h>

#include "edge-impulse-sdk/dsp/image/image.hpp"
#include <prefal-real_inferencing.h>

#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H
#define CAMERA_MODEL_AI_THINKER
#endif

#define WDT_TIMEOUT 300

// Pin Definitions
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22
#define LED_GPIO_NUM 4

// --- Configurations ---
const char *server_ip = "140.99.98.15";
const int server_port = 8080;
const char *ssid = "KUWIN-IOT";
const char *password = "";

// --- Variables Init ---
const String server_url = "http://" + String(server_ip) + ":" + String(server_port);
JsonDocument resultAfterAnalyse;

// [AI] Variables สำหรับเก็บสถิติ
int leaf_count = 0;
int plant_count = 0;
int ready_count = 0;
float avg_leaves_per_plant = 0.0;
bool harvestable = false;

static uint8_t *ei_camera_frame_buffer;

// ==========================================
// [AI] Data Callback สำหรับ Edge Impulse
// ==========================================
int ei_camera_get_data(size_t offset, size_t length, float *out_ptr) {
  size_t pixel_ix = offset * 3;
  size_t pixels_left = length;
  size_t out_ptr_ix = 0;

  while (pixels_left != 0) {
    out_ptr[out_ptr_ix] = (ei_camera_frame_buffer[pixel_ix] << 16) +
                          (ei_camera_frame_buffer[pixel_ix + 1] << 8) +
                          ei_camera_frame_buffer[pixel_ix + 2];
    out_ptr_ix++;
    pixel_ix += 3;
    pixels_left--;
  }
  return 0;
}

// --- Functions ---
camera_fb_t *takePhoto() {
  Serial.println("TAKING PHOTO");
  delay(2000);

  camera_fb_t *fb = esp_camera_fb_get();
  if (fb) esp_camera_fb_return(fb); // Clear buffer

  fb = esp_camera_fb_get();
  Serial.println("CAPTURE DONE");

  if (!fb) {
    return NULL;
  }
  return fb;
}

void sendAnalyseResult(int leaf_count, bool harvestable) {
  resultAfterAnalyse["leaf_count"] = leaf_count;
  resultAfterAnalyse["harvestable"] = harvestable;

  // ส่งเป็น JSON ออกไปทาง Serial (เพื่อเข้าบอร์ดหลัก)
  serializeJson(resultAfterAnalyse, Serial);
  Serial.println();
}

// [AI] ปรับปรุงให้ส่งค่ากลับเป็น bool เพื่อเช็คสถานะการทำงาน
bool  analysePhoto(camera_fb_t* myPhoto) {
  Serial.println("[AI] Starting Inference...");

  // 1. แปลง JPEG เป็น RGB (ใช้ PSRAM) - ตอนนี้เป็น QVGA แรมใช้แค่ประมาณ 230 KB ผ่านฉลุยชัวร์
  uint8_t *full_rgb_buf = (uint8_t *)heap_caps_malloc(myPhoto->width * myPhoto->height * 3, MALLOC_CAP_SPIRAM);
  if (!full_rgb_buf) {
    Serial.println("[AI] ERR: Failed to allocate PSRAM for Full RGB!");
    return false;
  }

  bool converted = fmt2rgb888(myPhoto->buf, myPhoto->len, PIXFORMAT_JPEG, full_rgb_buf);
  if (!converted) {
    Serial.println("[AI] ERR: JPEG format decoding failed!");
    free(full_rgb_buf);
    return false;
  }

  // 2. ย่อขนาดภาพให้เข้ากับโมเดล (ใช้ PSRAM)
  size_t ei_buf_size = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT * 3;
  ei_camera_frame_buffer = (uint8_t *)heap_caps_malloc(ei_buf_size, MALLOC_CAP_SPIRAM);
  if (!ei_camera_frame_buffer) {
    Serial.println("[AI] ERR: Failed to allocate PSRAM for EI buffer!");
    free(full_rgb_buf);
    return false;
  }

  ei::image::processing::crop_and_interpolate_rgb888(
      full_rgb_buf, myPhoto->width, myPhoto->height, ei_camera_frame_buffer,
      EI_CLASSIFIER_INPUT_WIDTH, EI_CLASSIFIER_INPUT_HEIGHT);

  free(full_rgb_buf);

  // 3. เตรียมข้อมูลให้ AI
  signal_t signal;
  signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
  signal.get_data = &ei_camera_get_data;

  // 4. รัน AI
  ei_impulse_result_t result = {0};
  EI_IMPULSE_ERROR res = run_classifier(&signal, &result, false);

  if (res != EI_IMPULSE_OK) {
    Serial.printf("[AI] ERR: Failed to run classifier (%d)\n", res);
    free(ei_camera_frame_buffer);
    return false;
  }

  // 5. นับค่าใหม่ที่ได้จาก AI
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
  return true;
}

void analyseAndUpload() {
  Serial.println("ANALYSING...");

  camera_fb_t *myPhoto = takePhoto();
  if (myPhoto == NULL) {
    Serial.println("[CAM] Capture Failed");
    return;
  }

  // [AI] เรียกฟังก์ชันทำนายผลภาพ ถ้ารันไม่สำเร็จให้เคลียร์หน่วยความจำแล้วออกทันที
  if (!analysePhoto(myPhoto)) {
    Serial.println("[SYSTEM] AI Processing Failed. Aborting upload.");
    esp_camera_fb_return(myPhoto);
    return;
  }

  sendAnalyseResult(leaf_count, harvestable);

  Serial.printf("[Stage] Analyse Result: Leaf Count: %d, Harvestable: %s\n",
                leaf_count, (harvestable ? "Yes" : "No"));

  Serial.println("UPLOADING...");

  HTTPClient http;
  http.setTimeout(15000);
  http.begin(server_url + "/hardware/upload-image");

  String boundary = "----ESP32Boundary" + String(millis(), HEX);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("Connection", "close");

  String head = "--" + boundary +
                "\r\n"
                "Content-Disposition: form-data; name=\"image\"; "
                "filename=\"scan.jpg\"\r\n"
                "Content-Type: image/jpeg\r\n\r\n";

  String tail = "\r\n--" + boundary + "--\r\n";
  size_t totalLen = head.length() + myPhoto->len + tail.length();

  uint8_t *payload = (uint8_t *)ps_malloc(totalLen);

  if (payload) {
    memcpy(payload, head.c_str(), head.length());
    memcpy(payload + head.length(), myPhoto->buf, myPhoto->len);
    memcpy(payload + head.length() + myPhoto->len, tail.c_str(), tail.length());

    int httpResponseCode = http.POST(payload, totalLen);
    free(payload);
  }

  http.end();
  esp_camera_fb_return(myPhoto);
  Serial.println("UPLOAD DONE.");
}

// ==========================================
//              ESP-CAM SETUP
// ==========================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);

  esp_task_wdt_deinit();

  esp_task_wdt_config_t wdt_config = {.timeout_ms = WDT_TIMEOUT * 1000,
                                      .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
                                      .trigger_panic = true};

  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);

  Serial.setTimeout(200);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

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
  config.frame_size = FRAMESIZE_QVGA; // <--- แก้ไขจุดนี้เป็น QVGA เพื่อป้องกันแรม PSRAM เต็ม
  config.jpeg_quality = 10;
  config.fb_count = 1;

  Serial.println("Initializing Camera...");
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
    s->set_framesize(s, FRAMESIZE_QVGA); // <--- แก้ไขจุดนี้เป็น QVGA เช่นกัน
    s->set_brightness(s, -2);
    s->set_ae_level(s, -2);
  }

  delay(2000);
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);
}

// ==========================================
//             ESP-CAM MAIN LOGIC
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

    if (incomingCommand == "RESCAN") {
      Serial.println("RECEIVED RESCAN SIGNAL");
      analyseAndUpload();
    }
  }
}