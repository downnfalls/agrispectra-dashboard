package repository

import (
	"fmt"
	"math"
	"server/internal/models"

	"gorm.io/gorm"
)

type EnergyRepo struct {
	db *gorm.DB
}

func NewEnergyRepo(db *gorm.DB) *EnergyRepo {
	return &EnergyRepo{db: db}
}

// UpsertHourly inserts or accumulates the kWh value for a specific date+hour.
// Each call ADDS the given kWh to the existing total (for accumulation every 5 min).
func (r *EnergyRepo) UpsertHourly(record *models.EnergyRecord) error {
	var existing models.EnergyRecord
	result := r.db.Where("date = ? AND hour = ?", record.Date, record.Hour).First(&existing)
	if result.Error != nil {
		// Not found — create new
		return r.db.Create(record).Error
	}
	// Found — accumulate kWh (add to existing)
	existing.Kwh += record.Kwh
	return r.db.Save(&existing).Error
}

// GetByDate returns all hourly records for a given date (up to 24).
func (r *EnergyRepo) GetByDate(date string) ([]models.EnergyRecord, error) {
	var records []models.EnergyRecord
	err := r.db.Where("date = ?", date).Order("hour ASC").Find(&records).Error
	return records, err
}

// GetDailyTotal returns the sum of kWh for a given date.
func (r *EnergyRepo) GetDailyTotal(date string) (float64, error) {
	var total float64
	err := r.db.Model(&models.EnergyRecord{}).
		Where("date = ?", date).
		Select("COALESCE(SUM(kwh), 0)").
		Scan(&total).Error
	return total, err
}

// GetMonthlyTotal returns the sum of all kWh for a given month (format: "2026-05").
func (r *EnergyRepo) GetMonthlyTotal(yearMonth string) (float64, error) {
	var total float64
	err := r.db.Model(&models.EnergyRecord{}).
		Where("date LIKE ?", yearMonth+"%").
		Select("COALESCE(SUM(kwh), 0)").
		Scan(&total).Error
	return total, err
}

// SeedMockData inserts mock energy data for testing. Only seeds if no data exists.
func (r *EnergyRepo) SeedMockData() error {
	var count int64
	r.db.Model(&models.EnergyRecord{}).Count(&count)
	if count > 0 {
		return nil // already seeded
	}

	// --- April 2026 mock data (30 days) ---
	aprilDays := 30
	for day := 1; day <= aprilDays; day++ {
		date := fmt.Sprintf("2026-04-%02d", day)
		for hour := 0; hour < 24; hour++ {
			kwh := 0.0
			if hour >= 6 && hour <= 22 {
				// Active hours: 0.04 - 0.09 kWh range
				kwh = 0.04 + float64(hour%5)*0.01 + float64(day%3)*0.005
			} else {
				// Standby: 0.005 - 0.01 kWh
				kwh = 0.005 + float64(hour%3)*0.002
			}
			r.db.Create(&models.EnergyRecord{Date: date, Hour: hour, Kwh: round(kwh, 4)})
		}
	}

	// --- May 1-3 mock data ---
	mayData := map[string][]float64{
		"2026-05-01": {
			0.008, 0.006, 0.005, 0.007, 0.006, 0.009, // 00-05
			0.045, 0.052, 0.068, 0.072, 0.075, 0.070, // 06-11
			0.065, 0.078, 0.082, 0.080, 0.076, 0.071, // 12-17
			0.068, 0.055, 0.042, 0.030, 0.010, 0.008, // 18-23
		},
		"2026-05-02": {
			0.007, 0.005, 0.006, 0.005, 0.007, 0.008, // 00-05
			0.048, 0.055, 0.070, 0.075, 0.078, 0.073, // 06-11
			0.068, 0.080, 0.085, 0.083, 0.079, 0.074, // 12-17
			0.070, 0.058, 0.045, 0.032, 0.012, 0.009, // 18-23
		},
		"2026-05-03": {
			0.009, 0.007, 0.006, 0.008, 0.007, 0.010, // 00-05
			0.050, 0.058, 0.072, 0.078, 0.080, 0.076, // 06-11
			0.070, 0.082, 0.088, 0.086, 0.082, 0.077, // 12-17
			0.073, 0.060, 0.048, 0.035, 0.015, 0.010, // 18-23
		},
	}

	for date, hours := range mayData {
		for hour, kwh := range hours {
			r.db.Create(&models.EnergyRecord{Date: date, Hour: hour, Kwh: kwh})
		}
	}

	return nil
}

func round(val float64, precision int) float64 {
	p := math.Pow(10, float64(precision))
	return math.Round(val*p) / p
}
