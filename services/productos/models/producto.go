package models

// Producto representa el modelo de datos de un producto según el estándar del proyecto
type Producto struct {
	ID     int     `json:"id"`
	Nombre string  `json:"nombre"`
	Precio float64 `json:"precio"`
	Stock  int     `json:"stock"`
}

// CreateProductoRequest datos para la creación de un nuevo producto
type CreateProductoRequest struct {
	Nombre string  `json:"nombre"`
	Precio float64 `json:"precio"`
	Stock  int     `json:"stock"`
}

// UpdateProductoRequest datos para la actualización de un producto existente
type UpdateProductoRequest struct {
	Nombre string   `json:"nombre"`
	Precio *float64 `json:"precio,omitempty"`
	Stock  *int     `json:"stock,omitempty"`
}

// DescontarItem identifica el producto y la cantidad a descontar
type DescontarItem struct {
	ID       int `json:"id"`
	Cantidad int `json:"cantidad"`
}

// DescontarStockRequest lista de productos y cantidades a descontar atómicamente
type DescontarStockRequest struct {
	Items []DescontarItem `json:"items"`
}
