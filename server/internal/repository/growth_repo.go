package repository

import (
	"server/internal/models"

	"gorm.io/gorm"
)

type GrowthRepo struct {
	db *gorm.DB
}

func NewGrowthRepo(db *gorm.DB) *GrowthRepo {
	return &GrowthRepo{db: db}
}

// Create บันทึกข้อมูลการเจริญเติบโตจากการสแกนแต่ละครั้ง
func (r *GrowthRepo) Create(record *models.GrowthRecord) error {
	return r.db.Create(record).Error
}

// DailyGrowth โครงสร้างสำหรับส่งข้อมูลรายวัน (เฉลี่ยของวันนั้นๆ)
type DailyGrowth struct {
	Date             string  `json:"date"`
	AvgLeafCount     float64 `json:"avg_leaf_count"`
	AvgHarvestReady  float64 `json:"avg_harvest_readiness"`
	ScanCount        int     `json:"scan_count"`
}

// GetDailyRange ดึงข้อมูลเฉลี่ยรายวันในช่วงวันที่กำหนด (สำหรับทำกราฟ)
func (r *GrowthRepo) GetDailyRange(startDate, endDate string) ([]DailyGrowth, error) {
	var results []DailyGrowth
	err := r.db.Model(&models.GrowthRecord{}).
		Select("date, AVG(leaf_count) as avg_leaf_count, AVG(harvest_readiness) as avg_harvest_ready, COUNT(*) as scan_count").
		Where("date >= ? AND date <= ?", startDate, endDate).
		Group("date").
		Order("date ASC").
		Scan(&results).Error
	return results, err
}

// GetByDate ดึงข้อมูลการสแกนทั้งหมดของวันนั้น
func (r *GrowthRepo) GetByDate(date string) ([]models.GrowthRecord, error) {
	var records []models.GrowthRecord
	err := r.db.Where("date = ?", date).Order("created_at ASC").Find(&records).Error
	return records, err
}

// GetLatest ดึงข้อมูลล่าสุด
func (r *GrowthRepo) GetLatest() (*models.GrowthRecord, error) {
	var record models.GrowthRecord
	err := r.db.Order("created_at DESC").First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}
