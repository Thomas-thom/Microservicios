(() => {
// Componente React de Gestión de Productos e Inventario (CRUD + Ajuste Rápido de Stock)
const { useState, useMemo } = React;
const useApp = window.useApp;

function ProductosView() {
  const { productos, refreshProductos, notify } = useApp();

  // Controles de filtrado, ordenamiento y vista
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'ok' | 'low' | 'out'
  const [sortBy, setSortBy] = useState('id-asc');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Estado Modal Crear/Editar Producto
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [formNombre, setFormNombre] = useState('');
  const [formPrecio, setFormPrecio] = useState('');
  const [formStock, setFormStock] = useState('');
  const [saving, setSaving] = useState(false);

  // Estado Modal Confirmar Eliminación
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Filtrado y ordenamiento reactivo
  const filteredProductos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let list = productos.filter((p) => {
      const st = Formatters.stockBadge(p.stock);
      if (stockFilter !== 'all' && st.level !== stockFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (p.nombre || '').toLowerCase().includes(q) ||
        String(p.id).includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'id-asc') return a.id - b.id;
      if (sortBy === 'nombre-asc') return (a.nombre || '').localeCompare(b.nombre || '');
      if (sortBy === 'precio-desc') return (b.precio || 0) - (a.precio || 0);
      if (sortBy === 'precio-asc') return (a.precio || 0) - (b.precio || 0);
      if (sortBy === 'stock-asc') return (a.stock || 0) - (b.stock || 0);
      if (sortBy === 'stock-desc') return (b.stock || 0) - (a.stock || 0);
      return 0;
    });

    return list;
  }, [productos, searchQuery, stockFilter, sortBy]);

  // Resumen de inventario
  const inventoryStats = useMemo(() => {
    const totalItems = productos.length;
    const totalUnits = productos.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
    const totalValue = productos.reduce(
      (acc, p) => acc + (Number(p.precio) || 0) * (Number(p.stock) || 0),
      0
    );
    const lowOrOut = productos.filter((p) => (Number(p.stock) || 0) < 10).length;
    return { totalItems, totalUnits, totalValue, lowOrOut };
  }, [productos]);

  const openCreateModal = () => {
    setEditingProd(null);
    setFormNombre('');
    setFormPrecio('');
    setFormStock('10');
    setModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProd(prod);
    setFormNombre(prod.nombre);
    setFormPrecio(String(prod.precio));
    setFormStock(String(prod.stock));
    setModalOpen(true);
  };

  const handleSaveProducto = async (e) => {
    e.preventDefault();
    const nombre = formNombre.trim();
    const precio = parseFloat(formPrecio);
    const stock = parseInt(formStock, 10);

    if (!nombre) {
      notify.warning('El nombre del producto es obligatorio.');
      return;
    }
    if (isNaN(precio) || precio <= 0) {
      notify.warning('El precio unitario debe ser mayor a 0.');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      notify.warning('El stock disponible no puede ser negativo.');
      return;
    }

    setSaving(true);
    try {
      if (editingProd) {
        await API.put(`${CONFIG.PRODUCTOS_API}/productos/${editingProd.id}`, {
          nombre,
          precio,
          stock
        });
        notify.success(`Producto "${nombre}" actualizado correctamente.`);
      } else {
        await API.post(`${CONFIG.PRODUCTOS_API}/productos`, {
          nombre,
          precio,
          stock
        });
        notify.success(`Producto "${nombre}" agregado al catálogo.`);
      }
      setModalOpen(false);
      await refreshProductos();
    } catch (err) {
      notify.error(err.message || 'Error al guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  // Ajuste rápido de stock (+1 / -1 / +5)
  const handleQuickStockAdjust = async (prod, delta) => {
    const newStock = (Number(prod.stock) || 0) + delta;
    if (newStock < 0) {
      notify.warning('El stock no puede ser menor a 0.');
      return;
    }
    try {
      await API.put(`${CONFIG.PRODUCTOS_API}/productos/${prod.id}`, {
        nombre: prod.nombre,
        precio: prod.precio,
        stock: newStock
      });
      await refreshProductos();
      notify.info(`Stock de "${prod.nombre}" actualizado a ${newStock} unidades.`);
    } catch (err) {
      notify.error(err.message || 'No se pudo ajustar el stock.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.delete(`${CONFIG.PRODUCTOS_API}/productos/${deleteTarget.id}`);
      notify.success(`Producto "${deleteTarget.nombre}" eliminado del catálogo.`);
      setDeleteTarget(null);
      await refreshProductos();
    } catch (err) {
      notify.error(err.message || 'Error al eliminar el producto.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fade-in-up">
      {/* Cabecera */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">
            <i className="bi bi-box-seam-fill text-primary me-2"></i>
            Catálogo de Productos e Inventario
          </h2>
          <p className="text-secondary mb-0">
            Administra precios unitarios, existencias en tiempo real y reposición rápida.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary rounded-3 fw-semibold px-4 py-2 shadow-sm"
          onClick={openCreateModal}
        >
          <i className="bi bi-plus-circle-fill me-2"></i>
          Nuevo Producto
        </button>
      </div>

      {/* Mini KPIs de Inventario */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="friendly-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-circle icon-indigo">
              <i className="bi bi-boxes"></i>
            </div>
            <div>
              <div className="text-secondary small fw-semibold">Referencias Activas</div>
              <h4 className="fw-bold mb-0">{inventoryStats.totalItems} productos</h4>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="friendly-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-circle icon-emerald">
              <i className="bi bi-stack"></i>
            </div>
            <div>
              <div className="text-secondary small fw-semibold">Existencias Totales</div>
              <h4 className="fw-bold mb-0">{inventoryStats.totalUnits} unidades</h4>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="friendly-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-circle icon-sky">
              <i className="bi bi-wallet2"></i>
            </div>
            <div>
              <div className="text-secondary small fw-semibold">Valorización de Stock</div>
              <h5 className="fw-bold text-primary font-mono mb-0">
                {Formatters.currency(inventoryStats.totalValue)}
              </h5>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="friendly-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-circle icon-amber">
              <i className="bi bi-exclamation-triangle-fill"></i>
            </div>
            <div>
              <div className="text-secondary small fw-semibold">Por Reabastecer</div>
              <h4 className="fw-bold mb-0">{inventoryStats.lowOrOut} ítems</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Herramientas (Búsqueda, Filtro de Stock, Orden y Modo de Vista) */}
      <div className="friendly-card p-3 mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-lg-4">
            <div className="input-group">
              <span className="input-group-text bg-transparent">
                <i className="bi bi-search text-secondary"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre o código ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setSearchQuery('')}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>

          <div className="col-lg-4">
            <div className="nav nav-pills nav-fill bg-body-tertiary p-1 rounded-3 small">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'ok', label: 'Óptimo' },
                { id: 'low', label: 'Bajo' },
                { id: 'out', label: 'Agotado' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`nav-link py-1 px-2 rounded-2 fw-semibold ${stockFilter === tab.id ? 'active' : ''}`}
                  onClick={() => setStockFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="col-sm-8 col-lg-3">
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="id-asc">Ordenar por ID</option>
              <option value="nombre-asc">Nombre (A - Z)</option>
              <option value="precio-desc">Mayor Precio</option>
              <option value="precio-asc">Menor Precio</option>
              <option value="stock-asc">Menor Stock (Urgentes)</option>
              <option value="stock-desc">Mayor Stock</option>
            </select>
          </div>

          <div className="col-sm-4 col-lg-1 text-end">
            <div className="btn-group w-100">
              <button
                type="button"
                className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('table')}
                title="Vista de Tabla"
              >
                <i className="bi bi-list-ul"></i>
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('grid')}
                title="Vista de Tarjetas"
              >
                <i className="bi bi-grid-fill"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido: Vista de Tabla o Vista de Tarjetas */}
      {filteredProductos.length === 0 ? (
        <div className="friendly-card text-center py-5 px-3">
          <div className="stat-icon-circle icon-amber mx-auto mb-3" style={{ width: '64px', height: '64px', fontSize: '1.8rem' }}>
            <i className="bi bi-box-seam"></i>
          </div>
          <h5 className="fw-bold">No se encontraron productos</h5>
          <p className="text-secondary small mb-3">
            Intenta cambiar los criterios de búsqueda o agrega una nueva referencia al catálogo.
          </p>
          <button type="button" className="btn btn-primary rounded-3" onClick={openCreateModal}>
            <i className="bi bi-plus-lg me-2"></i>
            Registrar Producto
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="friendly-card overflow-hidden">
          <div className="table-responsive">
            <table className="table table-friendly table-hover mb-0">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Código</th>
                  <th>Producto</th>
                  <th>Precio Unitario</th>
                  <th>Estado de Stock</th>
                  <th className="text-center">Ajuste Rápido</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProductos.map((p) => {
                  const st = Formatters.stockBadge(p.stock);
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="badge bg-body-secondary text-body font-mono border">
                          #{p.id}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className={`avatar-circle ${Formatters.avatarColor(p.nombre)}`}>
                            <i className="bi bi-box-seam"></i>
                          </div>
                          <div>
                            <div className="fw-bold">{p.nombre}</div>
                            <small className="text-secondary">
                              Valor en inventario: {Formatters.currency((p.precio || 0) * (p.stock || 0))}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono fw-bold text-success fs-6">
                        {Formatters.currency(p.precio)}
                      </td>
                      <td>
                        <span className={`badge ${st.className} rounded-pill px-3 py-2`}>
                          <i className={`bi ${st.icon} me-1`}></i>
                          {st.label}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-outline-secondary font-mono"
                            onClick={() => handleQuickStockAdjust(p, -1)}
                            disabled={p.stock <= 0}
                            title="Restar 1 unidad"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary font-mono"
                            onClick={() => handleQuickStockAdjust(p, 1)}
                            title="Sumar 1 unidad"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-success font-mono"
                            onClick={() => handleQuickStockAdjust(p, 5)}
                            title="Reabastecer +5 unidades"
                          >
                            +5
                          </button>
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary rounded-start-3"
                            onClick={() => openEditModal(p)}
                          >
                            <i className="bi bi-pencil-square me-1"></i>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-end-3"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <i className="bi bi-trash3"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {filteredProductos.map((p) => {
            const st = Formatters.stockBadge(p.stock);
            return (
              <div className="col-sm-6 col-lg-4 col-xl-3" key={p.id}>
                <div className="friendly-card friendly-card-hover p-4 h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="badge bg-body-secondary text-secondary font-mono">
                        ID #{p.id}
                      </span>
                      <span className={`badge ${st.className} rounded-pill`}>
                        <i className={`bi ${st.icon} me-1`}></i>
                        {st.label}
                      </span>
                    </div>

                    <h5 className="fw-bold mb-2">{p.nombre}</h5>
                    <h4 className="fw-extrabold text-success font-mono mb-3">
                      {Formatters.currency(p.precio)}
                    </h4>
                  </div>

                  <div className="pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <small className="text-secondary fw-semibold">Ajustar stock:</small>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => handleQuickStockAdjust(p, -1)}
                          disabled={p.stock <= 0}
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => handleQuickStockAdjust(p, 1)}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-success"
                          onClick={() => handleQuickStockAdjust(p, 5)}
                        >
                          +5
                        </button>
                      </div>
                    </div>

                    <div className="d-flex gap-2 mt-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary flex-grow-1 rounded-3"
                        onClick={() => openEditModal(p)}
                      >
                        <i className="bi bi-pencil-square me-1"></i>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-3"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Bootstrap: Crear / Editar Producto */}
      {modalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1055 }}
          tabIndex="-1"
          onClick={() => setModalOpen(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content friendly-card border-0 shadow-lg">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold">
                  <i className={`bi ${editingProd ? 'bi-pencil-square' : 'bi-plus-circle-fill'} text-primary me-2`}></i>
                  {editingProd ? `Editar Producto #${editingProd.id}` : 'Registrar Nuevo Producto'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setModalOpen(false)}
                ></button>
              </div>

              <form onSubmit={handleSaveProducto}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-secondary">
                      Nombre o Descripción del Producto
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg fs-6"
                      placeholder="Ej: Monitor LG UltraWide 29 pulgadas"
                      value={formNombre}
                      onChange={(e) => setFormNombre(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="row g-3">
                    <div className="col-sm-7">
                      <label className="form-label fw-semibold small text-secondary">
                        Precio Unitario (COP $)
                      </label>
                      <div className="input-group">
                        <span className="input-group-text font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-control font-mono"
                          placeholder="150000.00"
                          value={formPrecio}
                          onChange={(e) => setFormPrecio(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="col-sm-5">
                      <label className="form-label fw-semibold small text-secondary">
                        Existencias (Stock)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-control font-mono"
                        placeholder="25"
                        value={formStock}
                        onChange={(e) => setFormStock(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-3"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-3 fw-semibold px-4"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-2"></i>
                        Guardar Producto
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bootstrap: Confirmación de Eliminación */}
      {deleteTarget && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1055 }}
          tabIndex="-1"
          onClick={() => setDeleteTarget(null)}
        >
          <div className="modal-dialog modal-sm modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content friendly-card border-0 shadow-lg text-center p-4">
              <div className="stat-icon-circle icon-rose mx-auto mb-3">
                <i className="bi bi-trash3-fill"></i>
              </div>
              <h5 className="fw-bold mb-2">¿Eliminar producto?</h5>
              <p className="text-secondary small mb-4">
                Estás a punto de eliminar <strong>"{deleteTarget.nombre}"</strong> (#{deleteTarget.id}) del catálogo.
              </p>
              <div className="d-flex gap-2 justify-content-center">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-3 flex-grow-1"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger rounded-3 flex-grow-1 fw-semibold"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.ProductosView = ProductosView;
})();
