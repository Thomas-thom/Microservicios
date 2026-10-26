package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"microservicios/pkg/response"
	"microservicios/services/productos/models"
	"microservicios/services/productos/repository"
)

type ProductoHandler struct {
	repo *repository.ProductoRepository
}

func NewProductoHandler(repo *repository.ProductoRepository) *ProductoHandler {
	return &ProductoHandler{repo: repo}
}

// Router distribuye las solicitudes según el path y método
func (h *ProductoHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/productos")
	path = strings.TrimPrefix(path, "/")

	if path == "descontar" {
		h.DescontarStock(w, r)
		return
	}

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
		response.Error(w, http.StatusBadRequest, "ID inválido", "El identificador del producto debe ser un entero")
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

func (h *ProductoHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.GetAll()
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, items)
}

func (h *ProductoHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	item, err := h.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrProductoNotFound) {
			response.Error(w, http.StatusNotFound, "Producto no encontrado", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error interno", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *ProductoHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateProductoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "El nombre es obligatorio")
		return
	}
	if req.Precio <= 0 {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "El precio debe ser mayor a 0")
		return
	}
	if req.Stock < 0 {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "El stock no puede ser negativo")
		return
	}

	newP := models.Producto{
		Nombre: req.Nombre,
		Precio: req.Precio,
		Stock:  req.Stock,
	}

	created, err := h.repo.Create(newP)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, created)
}

func (h *ProductoHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	var req models.UpdateProductoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "El nombre es obligatorio")
		return
	}

	if req.Precio == nil || *req.Precio <= 0 {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "El precio debe ser mayor a 0")
		return
	}

	if req.Stock == nil || *req.Stock < 0 {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "El stock no puede ser negativo")
		return
	}

	updatedP := models.Producto{
		ID:     id,
		Nombre: req.Nombre,
		Precio: *req.Precio,
		Stock:  *req.Stock,
	}

	res, err := h.repo.Update(id, updatedP)
	if err != nil {
		if errors.Is(err, repository.ErrProductoNotFound) {
			response.Error(w, http.StatusNotFound, "Producto no encontrado", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, res)
}

func (h *ProductoHandler) Delete(w http.ResponseWriter, r *http.Request, id int) {
	err := h.repo.Delete(id)
	if err != nil {
		if errors.Is(err, repository.ErrProductoNotFound) {
			response.Error(w, http.StatusNotFound, "Producto no encontrado", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error de persistencia", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"mensaje": "Producto eliminado exitosamente"})
}

func (h *ProductoHandler) DescontarStock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use POST para descontar stock")
		return
	}

	var req models.DescontarStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	if len(req.Items) == 0 {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "Debe incluir al menos un producto a descontar")
		return
	}

	if err := h.repo.DescontarStock(req.Items); err != nil {
		if errors.Is(err, repository.ErrStockInsuficiente) {
			response.Error(w, http.StatusConflict, "Stock insuficiente", err.Error())
			return
		}
		if errors.Is(err, repository.ErrProductoNotFound) {
			response.Error(w, http.StatusNotFound, "Producto inexistente", err.Error())
			return
		}
		if errors.Is(err, repository.ErrCantidadInvalida) {
			response.Error(w, http.StatusBadRequest, "Cantidad inválida", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error al descontar stock", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"mensaje": "Stock descontado exitosamente"})
}
