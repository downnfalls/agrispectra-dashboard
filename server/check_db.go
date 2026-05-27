package main

import (
	"fmt"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type GrowthRecord struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	Date             string    `json:"date"`
	LeafCount        float64   `json:"leaf_count"`
	PlantCount       int       `json:"plant_count"`
	HarvestReadiness float64   `json:"harvest_readiness"`
}

func main() {
	db, err := gorm.Open(sqlite.Open("pfal.db"), &gorm.Config{})
	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	var records []GrowthRecord
	db.Find(&records)

	fmt.Println("--- Growth Records ---")
	for _, r := range records {
		fmt.Printf("ID: %d | Date: %s | Leaf: %.1f | Plant: %d | Readiness: %.1f%%\n", r.ID, r.Date, r.LeafCount, r.PlantCount, r.HarvestReadiness)
	}
}
