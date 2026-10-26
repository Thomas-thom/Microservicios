package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"microservicios/services/productos/models"
)

var (
	ErrProductoNotFound    = errors.New("producto no encontrado")
	ErrStockInsuficiente   = errors.New("stock insuficiente para uno o más productos")
	ErrCantidadInvalida    = errors.New("la cantidad a descontar debe ser mayor a cero")
	ErrPrecioInvalido      = errors.New("el precio debe ser mayor a cero")
	ErrStockNegativo       = errors.New("el stock no puede ser negativo")
	ErrNombreRequerido     = errors.New("el nombre del producto es obligatorio")
)

type ProductoRepository struct {
	mu       sync.RWMutex
	filePath string
}

func NewProductoRepository(filePath string) (*ProductoRepository, error) {
	repo := &ProductoRepository{filePath: filePath}
	if err := repo.ensureFileExists(); err != nil {
		return nil, err
	}
	return repo, nil
}

func (r *ProductoRepository) ensureFileExists() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	dir := filepath.Dir(r.filePath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	if _, err := os.Stat(r.filePath); os.IsNotExist(err) {
		emptyList := []models.Producto{}
		data, err := json.MarshalIndent(emptyList, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(r.filePath, data, 0644)
	}
	return nil
}

func (r *ProductoRepository) readAllUnlocked() ([]models.Producto, error) {
	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return []models.Producto{}, nil
	}
	var items []models.Producto
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *ProductoRepository) writeAllUnlocked(items []models.Producto) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.filePath, data, 0644)
}

func (r *ProductoRepository) GetAll() ([]models.Producto, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.readAllUnlocked()
}

func (r *ProductoRepository) GetByID(id int) (*models.Producto, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	for _, p := range items {
		if p.ID == id {
			copyP := p
			return &copyP, nil
		}
	}
	return nil, ErrProductoNotFound
}

func (r *ProductoRepository) Create(p models.Producto) (*models.Producto, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if strings.TrimSpace(p.Nombre) == "" {
		return nil, ErrNombreRequerido
	}
	if p.Precio <= 0 {
		return nil, ErrPrecioInvalido
	}
	if p.Stock < 0 {
		return nil, ErrStockNegativo
	}

	items, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	maxID := 0
	for _, item := range items {
		if item.ID > maxID {
			maxID = item.ID
		}
	}

	if p.ID <= 0 {
		p.ID = maxID + 1
	}

	items = append(items, p)
	if err := r.writeAllUnlocked(items); err != nil {
		return nil, err
	}

	return &p, nil
}

func (r *ProductoRepository) Update(id int, updated models.Producto) (*models.Producto, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if strings.TrimSpace(updated.Nombre) == "" {
		return nil, ErrNombreRequerido
	}
	if updated.Precio <= 0 {
		return nil, ErrPrecioInvalido
	}
	if updated.Stock < 0 {
		return nil, ErrStockNegativo
	}

	items, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	foundIndex := -1
	for i, item := range items {
		if item.ID == id {
			foundIndex = i
			break
		}
	}

	if foundIndex == -1 {
		return nil, ErrProductoNotFound
	}

	updated.ID = id
	items[foundIndex] = updated

	if err := r.writeAllUnlocked(items); err != nil {
		return nil, err
	}

	return &updated, nil
}

func (r *ProductoRepository) Delete(id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	items, err := r.readAllUnlocked()
	if err != nil {
		return err
	}

	foundIndex := -1
	for i, item := range items {
		if item.ID == id {
			foundIndex = i
			break
		}
	}

	if foundIndex == -1 {
		return ErrProductoNotFound
	}

	items = append(items[:foundIndex], items[foundIndex+1:]...)
	return r.writeAllUnlocked(items)
}

// DescontarStock aplica un descuento atómico a una lista de productos. Si alguno no cuenta con existencias, la operación se cancela por completo.
func (r *ProductoRepository) DescontarStock(itemsToDeduct []models.DescontarItem) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(itemsToDeduct) == 0 {
		return nil
	}

	currentItems, err := r.readAllUnlocked()
	if err != nil {
		return err
	}

	indexMap := make(map[int]int)
	for i, p := range currentItems {
		indexMap[p.ID] = i
	}

	// 1. Fase de validación completa (sin modificar nada todavía)
	for _, item := range itemsToDeduct {
		if item.Cantidad <= 0 {
			return fmt.Errorf("%w: el producto ID %d tiene cantidad inválida %d", ErrCantidadInvalida, item.ID, item.Cantidad)
		}
		idx, exists := indexMap[item.ID]
		if !exists {
			return fmt.Errorf("%w: ID %d no existe", ErrProductoNotFound, item.ID)
		}
		if currentItems[idx].Stock < item.Cantidad {
			return fmt.Errorf("%w: producto '%s' (ID %d) tiene stock %d y se solicitaron %d",
				ErrStockInsuficiente, currentItems[idx].Nombre, item.ID, currentItems[idx].Stock, item.Cantidad)
		}
	}

	// 2. Fase de aplicación del descuento atómico
	for _, item := range itemsToDeduct {
		idx := indexMap[item.ID]
		currentItems[idx].Stock -= item.Cantidad
	}

	return r.writeAllUnlocked(currentItems)
}
