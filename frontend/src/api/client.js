/**
 * API client for EasyLin backend.
 */

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('easylin_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('easylin_token', token);
    } else {
      localStorage.removeItem('easylin_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        this.setToken(null);
        window.location.href = '/login';
        throw new Error('Session expired');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      return data;
    } catch (error) {
      if (error.message === 'Session expired') throw error;
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint, bodyOrOptions) {
    let body = bodyOrOptions;
    // Handle axios-style data wrapping
    if (bodyOrOptions && bodyOrOptions.data) {
      body = bodyOrOptions.data;
    }
    
    return this.request(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  del(endpoint) {
    return this.delete(endpoint);
  }
}

const api = new ApiClient();
export default api;
