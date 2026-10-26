package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"microservicios/pkg/response"
	"microservicios/services/facturacion/clients"
	"microservicios/services/facturacion/models"
	"microservicios/services/facturacion/repository"
)

type FacturaHandler struct {
	repo    *repository.FacturaRepository
	clients *clients.ServiceClients
}

func NewFacturaHandler(repo *repository.FacturaRepository, svcClients *clients.ServiceClients) *FacturaHandler {
	return &FacturaHandler{
		repo:    repo,
		clients: svcClients,
	}
}

func (h *FacturaHandler) Router(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/facturas")
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
		response.Error(w, http.StatusBadRequest, "ID inválido", "El número de factura debe ser un entero")
		return
	}

	if r.Method == http.MethodGet {
		h.GetByID(w, r, id)
		return
	}

	response.Error(w, http.StatusMethodNotAllowed, "Método no permitido", "Use GET para consultar factura por ID")
}

func (h *FacturaHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.GetAll()
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Error al leer facturas", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, items)
}

func (h *FacturaHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	item, err := h.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrFacturaNotFound) {
			response.Error(w, http.StatusNotFound, "Factura no encontrada", err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, "Error interno", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *FacturaHandler) Create(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		response.Error(w, http.StatusUnauthorized, "No autorizado", "Se requiere autenticación para emitir facturas")
		return
	}

	// 1. Validar usuario autenticado
	user, err := h.clients.VerifyUser(authHeader)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "Sesión no válida", err.Error())
		return
	}

	// 2. Decodificar payload
	var req models.CreateFacturaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Petición inválida", "JSON mal formado")
		return
	}

	if req.ClienteID <= 0 {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "Debe especificar un ID de cliente válido")
		return
	}

	if len(req.Productos) == 0 {
		response.Error(w, http.StatusBadRequest, "Validación fallida", "Debe incluir al menos un producto en la factura")
		return
	}

	// 3. Consultar cliente en el microservicio de clientes
	cliente, err := h.clients.GetCliente(req.ClienteID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Cliente inválido", err.Error())
		return
	}

	// 4. Validar existencias y calcular importes en el backend
	var facturaItems []models.FacturaProductoItem
	var itemsADescontar []clients.DescontarItem
	var total float64

	// Consolidar productos por si el usuario incluyó el mismo producto varias veces
	cantidadesPorID := make(map[int]int)
	for _, item := range req.Productos {
		if item.ProductoID <= 0 {
			response.Error(w, http.StatusBadRequest, "Producto inválido", "El ID del producto debe ser mayor a cero")
			return
		}
		if item.Cantidad <= 0 {
			response.Error(w, http.StatusBadRequest, "Cantidad inválida", fmt.Sprintf("La cantidad para el producto %d debe ser mayor a cero", item.ProductoID))
			return
		}
		cantidadesPorID[item.ProductoID] += item.Cantidad
	}

	for pID, cantidad := range cantidadesPorID {
		prod, err := h.clients.GetProducto(pID)
		if err != nil {
			response.Error(w, http.StatusNotFound, "Producto no disponible", fmt.Sprintf("El producto con ID %d no existe: %s", pID, err.Error()))
			return
		}

		if prod.Stock < cantidad {
			response.Error(w, http.StatusConflict, "Stock insuficiente",
				fmt.Sprintf("El producto '%s' (ID %d) tiene %d unidades disponibles y se solicitaron %d",
					prod.Nombre, prod.ID, prod.Stock, cantidad))
			return
		}

		subtotal := prod.Precio * float64(cantidad)
		total += subtotal

		facturaItems = append(facturaItems, models.FacturaProductoItem{
			ID:             prod.ID,
			Nombre:         prod.Nombre,
			Cantidad:       cantidad,
			PrecioUnitario: prod.Precio,
			Subtotal:       subtotal,
		})

		itemsADescontar = append(itemsADescontar, clients.DescontarItem{
			ID:       prod.ID,
			Cantidad: cantidad,
		})
	}

	// 5. Descontar stock atómicamente en el microservicio de productos
	if err := h.clients.DescontarStock(itemsADescontar); err != nil {
		response.Error(w, http.StatusConflict, "Fallo al descontar existencias", err.Error())
		return
	}

	// 6. Armar y persistir la factura
	nuevaFactura := models.Factura{
		Cliente: models.FacturaCliente{
			ID:     cliente.ID,
			Nombre: cliente.Nombre,
			Email:  cliente.Email,
		},
		Usuario: models.FacturaUsuario{
			ID:     user.ID,
			Nombre: user.Nombre,
			Rol:    user.Rol,
		},
		Productos: facturaItems,
		Total:     total,
		Fecha:     time.Now().Format("2006-01-02"),
	}

	created, err := h.repo.Create(nuevaFactura)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Error al persistir la factura", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, created)
}
