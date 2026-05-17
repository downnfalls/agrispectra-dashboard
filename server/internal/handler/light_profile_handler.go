package handler

import (
	"encoding/json"
	"net/http"
	"server/internal/models"
	"server/internal/repository"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

type LightProfileHandler struct {
	repo            *repository.LightProfileRepo
	hardwareHandler *HardwareHandler
	stateRepo       *repository.SystemStateRepo
}

func NewLightProfileHandler(repo *repository.LightProfileRepo, hw *HardwareHandler, stateRepo *repository.SystemStateRepo) *LightProfileHandler {
	return &LightProfileHandler{
		repo:            repo,
		hardwareHandler: hw,
		stateRepo:       stateRepo,
	}
}

func (h *LightProfileHandler) CreateLightProfile(c *gin.Context) {
	// อ่าน JSON ทั้งก้อนแบบ Dynamic
	var rawData map[string]interface{}
	if err := c.ShouldBindJSON(&rawData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	// ดึง profile_name ออกมา
	profileName, ok := rawData["profile_name"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุ profile_name"})
		return
	}

	// ดึง profile_id ออกมาเพื่อเช็คโหมด Update vs Create
	var profileID int
	if pid, exists := rawData["profile_id"]; exists {
		if pidFloat, ok := pid.(float64); ok {
			profileID = int(pidFloat)
		}
	}

	// คัดแยกข้อมูล Stage ทั้งหมดที่เหลือออกจาก profile_name และ profile_id
	stagesData := make(map[string]interface{})
	for key, value := range rawData {
		if key != "profile_name" && key != "profile_id" {
			stagesData[key] = value
		}
	}

	// แปลงข้อมูล Stage กลับเป็น JSON byte array เพื่อเก็บใน datatypes.JSON
	stagesBytes, err := json.Marshal(stagesData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถจัดการข้อมูล stages ได้"})
		return
	}

	// ตรวจสอบว่าโหมดสร้างใหม่ หรือโหมดแก้ไข
	if profileID == 0 || profileID > 1000000 {
		// โหมดสร้างใหม่ (หรือ ID จำลองจาก Client ที่ใหญ่เกิน) - เช็คชื่อซ้ำ!
		if h.repo.ExistsProfileName(profileName) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ชื่อ Profile นี้มีอยู่ในระบบแล้ว"})
			return
		}

		profile := models.LightProfile{
			ProfileName: profileName,
			Stages:      datatypes.JSON(stagesBytes),
		}

		// บันทึกลง Database
		if err := h.repo.CreateLightProfile(&profile); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "บันทึก Light Profile ใหม่ไม่สำเร็จ"})
			return
		}
	} else {
		// โหมดแก้ไขตัวเดิม
		profile := models.LightProfile{
			ProfileID:   profileID,
			ProfileName: profileName,
			Stages:      datatypes.JSON(stagesBytes),
		}

		if err := h.repo.UpdateLightProfile(&profile); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "อัปเดต Light Profile ไม่สำเร็จ"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "บันทึก Light Profile สำเร็จฉบับ Update Version",
	})
}

func (h *LightProfileHandler) GetLightProfiles(c *gin.Context) {
	profiles, err := h.repo.GetLightProfiles()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ดึงข้อมูล Light Profiles ไม่สำเร็จ"})
		return
	}
	c.JSON(http.StatusOK, profiles)
}

func (h *LightProfileHandler) DeleteLightProfile(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	if err := h.repo.DeleteLightProfile(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ลบ Light Profile ไม่สำเร็จ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ลบ Light Profile สำเร็จ"})
}

func (h *LightProfileHandler) DeployProfile(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	// 1. ดึงชื่อ Profile
	profileName, _ := payload["profile_name"].(string)

	// สร้างโครงสร้างใหม่ที่มี stages
	stages := make(map[string]interface{})
	structuredPayload := make(map[string]interface{})

	for key, value := range payload {
		if key == "profile_name" || key == "profile_id" {
			structuredPayload[key] = value
		} else {
			// ตรวจสอบว่า value เป็น object และมี key "name" หรือไม่
			if stageMap, ok := value.(map[string]interface{}); ok {
				if name, nameOk := stageMap["name"].(string); nameOk && name != "" {
					stages[name] = value
				} else {
					stages[key] = value
				}
			} else {
				stages[key] = value
			}
		}
	}
	structuredPayload["stages"] = stages

	// หุ้ม Payload ไว้ใน key 'payload' และเพิ่ม action
	command := map[string]interface{}{
		"action":  "DEPLOY_PROFILE",
		"payload": structuredPayload,
	}

	// 2. ส่งข้อมูลไปยัง ESP32 ผ่าน WebSocket ของจริง
	h.hardwareHandler.SendCommand(command)

	// 3. บันทึก deployed profile ID ลง DB เพื่อ sync ข้ามเครื่อง
	if pid, exists := payload["profile_id"]; exists {
		if pidFloat, ok := pid.(float64); ok {
			h.stateRepo.SetState("deployed_profile_id", strconv.Itoa(int(pidFloat)))
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile " + profileName + " deployed to hardware successfully",
	})
}

// GetDeployedProfile returns the currently deployed profile ID.
// GET /api/deployed-profile
func (h *LightProfileHandler) GetDeployedProfile(c *gin.Context) {
	val, err := h.stateRepo.GetState("deployed_profile_id")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get deployed profile"})
		return
	}

	var profileId *int
	if val != "" {
		parsed, err := strconv.Atoi(val)
		if err == nil {
			profileId = &parsed
		}
	}

	c.JSON(http.StatusOK, gin.H{"deployed_profile_id": profileId})
}