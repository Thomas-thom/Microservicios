// Cliente HTTP unificado para microservicios con gestión de token y errores
const API = {
  getToken() {
    return localStorage.getItem('auth_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  },

  getUser() {
    try {
      const u = localStorage.getItem('auth_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  },

  clearSession() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },

  async request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Manejo de respuestas 204 No Content
      if (response.status === 204) {
        return null;
      }

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text) data = { message: text };
      }

      if (!response.ok) {
        // Extraer mensaje según RFC 9457 o estándar
        const errorMsg = data?.detail || data?.title || data?.message || `Error HTTP ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.status === 401 && !url.includes('/login') && !url.includes('/register')) {
        Toast.warning('Tu sesión ha expirado o no es válida. Por favor ingresa nuevamente.');
        this.clearSession();
        window.dispatchEvent(new CustomEvent('auth-changed'));
      }
      throw err;
    }
  },

  get(url, headers = {}) {
    return this.request(url, { method: 'GET', headers });
  },

  post(url, body, headers = {}) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers
    });
  },

  put(url, body, headers = {}) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers
    });
  },

  delete(url, headers = {}) {
    return this.request(url, { method: 'DELETE', headers });
  }
};

window.API = API;
