// Orquestador principal del Frontend
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar componentes
  if (window.Toast) Toast.init();
  if (window.AuthModule) AuthModule.init();
  if (window.ProductosModule) ProductosModule.init();
  if (window.ClientesModule) ClientesModule.init();
  if (window.FacturacionModule) FacturacionModule.init();
  if (window.FacturasListModule) FacturasListModule.init();

  // Gestión de pestañas de navegación
  const navButtons = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.app-section');

  function switchTab(targetId) {
    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === targetId);
    });

    sections.forEach(sec => {
      sec.classList.toggle('active', sec.id === targetId);
    });

    // Cargar datos según sección
    if (targetId === 'sec-dashboard') {
      DashboardModule.load();
    } else if (targetId === 'sec-productos') {
      ProductosModule.load();
    } else if (targetId === 'sec-clientes') {
      ClientesModule.load();
    } else if (targetId === 'sec-nueva-factura') {
      FacturacionModule.loadData();
    } else if (targetId === 'sec-facturas') {
      FacturasListModule.load();
    }
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(btn.dataset.target);
    });
  });

  // Escuchar cambios de autenticación
  window.addEventListener('auth-changed', () => {
    if (API.getToken()) {
      switchTab('sec-dashboard');
    }
  });

  // Si ya hay token activo al arrancar
  if (API.getToken()) {
    switchTab('sec-dashboard');
  }
});
