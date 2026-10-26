// Configuración centralizada de URLs de microservicios
const CONFIG = {
  AUTH_API: 'http://localhost:8081',
  PRODUCTOS_API: 'http://localhost:8082',
  CLIENTES_API: 'http://localhost:8083',
  FACTURACION_API: 'http://localhost:8084',
  APP_NAME: 'Sistema de Facturación Digital',
  CURRENCY: 'COP'
};

// Exponer globalmente
window.CONFIG = CONFIG;
