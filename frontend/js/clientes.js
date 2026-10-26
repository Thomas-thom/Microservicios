// Módulo de Gestión de Clientes (CRUD Completo)
const ClientesModule = {
  items: [],

  init() {
    const searchInput = document.getElementById('search-cliente');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.filter(e.target.value));
    }

    const form = document.getElementById('cliente-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  },

  async load() {
    const tbody = document.getElementById('clientes-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Cargando clientes...</td></tr>';
    }

    try {
      this.items = await API.get(`${CONFIG.CLIENTES_API}/clientes`);
      this.render(this.items);
    } catch (err) {
      Toast.error('No se pudo conectar con el microservicio de clientes');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${err.message}</td></tr>`;
      }
    }
  },

  render(list) {
    const tbody = document.getElementById('clientes-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay clientes registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(c => `
      <tr>
        <td><strong>#${c.id}</strong></td>
        <td><strong>${c.nombre}</strong></td>
        <td><span class="font-mono">${c.cc || 'N/A'}</span></td>
        <td><a href="mailto:${c.email}" class="text-blue">${c.email}</a></td>
        <td>${c.direccion || 'N/A'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-outline" onclick="ClientesModule.openEdit(${c.id})">Editar</button>
            <button class="btn btn-sm btn-danger-outline" onclick="ClientesModule.delete(${c.id})">Eliminar</button>
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
    const filtered = this.items.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      (c.cc && c.cc.toLowerCase().includes(q)) ||
      c.email.toLowerCase().includes(q) ||
      String(c.id).includes(q)
    );
    this.render(filtered);
  },

  openNew() {
    document.getElementById('modal-cliente-title').textContent = 'Nuevo Cliente';
    document.getElementById('cliente-id').value = '';
    document.getElementById('cliente-nombre').value = '';
    document.getElementById('cliente-cc').value = '';
    document.getElementById('cliente-email').value = '';
    document.getElementById('cliente-direccion').value = '';
    document.getElementById('modal-cliente').style.display = 'flex';
  },

  openEdit(id) {
    const client = this.items.find(c => c.id === id);
    if (!client) return;

    document.getElementById('modal-cliente-title').textContent = `Editar Cliente #${client.id}`;
    document.getElementById('cliente-id').value = client.id;
    document.getElementById('cliente-nombre').value = client.nombre;
    document.getElementById('cliente-cc').value = client.cc || '';
    document.getElementById('cliente-email').value = client.email;
    document.getElementById('cliente-direccion').value = client.direccion || '';
    document.getElementById('modal-cliente').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('modal-cliente').style.display = 'none';
  },

  async handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('cliente-id').value;
    const nombre = document.getElementById('cliente-nombre').value.trim();
    const cc = document.getElementById('cliente-cc').value.trim();
    const email = document.getElementById('cliente-email').value.trim();
    const direccion = document.getElementById('cliente-direccion').value.trim();

    if (!nombre || !cc || !email || !direccion) {
      Toast.error('Todos los campos del cliente son obligatorios');
      return;
    }

    try {
      if (id) {
        await API.put(`${CONFIG.CLIENTES_API}/clientes/${id}`, { nombre, cc, email, direccion });
        Toast.success('Cliente actualizado exitosamente');
      } else {
        await API.post(`${CONFIG.CLIENTES_API}/clientes`, { nombre, cc, email, direccion });
        Toast.success('Cliente registrado exitosamente');
      }
      this.closeModal();
      await this.load();
    } catch (err) {
      Toast.error(err.message || 'Error al guardar cliente');
    }
  },

  async delete(id) {
    const client = this.items.find(c => c.id === id);
    const name = client ? client.nombre : `#${id}`;
    if (!confirm(`¿Estás seguro de eliminar el cliente "${name}"?`)) {
      return;
    }

    try {
      await API.delete(`${CONFIG.CLIENTES_API}/clientes/${id}`);
      Toast.success('Cliente eliminado con éxito');
      await this.load();
    } catch (err) {
      Toast.error(err.message || 'Error al eliminar cliente');
    }
  }
};

window.ClientesModule = ClientesModule;
