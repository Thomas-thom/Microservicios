// Módulo de Emisión de Facturas
const FacturacionModule = {
  clientes: [],
  productos: [],
  selectedItems: [], // [{ id, nombre, precio, stock, cantidad, subtotal }]

  async init() {
    const addBtn = document.getElementById('btn-add-item');
    const form = document.getElementById('factura-form');
    const prodSelect = document.getElementById('factura-producto-select');

    if (addBtn) {
      addBtn.addEventListener('click', () => this.addItemFromSelect());
    }

    if (prodSelect) {
      prodSelect.addEventListener('change', () => this.onProductSelectChange());
    }

    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  },

  async loadData() {
    try {
      const [cls, prods] = await Promise.all([
        API.get(`${CONFIG.CLIENTES_API}/clientes`).catch(() => []),
        API.get(`${CONFIG.PRODUCTOS_API}/productos`).catch(() => [])
      ]);

      this.clientes = cls;
      this.productos = prods;
      this.populateSelects();
    } catch (err) {
      Toast.error('Error al cargar datos para facturar: ' + err.message);
    }
  },

  populateSelects() {
    const clientSelect = document.getElementById('factura-cliente-select');
    const prodSelect = document.getElementById('factura-producto-select');

    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">-- Selecciona un Cliente --</option>' +
        this.clientes.map(c => `<option value="${c.id}">${c.nombre} (CC: ${c.cc || 'N/A'}) - ${c.email}</option>`).join('');
    }

    if (prodSelect) {
      prodSelect.innerHTML = '<option value="">-- Selecciona un Producto --</option>' +
        this.productos.map(p => {
          const disabled = p.stock <= 0 ? 'disabled' : '';
          const stockLabel = p.stock <= 0 ? '(Agotado)' : `(Stock: ${p.stock})`;
          return `<option value="${p.id}" ${disabled}>${p.nombre} - $ ${p.precio.toLocaleString('es-CO')} ${stockLabel}</option>`;
        }).join('');
    }

    this.onProductSelectChange();
  },

  onProductSelectChange() {
    const prodSelect = document.getElementById('factura-producto-select');
    const stockInfo = document.getElementById('selected-prod-stock-info');
    const qtyInput = document.getElementById('factura-cantidad-input');
    if (!prodSelect || !stockInfo || !qtyInput) return;

    const selectedId = parseInt(prodSelect.value, 10);
    const prod = this.productos.find(p => p.id === selectedId);

    if (prod) {
      stockInfo.textContent = `Disponible: ${prod.stock} unidades | Precio: $ ${prod.precio.toLocaleString('es-CO')}`;
      qtyInput.max = prod.stock;
      if (parseInt(qtyInput.value, 10) > prod.stock) {
        qtyInput.value = prod.stock > 0 ? 1 : 0;
      }
    } else {
      stockInfo.textContent = '';
      qtyInput.removeAttribute('max');
    }
  },

  addItemFromSelect() {
    const prodSelect = document.getElementById('factura-producto-select');
    const qtyInput = document.getElementById('factura-cantidad-input');
    const prodId = parseInt(prodSelect.value, 10);
    const cantidad = parseInt(qtyInput.value, 10);

    if (!prodId) {
      Toast.warning('Por favor selecciona un producto');
      return;
    }
    if (isNaN(cantidad) || cantidad <= 0) {
      Toast.warning('La cantidad debe ser mayor a 0');
      return;
    }

    const prod = this.productos.find(p => p.id === prodId);
    if (!prod) return;

    // Verificar si ya está en la lista
    const existing = this.selectedItems.find(it => it.id === prodId);
    const totalDeseado = (existing ? existing.cantidad : 0) + cantidad;

    if (totalDeseado > prod.stock) {
      Toast.error(`No hay existencias suficientes. Stock disponible: ${prod.stock}`);
      return;
    }

    if (existing) {
      existing.cantidad = totalDeseado;
      existing.subtotal = existing.cantidad * existing.precio;
    } else {
      this.selectedItems.push({
        id: prod.id,
        nombre: prod.nombre,
        precio: prod.precio,
        stock: prod.stock,
        cantidad: cantidad,
        subtotal: cantidad * prod.precio
      });
    }

    qtyInput.value = 1;
    this.renderSelectedItems();
    Toast.info(`"${prod.nombre}" agregado al pedido`);
  },

  renderSelectedItems() {
    const tbody = document.getElementById('factura-items-table');
    const totalEl = document.getElementById('factura-total-display');
    if (!tbody || !totalEl) return;

    if (this.selectedItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aún no has agregado productos a la factura.</td></tr>';
      totalEl.textContent = '$ 0,00';
      return;
    }

    let granTotal = 0;
    tbody.innerHTML = this.selectedItems.map((item, idx) => {
      granTotal += item.subtotal;
      return `
        <tr>
          <td><strong>${item.nombre}</strong></td>
          <td class="font-mono text-center">
            <div class="qty-control">
              <button type="button" class="btn-qty" onclick="FacturacionModule.updateItemQty(${idx}, -1)">-</button>
              <span>${item.cantidad}</span>
              <button type="button" class="btn-qty" onclick="FacturacionModule.updateItemQty(${idx}, 1)">+</button>
            </div>
          </td>
          <td class="text-emerald font-mono">$ ${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
          <td class="text-emerald font-mono font-bold">$ ${item.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
          <td>
            <button type="button" class="btn btn-sm btn-danger-outline" onclick="FacturacionModule.removeItem(${idx})">&times;</button>
          </td>
        </tr>
      `;
    }).join('');

    totalEl.textContent = `$ ${granTotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
  },

  updateItemQty(index, delta) {
    const item = this.selectedItems[index];
    if (!item) return;

    const prod = this.productos.find(p => p.id === item.id);
    const nuevaCant = item.cantidad + delta;

    if (nuevaCant <= 0) {
      this.removeItem(index);
      return;
    }

    if (prod && nuevaCant > prod.stock) {
      Toast.error(`Stock máximo alcanzado (${prod.stock} unidades)`);
      return;
    }

    item.cantidad = nuevaCant;
    item.subtotal = item.cantidad * item.precio;
    this.renderSelectedItems();
  },

  removeItem(index) {
    this.selectedItems.splice(index, 1);
    this.renderSelectedItems();
  },

  async handleSubmit(e) {
    e.preventDefault();
    const clientSelect = document.getElementById('factura-cliente-select');
    const clienteId = parseInt(clientSelect.value, 10);
    const submitBtn = document.getElementById('btn-submit-factura');

    if (!clienteId) {
      Toast.warning('Por favor selecciona un cliente para la factura');
      return;
    }

    if (this.selectedItems.length === 0) {
      Toast.warning('Debes agregar al menos un producto a la factura');
      return;
    }

    const payload = {
      cliente_id: clienteId,
      productos: this.selectedItems.map(it => ({
        producto_id: it.id,
        cantidad: it.cantidad
      }))
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Generando Factura...';

      const facturaCreada = await API.post(`${CONFIG.FACTURACION_API}/facturas`, payload);
      Toast.success(`¡Factura #${facturaCreada.factura_id} generada exitosamente!`);

      // Limpiar formulario y selección
      this.selectedItems = [];
      this.renderSelectedItems();
      clientSelect.value = '';

      // Recargar datos y stock actualizado
      await this.loadData();
      if (window.ProductosModule) window.ProductosModule.load();
      if (window.DashboardModule) window.DashboardModule.load();

      // Abrir modal de detalle para visualizar e imprimir en PDF
      if (window.FacturasListModule) {
        window.FacturasListModule.openModal(facturaCreada);
      }
    } catch (err) {
      Toast.error(err.message || 'Error al emitir factura');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Emitir y Guardar Factura';
    }
  }
};

window.FacturacionModule = FacturacionModule;
