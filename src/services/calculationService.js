/**
 * ARUS Calculation Service Layer
 * 
 * Abstraction layer for calculation executions.
 * Current implementation uses the local client calculation runtime.
 * In the future, this can easily switch to a Backend REST/GraphQL/WebSocket API
 * simply by updating the endpoints and setting `USE_BACKEND_API = true`.
 */

const USE_BACKEND_API = false; // Toggle to true when Backend API is deployed
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const calculationService = {
  /**
   * Run resistance calculation
   * @param {Object} payload ship parameters and method
   */
  async calculateResistance(payload) {
    if (USE_BACKEND_API) {
      const response = await fetch(`${API_BASE_URL}/calculate/resistance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Backend calculation failed');
      return await response.json();
    }
    // Local / Offline engine dispatch
    return { status: 'client_handled', timestamp: new Date().toISOString() };
  },

  /**
   * Run propeller selection calculation
   * @param {Object} payload selection criteria (kt/kq, D, RPM, etc.)
   */
  async calculateSelection(payload) {
    if (USE_BACKEND_API) {
      const response = await fetch(`${API_BASE_URL}/calculate/selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Backend selection failed');
      return await response.json();
    }
    return { status: 'client_handled', timestamp: new Date().toISOString() };
  },

  /**
   * Run propulsion interaction calculation (wake & thrust)
   */
  async calculatePropulsion(payload) {
    if (USE_BACKEND_API) {
      const response = await fetch(`${API_BASE_URL}/calculate/propulsion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Backend propulsion failed');
      return await response.json();
    }
    return { status: 'client_handled', timestamp: new Date().toISOString() };
  },

  /**
   * Save calculation result to backend or history
   */
  async saveCalculation(data) {
    if (USE_BACKEND_API) {
      const response = await fetch(`${API_BASE_URL}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    }
    const historyKey = 'arus-offline-history-v1';
    const existing = JSON.parse(localStorage.getItem(historyKey) || '[]');
    existing.unshift({
      ...data,
      savedAt: new Date().toISOString()
    });
    localStorage.setItem(historyKey, JSON.stringify(existing.slice(0, 50)));
    return { success: true };
  }
};

export default calculationService;
