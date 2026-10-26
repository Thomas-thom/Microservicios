package repository

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"microservicios/services/clientes/models"
)

var (
	ErrClienteNotFound    = errors.New("cliente no encontrado")
	ErrCCDuplicada        = errors.New("ya existe un cliente registrado con esta identificación (cc)")
	ErrEmailDuplicado     = errors.New("ya existe un cliente con este correo electrónico")
	ErrNombreRequerido    = errors.New("el nombre del cliente es obligatorio")
	ErrCCRequerida        = errors.New("la cédula/identificación (cc) es obligatoria")
	ErrEmailInvalido      = errors.New("el correo electrónico no es válido")
	ErrDireccionRequerida = errors.New("la dirección es obligatoria")
)

type ClienteRepository struct {
	mu       sync.RWMutex
	filePath string
}

func NewClienteRepository(filePath string) (*ClienteRepository, error) {
	repo := &ClienteRepository{filePath: filePath}
	if err := repo.ensureFileExists(); err != nil {
		return nil, err
	}
	return repo, nil
}

func (r *ClienteRepository) ensureFileExists() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	dir := filepath.Dir(r.filePath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	if _, err := os.Stat(r.filePath); os.IsNotExist(err) {
		emptyList := []models.Cliente{}
		data, err := json.MarshalIndent(emptyList, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(r.filePath, data, 0644)
	}
	return nil
}

func (r *ClienteRepository) readAllUnlocked() ([]models.Cliente, error) {
	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return []models.Cliente{}, nil
	}
	var items []models.Cliente
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *ClienteRepository) writeAllUnlocked(items []models.Cliente) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.filePath, data, 0644)
}

func (r *ClienteRepository) GetAll() ([]models.Cliente, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.readAllUnlocked()
}

func (r *ClienteRepository) GetByID(id int) (*models.Cliente, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	for _, c := range items {
		if c.ID == id {
			copyC := c
			return &copyC, nil
		}
	}
	return nil, ErrClienteNotFound
}

func (r *ClienteRepository) Create(c models.Cliente) (*models.Cliente, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	c.Nombre = strings.TrimSpace(c.Nombre)
	c.CC = strings.TrimSpace(c.CC)
	c.Email = strings.TrimSpace(strings.ToLower(c.Email))
	c.Direccion = strings.TrimSpace(c.Direccion)

	if c.Nombre == "" {
		return nil, ErrNombreRequerido
	}
	if c.CC == "" {
		return nil, ErrCCRequerida
	}
	if c.Email == "" || !strings.Contains(c.Email, "@") {
		return nil, ErrEmailInvalido
	}
	if c.Direccion == "" {
		return nil, ErrDireccionRequerida
	}

	items, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	maxID := 200 // Comenzar a partir de 201 según esquema de ejemplo del PDF
	for _, existing := range items {
		if existing.CC == c.CC {
			return nil, ErrCCDuplicada
		}
		if strings.ToLower(existing.Email) == c.Email {
			return nil, ErrEmailDuplicado
		}
		if existing.ID > maxID {
			maxID = existing.ID
		}
	}

	if c.ID <= 0 {
		c.ID = maxID + 1
	}

	items = append(items, c)
	if err := r.writeAllUnlocked(items); err != nil {
		return nil, err
	}

	return &c, nil
}

func (r *ClienteRepository) Update(id int, updated models.Cliente) (*models.Cliente, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	updated.Nombre = strings.TrimSpace(updated.Nombre)
	updated.CC = strings.TrimSpace(updated.CC)
	updated.Email = strings.TrimSpace(strings.ToLower(updated.Email))
	updated.Direccion = strings.TrimSpace(updated.Direccion)

	if updated.Nombre == "" {
		return nil, ErrNombreRequerido
	}
	if updated.CC == "" {
		return nil, ErrCCRequerida
	}
	if updated.Email == "" || !strings.Contains(updated.Email, "@") {
		return nil, ErrEmailInvalido
	}
	if updated.Direccion == "" {
		return nil, ErrDireccionRequerida
	}

	items, err := r.readAllUnlocked()
	if err != nil {
		return nil, err
	}

	foundIndex := -1
	for i, existing := range items {
		if existing.ID == id {
			foundIndex = i
		} else {
			if existing.CC == updated.CC {
				return nil, ErrCCDuplicada
			}
			if strings.ToLower(existing.Email) == updated.Email {
				return nil, ErrEmailDuplicado
			}
		}
	}

	if foundIndex == -1 {
		return nil, ErrClienteNotFound
	}

	updated.ID = id
	items[foundIndex] = updated

	if err := r.writeAllUnlocked(items); err != nil {
		return nil, err
	}

	return &updated, nil
}

func (r *ClienteRepository) Delete(id int) error {
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
		return ErrClienteNotFound
	}

	items = append(items[:foundIndex], items[foundIndex+1:]...)
	return r.writeAllUnlocked(items)
}
