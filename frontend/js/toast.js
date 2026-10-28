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
