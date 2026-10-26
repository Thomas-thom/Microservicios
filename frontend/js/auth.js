// Módulo de Autenticación
const AuthModule = {
  init() {
    this.loginForm = document.getElementById('login-form');
    this.registerForm = document.getElementById('register-form');
    this.logoutBtn = document.getElementById('logout-btn');

    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }
    if (this.registerForm) {
      this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }
    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Toggle entre login y registro
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');
    if (showRegisterLink) {
      showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-box').style.display = 'none';
        document.getElementById('register-box').style.display = 'block';
      });
    }
    if (showLoginLink) {
      showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-box').style.display = 'none';
        document.getElementById('login-box').style.display = 'block';
      });
    }

    this.checkSession();
  },

  async checkSession() {
    const token = API.getToken();
    if (!token) {
      this.renderLoggedOut();
      return;
    }

    try {
      const claims = await API.get(`${CONFIG.AUTH_API}/verify`);
      API.setUser({
        id: claims.id,
        nombre: claims.nombre,
        email: claims.email,
        rol: claims.rol
      });
      this.renderLoggedIn(claims);
    } catch {
      API.clearSession();
      this.renderLoggedOut();
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const submitBtn = this.loginForm.querySelector('button[type="submit"]');

    if (!email || !password) {
      Toast.error('Por favor ingresa correo y contraseña');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesión...';

      const res = await API.post(`${CONFIG.AUTH_API}/login`, { email, password });
      API.setToken(res.token);
      API.setUser(res.user);

      Toast.success(`¡Bienvenido, ${res.user.nombre}!`);
      this.renderLoggedIn(res.user);
      window.dispatchEvent(new CustomEvent('auth-changed'));
    } catch (err) {
      Toast.error(err.message || 'Error al iniciar sesión');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar Sesión';
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const rol = document.getElementById('reg-rol').value || 'cliente';
    const submitBtn = this.registerForm.querySelector('button[type="submit"]');

    if (!nombre || !email || !password) {
      Toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registrando...';

      await API.post(`${CONFIG.AUTH_API}/register`, { nombre, email, password, rol });
      Toast.success('Usuario registrado con éxito. Ahora puedes iniciar sesión.');

      // Cambiar a formulario de login
      document.getElementById('register-box').style.display = 'none';
      document.getElementById('login-box').style.display = 'block';
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = '';
      this.registerForm.reset();
    } catch (err) {
      Toast.error(err.message || 'Error al registrar usuario');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear Cuenta';
    }
  },

  handleLogout() {
    API.clearSession();
    Toast.info('Has cerrado sesión correctamente');
    this.renderLoggedOut();
    window.dispatchEvent(new CustomEvent('auth-changed'));
  },

  renderLoggedIn(user) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-main').style.display = 'block';
    document.getElementById('user-info-bar').style.display = 'flex';

    document.getElementById('current-user-name').textContent = user.nombre;
    const badge = document.getElementById('current-user-role');
    badge.textContent = user.rol;
    badge.className = `badge badge-${user.rol === 'admin' ? 'purple' : 'blue'}`;
  },

  renderLoggedOut() {
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('app-main').style.display = 'none';
    document.getElementById('user-info-bar').style.display = 'none';
  }
};

window.AuthModule = AuthModule;
