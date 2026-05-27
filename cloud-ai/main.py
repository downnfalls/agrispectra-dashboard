import requests
import base64
import cv2
import numpy as np

# ==========================================
# 1. ตั้งค่า API และตัวแปรอ้างอิง
# ==========================================
ROBOFLOW_API_KEY = "KSL83MVJLDBQHbh2R62M"
# ใส่ชื่อโปรเจกต์และเวอร์ชัน เช่น green-oak-xyz/1
ROBOFLOW_MODEL = "pfal-9vkwz/3" 
IMAGE_PATH = "scan_1779870745.jpg"  # ใส่ชื่อไฟล์รูปที่ต้องการวิเคราะห์

# กำหนด "ขนาดพุ่มของต้นที่พร้อมเก็บเกี่ยว" (หน่วย: ตารางพิกเซล)
# ตัวเลขนี้คุณต้องลองเอารูปต้นที่โตเต็มที่มาวัดดูสักครั้ง แล้วจดค่ามาใส่ไว้ครับ
HARVESTABLE_AREA_PIXELS = 370000  # ตัวอย่างค่าที่วัดได้จากรูปต้นที่โตเต็มที่ (คุณต้องปรับให้เหมาะสมกับรูปของคุณเอง) 

# ==========================================
# 2. ฟังก์ชันส่งรูปไป Roboflow ผ่าน HTTP API
# ==========================================
def get_predictions_from_roboflow(image_path):
    # อ่านไฟล์รูปและแปลงเป็น Base64
    with open(image_path, "rb") as image_file:
        image_data = image_file.read()
        image_base64 = base64.b64encode(image_data).decode("utf-8")

    # ยิง HTTP POST ไปที่ Roboflow
    url = f"https://detect.roboflow.com/{ROBOFLOW_MODEL}?api_key={ROBOFLOW_API_KEY}"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    
    print("กำลังส่งรูปภาพไปวิเคราะห์...")
    response = requests.post(url, data=image_base64, headers=headers)
    
    if response.status_code != 200:
        print("เกิดข้อผิดพลาด:", response.text)
        return []
        
    return response.json().get("predictions", [])

# ==========================================
# 3. โค้ดหลัก (คำนวณและวิเคราะห์)
# ==========================================
def main():
    predictions = get_predictions_from_roboflow(IMAGE_PATH)
    
    if not predictions:
        print("ไม่พบวัตถุ หรือ มีปัญหาการเชื่อมต่อ")
        return

    # ตัวแปรเก็บข้อมูล
    leaf_count = 0
    plants_data = []

    # คัดแยกข้อมูลที่ AI ส่งกลับมา
    for pred in predictions:
        print("AI ตรวจเจอ Class:", pred["class"])
        if pred["class"] == "leaf":
            leaf_count += 1
        elif pred["class"] == "plant":
            plants_data.append(pred)

    plant_count = len(plants_data)

    print("\n--- 📊 สรุปผลภาพรวม ---")
    print(f"เจอพุ่มผักทั้งหมด (Plant): {plant_count} ต้น")
    print(f"เจอใบผักทั้งหมด (Leaf): {leaf_count} ใบ")
    
    # คำนวณใบเฉลี่ยต่อต้น
    if plant_count > 0:
        avg_leaf_per_plant = leaf_count / plant_count
        print(f"เฉลี่ยแล้วมีใบประมาณ: {avg_leaf_per_plant:.1f} ใบ/ต้น")

    print("\n--- 🪴 วิเคราะห์ความพร้อมแต่ละต้น ---")
    
    # วนลูปวิเคราะห์ 'ขนาดพุ่ม' ของแต่ละต้น
    for index, plant in enumerate(plants_data):
        # 1. ดึงจุด (Points) ที่วาดล้อมรอบพุ่มผักออกมา
        points = plant["points"]
        
        # 2. แปลงข้อมูลจุดให้อยู่ในรูปแบบที่ OpenCV คำนวณได้
        contour = np.array([[p['x'], p['y']] for p in points], dtype=np.int32)
        
        # 3. คำนวณหาพื้นที่ (Area) เป็นพิกเซล
        area_pixels = cv2.contourArea(contour)
        
        # 4. เทียบเปอร์เซ็นต์กับค่ามาตรฐาน HARVESTABLE_AREA_PIXELS
        growth_percent = (area_pixels / HARVESTABLE_AREA_PIXELS) * 100
        
        # ป้องกันเลขทะลุ 100% กรณีผักโตกว่ามาตรฐานมากๆ
        if growth_percent > 100:
            growth_percent = 100.0

        print(f"ต้นที่ {index + 1}:")
        print(f"  - ความมั่นใจของ AI: {plant['confidence'] * 100:.1f}%")
        print(f"  - ขนาดพื้นที่พุ่ม: {int(area_pixels):,} พิกเซล")
        print(f"  - 📈 ความพร้อมเก็บเกี่ยว: {growth_percent:.1f}%")

if __name__ == "__main__":
    main()