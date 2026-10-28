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
