package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"microservicios/pkg/response"
	"microservicios/services/clientes/models"
	"microservicios/services/clientes/repository"
)

type ClienteHandler struct {
	repo *repository.ClienteRepository
}

func NewClienteHandler(repo *repository.ClienteRepository) *ClienteHandler {
	return &ClienteHandler{repo: repo}
}

func (h *ClienteHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/clientes")
	path = strings.TrimPrefix(path, "/")

	if path == "" {
		switch r.Method {
		case http.MethodGet:
			h.GetAll(w, r)
		case http.MethodPost:
			h.Create(w, r)
		default:
			log.Printf("[Clientes CMD] ⚠️ Acción rechazada: Método %s no permitido en /clientes", r.Method)
			response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use GET o POST")
		}
		return
	}

	id, err := strconv.Atoi(path)
	if err != nil {
		log.Printf("[Clientes CMD] ⚠️ Acción rechazada: ID de cliente inválido (%q)", path)
		response.Error(w, http.StatusBadRequest, "ID inválido", "El identificador del cliente debe ser un entero")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.GetByID(w, r, id)
	case http.MethodPut:
		h.Update(w, r, id)
	case http.MethodDelete:
		h.Delete(w, r, id)
	default:
		log.Printf("[Clientes CMD] ⚠️ Acción rechazada: Método %s no permitido para el cliente ID=%d", r.Method, id)
		response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use GET, PUT o DELETE")
	}
}

func (h *ClienteHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.GetAll()
	if err != nil {
		log.Printf("[Clientes CMD] ❌ ERROR al listar clientes desde data/clientes.json: %v", err)
		response.Error(w, http.StatusInternalServerError, "Error al leer clientes", err.Error())
		return
	}
	log.Printf("[Clientes CMD] 📋 ACCIÓN CLIENTES -> Se consultó el listado de clientes (%d clientes registrados)", len(items))
	response.JSON(w, http.StatusOK, items)
}

func (h *ClienteHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	item, err := h.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrClienteNotFound) {
			log.Printf("[Clientes CMD] ⚠️ ACCIÓN CLIENTES -> Consulta fallida: El cliente con ID=%d no fue encontrado", id)
			response.Error(w, http.StatusNotFound, "Cliente no encontrado", err.Error())
			return
		}
		log.Printf("[Clientes CMD] ❌ ERROR interno al consultar cliente ID=%d: %v", id, err)
		response.Error(w, http.StatusInternalServerError, "Error interno", err.Error())
		return
	}
	log.Printf("[Clientes CMD] 🔍 ACCIÓN CLIENTES -> Se consultó el cliente ID=%d: Nombre=%q | CC=%s | Email=%s | Dirección=%q",
		item.ID, item.Nombre, item.CC, item.Email, item.Direccion)
	response.JSON(w, http.StatusOK, item)
}

