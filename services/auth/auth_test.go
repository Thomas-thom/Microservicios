package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"microservicios/services/auth/handlers"
	"microservicios/services/auth/models"
	"microservicios/services/auth/repository"
)

func setupTestAuthRepo(t *testing.T) (*repository.UserRepository, string) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "usuarios_test.json")

	hashAdmin, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	initialUsers := []models.User{
		{
			ID:       1,
			Nombre:   "Ricardo Gómez",
			Email:    "ricardo@example.com",
			Password: string(hashAdmin),
			Rol:      "admin",
		},
	}
	data, _ := json.Marshal(initialUsers)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		t.Fatalf("failed to write test users: %v", err)
	}

	repo, err := repository.NewUserRepository(filePath)
	if err != nil {
		t.Fatalf("failed to init repo: %v", err)
	}
	return repo, filePath
}

func TestAuthFlow(t *testing.T) {
	repo, _ := setupTestAuthRepo(t)
	handler := handlers.NewAuthHandler(repo)

	// 1. Probar Login con credenciales válidas
	loginBody, _ := json.Marshal(models.LoginRequest{
		Email:    "ricardo@example.com",
		Password: "admin123",
	})
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(loginBody))
	rec := httptest.NewRecorder()
	handler.Login(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperaba status 200 en login, obtuve %d: %s", rec.Code, rec.Body.String())
	}

	var loginResp models.LoginResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("error unmarshaling login response: %v", err)
	}
	if loginResp.Token == "" {
		t.Errorf("token no debe ser vacío")
	}
	if loginResp.User.Password != "" {
		t.Errorf("la contraseña no debe ser expuesta")
	}

	// 2. Probar Verify con el token generado
	verifyReq := httptest.NewRequest(http.MethodGet, "/verify", nil)
	verifyReq.Header.Set("Authorization", "Bearer "+loginResp.Token)
	verifyRec := httptest.NewRecorder()
	handler.Verify(verifyRec, verifyReq)

	if verifyRec.Code != http.StatusOK {
		t.Fatalf("esperaba status 200 en verify, obtuve %d: %s", verifyRec.Code, verifyRec.Body.String())
	}

	// 3. Probar Registro de nuevo usuario
	regBody, _ := json.Marshal(models.RegisterRequest{
		Nombre:   "Nuevo Usuario",
		Email:    "nuevo@example.com",
		Password: "password456",
		Rol:      "cliente",
	})
	regReq := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(regBody))
	regRec := httptest.NewRecorder()
	handler.Register(regRec, regReq)

	if regRec.Code != http.StatusCreated {
		t.Fatalf("esperaba status 201 en register, obtuve %d: %s", regRec.Code, regRec.Body.String())
	}

	// 4. Intentar registrar el mismo email de nuevo (debe fallar con 409)
	dupReq := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(regBody))
	dupRec := httptest.NewRecorder()
	handler.Register(dupRec, dupReq)

	if dupRec.Code != http.StatusConflict {
		t.Fatalf("esperaba status 409 por duplicado, obtuve %d: %s", dupRec.Code, dupRec.Body.String())
	}
}
