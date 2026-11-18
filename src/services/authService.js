/**
 * ARUS Authentication Service Layer
 * 
 * Supports local demo auth and ready for Backend JWT/OAuth integration.
 */

const AUTH_KEY = 'arus_auth_session';
const USE_BACKEND_AUTH = false;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const authService = {
  getCurrentUser() {
    try {
      const saved = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  },

  async login(credentials, remember = true) {
    if (USE_BACKEND_AUTH) {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (!res.ok) throw new Error('Invalid email or password');
      const data = await res.json();
      if (remember) localStorage.setItem(AUTH_KEY, JSON.stringify(data.user));
      else sessionStorage.setItem(AUTH_KEY, JSON.stringify(data.user));
      return data.user;
    }

    // Default offline/demo authentication
    const user = {
      email: credentials.email,
      name: credentials.email.split('@')[0] || 'Engineer',
      role: 'marine_engineer',
      token: 'demo-token-' + Date.now()
    };
    if (remember) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    else sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
  }
};

export default authService;