func (h *ClienteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateClienteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[Clientes CMD] ❌ ACCIÓN CLIENTES -> Error al crear cliente: JSON mal formado (%v)", err)
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	log.Printf("==================================================================")
	log.Printf("[Clientes CMD] ➕ ACCIÓN CLIENTES: Registrando nuevo cliente -> Nombre=%q | CC=%s | Email=%s | Dirección=%q",
		req.Nombre, req.CC, req.Email, req.Direccion)

	created, err := h.repo.Create(models.Cliente{
		Nombre:    req.Nombre,
		CC:        req.CC,
		Email:     req.Email,
		Direccion: req.Direccion,
	})
	if err != nil {
		log.Printf("[Clientes CMD] ❌ ERROR AL CREAR CLIENTE (%q - CC %s): %v", req.Nombre, req.CC, err)
		log.Printf("==================================================================")
		if errors.Is(err, repository.ErrCCDuplicada) || errors.Is(err, repository.ErrEmailDuplicado) {
			response.Error(w, http.StatusConflict, "Dato duplicado", err.Error())
			return
		}
		if errors.Is(err, repository.ErrNombreRequerido) || errors.Is(err, repository.ErrCCRequerida) ||
			errors.Is(err, repository.ErrEmailInvalido) || errors.Is(err, repository.ErrDireccionRequerida) {
			response.Error(w, http.StatusBadRequest, "Validación fallida", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}

	log.Printf("[Clientes CMD] ✅ CLIENTE CREADO EXITOSAMENTE -> ID=%d | Nombre=%q | CC=%s | Email=%s | Dirección=%q (Guardado en data/clientes.json)",
		created.ID, created.Nombre, created.CC, created.Email, created.Direccion)
	log.Printf("==================================================================")
	response.JSON(w, http.StatusCreated, created)
}

func (h *ClienteHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	var req models.UpdateClienteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[Clientes CMD] ❌ ACCIÓN CLIENTES -> Error al actualizar cliente ID=%d: JSON mal formado (%v)", id, err)
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	prevCliente, _ := h.repo.GetByID(id)
	log.Printf("==================================================================")
	if prevCliente != nil {
		log.Printf("[Clientes CMD] ✏️ ACCIÓN CLIENTES: Actualizando cliente ID=%d (Antes: Nombre=%q, CC=%s, Email=%s, Dir=%q)",
			id, prevCliente.Nombre, prevCliente.CC, prevCliente.Email, prevCliente.Direccion)
	} else {
		log.Printf("[Clientes CMD] ✏️ ACCIÓN CLIENTES: Intentando actualizar cliente ID=%d", id)
	}

	updated, err := h.repo.Update(id, models.Cliente{
		Nombre:    req.Nombre,
		CC:        req.CC,
		Email:     req.Email,
		Direccion: req.Direccion,
	})
	if err != nil {
		log.Printf("[Clientes CMD] ❌ ERROR AL ACTUALIZAR CLIENTE ID=%d: %v", id, err)
		log.Printf("==================================================================")
		if errors.Is(err, repository.ErrClienteNotFound) {
			response.Error(w, http.StatusNotFound, "Cliente no encontrado", err.Error())
			return
		}
		if errors.Is(err, repository.ErrCCDuplicada) || errors.Is(err, repository.ErrEmailDuplicado) {
			response.Error(w, http.StatusConflict, "Dato duplicado", err.Error())
			return
		}
		if errors.Is(err, repository.ErrNombreRequerido) || errors.Is(err, repository.ErrCCRequerida) ||
			errors.Is(err, repository.ErrEmailInvalido) || errors.Is(err, repository.ErrDireccionRequerida) {
			response.Error(w, http.StatusBadRequest, "Validación fallida", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}

	log.Printf("[Clientes CMD] ✅ CLIENTE ACTUALIZADO EXITOSAMENTE -> ID=%d | Nuevo Nombre=%q | CC=%s | Email=%s | Dirección=%q (Guardado en data/clientes.json)",
		updated.ID, updated.Nombre, updated.CC, updated.Email, updated.Direccion)
	log.Printf("==================================================================")
	response.JSON(w, http.StatusOK, updated)
}

func (h *ClienteHandler) Delete(w http.ResponseWriter, r *http.Request, id int) {
	prevCliente, _ := h.repo.GetByID(id)
	log.Printf("==================================================================")
	if prevCliente != nil {
		log.Printf("[Clientes CMD] 🗑️ ACCIÓN CLIENTES: Eliminando cliente ID=%d -> Nombre=%q | CC=%s | Email=%s",
			id, prevCliente.Nombre, prevCliente.CC, prevCliente.Email)
	} else {
		log.Printf("[Clientes CMD] 🗑️ ACCIÓN CLIENTES: Solicitud para eliminar cliente ID=%d", id)
	}

	err := h.repo.Delete(id)
	if err != nil {
		log.Printf("[Clientes CMD] ❌ ERROR AL ELIMINAR CLIENTE ID=%d: %v", id, err)
		log.Printf("==================================================================")
		if errors.Is(err, repository.ErrClienteNotFound) {
			response.Error(w, http.StatusNotFound, "Cliente no encontrado", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}

	if prevCliente != nil {
		log.Printf("[Clientes CMD] ✅ CLIENTE ELIMINADO EXITOSAMENTE -> ID=%d | Nombre=%q | CC=%s fue removido de data/clientes.json",
			id, prevCliente.Nombre, prevCliente.CC)
	} else {
		log.Printf("[Clientes CMD] ✅ CLIENTE ELIMINADO EXITOSAMENTE -> ID=%d removido de data/clientes.json", id)
	}
	log.Printf("==================================================================")
	response.JSON(w, http.StatusOK, map[string]string{"mensaje": "Cliente eliminado exitosamente"})
}
