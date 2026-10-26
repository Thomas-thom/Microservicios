package repository

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"microservicios/services/auth/models"
)

var (
	ErrUserNotFound      = errors.New("usuario no encontrado")
	ErrUserAlreadyExists = errors.New("ya existe un usuario con este correo electrónico")
)

type UserRepository struct {
	mu       sync.RWMutex
	filePath string
}

func NewUserRepository(filePath string) (*UserRepository, error) {
	repo := &UserRepository{filePath: filePath}
	if err := repo.ensureFileExists(); err != nil {
		return nil, err
	}
	return repo, nil
}

func (r *UserRepository) ensureFileExists() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	dir := filepath.Dir(r.filePath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	if _, err := os.Stat(r.filePath); os.IsNotExist(err) {
		emptyList := []models.User{}
		data, err := json.MarshalIndent(emptyList, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(r.filePath, data, 0644)
	}
	return nil
}

func (r *UserRepository) readAllUnlocked() ([]models.User, error) {
	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return []models.User{}, nil
	}
	var users []models.User
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, err
	}
	return users, nil
}

func (r *UserRepository) writeAllUnlocked(users []models.User) error {
	data, err := json.MarshalIndent(users, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.filePath, data, 0644)
}

func (r *UserRepository) GetAll() ([]models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.readAllUnlocked()
}

func (r *UserRepository) GetByID(id int) (*models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	for _, u := range users {
		if u.ID == id {
			copyU := u
			return &copyU, nil
		}
	}
	return nil, ErrUserNotFound
}

func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	normalized := strings.TrimSpace(strings.ToLower(email))
	for _, u := range users {
		if strings.TrimSpace(strings.ToLower(u.Email)) == normalized {
			copyU := u
			return &copyU, nil
		}
	}
	return nil, ErrUserNotFound
}

func (r *UserRepository) Create(u models.User) (*models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	users, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	normalized := strings.TrimSpace(strings.ToLower(u.Email))
	maxID := 0
	for _, existing := range users {
		if strings.TrimSpace(strings.ToLower(existing.Email)) == normalized {
			return nil, ErrUserAlreadyExists
		}
		if existing.ID > maxID {
			maxID = existing.ID
		}
	}

	if u.ID <= 0 {
		u.ID = maxID + 1
	}

	users = append(users, u)
	if err := r.writeAllUnlocked(users); err != nil {
		return nil, err
	}

	return &u, nil
}
