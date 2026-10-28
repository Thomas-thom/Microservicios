(() => {
// Componente React de Autenticación (Login Seguro, Limpio y Centrado)
const { useState } = React;
const useApp = window.useApp;

function AuthView() {
  const { login, register, theme, toggleTheme, notify } = useApp();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Estado formulario Login (campos limpios sin credenciales expuestas)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Estado formulario Registro
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRol, setRegRol] = useState('cliente');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      notify.warning('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      await login(loginEmail.trim(), loginPassword.trim());
    } catch (err) {
      notify.error(err.message || 'Credenciales incorrectas.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regNombre.trim() || !regEmail.trim() || !regPassword.trim()) {
      notify.warning('Completa todos los campos para crear tu cuenta.');
      return;
    }
    if (regPassword.trim().length < 4) {
      notify.warning('La contraseña debe tener mínimo 4 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        nombre: regNombre.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        rol: regRol
      });
      setLoginEmail(regEmail.trim());
      setLoginPassword('');
      setRegNombre('');
      setRegEmail('');
      setRegPassword('');
      setMode('login');
    } catch (err) {
      notify.error(err.message || 'No fue posible registrar el usuario.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split-wrapper d-flex align-items-center justify-content-center min-vh-100 py-4 px-3">
      <div className="w-100" style={{ maxWidth: '440px' }}>
        {/* Selector de Tema */}
        <div className="d-flex justify-content-end mb-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm bg-body"
            title="Cambiar tema visual"
          >
            <i className={`bi ${theme === 'light' ? 'bi-moon-stars-fill' : 'bi-sun-fill'} me-1`}></i>
            {theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
          </button>
        </div>

        {/* Tarjeta de Autenticación Centrada y Segura */}
        <div className="friendly-card p-4 p-sm-5 shadow-lg border-0 fade-in-up">
          {/* Logo y Título Centrado */}
          <div className="text-center mb-4">
            <div
              className="brand-logo-box mx-auto mb-3 shadow"
              style={{ width: '56px', height: '56px', fontSize: '1.75rem', borderRadius: '16px' }}
            >
              <i className="bi bi-lightning-charge-fill"></i>
            </div>
            <h3 className="fw-extrabold mb-1">FacturaFlow</h3>
            <p className="text-secondary small mb-0">
              Sistema de Facturación Digital e Inventario
            </p>
          </div>

          {/* Pestañas de Alternancia: Iniciar Sesión / Registro */}
          <ul className="nav nav-pills nav-fill bg-body-tertiary p-1 rounded-4 mb-4">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link rounded-3 fw-semibold ${mode === 'login' ? 'active shadow-sm' : ''}`}
                onClick={() => setMode('login')}
              >
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Iniciar Sesión
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link rounded-3 fw-semibold ${mode === 'register' ? 'active shadow-sm' : ''}`}
                onClick={() => setMode('register')}
              >
                <i className="bi bi-person-plus-fill me-2"></i>
                Crear Cuenta
              </button>
            </li>
          </ul>

          {mode === 'login' ? (
            <div className="fade-in-up">
              <form onSubmit={handleLoginSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small text-secondary">
                    Correo Electrónico
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent">
                      <i className="bi bi-envelope text-primary"></i>
                    </span>
                    <input
                      type="email"
                      className="form-control form-control-lg fs-6"
                      placeholder="nombre@ejemplo.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      autoComplete="email"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold small text-secondary">
                    Contraseña
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent">
                      <i className="bi bi-key text-primary"></i>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-control-lg fs-6"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-100 rounded-3 fw-bold shadow-sm"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Verificando credenciales...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-unlock-fill me-2"></i>
                      Entrar al Sistema
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="fade-in-up">
              <form onSubmit={handleRegisterSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small text-secondary">
                    Nombre Completo
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent">
                      <i className="bi bi-person text-primary"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: Carlos Gómez"
                      value={regNombre}
                      onChange={(e) => setRegNombre(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mb-3">
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
                      placeholder="carlos@correo.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label className="form-label fw-semibold small text-secondary">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Mín. 4 carac."
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small text-secondary">
                      Rol
                    </label>
                    <select
                      className="form-select"
                      value={regRol}
                      onChange={(e) => setRegRol(e.target.value)}
                    >
                      <option value="cliente">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-success btn-lg w-100 rounded-3 fw-bold shadow-sm"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Registrando cuenta...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle me-2"></i>
                      Completar Registro
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Nota de Seguridad al Pie */}
        <div className="text-center mt-3 text-secondary small">
          <i className="bi bi-shield-check text-success me-1"></i>
          Acceso protegido con cifrado <strong>bcrypt</strong> y tokens <strong>HMAC-SHA256</strong>
        </div>
      </div>
    </div>
  );
}

window.AuthView = AuthView;
})();
