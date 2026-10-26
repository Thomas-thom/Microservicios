package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"microservicios/pkg/token"
	"microservicios/services/facturacion/clients"
	"microservicios/services/facturacion/handlers"
	"microservicios/services/facturacion/models"
	"microservicios/services/facturacion/repository"
)

func TestFacturacionFlow(t *testing.T) {
	// 1. Mock de Auth Service
	mockAuth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(token.UserClaims{
			ID:     1,
			Nombre: "Ricardo Gómez",
			Email:  "ricardo@example.com",
			Rol:    "admin",
		})
	}))
	defer mockAuth.Close()

	// 2. Mock de Clientes Service
	mockClientes := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(clients.RemoteCliente{
			ID:        201,
			Nombre:    "Carlos Pérez",
			CC:        "1234567",
			Email:     "carlos@example.com",
			Direccion: "Calle 123",
		})
	}))
	defer mockClientes.Close()

	// 3. Mock de Productos Service
	stock101 := 10
	mockProductos := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/productos/101" {
			json.NewEncoder(w).Encode(clients.RemoteProducto{
				ID:     101,
				Nombre: "Laptop Lenovo ThinkPad",
				Precio: 3500000.0,
				Stock:  stock101,
			})
			return
		}
		if r.URL.Path == "/productos/descontar" && r.Method == http.MethodPost {
			var descReq clients.DescontarStockRequest
			json.NewDecoder(r.Body).Decode(&descReq)
			for _, it := range descReq.Items {
				if it.ID == 101 {
					if it.Cantidad > stock101 {
						w.WriteHeader(http.StatusConflict)
						json.NewEncoder(w).Encode(map[string]string{"detail": "Stock insuficiente"})
						return
					}
					stock101 -= it.Cantidad
				}
			}
			json.NewEncoder(w).Encode(map[string]string{"mensaje": "OK"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockProductos.Close()

	// 4. Inicializar repositorio de facturas temporal
	tmpDir := t.TempDir()
	facturaPath := filepath.Join(tmpDir, "facturas_test.json")
	repo, err := repository.NewFacturaRepository(facturaPath)
	if err != nil {
		t.Fatalf("error init repo: %v", err)
	}

	svcClients := clients.NewServiceClients(mockAuth.URL, mockClientes.URL, mockProductos.URL)
	handler := handlers.NewFacturaHandler(repo, svcClients)

	// 5. Emitir factura válida
	reqBody := models.CreateFacturaRequest{
		ClienteID: 201,
		Productos: []models.CreateFacturaItemRequest{
			{ProductoID: 101, Cantidad: 2},
		},
	}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/facturas", bytes.NewReader(bodyBytes))
	req.Header.Set("Authorization", "Bearer token-valido")
	rec := httptest.NewRecorder()

	handler.Router(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperaba status 201, obtuve %d: %s", rec.Code, rec.Body.String())
	}

	var creada models.Factura
	if err := json.Unmarshal(rec.Body.Bytes(), &creada); err != nil {
		t.Fatalf("error decodificando factura: %v", err)
	}

	if creada.FacturaID != 5001 {
		t.Errorf("esperaba factura_id 5001, obtuve %d", creada.FacturaID)
	}
	if creada.Total != 7000000.0 {
		t.Errorf("esperaba total 7000000.0, obtuve %f", creada.Total)
	}
	if creada.Cliente.Nombre != "Carlos Pérez" {
		t.Errorf("nombre cliente incorrecto: %s", creada.Cliente.Nombre)
	}
	if creada.Usuario.Nombre != "Ricardo Gómez" {
		t.Errorf("nombre usuario incorrecto: %s", creada.Usuario.Nombre)
	}

	// 6. Consultar facturas generadas
	listReq := httptest.NewRequest(http.MethodGet, "/facturas", nil)
	listRec := httptest.NewRecorder()
	handler.Router(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("esperaba 200 en listar facturas, obtuve %d", listRec.Code)
	}

	var lista []models.Factura
	json.Unmarshal(listRec.Body.Bytes(), &lista)
	if len(lista) != 1 {
		t.Errorf("esperaba 1 factura en la lista, encontré %d", len(lista))
	}

	// 7. Intentar facturar más de lo disponible en stock (stock restante = 8, pedimos 10)
	reqOver := models.CreateFacturaRequest{
		ClienteID: 201,
		Productos: []models.CreateFacturaItemRequest{
			{ProductoID: 101, Cantidad: 10},
		},
	}
	overBytes, _ := json.Marshal(reqOver)
	reqOverHttp := httptest.NewRequest(http.MethodPost, "/facturas", bytes.NewReader(overBytes))
	reqOverHttp.Header.Set("Authorization", "Bearer token-valido")
	recOver := httptest.NewRecorder()

	handler.Router(recOver, reqOverHttp)
	if recOver.Code != http.StatusConflict {
		t.Fatalf("esperaba status 409 por stock insuficiente, obtuve %d: %s", recOver.Code, recOver.Body.String())
	}
}
