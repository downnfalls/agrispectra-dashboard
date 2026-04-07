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
	ProfileID   int            `json:"profile_id" Gorm:"primaryKey"`
	ProfileName string         `json:"profile_name"`
	Stages      datatypes.JSON `json:"stages"`
}

type PowerConsumption struct {
	ID        uint      `Gorm:"primaryKey" json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Power     float64   `json:"power"`
}

type User struct {
	Username string `json:"username" Gorm:"primaryKey"`
	Password string `json:"password"`
}

type Token struct {
	Username     string `json:"username" Gorm:"primaryKey"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}
