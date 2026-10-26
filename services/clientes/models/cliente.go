package models

// Cliente representa a un cliente del sistema según el esquema del PDF
type Cliente struct {
	ID        int    `json:"id"`
	Nombre    string `json:"nombre"`
	CC        string `json:"cc"`
	Email     string `json:"email"`
	Direccion string `json:"direccion"`
}

// CreateClienteRequest datos requeridos para registrar un cliente
type CreateClienteRequest struct {
	Nombre    string `json:"nombre"`
	CC        string `json:"cc"`
	Email     string `json:"email"`
	Direccion string `json:"direccion"`
}

// UpdateClienteRequest datos para actualizar un cliente
type UpdateClienteRequest struct {
	Nombre    string `json:"nombre"`
	CC        string `json:"cc"`
	Email     string `json:"email"`
	Direccion string `json:"direccion"`
}
