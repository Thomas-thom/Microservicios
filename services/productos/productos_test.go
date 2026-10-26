package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"microservicios/services/productos/handlers"
	"microservicios/services/productos/models"
	"microservicios/services/productos/repository"
)

func setupTestProductosRepo(t *testing.T) (*repository.ProductoRepository, string) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "productos_test.json")

	initial := []models.Producto{
		{ID: 101, Nombre: "Laptop Lenovo ThinkPad", Precio: 3500000.0, Stock: 10},
		{ID: 102, Nombre: "Mouse inalámbrico Logitech", Precio: 12000.0, Stock: 5},
	}
	data, _ := json.Marshal(initial)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		t.Fatalf("failed to write test data: %v", err)
	}

	repo, err := repository.NewProductoRepository(filePath)
	if err != nil {
		t.Fatalf("failed to init repo: %v", err)
	}
	return repo, filePath
}

func TestProductosCRUDAndDescuento(t *testing.T) {
	repo, _ := setupTestProductosRepo(t)
	handler := handlers.NewProductoHandler(repo)

	// 1. Listar productos
	reqList := httptest.NewRequest(http.MethodGet, "/productos", nil)
	recList := httptest.NewRecorder()
	handler.Router(recList, reqList)
	if recList.Code != http.StatusOK {
		t.Fatalf("esperaba 200 en listar, obtuve %d", recList.Code)
	}

	// 2. Crear producto
	newProd := models.CreateProductoRequest{
		Nombre: "Monitor Curvo 27",
		Precio: 850000.0,
		Stock:  15,
	}
	body, _ := json.Marshal(newProd)
	reqCreate := httptest.NewRequest(http.MethodPost, "/productos", bytes.NewReader(body))
	recCreate := httptest.NewRecorder()
	handler.Router(recCreate, reqCreate)
	if recCreate.Code != http.StatusCreated {
		t.Fatalf("esperaba 201 en crear, obtuve %d: %s", recCreate.Code, recCreate.Body.String())
	}

	// 3. Descontar stock exitosamente
	descuentoReq := models.DescontarStockRequest{
		Items: []models.DescontarItem{
			{ID: 101, Cantidad: 3},
			{ID: 102, Cantidad: 2},
		},
	}
	dBody, _ := json.Marshal(descuentoReq)
	reqDesc := httptest.NewRequest(http.MethodPost, "/productos/descontar", bytes.NewReader(dBody))
	recDesc := httptest.NewRecorder()
	handler.Router(recDesc, reqDesc)
	if recDesc.Code != http.StatusOK {
		t.Fatalf("esperaba 200 en descuento de stock, obtuve %d: %s", recDesc.Code, recDesc.Body.String())
	}

	// Verificar que el stock de 101 ahora es 7 y de 102 es 3
	p101, _ := repo.GetByID(101)
	if p101.Stock != 7 {
		t.Errorf("esperaba stock 7 para 101, obtuve %d", p101.Stock)
	}

	// 4. Descontar stock con cantidad excesiva (debe fallar atómicamente)
	descuentoExcesivo := models.DescontarStockRequest{
		Items: []models.DescontarItem{
			{ID: 101, Cantidad: 1}, // este sí alcanzaría
			{ID: 102, Cantidad: 10}, // este NO alcanza (stock es 3)
		},
	}
	dExBody, _ := json.Marshal(descuentoExcesivo)
	reqEx := httptest.NewRequest(http.MethodPost, "/productos/descontar", bytes.NewReader(dExBody))
	recEx := httptest.NewRecorder()
	handler.Router(recEx, reqEx)
	if recEx.Code != http.StatusConflict {
		t.Fatalf("esperaba 409 Conflict por stock insuficiente, obtuve %d: %s", recEx.Code, recEx.Body.String())
	}

	// Verificar atomicidad: el producto 101 NO debe haber sido descontado
	p101Check, _ := repo.GetByID(101)
	if p101Check.Stock != 7 {
		t.Errorf("la atomicidad falló: el stock de 101 fue modificado indebidamente a %d", p101Check.Stock)
	}
}
