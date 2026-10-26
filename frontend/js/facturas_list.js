// Módulo de Historial, Visualización y Exportación a PDF/JSON de Facturas
const FacturasListModule = {
  items: [],
  currentModalFactura: null,

  init() {
    const searchInput = document.getElementById('search-factura');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.filter(e.target.value));
    }
  },

  async load() {
    const tbody = document.getElementById('facturas-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Cargando historial de facturas...</td></tr>';
    }

    try {
      this.items = await API.get(`${CONFIG.FACTURACION_API}/facturas`);
      this.render(this.items);
    } catch (err) {
      Toast.error('No se pudo conectar con el microservicio de facturación');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${err.message}</td></tr>`;
      }
    }
  },

  render(list) {
    const tbody = document.getElementById('facturas-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se han emitido facturas.</td></tr>';
      return;
    }

    // Ordenar de más reciente a más antigua
    const sorted = [...list].sort((a, b) => b.factura_id - a.factura_id);

    tbody.innerHTML = sorted.map(f => `
      <tr>
        <td><strong>#${f.factura_id}</strong></td>
        <td>${f.fecha || 'N/A'}</td>
        <td><strong>${f.cliente ? f.cliente.nombre : 'N/A'}</strong><br><small class="text-muted">${f.cliente ? f.cliente.email : ''}</small></td>
        <td>${f.usuario ? f.usuario.nombre : 'N/A'} <span class="badge badge-sm badge-blue">${f.usuario ? f.usuario.rol : ''}</span></td>
        <td class="text-emerald font-mono font-bold">$ ${(f.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-outline" onclick="FacturasListModule.viewDetail(${f.factura_id})">Ver Factura</button>
            <button class="btn btn-sm btn-outline" onclick="FacturasListModule.downloadJSON(${f.factura_id})">JSON</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  filter(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.render(this.items);
      return;
    }
    const filtered = this.items.filter(f =>
      String(f.factura_id).includes(q) ||
      (f.cliente && f.cliente.nombre.toLowerCase().includes(q)) ||
      (f.cliente && f.cliente.email.toLowerCase().includes(q)) ||
      (f.fecha && f.fecha.includes(q))
    );
    this.render(filtered);
  },

  async viewDetail(id) {
    try {
      const factura = await API.get(`${CONFIG.FACTURACION_API}/facturas/${id}`);
      this.openModal(factura);
    } catch (err) {
      Toast.error('Error al cargar la factura: ' + err.message);
    }
  },

  openModal(factura) {
    this.currentModalFactura = factura;

    document.getElementById('inv-modal-id').textContent = `#${factura.factura_id}`;
    document.getElementById('inv-modal-fecha').textContent = factura.fecha;
    document.getElementById('inv-modal-cliente-nombre').textContent = factura.cliente?.nombre || 'N/A';
    document.getElementById('inv-modal-cliente-email').textContent = factura.cliente?.email || 'N/A';
    document.getElementById('inv-modal-vendedor-nombre').textContent = factura.usuario?.nombre || 'N/A';
    document.getElementById('inv-modal-vendedor-rol').textContent = factura.usuario?.rol || 'N/A';

    const tbody = document.getElementById('inv-modal-items');
    tbody.innerHTML = (factura.productos || []).map(p => `
      <tr>
        <td class="text-center font-mono">${p.cantidad}</td>
        <td><strong>${p.nombre}</strong> (ID: ${p.id})</td>
        <td class="text-right font-mono">$ ${(p.precio_unitario || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
        <td class="text-right font-mono font-bold">$ ${(p.subtotal || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    document.getElementById('inv-modal-total').textContent = `$ ${(factura.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;

    document.getElementById('modal-factura-detalle').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('modal-factura-detalle').style.display = 'none';
    this.currentModalFactura = null;
  },

  printCurrentInvoice() {
    window.print();
  },

  downloadJSON(id) {
    const f = this.items.find(item => item.factura_id === id) || this.currentModalFactura;
    if (!f) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(f, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `factura_${f.factura_id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    Toast.success(`Factura #${f.factura_id} descargada en JSON`);
  }
};

window.FacturasListModule = FacturasListModule;
