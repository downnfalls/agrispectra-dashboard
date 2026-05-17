package repository

import (
	"server/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SystemStateRepo struct {
	db *gorm.DB
}

func NewSystemStateRepo(db *gorm.DB) *SystemStateRepo {
	return &SystemStateRepo{db: db}
}

// GetState returns the value for a given key, or empty string if not found.
func (r *SystemStateRepo) GetState(key string) (string, error) {
	var state models.SystemState
	result := r.db.Where("key = ?", key).First(&state)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", result.Error
	}
	return state.Value, nil
}

// SetState upserts a key-value pair.
func (r *SystemStateRepo) SetState(key, value string) error {
	state := models.SystemState{Key: key, Value: value}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value"}),
	}).Create(&state).Error
}
