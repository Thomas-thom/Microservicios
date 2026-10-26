// Módulo de Dashboard y Métricas Resumen
const DashboardModule = {
  async load() {
    try {
      const [productos, clientes, facturas] = await Promise.all([
        API.get(`${CONFIG.PRODUCTOS_API}/productos`).catch(() => []),
        API.get(`${CONFIG.CLIENTES_API}/clientes`).catch(() => []),
        API.get(`${CONFIG.FACTURACION_API}/facturas`).catch(() => [])
      ]);

      const totalFacturado = facturas.reduce((sum, f) => sum + (f.total || 0), 0);
      const stockTotal = productos.reduce((sum, p) => sum + (p.stock || 0), 0);

      const elTotal = document.getElementById('stat-total-facturado');
      const elFacturas = document.getElementById('stat-num-facturas');
      const elClientes = document.getElementById('stat-num-clientes');
      const elProductos = document.getElementById('stat-num-productos');

      if (elTotal) elTotal.textContent = `$ ${totalFacturado.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
      if (elFacturas) elFacturas.textContent = facturas.length;
      if (elClientes) elClientes.textContent = clientes.length;
      if (elProductos) elProductos.textContent = `${productos.length} (${stockTotal} unid.)`;

      this.renderRecentInvoices(facturas.slice(-5).reverse());
    } catch (err) {
      console.error('Error al cargar dashboard:', err);
    }
  },

  renderRecentInvoices(recent) {
    const tbody = document.getElementById('dashboard-recent-table');
    if (!tbody) return;

    if (!recent || recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay facturas emitidas todavía.</td></tr>';
      return;
    }

    tbody.innerHTML = recent.map(f => `
      <tr>
        <td><strong>#${f.factura_id}</strong></td>
        <td>${f.fecha || 'N/A'}</td>
        <td>${f.cliente ? f.cliente.nombre : 'N/A'}</td>
        <td><strong class="text-emerald">$ ${(f.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="FacturasListModule.viewDetail(${f.factura_id})">Ver Factura</button>
        </td>
      </tr>
    `).join('');
  }
};

window.DashboardModule = DashboardModule;
