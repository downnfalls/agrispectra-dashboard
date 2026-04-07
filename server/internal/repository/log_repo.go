package repository

import (
	"server/internal/models"

	"gorm.io/gorm"
)

type LogRepo struct {
	db *gorm.DB
}

func NewLogRepo(db *gorm.DB) *LogRepo {
	return &LogRepo{db: db}
}

func (r *LogRepo) CreateLog(l *models.Log) error {
	return r.db.Create(l).Error
}

func (r *LogRepo) CreatePowerConsumption(p *models.PowerConsumption) error {
	return r.db.Create(p).Error
}
