package main

import (
	"fmt"
	"log"
	"os"
	"server/internal/handler"
	"server/internal/middleware"
	"server/internal/models"
	"server/internal/repository"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		return
	}

	db, err := repository.NewDB(os.Getenv("DB_DSN"))
	if err != nil {
		log.Fatal(err)
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.Token{},
		&models.Log{},
		&models.LightProfile{},
		&models.PowerConsumption{},
		&models.EnergyRecord{},
		&models.GrowthRecord{},
		&models.SystemState{},
	)
	if err != nil {
		return
	}

	// 1. กำหนด Repositories
	userRepo := repository.NewUserRepo(db)
	logRepo := repository.NewLogRepo(db)
	lightProfileRepo := repository.NewLightProfileRepo(db)
	energyRepo := repository.NewEnergyRepo(db)
	growthRepo := repository.NewGrowthRepo(db)
	systemStateRepo := repository.NewSystemStateRepo(db)

	// Seed mock energy data (May 1-3 + April 2026)
	if err := energyRepo.SeedMockData(); err != nil {
		log.Printf("Warning: Failed to seed energy data: %v", err)
	}

	// Seed mock growth data
	if err := growthRepo.SeedMockData(); err != nil {
		log.Printf("Warning: Failed to seed growth data: %v", err)
	}

	// 2. กำหนด Handlers
	authHandler := handler.NewAuthHandler(userRepo)
	logHandler := handler.NewLogHandler(logRepo)
	hardwareHandler := handler.NewHardwareHandler(energyRepo, growthRepo)
	lightProfileHandler := handler.NewLightProfileHandler(lightProfileRepo, hardwareHandler, systemStateRepo)
	energyHandler := handler.NewEnergyHandler(energyRepo)
	growthHandler := handler.NewGrowthHandler(growthRepo)

	// เริ่มต้นระบบ Broadcast
	go hardwareHandler.HandleMessages()

	// เริ่มระบบบันทึกพลังงานอัตโนมัติ (ทุก 5 นาที)
	go hardwareHandler.StartEnergyRecorder()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.POST("/auth/register", authHandler.Register)
	r.POST("/auth/login", authHandler.Login)

	apiGroup := r.Group("/api")
	apiGroup.Use(middleware.AuthMiddleware())
	{
		apiGroup.POST("/logs", logHandler.CreateLog)
		apiGroup.POST("/power", logHandler.CreatePowerConsumption)
		apiGroup.POST("/light-profiles", lightProfileHandler.CreateLightProfile)
		apiGroup.GET("/light-profiles", lightProfileHandler.GetLightProfiles)
		apiGroup.DELETE("/light-profiles/:id", lightProfileHandler.DeleteLightProfile)
		apiGroup.POST("/deploy", lightProfileHandler.DeployProfile)
		apiGroup.GET("/deployed-profile", lightProfileHandler.GetDeployedProfile)
		apiGroup.GET("/hardware/state", hardwareHandler.GetState)
		apiGroup.POST("/hardware/stop", hardwareHandler.EmergencyStop) // ปุ่ม Emergency Stop
		apiGroup.POST("/hardware/reset", hardwareHandler.Reset)         // ปุ่ม Reset
		apiGroup.POST("/hardware/force-rescan", hardwareHandler.ForceRescan) // ปุ่ม Force Re-Scan

		// Energy endpoints
		apiGroup.POST("/energy/record", energyHandler.RecordHourly)
		apiGroup.GET("/energy/daily", energyHandler.GetDaily)
		apiGroup.GET("/energy/monthly", energyHandler.GetMonthly)

		// Growth tracking endpoints
		apiGroup.GET("/growth/daily", growthHandler.GetDailyGrowth)
		apiGroup.GET("/growth/detail", growthHandler.GetDateDetail)
		apiGroup.GET("/growth/latest", growthHandler.GetLatest)
	}

	hardwareGroup := r.Group("/hardware")
	{
		hardwareGroup.POST("/state", hardwareHandler.UpdateState)
		hardwareGroup.GET("/ws", hardwareHandler.ConnectWebSocket)
		hardwareGroup.GET("/command", hardwareHandler.ConnectCommandWS) // สำหรับ ESP32 Connect มาฟังคำสั่ง
		hardwareGroup.POST("/upload-image", hardwareHandler.UploadImage)
	}

	r.Static("/uploads", "./uploads")

	fmt.Println("🚀 Pfal Server is running on http://0.0.0.0:8080")

	err = r.Run("0.0.0.0:8080")
	if err != nil {
		return
	}
}