// FacturaFlow - Unified React Bundle

/* ==================== toast.js ==================== */
(() => {
// Contexto Global Reactivo (Estado Central, Autenticación y Toasts con Bootstrap 5)
const { createContext, useContext, useState, useEffect, useCallback, useMemo } = React;

const AppContext = createContext(null);

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp debe utilizarse dentro de un <AppProvider>');
  }
  return ctx;
}

function BootstrapToastContainer({ toasts, onDismiss }) {
  const variantMap = {
    success: {
      icon: 'bi-check-circle-fill text-success',
      title: 'Operación exitosa',
      border: 'border-success'
    },
    error: {
      icon: 'bi-x-circle-fill text-danger',
      title: 'Atención',
      border: 'border-danger'
    },
    warning: {
      icon: 'bi-exclamation-triangle-fill text-warning',
      title: 'Advertencia',
      border: 'border-warning'
    },
    info: {
      icon: 'bi-info-circle-fill text-primary',
      title: 'Información',
      border: 'border-primary'
    }
  };

  return (
    <div className="toast-container position-fixed bottom-0 end-0 p-3 no-print" style={{ zIndex: 1090 }}>
      {toasts.map((t) => {
        const meta = variantMap[t.type] || variantMap.info;
        return (
          <div
            key={t.id}
            className={`toast show align-items-center friendly-card border-start border-4 ${meta.border} mb-2 fade-in-up`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="toast-header bg-transparent border-0 pb-1">
              <i className={`bi ${meta.icon} me-2 fs-6`}></i>
              <strong className="me-auto">{meta.title}</strong>
              <small className="text-muted">Ahora</small>
              <button
                type="button"
                className="btn-close ms-2"
                aria-label="Cerrar"
                onClick={() => onDismiss(t.id)}
              ></button>
            </div>
            <div className="toast-body pt-1 pb-3 text-secondary fw-medium">
              {t.message}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AppProvider({ children }) {
  const [user, setUser] = useState(() => API.getUser());
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setThemeState] = useState(() => API.getTheme());

  // Datos globales sincronizados desde los microservicios
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [servicesHealth, setServicesHealth] = useState(
    CONFIG.SERVICES_META.map((s) => ({ ...s, online: true, latency: null }))
  );
  const [loadingData, setLoadingData] = useState(false);

  // Estado compartido para iniciar facturación rápida con un cliente o abrir recibo de factura
  const [preselectedClientId, setPreselectedClientId] = useState('');
  const [activeInvoiceModal, setActiveInvoiceModal] = useState(null);

  // Cola de notificaciones Bootstrap Toast
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }, [dismissToast]);

  const notify = useMemo(() => ({
    success: (msg) => pushToast(msg, 'success', 3800),
    error: (msg) => pushToast(msg, 'error', 5000),
    warning: (msg) => pushToast(msg, 'warning', 4200),
    info: (msg) => pushToast(msg, 'info', 3500)
  }), [pushToast]);

  // Aplicar tema Bootstrap 5 (light / dark)
  useEffect(() => {
    API.setTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Salud de los microservicios
  const refreshHealth = useCallback(async () => {
    const status = await API.checkServicesHealth();
    setServicesHealth(status);
    return status;
  }, []);

  // Recargas individuales y globales
  const refreshProductos = useCallback(async () => {
    const data = await API.get(`${CONFIG.PRODUCTOS_API}/productos`);
    setProductos(Array.isArray(data) ? data : []);
    return data;
  }, []);

  const refreshClientes = useCallback(async () => {
    const data = await API.get(`${CONFIG.CLIENTES_API}/clientes`);
    setClientes(Array.isArray(data) ? data : []);
    return data;
  }, []);

  const refreshFacturas = useCallback(async () => {
    const data = await API.get(`${CONFIG.FACTURACION_API}/facturas`);
    setFacturas(Array.isArray(data) ? data : []);
    return data;
  }, []);

  const refreshUsuarios = useCallback(async () => {
    const data = await API.get(`${CONFIG.AUTH_API}/usuarios`);
    setUsuarios(Array.isArray(data) ? data : []);
    return data;
  }, []);

  const refreshAll = useCallback(async (silent = false) => {
    if (!silent) setLoadingData(true);
    try {
      const [prods, cls, facts, usrs, health] = await Promise.all([
        API.get(`${CONFIG.PRODUCTOS_API}/productos`).catch(() => []),
        API.get(`${CONFIG.CLIENTES_API}/clientes`).catch(() => []),
        API.get(`${CONFIG.FACTURACION_API}/facturas`).catch(() => []),
        API.get(`${CONFIG.AUTH_API}/usuarios`).catch(() => []),
        API.checkServicesHealth()
      ]);
      setProductos(Array.isArray(prods) ? prods : []);
      setClientes(Array.isArray(cls) ? cls : []);
      setFacturas(Array.isArray(facts) ? facts : []);
      setUsuarios(Array.isArray(usrs) ? usrs : []);
      setServicesHealth(health);
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, []);

  // Verificar token al iniciar la app
  useEffect(() => {
    let mounted = true;
    async function verifyCurrentSession() {
      refreshHealth();
      const token = API.getToken();
      if (!token) {
        if (mounted) {
          setUser(null);
          setCheckingAuth(false);
        }
        return;
      }

      try {
        const claims = await API.get(`${CONFIG.AUTH_API}/verify`);
        const validUser = {
          id: claims.id,
          nombre: claims.nombre,
          email: claims.email,
          rol: claims.rol
        };
        API.setUser(validUser);
        if (mounted) {
          setUser(validUser);
          await refreshAll(false);
        }
      } catch {
        API.clearSession();
        if (mounted) setUser(null);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    }

    verifyCurrentSession();

    const onExpired = () => {
      setUser(null);
      notify.warning('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
    };
    window.addEventListener('session-expired', onExpired);
    return () => {
      mounted = false;
      window.removeEventListener('session-expired', onExpired);
    };
  }, [refreshAll, refreshHealth, notify]);

  // Operaciones de Autenticación
  const login = useCallback(async (email, password) => {
    const res = await API.post(`${CONFIG.AUTH_API}/login`, { email, password });
    API.setToken(res.token);
    API.setUser(res.user);
    setUser(res.user);
    setActiveTab('dashboard');
    await refreshAll(false);
    notify.success(`¡Hola de nuevo, ${res.user.nombre}! Bienvenido a FacturaFlow.`);
    return res.user;
  }, [refreshAll, notify]);

  const register = useCallback(async ({ nombre, email, password, rol }) => {
    const created = await API.post(`${CONFIG.AUTH_API}/register`, {
      nombre,
      email,
      password,
      rol
    });
    notify.success(`Cuenta creada para ${created.nombre}. Ya puedes iniciar sesión.`);
    return created;
  }, [notify]);

  const logout = useCallback(() => {
    API.clearSession();
    setUser(null);
    setActiveTab('dashboard');
    notify.info('Has cerrado tu sesión de forma segura.');
  }, [notify]);

  // Atajo para facturar directamente a un cliente específico
  const startBillingForClient = useCallback((clienteId) => {
    setPreselectedClientId(String(clienteId));
    setActiveTab('nueva-factura');
  }, []);

  const value = useMemo(() => ({
    user,
    checkingAuth,
    login,
    register,
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
    loadingData,
    refreshAll,
    refreshProductos,
    refreshClientes,
    refreshFacturas,
    refreshUsuarios,
    refreshHealth,
    preselectedClientId,
    setPreselectedClientId,
    startBillingForClient,
    activeInvoiceModal,
    setActiveInvoiceModal,
    notify
  }), [
    user,
    checkingAuth,
    login,
    register,
    logout,
    activeTab,
    theme,
    toggleTheme,
    productos,
    clientes,
    facturas,
    usuarios,
    servicesHealth,
    loadingData,
    refreshAll,
    refreshProductos,
    refreshClientes,
    refreshFacturas,
    refreshUsuarios,
    refreshHealth,
    preselectedClientId,
    startBillingForClient,
    activeInvoiceModal,
    notify
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <BootstrapToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppContext.Provider>
  );
}

window.AppContext = AppContext;
window.useApp = useApp;
window.AppProvider = AppProvider;
})();

/* ==================== auth.js ==================== */
(() => {
// Componente React de Autenticación (Login Seguro, Limpio y Centrado)
const { useState } = React;
const useApp = window.useApp;

function AuthView() {
  const { login, register, theme, toggleTheme, notify } = useApp();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Estado formulario Login (campos limpios sin credenciales expuestas)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Estado formulario Registro
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRol, setRegRol] = useState('cliente');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      notify.warning('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      await login(loginEmail.trim(), loginPassword.trim());
    } catch (err) {
      notify.error(err.message || 'Credenciales incorrectas.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regNombre.trim() || !regEmail.trim() || !regPassword.trim()) {
      notify.warning('Completa todos los campos para crear tu cuenta.');
      return;
    }
    if (regPassword.trim().length < 4) {
      notify.warning('La contraseña debe tener mínimo 4 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        nombre: regNombre.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        rol: regRol
      });
      setLoginEmail(regEmail.trim());
      setLoginPassword('');
      setRegNombre('');
      setRegEmail('');
      setRegPassword('');
      setMode('login');
    } catch (err) {
      notify.error(err.message || 'No fue posible registrar el usuario.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split-wrapper d-flex align-items-center justify-content-center min-vh-100 py-4 px-3">
      <div className="w-100" style={{ maxWidth: '440px' }}>
        {/* Selector de Tema */}
        <div className="d-flex justify-content-end mb-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm bg-body"
            title="Cambiar tema visual"
          >
            <i className={`bi ${theme === 'light' ? 'bi-moon-stars-fill' : 'bi-sun-fill'} me-1`}></i>
            {theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
          </button>
        </div>

        {/* Tarjeta de Autenticación Centrada y Segura */}
        <div className="friendly-card p-4 p-sm-5 shadow-lg border-0 fade-in-up">
          {/* Logo y Título Centrado */}
          <div className="text-center mb-4">
            <div
              className="brand-logo-box mx-auto mb-3 shadow"
              style={{ width: '56px', height: '56px', fontSize: '1.75rem', borderRadius: '16px' }}
            >
              <i className="bi bi-lightning-charge-fill"></i>
            </div>
            <h3 className="fw-extrabold mb-1">FacturaFlow</h3>
            <p className="text-secondary small mb-0">
              Sistema de Facturación Digital e Inventario
            </p>
          </div>

          {/* Pestañas de Alternancia: Iniciar Sesión / Registro */}
          <ul className="nav nav-pills nav-fill bg-body-tertiary p-1 rounded-4 mb-4">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link rounded-3 fw-semibold ${mode === 'login' ? 'active shadow-sm' : ''}`}
                onClick={() => setMode('login')}
              >
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Iniciar Sesión
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link rounded-3 fw-semibold ${mode === 'register' ? 'active shadow-sm' : ''}`}
                onClick={() => setMode('register')}
              >
                <i className="bi bi-person-plus-fill me-2"></i>
                Crear Cuenta
              </button>
            </li>
          </ul>

          {mode === 'login' ? (
            <div className="fade-in-up">
              <form onSubmit={handleLoginSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small text-secondary">
                    Correo Electrónico
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent">
                      <i className="bi bi-envelope text-primary"></i>
                    </span>
                    <input
                      type="email"
                      className="form-control form-control-lg fs-6"
                      placeholder="nombre@ejemplo.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      autoComplete="email"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold small text-secondary">
                    Contraseña
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent">
                      <i className="bi bi-key text-primary"></i>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-control-lg fs-6"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-100 rounded-3 fw-bold shadow-sm"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Verificando credenciales...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-unlock-fill me-2"></i>
                      Entrar al Sistema
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="fade-in-up">
              <form onSubmit={handleRegisterSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small text-secondary">
                    Nombre Completo
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent">
                      <i className="bi bi-person text-primary"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: Carlos Gómez"
                      value={regNombre}
                      onChange={(e) => setRegNombre(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold small text-secondary">
                    Correo Electrónico
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent">
                      <i className="bi bi-envelope text-primary"></i>
                    </span>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="carlos@correo.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label className="form-label fw-semibold small text-secondary">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Mín. 4 carac."
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small text-secondary">
                      Rol
                    </label>
                    <select
                      className="form-select"
                      value={regRol}
                      onChange={(e) => setRegRol(e.target.value)}
                    >
                      <option value="cliente">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-success btn-lg w-100 rounded-3 fw-bold shadow-sm"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Registrando cuenta...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle me-2"></i>
                      Completar Registro
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Nota de Seguridad al Pie */}
        <div className="text-center mt-3 text-secondary small">
          <i className="bi bi-shield-check text-success me-1"></i>
          Acceso protegido con cifrado <strong>bcrypt</strong> y tokens <strong>HMAC-SHA256</strong>
        </div>
      </div>
    </div>
  );
}

window.AuthView = AuthView;
})();

/* ==================== facturas_list.js ==================== */
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

/* ==================== dashboard.js ==================== */
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

/* ==================== productos.js ==================== */
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

/* ==================== clientes.js ==================== */
(() => {
// Componente React de Directorio CRM de Clientes (CRUD + Historial de Compras + Facturación Directa)
const { useState, useMemo } = React;
const useApp = window.useApp;

function ClientesView() {
  const {
    clientes,
    facturas,
    refreshClientes,
    startBillingForClient,
    notify
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Estado Modal Crear/Editar Cliente
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formNombre, setFormNombre] = useState('');
  const [formCC, setFormCC] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDireccion, setFormDireccion] = useState('');
  const [saving, setSaving] = useState(false);

  // Estado Modal Eliminar
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Estadísticas de compras por cada cliente calculadas desde el historial de facturas
  const clientPurchaseMap = useMemo(() => {
    const map = {};
    facturas.forEach((f) => {
      const cid = f.cliente?.id;
      if (!cid) return;
      if (!map[cid]) {
        map[cid] = { count: 0, total: 0 };
      }
      map[cid].count += 1;
      map[cid].total += Number(f.total) || 0;
    });
    return map;
  }, [facturas]);

  const filteredClientes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter((c) =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.cc || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.direccion || '').toLowerCase().includes(q) ||
      String(c.id).includes(q)
    );
  }, [clientes, searchQuery]);

  const openCreateModal = () => {
    setEditingClient(null);
    setFormNombre('');
    setFormCC('');
    setFormEmail('');
    setFormDireccion('');
    setModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setFormNombre(client.nombre || '');
    setFormCC(client.cc || '');
    setFormEmail(client.email || '');
    setFormDireccion(client.direccion || '');
    setModalOpen(true);
  };

  const handleSaveCliente = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: formNombre.trim(),
      cc: formCC.trim(),
      email: formEmail.trim(),
      direccion: formDireccion.trim()
    };

    if (!payload.nombre || !payload.cc || !payload.email || !payload.direccion) {
      notify.warning('Todos los campos del cliente son obligatorios.');
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        await API.put(`${CONFIG.CLIENTES_API}/clientes/${editingClient.id}`, payload);
        notify.success(`Datos de "${payload.nombre}" actualizados.`);
      } else {
        await API.post(`${CONFIG.CLIENTES_API}/clientes`, payload);
        notify.success(`Cliente "${payload.nombre}" registrado en el directorio.`);
      }
      setModalOpen(false);
      await refreshClientes();
    } catch (err) {
      notify.error(err.message || 'No fue posible guardar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.delete(`${CONFIG.CLIENTES_API}/clientes/${deleteTarget.id}`);
      notify.success(`Cliente "${deleteTarget.nombre}" eliminado correctamente.`);
      setDeleteTarget(null);
      await refreshClientes();
    } catch (err) {
      notify.error(err.message || 'Error al eliminar el cliente.');
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
            <i className="bi bi-people-fill text-primary me-2"></i>
            Directorio CRM de Clientes
          </h2>
          <p className="text-secondary mb-0">
            Administra datos de identificación (CC), contacto, ubicación y volumen de compras por cliente.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary rounded-3 fw-semibold px-4 py-2 shadow-sm"
          onClick={openCreateModal}
        >
          <i className="bi bi-person-plus-fill me-2"></i>
          Nuevo Cliente
        </button>
      </div>

      {/* Barra de Búsqueda y Selector de Vista */}
      <div className="friendly-card p-3 mb-4">
        <div className="row g-3 align-items-center justify-content-between">
          <div className="col-md-8 col-lg-6">
            <div className="input-group">
              <span className="input-group-text bg-transparent">
                <i className="bi bi-search text-secondary"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre, cédula (CC), correo o dirección..."
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

          <div className="col-md-4 d-flex justify-content-md-end align-items-center gap-3">
            <span className="text-secondary small fw-semibold">
              Mostrando {filteredClientes.length} de {clientes.length} clientes
            </span>
            <div className="btn-group">
              <button
                type="button"
                className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('table')}
                title="Vista Tabla"
              >
                <i className="bi bi-list-ul"></i>
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('grid')}
                title="Vista Tarjetas"
              >
                <i className="bi bi-grid-fill"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Listado de Clientes */}
      {filteredClientes.length === 0 ? (
        <div className="friendly-card text-center py-5 px-3">
          <div className="stat-icon-circle icon-sky mx-auto mb-3" style={{ width: '64px', height: '64px', fontSize: '1.8rem' }}>
            <i className="bi bi-people"></i>
          </div>
          <h5 className="fw-bold">No se encontraron clientes</h5>
          <p className="text-secondary small mb-3">
            Registra un nuevo cliente para comenzar a emitir facturas electrónicas.
          </p>
          <button type="button" className="btn btn-primary rounded-3" onClick={openCreateModal}>
            <i className="bi bi-person-plus me-2"></i>
            Registrar Cliente
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="friendly-card overflow-hidden">
          <div className="table-responsive">
            <table className="table table-friendly table-hover mb-0">
              <thead>
                <tr>
                  <th style={{ width: '85px' }}>ID</th>
                  <th>Cliente</th>
                  <th>Identificación (CC)</th>
                  <th>Dirección</th>
                  <th>Actividad Comercial</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes.map((c) => {
                  const stats = clientPurchaseMap[c.id] || { count: 0, total: 0 };
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="badge bg-body-secondary text-body font-mono border">
                          #{c.id}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className={`avatar-circle ${Formatters.avatarColor(c.nombre)}`}>
                            {Formatters.initials(c.nombre)}
                          </div>
                          <div>
                            <div className="fw-bold">{c.nombre}</div>
                            <a
                              href={`mailto:${c.email}`}
                              className="small text-primary text-decoration-none"
                            >
                              <i className="bi bi-envelope me-1"></i>
                              {c.email}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-soft-info font-mono px-2 py-1">
                          CC {c.cc || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <div className="small text-secondary">
                          <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                          {c.direccion || 'No especificada'}
                        </div>
                      </td>
                      <td>
                        <div className="fw-bold font-mono text-success small">
                          {Formatters.currency(stats.total)}
                        </div>
                        <small className="text-secondary">
                          {stats.count} {stats.count === 1 ? 'factura emitida' : 'facturas emitidas'}
                        </small>
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-success rounded-3"
                            onClick={() => startBillingForClient(c.id)}
                            title="Crear factura para este cliente"
                          >
                            <i className="bi bi-cart-plus me-1"></i>
                            Facturar
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary rounded-3"
                            onClick={() => openEditModal(c)}
                            title="Editar datos"
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-3"
                            onClick={() => setDeleteTarget(c)}
                            title="Eliminar cliente"
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
          {filteredClientes.map((c) => {
            const stats = clientPurchaseMap[c.id] || { count: 0, total: 0 };
            return (
              <div className="col-sm-6 col-lg-4" key={c.id}>
                <div className="friendly-card friendly-card-hover p-4 h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className={`avatar-circle ${Formatters.avatarColor(c.nombre)}`}
                          style={{ width: '48px', height: '48px', fontSize: '1.1rem' }}
                        >
                          {Formatters.initials(c.nombre)}
                        </div>
                        <div>
                          <h5 className="fw-bold mb-0">{c.nombre}</h5>
                          <span className="badge badge-soft-info font-mono mt-1">
                            CC: {c.cc}
                          </span>
                        </div>
                      </div>
                      <span className="badge bg-body-secondary text-secondary font-mono">
                        #{c.id}
                      </span>
                    </div>

                    <div className="small text-secondary mb-2">
                      <i className="bi bi-envelope-fill text-primary me-2"></i>
                      {c.email}
                    </div>
                    <div className="small text-secondary mb-3">
                      <i className="bi bi-geo-alt-fill text-danger me-2"></i>
                      {c.direccion}
                    </div>
                  </div>

                  <div>
                    <div className="p-2 rounded-3 bg-body-tertiary border d-flex justify-content-between align-items-center mb-3 small">
                      <span className="text-secondary">
                        {stats.count} {stats.count === 1 ? 'compra' : 'compras'}:
                      </span>
                      <span className="font-mono fw-bold text-success">
                        {Formatters.currency(stats.total)}
                      </span>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-success flex-grow-1 rounded-3 fw-semibold"
                        onClick={() => startBillingForClient(c.id)}
                      >
                        <i className="bi bi-cart-plus me-1"></i>
                        Facturar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary rounded-3"
                        onClick={() => openEditModal(c)}
                      >
                        <i className="bi bi-pencil-square"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-3"
                        onClick={() => setDeleteTarget(c)}
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

      {/* Modal Bootstrap: Crear / Editar Cliente */}
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
                  <i className={`bi ${editingClient ? 'bi-person-gear' : 'bi-person-plus-fill'} text-primary me-2`}></i>
                  {editingClient ? `Editar Cliente #${editingClient.id}` : 'Registrar Nuevo Cliente'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setModalOpen(false)}
                ></button>
              </div>

              <form onSubmit={handleSaveCliente}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-secondary">
                      Nombre Completo o Razón Social
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-transparent">
                        <i className="bi bi-person text-primary"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: Carlos Andrés Pérez"
                        value={formNombre}
                        onChange={(e) => setFormNombre(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold small text-secondary">
                        Cédula / NIT (CC)
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-transparent">
                          <i className="bi bi-card-heading text-primary"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control font-mono"
                          placeholder="Ej: 1020304050"
                          value={formCC}
                          onChange={(e) => setFormCC(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <label className="form-label fw-semibold small text-secondary">
                        Correo Electrónico
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-transparent">
                          <i className="bi bi-envelope text-primary"></i>
                        </span>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="cliente@correo.com"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-semibold small text-secondary">
                      Dirección Física y Ciudad
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-transparent">
                        <i className="bi bi-geo-alt text-primary"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: Calle 100 #15-20, Bogotá D.C."
                        value={formDireccion}
                        onChange={(e) => setFormDireccion(e.target.value)}
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
                        Guardar Cliente
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
                <i className="bi bi-person-x-fill"></i>
              </div>
              <h5 className="fw-bold mb-2">¿Eliminar cliente?</h5>
              <p className="text-secondary small mb-4">
                Se eliminará a <strong>"{deleteTarget.nombre}"</strong> (CC {deleteTarget.cc}) del directorio.
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

window.ClientesView = ClientesView;
})();

/* ==================== facturacion.js ==================== */
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

/* ==================== app.js ==================== */
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
