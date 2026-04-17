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
	repo *repository.LightProfileRepo
}

func NewLightProfileHandler(repo *repository.LightProfileRepo) *LightProfileHandler {
	return &LightProfileHandler{repo: repo}
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