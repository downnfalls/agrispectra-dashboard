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
	lightProfileHandler := handler.NewLightProfileHandler(lightProfileRepo) // เพิ่มบรรทัดนี้

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
	}

	apiGroup := r.Group("/api")
	apiGroup.Use(middleware.AuthMiddleware()) // ต้องการ Token
	{
		apiGroup.POST("/logs", logHandler.CreateLog)
		apiGroup.POST("/power", logHandler.CreatePowerConsumption)
		// 3. เพิ่ม Endpoint ใหม่
		apiGroup.POST("/light-profiles", lightProfileHandler.CreateLightProfile)
		apiGroup.GET("/light-profiles", lightProfileHandler.GetLightProfiles) // GET สำหรับหน้ารับสูตรไฟ
		apiGroup.DELETE("/light-profiles/:id", lightProfileHandler.DeleteLightProfile) // DELETE สำหรับลบสูตรไฟ
	}

	fmt.Println("🚀 Pfal Server is running on http://localhost:8080")

	err = r.Run(":8080")
	if err != nil {
		return
	}
}