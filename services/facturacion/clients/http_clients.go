package clients

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"microservicios/pkg/token"
)

type RemoteUser struct {
	ID     int    `json:"id"`
	Nombre string `json:"nombre"`
	Email  string `json:"email"`
	Rol    string `json:"rol"`
}

type RemoteCliente struct {
	ID        int    `json:"id"`
	Nombre    string `json:"nombre"`
	CC        string `json:"cc"`
	Email     string `json:"email"`
	Direccion string `json:"direccion"`
}

type RemoteProducto struct {
	ID     int     `json:"id"`
	Nombre string  `json:"nombre"`
	Precio float64 `json:"precio"`
	Stock  int     `json:"stock"`
}

type DescontarItem struct {
	ID       int `json:"id"`
	Cantidad int `json:"cantidad"`
}

type DescontarStockRequest struct {
	Items []DescontarItem `json:"items"`
}

type ServiceClients struct {
	authURL      string
	clientesURL  string
	productosURL string
	httpClient   *http.Client
}

func NewServiceClients(authURL, clientesURL, productosURL string) *ServiceClients {
	return &ServiceClients{
		authURL:      authURL,
		clientesURL:  clientesURL,
		productosURL: productosURL,
		httpClient:   &http.Client{Timeout: 5 * time.Second},
	}
}

// VerifyUser verifica el token con el microservicio de autenticación
func (c *ServiceClients) VerifyUser(authHeader string) (*RemoteUser, error) {
	if authHeader == "" {
		return nil, errors.New("cabecera de autorización ausente")
	}

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/verify", c.authURL), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", authHeader)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Fallback directo a validación criptográfica de token si el microservicio no responde de inmediato
		claims, tErr := token.ValidateToken(authHeader)
		if tErr == nil {
			return &RemoteUser{ID: claims.ID, Nombre: claims.Nombre, Email: claims.Email, Rol: claims.Rol}, nil
		}
		return nil, fmt.Errorf("error al conectar con Auth Service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("token de usuario inválido o expirado")
	}

	var claims token.UserClaims
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return nil, err
	}

	return &RemoteUser{
		ID:     claims.ID,
		Nombre: claims.Nombre,
		Email:  claims.Email,
		Rol:    claims.Rol,
	}, nil
}

// GetCliente consulta los datos del cliente por ID en el microservicio de clientes
func (c *ServiceClients) GetCliente(id int) (*RemoteCliente, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/clientes/%d", c.clientesURL, id))
	if err != nil {
		return nil, fmt.Errorf("error al conectar con Clientes Service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, errors.New("cliente no encontrado")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("error al consultar cliente: código HTTP %d", resp.StatusCode)
	}

	var cliente RemoteCliente
	if err := json.NewDecoder(resp.Body).Decode(&cliente); err != nil {
		return nil, err
	}
	return &cliente, nil
}

// GetProducto consulta un producto por ID en el microservicio de productos
func (c *ServiceClients) GetProducto(id int) (*RemoteProducto, error) {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/productos/%d", c.productosURL, id))
	if err != nil {
		return nil, fmt.Errorf("error al conectar con Productos Service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, errors.New("producto no encontrado")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("error al consultar producto: código HTTP %d", resp.StatusCode)
	}

	var prod RemoteProducto
	if err := json.NewDecoder(resp.Body).Decode(&prod); err != nil {
		return nil, err
	}
	return &prod, nil
}

// DescontarStock solicita la reducción atómica del stock en el microservicio de productos
func (c *ServiceClients) DescontarStock(items []DescontarItem) error {
	payload, err := json.Marshal(DescontarStockRequest{Items: items})
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/productos/descontar", c.productosURL),
		"application/json",
		bytes.NewReader(payload),
	)
	if err != nil {
		return fmt.Errorf("error al conectar con Productos Service para descontar stock: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		detail, _ := errData["detail"].(string)
		if detail == "" {
			detail, _ = errData["title"].(string)
		}
		if detail == "" {
			detail = fmt.Sprintf("falló el descuento de existencias con estado HTTP %d", resp.StatusCode)
		}
		return errors.New(detail)
	}

	return nil
}
