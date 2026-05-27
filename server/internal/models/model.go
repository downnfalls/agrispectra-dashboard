package models

import (
	"time"

	"gorm.io/datatypes"
)

type Log struct {
	ID        uint      `Gorm:"primaryKey" json:"id"`
	Type      string    `json:"type"`
	Detail    string    `json:"detail"`
	Username  string    `json:"username"`
	Timestamp time.Time `json:"timestamp"`
}

type LightProfile struct {
	ProfileID   int            `json:"profile_id" gorm:"primaryKey"`
	ProfileName string         `json:"profile_name"`
	Stages      datatypes.JSON `json:"stages"`
}

type PowerConsumption struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Power     float64   `json:"power"`
}

type EnergyRecord struct {
	ID   uint    `gorm:"primaryKey" json:"id"`
	Date string  `gorm:"uniqueIndex:idx_date_hour;not null" json:"date"` // "2026-05-04"
	Hour int     `gorm:"uniqueIndex:idx_date_hour" json:"hour"`          // 0-23
	Kwh  float64 `json:"kwh"`                                            // kWh consumed in that hour
}

type GrowthRecord struct {
	ID               uint    `gorm:"primaryKey" json:"id"`
	Date             string  `gorm:"not null;index" json:"date"`              // "2026-05-27"
	LeafCount        int     `json:"leaf_count"`                              // จำนวนใบที่ตรวจพบ
	PlantCount       int     `json:"plant_count"`                             // จำนวนต้นที่ตรวจพบ
	HarvestReadiness float64 `json:"harvest_readiness"`                       // % ความพร้อมเก็บเกี่ยว
	ImageURL         string  `json:"image_url,omitempty"`                     // URL รูปที่สแกน
	CreatedAt        time.Time `gorm:"autoCreateTime" json:"created_at"`
}

type User struct {
	Username string `json:"username" gorm:"primaryKey"`
	Password string `json:"password"`
}

type Token struct {
	Username     string `json:"username" gorm:"primaryKey"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type SystemState struct {
	Key   string `gorm:"primaryKey" json:"key"`
	Value string `json:"value"`
}
