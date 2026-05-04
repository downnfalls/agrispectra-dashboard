package handler

import (
	"net/http"
	"server/internal/models"
	"server/internal/repository"

	"github.com/gin-gonic/gin"
)

type EnergyHandler struct {
	repo *repository.EnergyRepo
}

func NewEnergyHandler(repo *repository.EnergyRepo) *EnergyHandler {
	return &EnergyHandler{repo: repo}
}

// RecordHourly records kWh for a specific date+hour (upsert).
// POST /api/energy/record
// Body: { "date": "2026-05-04", "hour": 15, "kwh": 0.068 }
func (h *EnergyHandler) RecordHourly(c *gin.Context) {
	var record models.EnergyRecord
	if err := c.ShouldBindJSON(&record); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	if record.Hour < 0 || record.Hour > 23 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hour must be 0-23"})
		return
	}

	if record.Date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Date is required (YYYY-MM-DD)"})
		return
	}

	if err := h.repo.UpsertHourly(&record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record energy data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Energy recorded", "record": record})
}

// GetDaily returns all 24-hour records for a given date.
// GET /api/energy/daily?date=2026-05-04
func (h *EnergyHandler) GetDaily(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date query param is required (YYYY-MM-DD)"})
		return
	}

	records, err := h.repo.GetByDate(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch energy data"})
		return
	}

	// Build a full 24-hour array (fill missing hours with 0)
	hourlyMap := make(map[int]float64)
	for _, r := range records {
		hourlyMap[r.Hour] = r.Kwh
	}

	type HourlyEntry struct {
		Hour int     `json:"hour"`
		Kwh  float64 `json:"kwh"`
	}

	result := make([]HourlyEntry, 24)
	var dailyTotal float64
	for i := 0; i < 24; i++ {
		kwh := hourlyMap[i] // defaults to 0 if not found
		result[i] = HourlyEntry{Hour: i, Kwh: kwh}
		dailyTotal += kwh
	}

	c.JSON(http.StatusOK, gin.H{
		"date":       date,
		"hours":      result,
		"dailyTotal": dailyTotal,
	})
}

// GetMonthly returns the total kWh for a given month.
// GET /api/energy/monthly?month=2026-05
func (h *EnergyHandler) GetMonthly(c *gin.Context) {
	month := c.Query("month")
	if month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month query param is required (YYYY-MM)"})
		return
	}

	total, err := h.repo.GetMonthlyTotal(month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch monthly data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"month":        month,
		"monthlyTotal": total,
	})
}
