(() => {
// Orquestador Principal de la Aplicación en React 18 + Bootstrap 5.3
const { useState } = React;
const {
  useApp,
  AppProvider,
  AuthView,
  DashboardView,
  ProductosView,
  ClientesView,
  NuevaFacturaView,
  FacturasListView,
  InvoiceDetailModal
} = window;

function UsuariosModal({ show, onClose }) {
  const { usuarios, facturas, refreshUsuarios, notify } = useApp();
  const [reloading, setReloading] = useState(false);

  if (!show) return null;

  const handleReload = async () => {
    setReloading(true);
    try {
      await refreshUsuarios();
      notify.info('Directorio de usuarios actualizado.');
    } finally {
      setReloading(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1055 }}
      tabIndex="-1"
      onClick={onClose}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content friendly-card border-0 shadow-lg">
          <div className="modal-header border-bottom px-4 py-3">
            <div className="d-flex align-items-center gap-2">
              <div className="stat-icon-circle icon-indigo" style={{ width: '40px', height: '40px', fontSize: '1.15rem' }}>
                <i className="bi bi-shield-lock-fill"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0">Usuarios del Sistema (Auth :8081)</h5>
                <small className="text-secondary">
                  Operadores y administradores registrados en usuarios.json
                </small>
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="small text-secondary fw-semibold">
                Total registrados: <strong>{usuarios.length}</strong> cuentas activas
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary rounded-3"
                onClick={handleReload}
                disabled={reloading}
              >
                <i className="bi bi-arrow-clockwise me-1"></i>
                Actualizar
              </button>
            </div>

            <div className="table-responsive">
              <table className="table table-friendly align-middle mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Correo Electrónico</th>
                    <th>Rol</th>
                    <th className="text-end">Facturas Emitidas</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const emitidas = facturas.filter((f) => f.usuario?.id === u.id).length;
                    return (
                      <tr key={u.id}>
                        <td className="font-mono text-secondary">#{u.id}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className={`avatar-circle ${Formatters.avatarColor(u.nombre)}`}>
                              {Formatters.initials(u.nombre)}
                            </div>
                            <span className="fw-bold">{u.nombre}</span>
                          </div>
                        </td>
                        <td className="text-secondary">{u.email}</td>
                        <td>
                          <span
                            className={`badge ${
                              u.rol === 'admin' ? 'badge-soft-primary' : 'badge-soft-info'
                            } rounded-pill text-uppercase`}
                          >
                            {u.rol}
                          </span>
                        </td>
                        <td className="text-end font-mono fw-bold">{emitidas}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modal-footer border-top px-4 py-3">
            <button type="button" className="btn btn-secondary rounded-3" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainAppLayout() {
  const {
    user,
    logout,
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    productos,
    clientes,
    facturas,
    usuarios,
    servicesHealth,
    refreshHealth
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Panel de Control',
      icon: 'bi-grid-1x2-fill',
      badge: null
    },
    {
      id: 'nueva-factura',
      label: 'Punto de Venta (POS)',
      icon: 'bi-cart-plus-fill',
      badge: 'Nuevo',
      badgeClass: 'bg-success text-white'
    },
    {
      id: 'facturas',
      label: 'Historial de Facturas',
      icon: 'bi-receipt-cutoff',
      badge: facturas.length
    },
    {
      id: 'productos',
      label: 'Productos y Stock',
      icon: 'bi-box-seam-fill',
      badge: productos.length
    },
    {
      id: 'clientes',
      label: 'Directorio Clientes',
      icon: 'bi-people-fill',
      badge: clientes.length
    }
  ];

  const handleSelectNav = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const onlineCount = servicesHealth.filter((s) => s.online).length;

  const renderSidebarContent = () => (
    <>
      {/* Logo e Identidad */}
      <div className="p-4 border-bottom d-flex align-items-center justify-content-between">
        <div
          className="d-flex align-items-center gap-3"
          style={{ cursor: 'pointer' }}
          onClick={() => handleSelectNav('dashboard')}
        >
          <div className="brand-logo-box">
            <i className="bi bi-lightning-charge-fill"></i>
          </div>
          <div>
            <h5 className="fw-extrabold mb-0">FacturaFlow</h5>
            <small className="text-secondary" style={{ fontSize: '0.75rem' }}>
              ERP Microservicios Go
            </small>
          </div>
        </div>
        {mobileMenuOpen && (
          <button
            type="button"
            className="btn-close d-lg-none"
            onClick={() => setMobileMenuOpen(false)}
          ></button>
        )}
      </div>

      {/* Menú de Navegación Principal */}
      <div className="p-3 flex-grow-1 overflow-y-auto">
        <div className="text-uppercase text-secondary fw-bold px-2 mb-2" style={{ fontSize: '0.72rem', letterSpacing: '0.06em' }}>
          Menú Principal
        </div>

        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-nav-link ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => handleSelectNav(item.id)}
          >
            <i className={`bi ${item.icon}`}></i>
            <span className="flex-grow-1">{item.label}</span>
            {item.badge !== null && (
              <span
                className={`badge rounded-pill ${
                  item.badgeClass || 'bg-body-secondary text-secondary'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <div className="text-uppercase text-secondary fw-bold px-2 mt-4 mb-2" style={{ fontSize: '0.72rem', letterSpacing: '0.06em' }}>
          Sistema y Seguridad
        </div>

        <button
          type="button"
          className="sidebar-nav-link"
          onClick={() => {
            setMobileMenuOpen(false);
            setShowUsersModal(true);
          }}
        >
          <i className="bi bi-person-badge-fill"></i>
          <span className="flex-grow-1">Operadores Auth</span>
          <span className="badge rounded-pill bg-body-secondary text-secondary">
            {usuarios.length}
          </span>
        </button>

        {/* Tarjeta compacta de Salud de Microservicios */}
        <div className="mt-4 p-3 rounded-4 bg-body-tertiary border">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small fw-bold">
              <i className="bi bi-hdd-network text-primary me-1"></i>
              Nodos Go ({onlineCount}/{servicesHealth.length})
            </span>
            <button
              type="button"
              className="btn btn-sm btn-link p-0 text-decoration-none"
              onClick={refreshHealth}
              title="Comprobar servicios"
            >
              <i className="bi bi-arrow-repeat"></i>
            </button>
          </div>
          <div className="d-flex flex-column gap-1">
            {servicesHealth.map((s) => (
              <div
                key={s.key}
                className="d-flex justify-content-between align-items-center small text-secondary"
              >
                <span className="text-truncate">
                  <span className={`status-dot ${s.online ? 'online' : 'offline'} me-2`}></span>
                  {s.name}
                </span>
                <span className="font-mono" style={{ fontSize: '0.74rem' }}>
                  :{s.port}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pie del Sidebar: Perfil del Usuario */}
      <div className="p-3 border-top bg-body-tertiary bg-opacity-50">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2 text-truncate">
            <div className={`avatar-circle ${Formatters.avatarColor(user?.nombre)}`}>
              {Formatters.initials(user?.nombre)}
            </div>
            <div className="text-truncate">
              <div className="fw-bold small text-truncate">{user?.nombre}</div>
              <span
                className={`badge ${
                  user?.rol === 'admin' ? 'badge-soft-primary' : 'badge-soft-info'
                } text-uppercase`}
                style={{ fontSize: '0.68rem' }}
              >
                {user?.rol}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-danger rounded-3"
            onClick={logout}
            title="Cerrar sesión"
          >
            <i className="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-layout">
      {/* Sidebar Fijo en Escritorio */}
      <aside className="app-sidebar no-print">{renderSidebarContent()}</aside>

      {/* Offcanvas Móvil */}
      {mobileMenuOpen && (
        <div
          className="offcanvas-backdrop fade show d-lg-none no-print"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}
      <div
        className={`offcanvas offcanvas-start d-lg-none no-print ${mobileMenuOpen ? 'show' : ''}`}
        style={{ width: '280px', visibility: mobileMenuOpen ? 'visible' : 'hidden' }}
        tabIndex="-1"
      >
        <div className="d-flex flex-column h-100">{renderSidebarContent()}</div>
      </div>

      {/* Contenedor Principal */}
      <div className="app-main-wrapper">
        {/* Topbar Superior */}
        <header className="app-topbar d-flex justify-content-between align-items-center gap-3 no-print">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="btn btn-outline-secondary d-lg-none rounded-3"
              onClick={() => setMobileMenuOpen(true)}
            >
              <i className="bi bi-list fs-5"></i>
            </button>

            <div className="d-none d-sm-block">
              <span className="text-secondary small">Módulo activo:</span>{' '}
              <strong className="text-primary">
                {navItems.find((n) => n.id === activeTab)?.label || 'Panel'}
              </strong>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {activeTab !== 'nueva-factura' && (
              <button
                type="button"
                className="btn btn-sm btn-primary rounded-pill px-3 fw-semibold shadow-sm"
                onClick={() => setActiveTab('nueva-factura')}
              >
                <i className="bi bi-plus-circle-fill me-1"></i>
                Facturar Ahora
              </button>
            )}

            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              onClick={toggleTheme}
              title="Cambiar tema visual"
            >
              <i className={`bi ${theme === 'light' ? 'bi-moon-stars-fill' : 'bi-sun-fill'} me-1`}></i>
              <span className="d-none d-md-inline">
                {theme === 'light' ? 'Oscuro' : 'Claro'}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-outline-danger rounded-pill px-3 d-none d-sm-inline-flex align-items-center"
              onClick={logout}
            >
              <i className="bi bi-power me-1"></i>
              Salir
            </button>
          </div>
        </header>

        {/* Área de Trabajo Dinámica */}
        <main className="app-content container-fluid" style={{ maxWidth: '1440px' }}>
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'productos' && <ProductosView />}
          {activeTab === 'clientes' && <ClientesView />}
          {activeTab === 'nueva-factura' && <NuevaFacturaView />}
          {activeTab === 'facturas' && <FacturasListView />}
        </main>

        {/* Pie de página amigable */}
        <footer className="px-4 py-3 text-center text-secondary small border-top mt-auto no-print">
          <span>
            <strong>FacturaFlow</strong> • Interfaz construida con <strong>React 18</strong> y{' '}
            <strong>Bootstrap 5.3</strong> conectada a 4 Microservicios en <strong>Go</strong>
          </span>
        </footer>
      </div>

      {/* Modales Globales */}
      <InvoiceDetailModal />
      <UsuariosModal show={showUsersModal} onClose={() => setShowUsersModal(false)} />
    </div>
  );
}

function RootApplication() {
  const { user, checkingAuth } = useApp();

  if (checkingAuth) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center min-vh-100 bg-friendly-surface">
        <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="visually-hidden">Verificando sesión...</span>
        </div>
        <h5 className="fw-bold text-secondary mb-1">Verificando sesión segura</h5>
        <p className="text-muted small mb-0">Conectando con el microservicio de autenticación...</p>
      </div>
    );
  }

  return user ? <MainAppLayout /> : <AuthView />;
}

// Montar aplicación en React 18
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <AppProvider>
      <RootApplication />
    </AppProvider>
  );
}
})();
