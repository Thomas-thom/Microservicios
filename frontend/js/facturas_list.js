(() => {
// Componentes React de Historial de Facturas y Modal de Comprobante Comercial / PDF
const { useState, useMemo } = React;
const useApp = window.useApp;

function downloadInvoiceJson(factura, notify) {
  if (!factura) return;
  const content = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(factura, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', content);
  anchor.setAttribute('download', `factura_${factura.factura_id}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (notify) {
    notify.success(`Comprobante #${factura.factura_id} exportado en formato JSON.`);
  }
}

function InvoiceDetailModal() {
  const { activeInvoiceModal, setActiveInvoiceModal, notify } = useApp();

  if (!activeInvoiceModal) return null;

  const f = activeInvoiceModal;
  const items = Array.isArray(f.productos) ? f.productos : [];
  const totalUnidades = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
      tabIndex="-1"
      role="dialog"
      onClick={() => setActiveInvoiceModal(null)}
    >
      <div
        className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content friendly-card border-0 shadow-lg">
          {/* Cabecera del Modal (oculta en impresión) */}
          <div className="modal-header border-bottom px-4 py-3 no-print">
            <div className="d-flex align-items-center gap-2">
              <div className="stat-icon-circle icon-indigo" style={{ width: '40px', height: '40px', fontSize: '1.15rem' }}>
                <i className="bi bi-receipt-cutoff"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0">
                  Comprobante de Factura #{f.factura_id}
                </h5>
                <small className="text-secondary">
                  Emitida el {f.fecha || 'N/A'} • Lista para imprimir o guardar en PDF
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={() => setActiveInvoiceModal(null)}
            ></button>
          </div>

          {/* Cuerpo Imprimible de la Factura */}
          <div className="modal-body p-4 bg-body-tertiary">
            <div id="printable-invoice-area" className="invoice-printable-sheet shadow-sm">
              {/* Encabezado Empresa y Factura */}
              <div className="row g-3 justify-content-between align-items-start border-bottom pb-4 mb-4">
                <div className="col-sm-7">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-primary rounded-3 p-2">
                      <i className="bi bi-lightning-charge-fill fs-5"></i>
                    </span>
                    <h4 className="fw-extrabold mb-0 text-dark">
                      {CONFIG.COMPANY.NAME}
                    </h4>
                  </div>
                  <p className="text-secondary small mb-1">
                    <strong>NIT:</strong> {CONFIG.COMPANY.NIT} • {CONFIG.COMPANY.REGIMEN}
                  </p>
                  <p className="text-secondary small mb-1">
                    <i className="bi bi-geo-alt me-1"></i>
                    {CONFIG.COMPANY.DIRECCION}
                  </p>
                  <p className="text-secondary small mb-0">
                    <i className="bi bi-telephone me-1"></i>
                    {CONFIG.COMPANY.TELEFONO} | {CONFIG.COMPANY.EMAIL}
                  </p>
                </div>

                <div className="col-sm-5 text-sm-end">
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill fw-bold mb-2">
                    FACTURA ELECTRÓNICA DE VENTA
                  </span>
                  <h2 className="fw-extrabold text-primary font-mono mb-1">
                    N° {f.factura_id}
                  </h2>
                  <div className="small text-secondary">
                    <strong>Fecha de Emisión:</strong> {f.fecha || 'N/A'}
                  </div>
                  <div className="small text-success fw-semibold mt-1">
                    <i className="bi bi-check-circle-fill me-1"></i>
                    Estado: Pagada / Emitida
                  </div>
                </div>
              </div>

              {/* Información de Cliente y Vendedor */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-light border h-100">
                    <div className="text-uppercase small fw-bold text-secondary mb-2">
                      <i className="bi bi-person-vcard me-1 text-primary"></i>
                      Adquirente / Cliente
                    </div>
                    <h6 className="fw-bold text-dark mb-1">
                      {f.cliente?.nombre || 'Cliente General'}
                    </h6>
                    <div className="small text-secondary mb-1">
                      <strong>ID Cliente:</strong> #{f.cliente?.id || 'N/A'}
                    </div>
                    <div className="small text-secondary">
                      <strong>Correo:</strong> {f.cliente?.email || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-light border h-100">
                    <div className="text-uppercase small fw-bold text-secondary mb-2">
                      <i className="bi bi-person-workspace me-1 text-primary"></i>
                      Atendido y Emitido por
                    </div>
                    <h6 className="fw-bold text-dark mb-1">
                      {f.usuario?.nombre || 'Operador del Sistema'}
                    </h6>
                    <div className="small text-secondary mb-1">
                      <strong>ID Operador:</strong> #{f.usuario?.id || 'N/A'}
                    </div>
                    <div className="small text-secondary">
                      <strong>Rol:</strong>{' '}
                      <span className="badge bg-secondary text-uppercase">
                        {f.usuario?.rol || 'operador'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Productos Facturados */}
              <div className="table-responsive mb-4">
                <table className="table table-bordered align-middle mb-0">
                  <thead className="table-light">
                    <tr className="small text-uppercase text-secondary">
                      <th style={{ width: '80px' }} className="text-center">Código</th>
                      <th>Descripción del Producto</th>
                      <th style={{ width: '95px' }} className="text-center">Cant.</th>
                      <th style={{ width: '150px' }} className="text-end">Precio Unit.</th>
                      <th style={{ width: '160px' }} className="text-end">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((prod, idx) => (
                      <tr key={`${prod.id}-${idx}`}>
                        <td className="text-center font-mono small text-secondary">
                          #{prod.id}
                        </td>
                        <td className="fw-semibold text-dark">
                          {prod.nombre}
                        </td>
                        <td className="text-center font-mono fw-bold text-dark">
                          {prod.cantidad}
                        </td>
                        <td className="text-end font-mono text-secondary">
                          {Formatters.currency(prod.precio_unitario)}
                        </td>
                        <td className="text-end font-mono fw-bold text-dark">
                          {Formatters.currency(prod.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumen Total */}
              <div className="row justify-content-between align-items-end g-3">
                <div className="col-md-6">
                  <div className="p-3 rounded-3 bg-light border small text-secondary">
                    <div className="fw-semibold text-dark mb-1">
                      <i className="bi bi-shield-check text-success me-1"></i>
                      Observaciones Legales y Técnicas
                    </div>
                    <div>
                      Esta factura fue validada y calculada por el microservicio de facturación en Go, aplicando descuento atómico de inventario ({totalUnidades} unidades totales).
                    </div>
                  </div>
                </div>

                <div className="col-md-5">
                  <div className="p-3 rounded-3 bg-primary bg-opacity-10 border border-primary border-opacity-25">
                    <div className="d-flex justify-content-between small text-secondary mb-1">
                      <span>Ítems facturados:</span>
                      <span className="fw-semibold">{items.length} líneas ({totalUnidades} unid.)</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-primary border-opacity-25">
                      <span className="fw-bold text-dark fs-6">TOTAL A PAGAR:</span>
                      <span className="fw-extrabold text-primary font-mono fs-4">
                        {Formatters.currency(f.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pie del Modal (oculto en impresión) */}
          <div className="modal-footer border-top px-4 py-3 no-print">
            <button
              type="button"
              className="btn btn-outline-secondary rounded-3"
              onClick={() => setActiveInvoiceModal(null)}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-outline-primary rounded-3"
              onClick={() => downloadInvoiceJson(f, notify)}
            >
              <i className="bi bi-filetype-json me-2"></i>
              Descargar JSON
            </button>
            <button
              type="button"
              className="btn btn-primary rounded-3 fw-semibold px-4"
              onClick={() => window.print()}
            >
              <i className="bi bi-printer-fill me-2"></i>
              Imprimir / Guardar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacturasListView() {
  const {
    facturas,
    clientes,
    refreshFacturas,
    setActiveInvoiceModal,
    setActiveTab,
    notify
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'highest' | 'lowest'
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshFacturas();
      notify.info('Historial de facturas sincronizado.');
    } catch (err) {
      notify.error('No se pudo actualizar el historial: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredFacturas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let result = facturas.filter((f) => {
      const matchesClient =
        selectedClientFilter === 'all' ||
        String(f.cliente?.id) === String(selectedClientFilter);

      if (!matchesClient) return false;
      if (!q) return true;

      const matchId = String(f.factura_id).includes(q);
      const matchClienteNombre = (f.cliente?.nombre || '').toLowerCase().includes(q);
      const matchClienteEmail = (f.cliente?.email || '').toLowerCase().includes(q);
      const matchVendedor = (f.usuario?.nombre || '').toLowerCase().includes(q);
      const matchFecha = (f.fecha || '').toLowerCase().includes(q);
      const matchProducto = (f.productos || []).some((p) =>
        (p.nombre || '').toLowerCase().includes(q)
      );

      return (
        matchId ||
        matchClienteNombre ||
        matchClienteEmail ||
        matchVendedor ||
        matchFecha ||
        matchProducto
      );
    });

    result.sort((a, b) => {
      if (sortOrder === 'newest') return (b.factura_id || 0) - (a.factura_id || 0);
      if (sortOrder === 'oldest') return (a.factura_id || 0) - (b.factura_id || 0);
      if (sortOrder === 'highest') return (b.total || 0) - (a.total || 0);
      if (sortOrder === 'lowest') return (a.total || 0) - (b.total || 0);
      return 0;
    });

    return result;
  }, [facturas, searchQuery, selectedClientFilter, sortOrder]);

  const summaryStats = useMemo(() => {
    const totalMonto = filteredFacturas.reduce((acc, f) => acc + (Number(f.total) || 0), 0);
    const promedio = filteredFacturas.length > 0 ? totalMonto / filteredFacturas.length : 0;
    return {
      count: filteredFacturas.length,
      totalMonto,
      promedio
    };
  }, [filteredFacturas]);

  return (
    <div className="fade-in-up">
      {/* Encabezado de Sección */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">
            <i className="bi bi-journal-check text-primary me-2"></i>
            Historial de Facturas
          </h2>
          <p className="text-secondary mb-0">
            Consulta, filtra, descarga en JSON o imprime en PDF los comprobantes emitidos.
          </p>
        </div>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary rounded-3"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            <i className={`bi bi-arrow-clockwise me-1 ${refreshing ? 'spinner-border spinner-border-sm' : ''}`}></i>
            Actualizar
          </button>
          <button
            type="button"
            className="btn btn-primary rounded-3 fw-semibold shadow-sm"
            onClick={() => setActiveTab('nueva-factura')}
          >
            <i className="bi bi-plus-lg me-2"></i>
            Emitir Nueva Factura
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen del Filtro Actual */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="friendly-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-circle icon-indigo">
              <i className="bi bi-receipt"></i>
            </div>
            <div>
              <div className="text-secondary small fw-semibold">Facturas Listadas</div>
              <h4 className="fw-bold mb-0">{summaryStats.count} comprobantes</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="friendly-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-circle icon-emerald">
              <i className="bi bi-cash-stack"></i>
            </div>
            <div>
              <div className="text-secondary small fw-semibold">Volumen Total Filtrado</div>
              <h4 className="fw-bold text-success font-mono mb-0">
                {Formatters.currency(summaryStats.totalMonto)}
              </h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="friendly-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-circle icon-sky">
              <i className="bi bi-graph-up-arrow"></i>
            </div>
            <div>
              <div className="text-secondary small fw-semibold">Ticket Promedio</div>
              <h4 className="fw-bold font-mono mb-0">
                {Formatters.currency(summaryStats.promedio)}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="friendly-card p-3 mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-lg-5">
            <div className="input-group">
              <span className="input-group-text bg-transparent">
                <i className="bi bi-search text-secondary"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por # factura, cliente, producto, vendedor o fecha..."
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

          <div className="col-sm-6 col-lg-4">
            <div className="input-group">
              <span className="input-group-text bg-transparent">
                <i className="bi bi-person-lines-fill text-secondary"></i>
              </span>
              <select
                className="form-select"
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
              >
                <option value="all">Todos los clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="input-group">
              <span className="input-group-text bg-transparent">
                <i className="bi bi-sort-down text-secondary"></i>
              </span>
              <select
                className="form-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="newest">Más recientes primero</option>
                <option value="oldest">Más antiguas primero</option>
                <option value="highest">Mayor importe total</option>
                <option value="lowest">Menor importe total</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Facturas */}
      <div className="friendly-card overflow-hidden">
        {filteredFacturas.length === 0 ? (
          <div className="text-center py-5 px-3">
            <div className="stat-icon-circle icon-indigo mx-auto mb-3" style={{ width: '64px', height: '64px', fontSize: '1.8rem' }}>
              <i className="bi bi-receipt"></i>
            </div>
            <h5 className="fw-bold">No se encontraron facturas</h5>
            <p className="text-secondary small mb-3">
              {searchQuery || selectedClientFilter !== 'all'
                ? 'Prueba ajustando los filtros de búsqueda.'
                : 'Aún no se han emitido facturas en el sistema.'}
            </p>
            <button
              type="button"
              className="btn btn-primary rounded-3"
              onClick={() => setActiveTab('nueva-factura')}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Crear Primera Factura
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-friendly table-hover mb-0">
              <thead>
                <tr>
                  <th>N° Factura</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th>Emitida por</th>
                  <th className="text-end">Total Facturado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacturas.map((f) => {
                  const prods = Array.isArray(f.productos) ? f.productos : [];
                  const totalUnits = prods.reduce((sum, p) => sum + (p.cantidad || 0), 0);

                  return (
                    <tr key={f.factura_id}>
                      <td>
                        <span className="badge badge-soft-primary font-mono fs-6 px-2 py-1">
                          #{f.factura_id}
                        </span>
                      </td>
                      <td>
                        <div className="fw-medium">
                          <i className="bi bi-calendar3 text-secondary me-2"></i>
                          {f.fecha || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className={`avatar-circle ${Formatters.avatarColor(f.cliente?.nombre)}`}>
                            {Formatters.initials(f.cliente?.nombre)}
                          </div>
                          <div>
                            <div className="fw-bold">{f.cliente?.nombre || 'N/A'}</div>
                            <small className="text-secondary">{f.cliente?.email || ''}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-body-secondary text-body border">
                          {prods.length} {prods.length === 1 ? 'ítem' : 'ítems'} ({totalUnits} unid.)
                        </span>
                        <div className="small text-secondary text-truncate" style={{ maxWidth: '220px' }}>
                          {prods.map((p) => `${p.cantidad}x ${p.nombre}`).join(', ')}
                        </div>
                      </td>
                      <td>
                        <div className="fw-medium">{f.usuario?.nombre || 'N/A'}</div>
                        <span className={`badge ${f.usuario?.rol === 'admin' ? 'badge-soft-primary' : 'badge-soft-info'}`}>
                          {f.usuario?.rol || 'operador'}
                        </span>
                      </td>
                      <td className="text-end font-mono fw-bold text-success fs-6">
                        {Formatters.currency(f.total)}
                      </td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary rounded-start-3"
                            onClick={() => setActiveInvoiceModal(f)}
                            title="Ver e Imprimir Factura"
                          >
                            <i className="bi bi-eye-fill me-1"></i>
                            Ver / PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary rounded-end-3"
                            onClick={() => downloadInvoiceJson(f, notify)}
                            title="Descargar JSON"
                          >
                            <i className="bi bi-filetype-json"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

window.InvoiceDetailModal = InvoiceDetailModal;
window.FacturasListView = FacturasListView;
window.downloadInvoiceJson = downloadInvoiceJson;
})();
