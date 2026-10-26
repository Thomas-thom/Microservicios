// Módulo de Gestión de Productos (CRUD Completo)
const ProductosModule = {
  items: [],

  init() {
    const searchInput = document.getElementById('search-producto');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.filter(e.target.value));
    }

    const form = document.getElementById('producto-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  },

  async load() {
    const tbody = document.getElementById('productos-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Cargando productos...</td></tr>';
    }

    try {
      this.items = await API.get(`${CONFIG.PRODUCTOS_API}/productos`);
      this.render(this.items);
    } catch (err) {
      Toast.error('No se pudo conectar con el microservicio de productos');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${err.message}</td></tr>`;
      }
    }
  },

  render(list) {
    const tbody = document.getElementById('productos-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay productos registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(p => {
      let stockBadgeClass = 'badge-success';
      let stockText = `${p.stock} unid.`;
      if (p.stock <= 0) {
        stockBadgeClass = 'badge-danger';
        stockText = 'Agotado (0)';
      } else if (p.stock < 5) {
        stockBadgeClass = 'badge-warning';
        stockText = `Bajo stock (${p.stock})`;
      }

      return `
        <tr>
          <td><strong>#${p.id}</strong></td>
          <td><strong>${p.nombre}</strong></td>
          <td class="text-emerald font-mono">$ ${(p.precio || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
          <td><span class="badge ${stockBadgeClass}">${stockText}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-outline" onclick="ProductosModule.openEdit(${p.id})">Editar</button>
              <button class="btn btn-sm btn-danger-outline" onclick="ProductosModule.delete(${p.id})">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  filter(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.render(this.items);
      return;
    }
    const filtered = this.items.filter(p =>
      p.nombre.toLowerCase().includes(q) || String(p.id).includes(q)
    );
    this.render(filtered);
  },

  openNew() {
    document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
    document.getElementById('producto-id').value = '';
    document.getElementById('producto-nombre').value = '';
    document.getElementById('producto-precio').value = '';
    document.getElementById('producto-stock').value = '';
    document.getElementById('modal-producto').style.display = 'flex';
  },

  openEdit(id) {
    const prod = this.items.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('modal-producto-title').textContent = `Editar Producto #${prod.id}`;
    document.getElementById('producto-id').value = prod.id;
    document.getElementById('producto-nombre').value = prod.nombre;
    document.getElementById('producto-precio').value = prod.precio;
    document.getElementById('producto-stock').value = prod.stock;
    document.getElementById('modal-producto').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('modal-producto').style.display = 'none';
  },

  async handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('producto-id').value;
    const nombre = document.getElementById('producto-nombre').value.trim();
    const precio = parseFloat(document.getElementById('producto-precio').value);
    const stock = parseInt(document.getElementById('producto-stock').value, 10);

    if (!nombre) {
      Toast.error('El nombre del producto es obligatorio');
      return;
    }
    if (isNaN(precio) || precio <= 0) {
      Toast.error('El precio debe ser un número mayor a 0');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      Toast.error('El stock debe ser un número igual o mayor a 0');
      return;
    }

    try {
      if (id) {
        await API.put(`${CONFIG.PRODUCTOS_API}/productos/${id}`, { nombre, precio, stock });
        Toast.success('Producto actualizado exitosamente');
      } else {
        await API.post(`${CONFIG.PRODUCTOS_API}/productos`, { nombre, precio, stock });
        Toast.success('Producto creado exitosamente');
      }
      this.closeModal();
      await this.load();
    } catch (err) {
      Toast.error(err.message || 'Error al guardar producto');
    }
  },

  async delete(id) {
    const prod = this.items.find(p => p.id === id);
    const name = prod ? prod.nombre : `#${id}`;
    if (!confirm(`¿Estás seguro de eliminar el producto "${name}"?`)) {
      return;
    }

    try {
      await API.delete(`${CONFIG.PRODUCTOS_API}/productos/${id}`);
      Toast.success('Producto eliminado con éxito');
      await this.load();
    } catch (err) {
      Toast.error(err.message || 'Error al eliminar producto');
    }
  }
};

window.ProductosModule = ProductosModule;
