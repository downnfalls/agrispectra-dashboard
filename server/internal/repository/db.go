package repository

import (
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func NewDB(dsn string) (*gorm.DB, error) {
	return gorm.Open(sqlite.Open("pfal.db"), &gorm.Config{})
}
