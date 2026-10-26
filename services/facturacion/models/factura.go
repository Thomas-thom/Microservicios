package models

// FacturaCliente información del cliente incluida en la factura
type FacturaCliente struct {
	ID     int    `json:"id"`
	Nombre string `json:"nombre"`
	Email  string `json:"email"`
}

// FacturaUsuario información del vendedor/usuario autenticado que generó la factura
type FacturaUsuario struct {
	ID     int    `json:"id"`
	Nombre string `json:"nombre"`
	Rol    string `json:"rol"`
}

// FacturaProductoItem detalle de cada producto facturado
type FacturaProductoItem struct {
	ID             int     `json:"id"`
	Nombre         string  `json:"nombre"`
	Cantidad       int     `json:"cantidad"`
	PrecioUnitario float64 `json:"precio_unitario"`
	Subtotal       float64 `json:"subtotal"`
}

// Factura representa la estructura exacta de factura solicitada en el PDF
type Factura struct {
	FacturaID int                   `json:"factura_id"`
	Cliente   FacturaCliente        `json:"cliente"`
	Usuario   FacturaUsuario        `json:"usuario"`
	Productos []FacturaProductoItem `json:"productos"`
	Total     float64               `json:"total"`
	Fecha     string                `json:"fecha"`
}

// CreateFacturaItemRequest producto y cantidad solicitada por el cliente/frontend
type CreateFacturaItemRequest struct {
	ProductoID int `json:"producto_id"`
	Cantidad   int `json:"cantidad"`
}

// CreateFacturaRequest carga útil recibida para emitir una nueva factura
type CreateFacturaRequest struct {
	ClienteID int                        `json:"cliente_id"`
	Productos []CreateFacturaItemRequest `json:"productos"`
}
