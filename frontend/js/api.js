// Capa de Servicio HTTP Reactivo para Microservicios en Go
const API = {
  TOKEN_KEY: 'auth_token',
  USER_KEY: 'auth_user',
  THEME_KEY: 'ff_theme',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  },

  getUser() {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.USER_KEY);
    }
  },

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  getTheme() {
    return localStorage.getItem(this.THEME_KEY) || 'light';
  },

  setTheme(theme) {
    localStorage.setItem(this.THEME_KEY, theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
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
        const errorMsg = data?.detail || data?.title || data?.message || `Error HTTP ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.status === 401 && !url.includes('/login') && !url.includes('/register')) {
        this.clearSession();
        window.dispatchEvent(new CustomEvent('session-expired'));
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
  },

  // Verifica el estado y latencia de los 4 microservicios en paralelo
  async checkServicesHealth() {
    const checks = await Promise.all(
      CONFIG.SERVICES_META.map(async (svc) => {
        const start = performance.now();
        try {
          const res = await fetch(svc.url, { method: 'GET' });
          const latency = Math.round(performance.now() - start);
          return {
            ...svc,
            online: res.ok,
            latency
          };
        } catch {
          return {
            ...svc,
            online: false,
            latency: null
          };
        }
      })
    );
    return checks;
  }
};

window.API = API;
