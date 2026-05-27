from inference_sdk import InferenceHTTPClient
import json

def count_leaves(api_response, conf_threshold=0.5):
    """นับจำนวน leaf จากโครงสร้าง API Response ตัวใหม่

    Args:
        api_response (str or dict): ข้อมูล Response จากตัวตรวจจับ
        conf_threshold (float): ค่า confidence ขั้นต่ำที่ต้องการนับ (0.0 - 1.0)
    """
    # 1. แปลง string ให้เป็น dict (ถ้าดึงมาเป็น string)
    if isinstance(api_response, str):
        try:
            data = json.loads(api_response)
        except json.JSONDecodeError:
            import ast

            data = ast.literal_eval(api_response)
    else:
        data = api_response

    # 2. เจาะเข้าหาตำแหน่งข้อมูลพยากรณ์ (Predictions List)
    predictions = []
    if isinstance(data, dict):
        if "predictions" in data:
            predictions = data["predictions"]
        elif "detections" in data:
            predictions = data["detections"]
    elif isinstance(data, list):
        predictions = data

    # 3. เริ่มนับจำนวนโดยคัดกรองด้วย Threshold
    leaf_count = 0
    for item in predictions:
        is_leaf = item.get("class") == "leaf"
        passed_threshold = item.get("confidence", 0) >= conf_threshold

        if is_leaf and passed_threshold:
            leaf_count += 1

    return leaf_count

print("Hello World")

# initialize the client
CLIENT = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="KSL83MVJLDBQHbh2R62M"
)

# infer on a local image
result = CLIENT.infer("705437805_1021828163838339_8123423336088056331_n.jpg", model_id="pfal-9vkwz/1")


# print(result)
print(count_leaves(result, 0.0) / 7)