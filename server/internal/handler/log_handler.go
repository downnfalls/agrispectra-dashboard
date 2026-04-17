package handler

import (
	"net/http"
	"server/internal/models"
	"server/internal/repository"

	"github.com/gin-gonic/gin"
)

type LogHandler struct {
	repo *repository.LogRepo
}

func NewLogHandler(repo *repository.LogRepo) *LogHandler {
	return &LogHandler{repo: repo}
}

func (h *LogHandler) CreateLog(c *gin.Context) {
	var l models.Log
	if err := c.ShouldBindJSON(&l); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	username, exists := c.Get("username")
	if exists {
		l.Username = username.(string)
	}

	if err := h.repo.CreateLog(&l); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "บันทึก log ไม่สำเร็จ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "บันทึกสำเร็จ",
		"log":     l,
	})
}

func (h *LogHandler) CreatePowerConsumption(c *gin.Context) {
	var p models.PowerConsumption

	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	if err := h.repo.CreatePowerConsumption(&p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "บันทึกข้อมูลพลังงานไม่สำเร็จ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "บันทึกสำเร็จ"})
}
