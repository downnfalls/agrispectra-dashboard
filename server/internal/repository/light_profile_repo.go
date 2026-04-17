package repository

import (
	"server/internal/models"

	"gorm.io/gorm"
)

type LightProfileRepo struct {
	db *gorm.DB
}

func NewLightProfileRepo(db *gorm.DB) *LightProfileRepo {
	return &LightProfileRepo{db: db}
}

// ฟังก์ชันสำหรับเช็คว่า ProfileName ซ้ำหรือไม่ (ตอนสร้างใหม่)
func (r *LightProfileRepo) ExistsProfileName(name string) bool {
	var count int64
	r.db.Model(&models.LightProfile{}).Where("profile_name = ?", name).Count(&count)
	return count > 0
}

// ฟังก์ชันสำหรับบันทึกข้อมูล LightProfile ลงฐานข้อมูล (Create)
func (r *LightProfileRepo) CreateLightProfile(lp *models.LightProfile) error {
	return r.db.Create(lp).Error
}

// ฟังก์ชันสำหรับอัปเดตข้อมูล LightProfile เดิม (Update)
func (r *LightProfileRepo) UpdateLightProfile(lp *models.LightProfile) error {
	return r.db.Model(&models.LightProfile{}).Where("profile_id = ?", lp.ProfileID).Updates(map[string]interface{}{
		"profile_name": lp.ProfileName,
		"stages":       lp.Stages,
	}).Error
}

// ฟังก์ชันสำหรับดึงข้อมูล LightProfile ทั้งหมด
func (r *LightProfileRepo) GetLightProfiles() ([]models.LightProfile, error) {
	var profiles []models.LightProfile
	if err := r.db.Find(&profiles).Error; err != nil {
		return nil, err
	}
	return profiles, nil
}

// ฟังก์ชันสำหรับลบข้อมูล LightProfile
func (r *LightProfileRepo) DeleteLightProfile(id int) error {
	result := r.db.Where("profile_id = ?", id).Delete(&models.LightProfile{})
	if result.Error != nil {
		return result.Error
	}
	return nil
}