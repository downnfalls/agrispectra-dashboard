package repository

import (
	"server/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) CreateUser(user *models.User) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.Password = string(hashedPassword)
	return r.db.Create(user).Error
}

func (r *UserRepo) GetUserByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.Where("username = ?", username).First(&user).Error
	return &user, err
}

func (r *UserRepo) CheckPassword(hashedPassword, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}

func (r *UserRepo) SeedAdminUser() error {
	var count int64
	r.db.Model(&models.User{}).Where("username = ?", "admin").Count(&count)
	if count == 0 {
		user := &models.User{
			Username: "admin",
			Password: "1234", // default password
		}
		return r.CreateUser(user)
	}
	return nil
}
