package main

import (
	"fmt"
	"log"
	"os"
	"server/internal/handler"
	"server/internal/middleware"
	"server/internal/models"
	"server/internal/repository"

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

	userRepo := repository.NewUserRepo(db)
	logRepo := repository.NewLogRepo(db)
	authHandler := handler.NewAuthHandler(userRepo)
	logHandler := handler.NewLogHandler(logRepo)

	r := gin.Default()

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
	}

	apiGroup := r.Group("/api")
	apiGroup.Use(middleware.AuthMiddleware())
	{
		apiGroup.POST("/logs", logHandler.CreateLog)
		apiGroup.POST("/power", logHandler.CreatePowerConsumption)
	}

	fmt.Println("🚀 Pfal Server is running on http://localhost:8080")

	err = r.Run(":8080")
	if err != nil {
		return
	}
}
