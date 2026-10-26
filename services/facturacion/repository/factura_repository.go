package repository

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"microservicios/services/facturacion/models"
)

var (
	ErrFacturaNotFound = errors.New("factura no encontrada")
)

type FacturaRepository struct {
	mu       sync.RWMutex
	filePath string
}

func NewFacturaRepository(filePath string) (*FacturaRepository, error) {
	repo := &FacturaRepository{filePath: filePath}
	if err := repo.ensureFileExists(); err != nil {
		return nil, err
	}
	return repo, nil
}

func (r *FacturaRepository) ensureFileExists() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	dir := filepath.Dir(r.filePath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	if _, err := os.Stat(r.filePath); os.IsNotExist(err) {
		emptyList := []models.Factura{}
		data, err := json.MarshalIndent(emptyList, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(r.filePath, data, 0644)
	}
	return nil
}

func (r *FacturaRepository) readAllUnlocked() ([]models.Factura, error) {
	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return []models.Factura{}, nil
	}
	var items []models.Factura
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *FacturaRepository) writeAllUnlocked(items []models.Factura) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.filePath, data, 0644)
}

func (r *FacturaRepository) GetAll() ([]models.Factura, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.readAllUnlocked()
}

func (r *FacturaRepository) GetByID(id int) (*models.Factura, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	for _, f := range items {
		if f.FacturaID == id {
			copyF := f
			return &copyF, nil
		}
	}
	return nil, ErrFacturaNotFound
}

func (r *FacturaRepository) Create(f models.Factura) (*models.Factura, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	items, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	maxID := 5000 // Según especificaciones del PDF las facturas inician en 5001
	for _, item := range items {
		if item.FacturaID > maxID {
			maxID = item.FacturaID
		}
	}

	if f.FacturaID <= 0 {
		f.FacturaID = maxID + 1
	}

	items = append(items, f)
	if err := r.writeAllUnlocked(items); err != nil {
		return nil, err
	}

	return &f, nil
}
