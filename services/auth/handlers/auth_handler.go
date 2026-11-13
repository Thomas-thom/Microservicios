package handlers

import (
	"encoding/json"
	"log"
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

// Register maneja el registro de nuevos usuarios (vía /register o POST /usuarios)
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

	log.Printf("==================================================================")
	log.Printf("[Auth CMD] ➕ ACCIÓN USUARIOS: Creando usuario -> Nombre=%q | Email=%s | Rol=%s", req.Nombre, req.Email, req.Rol)

	created, err := h.repo.Create(newUser)
	if err != nil {
		log.Printf("[Auth CMD] ❌ ERROR AL CREAR USUARIO (%s): %v", req.Email, err)
		log.Printf("==================================================================")
		if err == repository.ErrUserAlreadyExists {
			response.Error(w, http.StatusConflict, "Usuario ya registrado", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}

	log.Printf("[Auth CMD] ✅ USUARIO CREADO EXITOSAMENTE -> ID=%d | Nombre=%q | Email=%s | Rol=%s (Guardado en data/usuarios.json)",
		created.ID, created.Nombre, created.Email, created.Rol)
	log.Printf("==================================================================")

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
		log.Printf("[Auth CMD] ⚠️ Intento de login fallido para email=%s (usuario no encontrado)", req.Email)
		response.Error(w, http.StatusUnauthorized, "Credenciales inválidas", "Email o contraseña incorrectos")
		return
	}

	if strings.HasPrefix(user.Password, "$2a$") || strings.HasPrefix(user.Password, "$2b$") || strings.HasPrefix(user.Password, "$2y$") {
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			log.Printf("[Auth CMD] ⚠️ Intento de login fallido para email=%s (contraseña incorrecta)", req.Email)
			response.Error(w, http.StatusUnauthorized, "Credenciales inválidas", "Email o contraseña incorrectos")
			return
		}
	} else {
		// Soporte para contraseñas editadas manualmente en texto plano en data/usuarios.json durante pruebas
		if user.Password != req.Password {
			log.Printf("[Auth CMD] ⚠️ Intento de login fallido para email=%s (contraseña incorrecta)", req.Email)
			response.Error(w, http.StatusUnauthorized, "Credenciales inválidas", "Email o contraseña incorrectos")
			return
		}
	}

	tok, err := token.GenerateToken(user.ID, user.Nombre, user.Email, user.Rol, 24*time.Hour)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Error al generar token", err.Error())
		return
	}

	log.Printf("[Auth CMD] 🔐 LOGIN EXITOSO -> Usuario ID=%d | Nombre=%q | Email=%s | Rol=%s", user.ID, user.Nombre, user.Email, user.Rol)

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

	// Verificar en tiempo real contra data/usuarios.json por si el archivo JSON fue modificado manualmente
	userFromDisk, err := h.repo.GetByID(claims.ID)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "Usuario no encontrado en usuarios.json", "El usuario asociado al token ya no existe en el archivo de persistencia")
		return
	}

	claims.Nombre = userFromDisk.Nombre
	claims.Email = userFromDisk.Email
	claims.Rol = userFromDisk.Rol

	response.JSON(w, http.StatusOK, claims)
}

// UsersHandler maneja las operaciones de listar, crear, consultar, actualizar o eliminar usuarios
func (h *AuthHandler) UsersHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/usuarios")
	path = strings.TrimPrefix(path, "/")

	if path == "" {
		switch r.Method {
		case http.MethodGet:
			users, err := h.repo.GetAll()
			if err != nil {
				response.Error(w, http.StatusInternalServerError, "Error al leer usuarios", err.Error())
				return
			}
			for i := range users {
				users[i].Password = ""
			}
			log.Printf("[Auth CMD] 📋 ACCIÓN USUARIOS -> Listado de usuarios consultado (%d usuarios registrados)", len(users))
			response.JSON(w, http.StatusOK, users)
			return
		case http.MethodPost:
			h.Register(w, r)
			return
		default:
			response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use GET o POST")
			return
		}
	}

	id, err := strconv.Atoi(path)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "ID inválido", "El ID de usuario debe ser un número entero")
		return
	}

	switch r.Method {
	case http.MethodGet:
		user, err := h.repo.GetByID(id)
		if err != nil {
			response.Error(w, http.StatusNotFound, "Usuario no encontrado", err.Error())
			return
		}
		safeUser := *user
		safeUser.Password = ""
		response.JSON(w, http.StatusOK, safeUser)
		return

	case http.MethodPut:
		var req models.UpdateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
			return
		}
		req.Nombre = strings.TrimSpace(req.Nombre)
		req.Email = strings.TrimSpace(strings.ToLower(req.Email))
		req.Password = strings.TrimSpace(req.Password)
		req.Rol = strings.TrimSpace(strings.ToLower(req.Rol))

		if req.Nombre == "" || req.Email == "" {
			response.Error(w, http.StatusBadRequest, "Datos incompletos", "Nombre y email son obligatorios")
			return
		}
		if !strings.Contains(req.Email, "@") || !strings.Contains(req.Email, ".") {
			response.Error(w, http.StatusBadRequest, "Email inválido", "El formato del correo electrónico no es válido")
			return
		}
		if req.Rol != "admin" && req.Rol != "cliente" {
			req.Rol = "cliente"
		}

		hashedPass := ""
		if req.Password != "" {
			if len(req.Password) < 4 {
				response.Error(w, http.StatusBadRequest, "Contraseña insegura", "La contraseña debe tener al menos 4 caracteres")
				return
			}
			hp, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
			if err != nil {
				response.Error(w, http.StatusInternalServerError, "Error interno", "No se pudo procesar la contraseña")
				return
			}
			hashedPass = string(hp)
		}

		updated, err := h.repo.Update(id, models.User{
			ID:       id,
			Nombre:   req.Nombre,
			Email:    req.Email,
			Password: hashedPass,
			Rol:      req.Rol,
		})
		if err != nil {
			if err == repository.ErrUserNotFound {
				response.Error(w, http.StatusNotFound, "Usuario no encontrado", err.Error())
				return
			}
			if err == repository.ErrUserAlreadyExists {
				response.Error(w, http.StatusConflict, "Email en uso", err.Error())
				return
			}
			response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
			return
		}

		log.Printf("[Auth CMD] ✏️ ACCIÓN USUARIOS -> Usuario actualizado ID=%d | Nombre=%q | Email=%s | Rol=%s",
			updated.ID, updated.Nombre, updated.Email, updated.Rol)
		updated.Password = ""
		response.JSON(w, http.StatusOK, updated)
		return

	case http.MethodDelete:
		prevUser, _ := h.repo.GetByID(id)
		if err := h.repo.Delete(id); err != nil {
			if err == repository.ErrUserNotFound {
				response.Error(w, http.StatusNotFound, "Usuario no encontrado", err.Error())
				return
			}
			response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
			return
		}
		if prevUser != nil {
			log.Printf("[Auth CMD] 🗑️ ACCIÓN USUARIOS -> Usuario eliminado ID=%d | Nombre=%q | Email=%s",
				id, prevUser.Nombre, prevUser.Email)
		} else {
			log.Printf("[Auth CMD] 🗑️ ACCIÓN USUARIOS -> Usuario eliminado ID=%d", id)
		}
		response.JSON(w, http.StatusOK, map[string]string{"mensaje": "Usuario eliminado exitosamente"})
		return

	default:
		response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use GET, PUT o DELETE")
	}
}
