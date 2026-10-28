(() => {
// Componente React de Dashboard Ejecutivo y Analítica Comercial
const { useMemo } = React;
const useApp = window.useApp;

function DashboardView() {
  const {
    user,
    productos,
    clientes,
    facturas,
    servicesHealth,
    loadingData,
    refreshAll,
    setActiveTab,
    setActiveInvoiceModal,
    notify
  } = useApp();

  // Métricas analíticas calculadas reactivamente con useMemo
  const metrics = useMemo(() => {
    const totalRevenue = facturas.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
    const avgTicket = facturas.length > 0 ? totalRevenue / facturas.length : 0;
    const totalStock = productos.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const inventoryValue = productos.reduce(
      (sum, p) => sum + (Number(p.precio) || 0) * (Number(p.stock) || 0),
      0
    );

    const lowStockProducts = productos
      .filter((p) => (Number(p.stock) || 0) < 10)
      .sort((a, b) => a.stock - b.stock);

    // Ranking de productos más vendidos a partir de facturas históricas
    const salesByProduct = {};
    facturas.forEach((f) => {
      (f.productos || []).forEach((item) => {
        if (!salesByProduct[item.id]) {
          salesByProduct[item.id] = {
            id: item.id,
            nombre: item.nombre,
            unidades: 0,
            ingresos: 0
          };
        }
        salesByProduct[item.id].unidades += Number(item.cantidad) || 0;
        salesByProduct[item.id].ingresos += Number(item.subtotal) || 0;
      });
    });

    const topProducts = Object.values(salesByProduct)
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 5);

    const maxProductRevenue = topProducts.length > 0 ? topProducts[0].ingresos : 1;

    const recentInvoices = [...facturas]
      .sort((a, b) => (b.factura_id || 0) - (a.factura_id || 0))
      .slice(0, 5);

    return {
      totalRevenue,
      avgTicket,
      totalStock,
      inventoryValue,
      lowStockProducts,
      topProducts,
      maxProductRevenue,
      recentInvoices
    };
  }, [productos, facturas]);

  return (
    <div className="fade-in-up">
      {/* Banner de Bienvenida Amigable */}
      <div className="welcome-banner mb-4">
        <div className="row align-items-center g-3 position-relative" style={{ zIndex: 2 }}>
          <div className="col-lg-7">
            <span className="badge bg-white bg-opacity-25 text-white rounded-pill px-3 py-1 mb-2 fw-semibold">
              <i className="bi bi-stars me-1"></i>
              Panel de Control en Tiempo Real
            </span>
            <h2 className="fw-extrabold mb-2">
              ¡Hola, {user?.nombre || 'Usuario'}! Qué gusto verte hoy 👋
            </h2>
            <p className="text-white text-opacity-90 mb-0">
              Aquí tienes el resumen actualizado de tus ventas, inventario disponible y estado de los microservicios.
            </p>
          </div>

          <div className="col-lg-5 d-flex flex-wrap justify-content-lg-end gap-2">
            <button
              type="button"
              className="btn btn-light text-primary fw-bold rounded-3 px-3 py-2 shadow-sm"
              onClick={() => setActiveTab('nueva-factura')}
            >
              <i className="bi bi-cart-plus-fill me-2"></i>
              Nueva Factura POS
            </button>
            <button
              type="button"
              className="btn btn-outline-light fw-semibold rounded-3 px-3 py-2"
              onClick={() => refreshAll(false)}
              disabled={loadingData}
            >
              <i className={`bi bi-arrow-clockwise me-1 ${loadingData ? 'spinner-border spinner-border-sm' : ''}`}></i>
              Sincronizar Datos
            </button>
          </div>
        </div>
      </div>

      {/* 4 Tarjetas KPI Principales */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="friendly-card friendly-card-hover p-4 h-100">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-secondary small fw-bold text-uppercase mb-1">
                  Ingresos Facturados
                </div>
                <h3 className="fw-extrabold text-success font-mono mb-0">
                  {Formatters.currency(metrics.totalRevenue)}
                </h3>
              </div>
              <div className="stat-icon-circle icon-emerald">
                <i className="bi bi-currency-dollar"></i>
              </div>
            </div>
            <div className="small text-secondary d-flex align-items-center gap-1">
              <i className="bi bi-receipt-cutoff text-success"></i>
              Ticket promedio: <strong className="font-mono">{Formatters.currency(metrics.avgTicket)}</strong>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div
            className="friendly-card friendly-card-hover p-4 h-100"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('facturas')}
          >
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-secondary small fw-bold text-uppercase mb-1">
                  Facturas Emitidas
                </div>
                <h3 className="fw-extrabold mb-0">{facturas.length}</h3>
              </div>
              <div className="stat-icon-circle icon-indigo">
                <i className="bi bi-file-earmark-check-fill"></i>
              </div>
            </div>
            <div className="small text-primary fw-semibold">
              Ver historial completo <i className="bi bi-arrow-right ms-1"></i>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div
            className="friendly-card friendly-card-hover p-4 h-100"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('clientes')}
          >
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-secondary small fw-bold text-uppercase mb-1">
                  Clientes Registrados
                </div>
                <h3 className="fw-extrabold mb-0">{clientes.length}</h3>
              </div>
              <div className="stat-icon-circle icon-sky">
                <i className="bi bi-people-fill"></i>
              </div>
            </div>
            <div className="small text-info fw-semibold">
              Administrar directorio <i className="bi bi-arrow-right ms-1"></i>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div
            className="friendly-card friendly-card-hover p-4 h-100"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('productos')}
          >
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div className="text-secondary small fw-bold text-uppercase mb-1">
                  Catálogo e Inventario
                </div>
                <h3 className="fw-extrabold mb-0">
                  {productos.length} <span className="fs-6 fw-normal text-secondary">ítems</span>
                </h3>
              </div>
              <div className="stat-icon-circle icon-amber">
                <i className="bi bi-box-seam-fill"></i>
              </div>
            </div>
            <div className="small text-secondary">
              Stock total: <strong>{metrics.totalStock} unid.</strong> ({metrics.lowStockProducts.length} alertas)
            </div>
          </div>
        </div>
      </div>

      {/* Fila Intermedia: Productos Más Vendidos + Alertas de Inventario */}
      <div className="row g-4 mb-4">
        {/* Top Productos Más Vendidos */}
        <div className="col-lg-7">
          <div className="friendly-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bold mb-0">
                  <i className="bi bi-trophy-fill text-warning me-2"></i>
                  Productos con Mayor Facturación
                </h5>
                <small className="text-secondary">
                  Desempeño calculado sobre las facturas emitidas
                </small>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary rounded-3"
                onClick={() => setActiveTab('productos')}
              >
                Ver Catálogo
              </button>
            </div>

            {metrics.topProducts.length === 0 ? (
              <div className="text-center py-4 text-secondary">
                <i className="bi bi-bar-chart-line fs-2 d-block mb-2"></i>
                Aún no hay datos de ventas para mostrar estadísticas.
              </div>
            ) : (
              <div className="d-flex flex-column gap-3 mt-3">
                {metrics.topProducts.map((prod, index) => {
                  const pct = Math.max(
                    8,
                    Math.round((prod.ingresos / metrics.maxProductRevenue) * 100)
                  );
                  return (
                    <div key={prod.id}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge rounded-pill badge-soft-primary font-mono">
                            #{index + 1}
                          </span>
                          <span className="fw-semibold">{prod.nombre}</span>
                          <span className="badge bg-body-secondary text-secondary">
                            {prod.unidades} vendidos
                          </span>
                        </div>
                        <span className="font-mono fw-bold text-success small">
                          {Formatters.currency(prod.ingresos)}
                        </span>
                      </div>
                      <div className="progress rounded-pill" style={{ height: '8px' }}>
                        <div
                          className="progress-bar bg-primary rounded-pill"
                          role="progressbar"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Alertas de Stock y Estado de Microservicios */}
        <div className="col-lg-5">
          <div className="friendly-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="fw-bold mb-0">
                    <i className="bi bi-bell-fill text-danger me-2"></i>
                    Alertas de Existencias
                  </h5>
                  <small className="text-secondary">
                    Productos agotados o con menos de 10 unidades
                  </small>
                </div>
                <span className="badge badge-soft-warning rounded-pill">
                  {metrics.lowStockProducts.length} alertas
                </span>
              </div>

              {metrics.lowStockProducts.length === 0 ? (
                <div className="alert alert-success border-0 rounded-4 d-flex align-items-center gap-3 mb-3">
                  <i className="bi bi-check-circle-fill fs-3"></i>
                  <div>
                    <div className="fw-bold">¡Inventario saludable!</div>
                    <small>Todos los productos tienen buen nivel de stock disponible.</small>
                  </div>
                </div>
              ) : (
                <div className="list-group list-group-flush mb-3">
                  {metrics.lowStockProducts.slice(0, 4).map((p) => {
                    const st = Formatters.stockBadge(p.stock);
                    return (
                      <div
                        key={p.id}
                        className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <div className="fw-semibold">{p.nombre}</div>
                          <small className="text-secondary font-mono">
                            ID #{p.id} • {Formatters.currency(p.precio)}
                          </small>
                        </div>
                        <span className={`badge ${st.className} rounded-pill`}>
                          <i className={`bi ${st.icon} me-1`}></i>
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Estado compacto de los 4 Microservicios en Go */}
            <div className="pt-3 border-top">
              <div className="small fw-bold text-secondary text-uppercase mb-2">
                <i className="bi bi-cpu-fill text-primary me-1"></i>
                Ecosistema de Microservicios en Go
              </div>
              <div className="row g-2">
                {servicesHealth.map((s) => (
                  <div className="col-6" key={s.key}>
                    <div className="p-2 rounded-3 bg-body-tertiary border d-flex justify-content-between align-items-center small">
                      <span className="fw-medium text-truncate">
                        <span className={`status-dot ${s.online ? 'online' : 'offline'} me-2`}></span>
                        {s.name}
                      </span>
                      <span className="font-mono text-secondary" style={{ fontSize: '0.75rem' }}>
                        {s.online ? `${s.latency ?? 1}ms` : 'Off'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Últimas Facturas Emitidas */}
      <div className="friendly-card overflow-hidden">
        <div className="p-4 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h5 className="fw-bold mb-0">
              <i className="bi bi-clock-history text-primary me-2"></i>
              Últimas Facturas Generadas
            </h5>
            <small className="text-secondary">
              Actividad reciente de facturación procesada en el backend
            </small>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary rounded-3"
            onClick={() => setActiveTab('facturas')}
          >
            Ver Todas las Facturas <i className="bi bi-arrow-right ms-1"></i>
          </button>
        </div>

        {metrics.recentInvoices.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-secondary mb-3">Aún no se han emitido facturas.</p>
            <button
              type="button"
              className="btn btn-primary rounded-3"
              onClick={() => setActiveTab('nueva-factura')}
            >
              Emitir Primera Factura
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-friendly table-hover mb-0">
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th className="text-end">Importe Total</th>
                  <th className="text-end">Acción Rápida</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentInvoices.map((f) => (
                  <tr key={f.factura_id}>
                    <td>
                      <span className="badge badge-soft-primary font-mono px-2 py-1">
                        #{f.factura_id}
                      </span>
                    </td>
                    <td>{f.fecha || 'N/A'}</td>
                    <td>
                      <div className="fw-semibold">{f.cliente?.nombre || 'N/A'}</div>
                      <small className="text-secondary">{f.cliente?.email || ''}</small>
                    </td>
                    <td>
                      <span>{f.usuario?.nombre || 'N/A'}</span>{' '}
                      <span className="badge bg-body-secondary text-secondary text-uppercase">
                        {f.usuario?.rol || ''}
                      </span>
                    </td>
                    <td className="text-end font-mono fw-bold text-success">
                      {Formatters.currency(f.total)}
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary rounded-3 me-1"
                        onClick={() => setActiveInvoiceModal(f)}
                      >
                        <i className="bi bi-eye me-1"></i>
                        Comprobante
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary rounded-3"
                        onClick={() => window.downloadInvoiceJson(f, notify)}
                        title="Descargar JSON"
                      >
                        <i className="bi bi-download"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

window.DashboardView = DashboardView;
})();
