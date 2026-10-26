package handlers

import (
	"encoding/json"
	"errors"
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
			response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use GET o POST")
		}
		return
	}

	id, err := strconv.Atoi(path)
	if err != nil {
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
		response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use GET, PUT o DELETE")
	}
}

func (h *ClienteHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.GetAll()
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Error al leer clientes", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, items)
}

func (h *ClienteHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	item, err := h.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrClienteNotFound) {
			response.Error(w, http.StatusNotFound, "Cliente no encontrado", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error interno", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *ClienteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateClienteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	created, err := h.repo.Create(models.Cliente{
		Nombre:    req.Nombre,
		CC:        req.CC,
		Email:     req.Email,
		Direccion: req.Direccion,
	})
	if err != nil {
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

	response.JSON(w, http.StatusCreated, created)
}

func (h *ClienteHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	var req models.UpdateClienteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	updated, err := h.repo.Update(id, models.Cliente{
		Nombre:    req.Nombre,
		CC:        req.CC,
		Email:     req.Email,
		Direccion: req.Direccion,
	})
	if err != nil {
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

	response.JSON(w, http.StatusOK, updated)
}

func (h *ClienteHandler) Delete(w http.ResponseWriter, r *http.Request, id int) {
	err := h.repo.Delete(id)
	if err != nil {
		if errors.Is(err, repository.ErrClienteNotFound) {
			response.Error(w, http.StatusNotFound, "Cliente no encontrado", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"mensaje": "Cliente eliminado exitosamente"})
}
