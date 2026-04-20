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
	)
	if err != nil {
		return
	}

	// 1. กำหนด Repositories
	userRepo := repository.NewUserRepo(db)
	logRepo := repository.NewLogRepo(db)
	lightProfileRepo := repository.NewLightProfileRepo(db) // เพิ่มบรรทัดนี้

	// 2. กำหนด Handlers
	authHandler := handler.NewAuthHandler(userRepo)
	logHandler := handler.NewLogHandler(logRepo)
	hardwareHandler := handler.NewHardwareHandler()
	lightProfileHandler := handler.NewLightProfileHandler(lightProfileRepo, hardwareHandler)

	// เริ่มต้นระบบ Broadcast
	go hardwareHandler.HandleMessages()

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
		apiGroup.GET("/hardware/state", hardwareHandler.GetState)
		apiGroup.POST("/hardware/stop", hardwareHandler.EmergencyStop) // ปุ่ม Emergency Stop
	}

	hardwareGroup := r.Group("/hardware")
	{
		hardwareGroup.POST("/state", hardwareHandler.UpdateState)
		hardwareGroup.GET("/ws", hardwareHandler.ConnectWebSocket)
		hardwareGroup.GET("/command", hardwareHandler.ConnectCommandWS) // สำหรับ ESP32 Connect มาฟังคำสั่ง
	}

	fmt.Println("🚀 Pfal Server is running on http://localhost:8080")

	err = r.Run(":8080")
	if err != nil {
		return
	}
}