package token

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var defaultSecret = []byte("super-secret-key-microservicios-2026-facturacion")

// UserClaims contiene los datos embebidos en el token
type UserClaims struct {
	ID        int       `json:"id"`
	Nombre    string    `json:"nombre"`
	Email     string    `json:"email"`
	Rol       string    `json:"rol"`
	ExpiresAt time.Time `json:"exp"`
}

// GenerateToken crea un token firmado con HMAC-SHA256
func GenerateToken(id int, nombre, email, rol string, duration time.Duration) (string, error) {
	claims := UserClaims{
		ID:        id,
		Nombre:    nombre,
		Email:     email,
		Rol:       rol,
		ExpiresAt: time.Now().Add(duration),
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	payloadB64 := base64.RawURLEncoding.EncodeToString(payload)
	sig := createSignature(payloadB64, defaultSecret)

	return fmt.Sprintf("%s.%s", payloadB64, sig), nil
}

// ValidateToken comprueba la firma y vigencia del token
func ValidateToken(tokenStr string) (*UserClaims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 2 {
		return nil, errors.New("formato de token inválido")
	}

	payloadB64 := parts[0]
	signature := parts[1]

	expectedSig := createSignature(payloadB64, defaultSecret)
	if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
		return nil, errors.New("firma de token inválida")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, errors.New("error al decodificar payload")
	}

	var claims UserClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, errors.New("error al deserializar claims")
	}

	if time.Now().After(claims.ExpiresAt) {
		return nil, errors.New("el token ha expirado")
	}

	return &claims, nil
}

func createSignature(data string, secret []byte) string {
	h := hmac.New(sha256.New, secret)
	h.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}
