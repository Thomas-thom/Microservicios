package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"microservicios/pkg/response"
	"microservicios/pkg/token"
	"microservicios/services/auth/models"
	"microservicios/services/auth/repository"
)

type AuthHandler struct {
	repo *repository.UserRepository
}

func NewAuthHandler(repo *repository.UserRepository) *AuthHandler {
	return &AuthHandler{repo: repo}
}

// Register maneja el registro de nuevos usuarios
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use POST para registrarse")
		return
	}

	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)
	req.Rol = strings.TrimSpace(strings.ToLower(req.Rol))

	if req.Nombre == "" || req.Email == "" || req.Password == "" {
		response.Error(w, http.StatusBadRequest, "Datos incompletos", "Nombre, email y password son obligatorios")
		return
	}

	if !strings.Contains(req.Email, "@") || !strings.Contains(req.Email, ".") {
		response.Error(w, http.StatusBadRequest, "Email inválido", "El formato del correo electrónico no es válido")
		return
	}

	if len(req.Password) < 4 {
		response.Error(w, http.StatusBadRequest, "Contraseña insegura", "La contraseña debe tener al menos 4 caracteres")
		return
	}

	if req.Rol != "admin" && req.Rol != "cliente" {
		req.Rol = "cliente"
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Error interno", "No se pudo procesar la contraseña")
		return
	}

	newUser := models.User{
		Nombre:   req.Nombre,
		Email:    req.Email,
		Password: string(hashedPassword),
		Rol:      req.Rol,
	}

	created, err := h.repo.Create(newUser)
	if err != nil {
		if err == repository.ErrUserAlreadyExists {
			response.Error(w, http.StatusConflict, "Usuario ya registrado", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}

	// No exponer la contraseña
	created.Password = ""
	response.JSON(w, http.StatusCreated, created)
}

// Login valida credenciales y retorna un token firmado
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use POST para iniciar sesión")
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	if req.Email == "" || req.Password == "" {
		response.Error(w, http.StatusBadRequest, "Datos incompletos", "Email y contraseña son obligatorios")
		return
	}

	user, err := h.repo.GetByEmail(req.Email)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "Credenciales inválidas", "Email o contraseña incorrectos")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		response.Error(w, http.StatusUnauthorized, "Credenciales inválidas", "Email o contraseña incorrectos")
		return
	}

	tok, err := token.GenerateToken(user.ID, user.Nombre, user.Email, user.Rol, 24*time.Hour)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Error al generar token", err.Error())
		return
	}

	safeUser := *user
	safeUser.Password = ""

	response.JSON(w, http.StatusOK, models.LoginResponse{
		Token: tok,
		User:  safeUser,
	})
}

// Verify verifica el token Bearer recibido en la cabecera Authorization
func (h *AuthHandler) Verify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use GET para verificar token")
		return
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		response.Error(w, http.StatusUnauthorized, "No autorizado", "Falta encabezado Authorization")
		return
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		response.Error(w, http.StatusUnauthorized, "Formato no válido", "Formato esperado: Bearer <token>")
		return
	}

	claims, err := token.ValidateToken(parts[1])
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "Token inválido o expirado", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, claims)
}

// UsersHandler maneja las operaciones de listar o consultar usuarios
func (h *AuthHandler) UsersHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/usuarios")
	path = strings.TrimPrefix(path, "/")

	if path == "" {
		if r.Method == http.MethodGet {
			users, err := h.repo.GetAll()
			if err != nil {
				response.Error(w, http.StatusInternalServerError, "Error al leer usuarios", err.Error())
				return
			}
			for i := range users {
				users[i].Password = ""
			}
			response.JSON(w, http.StatusOK, users)
			return
		}
		response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "")
		return
	}

	id, err := strconv.Atoi(path)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "ID inválido", "El ID de usuario debe ser un número entero")
		return
	}

	if r.Method == http.MethodGet {
		user, err := h.repo.GetByID(id)
		if err != nil {
			response.Error(w, http.StatusNotFound, "Usuario no encontrado", err.Error())
			return
		}
		safeUser := *user
		safeUser.Password = ""
		response.JSON(w, http.StatusOK, safeUser)
		return
	}

	response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "")
}
