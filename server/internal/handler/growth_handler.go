package handler

import (
	"net/http"
	"server/internal/repository"
	"time"

	"github.com/gin-gonic/gin"
)

type GrowthHandler struct {
	growthRepo *repository.GrowthRepo
}

func NewGrowthHandler(growthRepo *repository.GrowthRepo) *GrowthHandler {
	return &GrowthHandler{growthRepo: growthRepo}
}

// GetDailyGrowth ดึงข้อมูลเฉลี่ยรายวันสำหรับทำกราฟ
// Query params: start (YYYY-MM-DD), end (YYYY-MM-DD)
// ถ้าไม่ระบุจะแสดง 30 วันล่าสุด
func (h *GrowthHandler) GetDailyGrowth(c *gin.Context) {
	start := c.Query("start")
	end := c.Query("end")

	// ค่า default: 30 วันล่าสุด
	if end == "" {
		end = time.Now().Format("2006-01-02")
	}
	if start == "" {
		t, _ := time.Parse("2006-01-02", end)
		start = t.AddDate(0, 0, -30).Format("2006-01-02")
	}

	data, err := h.growthRepo.GetDailyRange(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch growth data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"start": start,
		"end":   end,
		"data":  data,
	})
}

// GetDateDetail ดึงข้อมูลการสแกนทั้งหมดของวันที่เลือก
// Query param: date (YYYY-MM-DD)
func (h *GrowthHandler) GetDateDetail(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	records, err := h.growthRepo.GetByDate(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch scan data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"date":    date,
		"scans":   records,
		"count":   len(records),
	})
}

// GetLatest ดึงข้อมูลการสแกนล่าสุด
func (h *GrowthHandler) GetLatest(c *gin.Context) {
	record, err := h.growthRepo.GetLatest()
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No growth data available"})
		return
	}

	c.JSON(http.StatusOK, record)
}
