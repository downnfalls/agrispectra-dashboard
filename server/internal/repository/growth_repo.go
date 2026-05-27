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
	Date              string  `json:"date"`
	AvgLeafPerPlant   float64 `json:"avg_leaf_per_plant"`
	AvgHarvestReady   float64 `json:"avg_harvest_readiness"`
	ScanCount         int     `json:"scan_count"`
}

// GetDailyRange ดึงข้อมูลเฉลี่ยรายวันในช่วงวันที่กำหนด (สำหรับทำกราฟ)
// avg_leaf_per_plant = ดึงค่า leaf_count ที่เฉลี่ยต่อต้นมาแล้วจาก DB มาหาค่าเฉลี่ยของวันนั้นอีกที
func (r *GrowthRepo) GetDailyRange(startDate, endDate string) ([]DailyGrowth, error) {
	var results []DailyGrowth
	err := r.db.Model(&models.GrowthRecord{}).
		Select("date, AVG(leaf_count) as avg_leaf_per_plant, AVG(harvest_readiness) as avg_harvest_ready, COUNT(*) as scan_count").
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

// SeedMockData สร้างข้อมูล Mock ตามที่ระบุสำหรับเดือนพฤษภาคม 2026 (2569)
func (r *GrowthRepo) SeedMockData() error {
	var count int64
	r.db.Model(&models.GrowthRecord{}).Count(&count)
	if count > 0 {
		return nil // already seeded
	}

	// ข้อมูลที่ระบุ:
	// 14/05/2026: avg leaves 1.8, harvest 0.9%
	// 17/05/2026: avg leaves 2.1, harvest 1.5%
	// 18/05/2026: avg leaves 2.3, harvest 1.9%
	// 19/05/2026: avg leaves 2.3, harvest 3.0%
	// 20/05/2026: avg leaves 2.3, harvest 3.4%
	// 23/05/2026: avg leaves 2.5, harvest 3.8% (interpolated)
	// 25/05/2026: avg leaves 5.5, harvest 4.4%
	// 27/05/2026: avg leaves 3.1, harvest 6.6%

	mockData := []models.GrowthRecord{
		{Date: "2026-05-14", LeafCount: 18, PlantCount: 10, HarvestReadiness: 0.9},
		{Date: "2026-05-15", LeafCount: 19, PlantCount: 10, HarvestReadiness: 1.1}, // interpolate
		{Date: "2026-05-16", LeafCount: 20, PlantCount: 10, HarvestReadiness: 1.3}, // interpolate
		{Date: "2026-05-17", LeafCount: 21, PlantCount: 10, HarvestReadiness: 1.5},
		{Date: "2026-05-18", LeafCount: 23, PlantCount: 10, HarvestReadiness: 1.9},
		{Date: "2026-05-19", LeafCount: 23, PlantCount: 10, HarvestReadiness: 3.0},
		{Date: "2026-05-20", LeafCount: 23, PlantCount: 10, HarvestReadiness: 3.4},
		{Date: "2026-05-21", LeafCount: 24, PlantCount: 10, HarvestReadiness: 3.5}, // interpolate
		{Date: "2026-05-22", LeafCount: 24, PlantCount: 10, HarvestReadiness: 3.7}, // interpolate
		{Date: "2026-05-23", LeafCount: 25, PlantCount: 10, HarvestReadiness: 3.9}, // interpolate
		{Date: "2026-05-24", LeafCount: 40, PlantCount: 10, HarvestReadiness: 4.1}, // interpolate
		{Date: "2026-05-25", LeafCount: 55, PlantCount: 10, HarvestReadiness: 4.4},
		{Date: "2026-05-26", LeafCount: 43, PlantCount: 10, HarvestReadiness: 5.5}, // interpolate
		{Date: "2026-05-27", LeafCount: 31, PlantCount: 10, HarvestReadiness: 6.6},
	}

	for _, d := range mockData {
		r.db.Create(&d)
	}

	return nil
}
