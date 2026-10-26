package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"microservicios/services/clientes/handlers"
	"microservicios/services/clientes/models"
	"microservicios/services/clientes/repository"
)

func setupTestClientesRepo(t *testing.T) (*repository.ClienteRepository, string) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "clientes_test.json")

	initial := []models.Cliente{
		{
			ID:        201,
			Nombre:    "Carlos Pérez",
			CC:        "1234567",
			Email:     "carlos@example.com",
			Direccion: "Calle 123 #45-67, Bogotá",
		},
	}
	data, _ := json.Marshal(initial)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		t.Fatalf("failed to write test data: %v", err)
	}

	repo, err := repository.NewClienteRepository(filePath)
	if err != nil {
		t.Fatalf("failed to init repo: %v", err)
	}
	return repo, filePath
}

func TestClientesCRUD(t *testing.T) {
	repo, _ := setupTestClientesRepo(t)
	handler := handlers.NewClienteHandler(repo)

	// 1. Listar clientes
	reqList := httptest.NewRequest(http.MethodGet, "/clientes", nil)
	recList := httptest.NewRecorder()
	handler.Router(recList, reqList)
	if recList.Code != http.StatusOK {
		t.Fatalf("esperaba status 200 en listado, obtuve %d", recList.Code)
	}

	// 2. Crear cliente nuevo
	newClient := models.CreateClienteRequest{
		Nombre:    "Ana Torres",
		CC:        "56789101",
		Email:     "ana@example.com",
		Direccion: "Carrera 10 #20-30, Medellín",
	}
	body, _ := json.Marshal(newClient)
	reqCreate := httptest.NewRequest(http.MethodPost, "/clientes", bytes.NewReader(body))
	recCreate := httptest.NewRecorder()
	handler.Router(recCreate, reqCreate)
	if recCreate.Code != http.StatusCreated {
		t.Fatalf("esperaba status 201 en crear, obtuve %d: %s", recCreate.Code, recCreate.Body.String())
	}

	// 3. Crear cliente con CC duplicada (debe fallar con 409)
	dupClient := models.CreateClienteRequest{
		Nombre:    "Otro Carlos",
		CC:        "1234567", // Repetida
		Email:     "otro@example.com",
		Direccion: "Calle 1",
	}
	dupBody, _ := json.Marshal(dupClient)
	reqDup := httptest.NewRequest(http.MethodPost, "/clientes", bytes.NewReader(dupBody))
	recDup := httptest.NewRecorder()
	handler.Router(recDup, reqDup)
	if recDup.Code != http.StatusConflict {
		t.Fatalf("esperaba status 409 por CC duplicada, obtuve %d: %s", recDup.Code, recDup.Body.String())
	}

	// 4. Actualizar cliente existente
	updClient := models.UpdateClienteRequest{
		Nombre:    "Carlos Pérez Modificado",
		CC:        "1234567",
		Email:     "carlos_nuevo@example.com",
		Direccion: "Avenida Siempre Viva 123",
	}
	updBody, _ := json.Marshal(updClient)
	reqUpd := httptest.NewRequest(http.MethodPut, "/clientes/201", bytes.NewReader(updBody))
	recUpd := httptest.NewRecorder()
	handler.Router(recUpd, reqUpd)
	if recUpd.Code != http.StatusOK {
		t.Fatalf("esperaba status 200 en update, obtuve %d: %s", recUpd.Code, recUpd.Body.String())
	}

	// 5. Eliminar cliente
	reqDel := httptest.NewRequest(http.MethodDelete, "/clientes/201", nil)
	recDel := httptest.NewRecorder()
	handler.Router(recDel, reqDel)
	if recDel.Code != http.StatusOK {
		t.Fatalf("esperaba status 200 en delete, obtuve %d", recDel.Code)
	}
}
