(() => {
// Componente React de Punto de Venta (POS) y Emisión de Facturas Electrónicas
const { useState, useEffect, useMemo } = React;
const useApp = window.useApp;

function NuevaFacturaView() {
  const {
    productos,
    clientes,
    refreshAll,
    refreshClientes,
    preselectedClientId,
    setPreselectedClientId,
    setActiveInvoiceModal,
    notify
  } = useApp();

  const [clienteId, setClienteId] = useState(() => preselectedClientId || '');
  const [cart, setCart] = useState([]); // [{ id, nombre, precio, stock, cantidad }]
  const [searchProd, setSearchProd] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal de creación rápida de cliente sin salir del POS
  const [quickClientModal, setQuickClientModal] = useState(false);
  const [qcNombre, setQcNombre] = useState('');
  const [qcCC, setQcCC] = useState('');
  const [qcEmail, setQcEmail] = useState('');
  const [qcDireccion, setQcDireccion] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // Si venimos desde la pestaña de Clientes con un cliente preseleccionado
  useEffect(() => {
    if (preselectedClientId) {
      setClienteId(String(preselectedClientId));
      setPreselectedClientId('');
    }
  }, [preselectedClientId, setPreselectedClientId]);

  const selectedClienteObj = useMemo(() => {
    return clientes.find((c) => String(c.id) === String(clienteId)) || null;
  }, [clientes, clienteId]);

  // Mapa rápido de cantidades ya puestas en el carrito
  const cartQtyMap = useMemo(() => {
    const map = {};
    cart.forEach((item) => {
      map[item.id] = item.cantidad;
    });
    return map;
  }, [cart]);

  // Catálogo filtrado para el POS
  const catalogList = useMemo(() => {
    const q = searchProd.toLowerCase().trim();
    return productos.filter((p) => {
      if (onlyAvailable && (Number(p.stock) || 0) <= 0) return false;
      if (!q) return true;
      return (
        (p.nombre || '').toLowerCase().includes(q) ||
        String(p.id).includes(q)
      );
    });
  }, [productos, searchProd, onlyAvailable]);

  // Agregar unidad(es) al carrito validando stock disponible
  const addToCart = (prod, qtyToAdd = 1) => {
    const currentInCart = cartQtyMap[prod.id] || 0;
    const desiredTotal = currentInCart + qtyToAdd;

    if (desiredTotal > prod.stock) {
      notify.warning(`Stock máximo alcanzado para "${prod.nombre}" (${prod.stock} disponibles).`);
      return;
    }

    setCart((prev) => {
      const exists = prev.find((it) => it.id === prod.id);
      if (exists) {
        return prev.map((it) =>
          it.id === prod.id ? { ...it, cantidad: desiredTotal, precio: prod.precio, stock: prod.stock } : it
        );
      }
      return [
        ...prev,
        {
          id: prod.id,
          nombre: prod.nombre,
          precio: prod.precio,
          stock: prod.stock,
          cantidad: qtyToAdd
        }
      ];
    });
  };

  const updateCartItemQty = (prodId, newQty) => {
    const prod = productos.find((p) => p.id === prodId);
    const maxStock = prod ? prod.stock : 9999;

    if (newQty <= 0) {
      setCart((prev) => prev.filter((it) => it.id !== prodId));
      return;
    }

    if (newQty > maxStock) {
      notify.warning(`Solo hay ${maxStock} unidades disponibles de este producto.`);
      return;
    }

    setCart((prev) =>
      prev.map((it) => (it.id === prodId ? { ...it, cantidad: newQty } : it))
    );
  };

  const removeFromCart = (prodId) => {
    setCart((prev) => prev.filter((it) => it.id !== prodId));
  };

  const clearCart = () => {
    setCart([]);
    notify.info('Carrito de facturación vaciado.');
  };

  // Totales del ticket
  const cartSummary = useMemo(() => {
    const totalUnidades = cart.reduce((acc, it) => acc + it.cantidad, 0);
    const granTotal = cart.reduce((acc, it) => acc + it.cantidad * it.precio, 0);
    return {
      lineas: cart.length,
      totalUnidades,
      granTotal
    };
  }, [cart]);

  // Emitir Factura al Microservicio de Facturación (:8084)
  const handleEmitirFactura = async (e) => {
    e.preventDefault();
    const parsedClienteId = parseInt(clienteId, 10);

    if (!parsedClienteId) {
      notify.warning('Selecciona un cliente antes de emitir la factura.');
      return;
    }
    if (cart.length === 0) {
      notify.warning('Agrega al menos un producto al carrito de la factura.');
      return;
    }

    const payload = {
      cliente_id: parsedClienteId,
      productos: cart.map((item) => ({
        producto_id: item.id,
        cantidad: item.cantidad
      }))
    };

    setSubmitting(true);
    try {
      const facturaEmitida = await API.post(`${CONFIG.FACTURACION_API}/facturas`, payload);
      notify.success(`¡Factura #${facturaEmitida.factura_id} emitida y descontada del inventario!`);
      setCart([]);
      await refreshAll(true);
      setActiveInvoiceModal(facturaEmitida);
    } catch (err) {
      notify.error(err.message || 'No se pudo emitir la factura.');
    } finally {
      setSubmitting(false);
    }
  };

  // Crear cliente rápido desde el POS
  const handleQuickCreateClient = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: qcNombre.trim(),
      cc: qcCC.trim(),
      email: qcEmail.trim(),
      direccion: qcDireccion.trim()
    };
    if (!payload.nombre || !payload.cc || !payload.email || !payload.direccion) {
      notify.warning('Completa todos los datos del nuevo cliente.');
      return;
    }

    setSavingClient(true);
    try {
      const nuevo = await API.post(`${CONFIG.CLIENTES_API}/clientes`, payload);
      await refreshClientes();
      setClienteId(String(nuevo.id));
      setQuickClientModal(false);
      setQcNombre('');
      setQcCC('');
      setQcEmail('');
      setQcDireccion('');
      notify.success(`Cliente "${nuevo.nombre}" creado y seleccionado en la factura.`);
    } catch (err) {
      notify.error(err.message || 'Error al registrar cliente.');
    } finally {
      setSavingClient(false);
    }
  };

  return (
    <div className="fade-in-up">
      {/* Encabezado */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">
            <i className="bi bi-cart-check-fill text-primary me-2"></i>
            Punto de Venta (POS) — Nueva Factura
          </h2>
          <p className="text-secondary mb-0">
            Haz clic en los productos del catálogo para armar el pedido. El backend verifica precios y descuenta existencias atómicamente.
          </p>
        </div>
      </div>

      <div className="row g-4 align-items-start">
        {/* Columna Izquierda: Catálogo Interactivo de Productos */}
        <div className="col-lg-7">
          <div className="friendly-card p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h5 className="fw-bold mb-0">
                <i className="bi bi-grid-3x3-gap-fill text-primary me-2"></i>
                1. Selecciona Productos del Catálogo
              </h5>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="switchOnlyAvailable"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold text-secondary" htmlFor="switchOnlyAvailable">
                  Ocultar agotados
                </label>
              </div>
            </div>

            {/* Buscador de Productos POS */}
            <div className="input-group mb-3">
              <span className="input-group-text bg-transparent">
                <i className="bi bi-search text-primary"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar producto por nombre o código para agregar..."
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
              />
              {searchProd && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setSearchProd('')}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>

            {/* Cuadrícula de Productos Clicables */}
            <div className="row g-3" style={{ maxHeight: '560px', overflowY: 'auto' }}>
              {catalogList.length === 0 ? (
                <div className="col-12 text-center py-5 text-secondary">
                  <i className="bi bi-box-seam fs-1 d-block mb-2"></i>
                  No se encontraron productos con ese filtro.
                </div>
              ) : (
                catalogList.map((prod) => {
                  const inCartQty = cartQtyMap[prod.id] || 0;
                  const remainingStock = (Number(prod.stock) || 0) - inCartQty;
                  const isOut = remainingStock <= 0;

                  return (
                    <div className="col-sm-6" key={prod.id}>
                      <div
                        className={`pos-product-card p-3 h-100 d-flex flex-column justify-content-between ${
                          inCartQty > 0 ? 'in-cart' : ''
                        } ${prod.stock <= 0 ? 'disabled' : ''}`}
                        onClick={() => {
                          if (!isOut) addToCart(prod, 1);
                        }}
                      >
                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="badge bg-body-secondary text-secondary font-mono">
                              #{prod.id}
                            </span>
                            {inCartQty > 0 ? (
                              <span className="badge bg-primary rounded-pill">
                                <i className="bi bi-cart-check me-1"></i>
                                {inCartQty} en carrito
                              </span>
                            ) : (
                              <span
                                className={`badge ${
                                  prod.stock <= 0
                                    ? 'badge-soft-danger'
                                    : prod.stock < 10
                                    ? 'badge-soft-warning'
                                    : 'badge-soft-success'
                                } rounded-pill`}
                              >
                                {prod.stock <= 0 ? 'Agotado' : `${prod.stock} disp.`}
                              </span>
                            )}
                          </div>

                          <h6 className="fw-bold mb-1">{prod.nombre}</h6>
                        </div>

                        <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                          <div>
                            <div className="font-mono fw-extrabold text-success">
                              {Formatters.currency(prod.precio)}
                            </div>
                            <small className="text-secondary" style={{ fontSize: '0.75rem' }}>
                              Restantes: <strong>{remainingStock}</strong> unid.
                            </small>
                          </div>

                          <button
                            type="button"
                            className={`btn btn-sm rounded-3 fw-semibold ${
                              isOut ? 'btn-outline-secondary' : 'btn-primary'
                            }`}
                            disabled={isOut}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(prod, 1);
                            }}
                          >
                            <i className="bi bi-plus-lg me-1"></i>
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Ticket / Resumen de Factura */}
        <div className="col-lg-5">
          <form onSubmit={handleEmitirFactura} className="friendly-card p-4 position-sticky" style={{ top: '88px' }}>
            {/* Paso 1: Selección de Cliente */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label fw-bold mb-0">
                  <i className="bi bi-person-vcard-fill text-primary me-2"></i>
                  2. Cliente a Facturar
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-decoration-none p-0 fw-semibold"
                  onClick={() => setQuickClientModal(true)}
                >
                  <i className="bi bi-person-plus-fill me-1"></i>
                  + Nuevo Cliente
                </button>
              </div>

              <select
                className="form-select form-select-lg fs-6"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
              >
                <option value="">-- Selecciona un cliente del directorio --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — CC: {c.cc} ({c.email})
                  </option>
                ))}
              </select>

              {selectedClienteObj && (
                <div className="mt-2 p-3 rounded-3 bg-body-tertiary border d-flex align-items-center gap-3 fade-in-up">
                  <div className={`avatar-circle ${Formatters.avatarColor(selectedClienteObj.nombre)}`}>
                    {Formatters.initials(selectedClienteObj.nombre)}
                  </div>
                  <div className="small lh-sm">
                    <div className="fw-bold">{selectedClienteObj.nombre}</div>
                    <div className="text-secondary">
                      CC: <span className="font-mono">{selectedClienteObj.cc}</span> • {selectedClienteObj.email}
                    </div>
                    <div className="text-secondary mt-1">
                      <i className="bi bi-geo-alt me-1"></i>
                      {selectedClienteObj.direccion}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Paso 2: Ítems del Pedido */}
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold">
                <i className="bi bi-receipt text-primary me-2"></i>
                3. Detalle del Pedido ({cartSummary.lineas})
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger rounded-3 py-0 px-2"
                  onClick={clearCart}
                >
                  <i className="bi bi-trash3 me-1"></i>
                  Vaciar
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-4 px-3 rounded-4 bg-body-tertiary border border-dashed mb-4">
                <i className="bi bi-basket2 fs-2 text-secondary d-block mb-2"></i>
                <div className="fw-semibold text-secondary">Tu factura está vacía</div>
                <small className="text-muted">
                  Haz clic en cualquier producto de la izquierda para añadirlo al pedido.
                </small>
              </div>
            ) : (
              <div
                className="d-flex flex-column gap-2 mb-4 pe-1"
                style={{ maxHeight: '300px', overflowY: 'auto' }}
              >
                {cart.map((item) => {
                  const subtotal = item.cantidad * item.precio;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-3 bg-body-tertiary border d-flex flex-column gap-2"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="fw-bold">{item.nombre}</div>
                          <small className="text-secondary font-mono">
                            {Formatters.currency(item.precio)} c/u (Máx: {item.stock})
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-0"
                          onClick={() => removeFromCart(item.id)}
                          title="Quitar producto"
                        >
                          <i className="bi bi-x-circle-fill fs-5"></i>
                        </button>
                      </div>

                      <div className="d-flex justify-content-between align-items-center pt-1 border-top">
                        <div className="input-group input-group-sm" style={{ width: '125px' }}>
                          <button
                            type="button"
                            className="btn btn-outline-secondary fw-bold"
                            onClick={() => updateCartItemQty(item.id, item.cantidad - 1)}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            className="form-control text-center font-mono fw-bold"
                            value={item.cantidad}
                            min="1"
                            max={item.stock}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) updateCartItemQty(item.id, val);
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary fw-bold"
                            onClick={() => updateCartItemQty(item.id, item.cantidad + 1)}
                            disabled={item.cantidad >= item.stock}
                          >
                            +
                          </button>
                        </div>

                        <div className="font-mono fw-extrabold text-success">
                          {Formatters.currency(subtotal)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Caja de Total General */}
            <div className="p-3 rounded-4 bg-success bg-opacity-10 border border-success border-opacity-25 mb-3">
              <div className="d-flex justify-content-between small text-secondary mb-1">
                <span>Unidades totales:</span>
                <span className="fw-bold">{cartSummary.totalUnidades} unidades</span>
              </div>
              <div className="d-flex justify-content-between align-items-center pt-2 border-top border-success border-opacity-25">
                <span className="fw-bold fs-6">TOTAL A PAGAR:</span>
                <span className="fw-extrabold text-success font-mono fs-3">
                  {Formatters.currency(cartSummary.granTotal)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-success btn-lg w-100 rounded-3 fw-bold shadow-sm"
              disabled={submitting || cart.length === 0 || !clienteId}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Procesando Factura en Backend...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-all me-2"></i>
                  Emitir y Guardar Factura
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Modal Rápido: Crear Cliente sin salir del POS */}
      {quickClientModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1055 }}
          tabIndex="-1"
          onClick={() => setQuickClientModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content friendly-card border-0 shadow-lg">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-person-plus-fill text-primary me-2"></i>
                  Registro Rápido de Cliente
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setQuickClientModal(false)}
                ></button>
              </div>
              <form onSubmit={handleQuickCreateClient}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Nombre Completo</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: Ana María Restrepo"
                      value={qcNombre}
                      onChange={(e) => setQcNombre(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-sm-6">
                      <label className="form-label small fw-semibold text-secondary">Cédula / NIT (CC)</label>
                      <input
                        type="text"
                        className="form-control font-mono"
                        placeholder="Ej: 90012345"
                        value={qcCC}
                        onChange={(e) => setQcCC(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label small fw-semibold text-secondary">Correo Electrónico</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="ana@correo.com"
                        value={qcEmail}
                        onChange={(e) => setQcEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold text-secondary">Dirección</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Cra 15 #88-20, Medellín"
                      value={qcDireccion}
                      onChange={(e) => setQcDireccion(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-top px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-3"
                    onClick={() => setQuickClientModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-3 fw-semibold"
                    disabled={savingClient}
                  >
                    {savingClient ? 'Guardando...' : 'Crear y Seleccionar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.NuevaFacturaView = NuevaFacturaView;
})();
