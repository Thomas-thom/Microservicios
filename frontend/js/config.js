// Configuración Centralizada de Microservicios y Utilidades Puras
const CONFIG = {
  AUTH_API: 'http://localhost:8081',
  PRODUCTOS_API: 'http://localhost:8082',
  CLIENTES_API: 'http://localhost:8083',
  FACTURACION_API: 'http://localhost:8084',
  APP_NAME: 'FacturaFlow',
  COMPANY: {
    NAME: 'FACTURAFLOW DIGITAL S.A.S.',
    NIT: '901.482.910-4',
    REGIMEN: 'Responsable de IVA - Régimen Común',
    DIRECCION: 'Av. El Dorado #68B-85, Torre Empresarial, Bogotá D.C.',
    TELEFONO: '(601) 742-8890',
    EMAIL: 'facturacion@facturaflow.co'
  },
  SERVICES_META: [
    { key: 'auth', name: 'Autenticación', port: 8081, url: 'http://localhost:8081/usuarios', icon: 'bi-shield-lock-fill', color: 'primary' },
    { key: 'productos', name: 'Productos / Stock', port: 8082, url: 'http://localhost:8082/productos', icon: 'bi-box-seam-fill', color: 'success' },
    { key: 'clientes', name: 'Clientes CRM', port: 8083, url: 'http://localhost:8083/clientes', icon: 'bi-people-fill', color: 'info' },
    { key: 'facturacion', name: 'Facturación', port: 8084, url: 'http://localhost:8084/facturas', icon: 'bi-receipt-cutoff', color: 'warning' }
  ]
};

const Formatters = {
  currency(value) {
    const num = Number(value) || 0;
    return `$ ${num.toLocaleString('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  },

  initials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'US';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  stockBadge(stock) {
    const qty = Number(stock) || 0;
    if (qty <= 0) {
      return {
        label: 'Agotado',
        className: 'badge-soft-danger',
        icon: 'bi-x-octagon-fill',
        level: 'out'
      };
    }
    if (qty < 10) {
      return {
        label: `Stock bajo (${qty})`,
        className: 'badge-soft-warning',
        icon: 'bi-exclamation-triangle-fill',
        level: 'low'
      };
    }
    return {
      label: `${qty} disponibles`,
      className: 'badge-soft-success',
      icon: 'bi-check-circle-fill',
      level: 'ok'
    };
  },

  avatarColor(idOrName) {
    const palette = [
      'icon-indigo',
      'icon-emerald',
      'icon-sky',
      'icon-amber',
      'icon-rose'
    ];
    const str = String(idOrName || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
  }
};

window.CONFIG = CONFIG;
window.Formatters = Formatters;
