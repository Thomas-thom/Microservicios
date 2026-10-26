package response

import (
	"encoding/json"
	"net/http"
)

// StandardError define el formato consistente de error (RFC 9457 compatible)
type StandardError struct {
	Status int    `json:"status"`
	Title  string `json:"title"`
	Detail string `json:"detail,omitempty"`
}

// JSON escribe una respuesta exitosa en formato JSON con el código de estado indicado
func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

// Error escribe una respuesta de error JSON uniforme
func Error(w http.ResponseWriter, status int, title string, detail string) {
	w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
	w.WriteHeader(status)
	errResp := StandardError{
		Status: status,
		Title:  title,
		Detail: detail,
	}
	_ = json.NewEncoder(w).Encode(errResp)
}
