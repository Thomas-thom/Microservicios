package models

// User representa la entidad de usuario en el sistema
type User struct {
	ID       int    `json:"id"`
	Nombre   string `json:"nombre"`
	Email    string `json:"email"`
	Password string `json:"password,omitempty"` // Se omite en respuestas públicas
	Rol      string `json:"rol"`
}

// RegisterRequest datos recibidos para registrar un usuario
type RegisterRequest struct {
	Nombre   string `json:"nombre"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Rol      string `json:"rol"`
}

// LoginRequest credenciales de inicio de sesión
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse respuesta de login con token y usuario
type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
