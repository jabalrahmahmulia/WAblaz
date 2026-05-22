/**
 * ============================================================
 * Modul Komunikasi API (Serverless GAS Backend)
 * ============================================================
 */
const API = {
  /**
   * Mengirim request ke Google Apps Script
   */
  async request(action, data = {}) {
    try {
      const payload = {
        action: action,
        sessionToken: localStorage.getItem('wasender_token'),
        ...data
      };

      const response = await fetch(window.CONFIG.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const result = await response.json();
      
      // Jika token tidak valid / kedaluwarsa
      if (result.code === 401) {
        localStorage.removeItem('wasender_token');
        localStorage.removeItem('wasender_user');
        window.location.reload();
      }

      return result;
    } catch (error) {
      console.error(`API Request Error (${action}):`, error);
      throw error;
    }
  },

  // ==================== AUTHENTICATION ====================
  async login(username, password) {
    return this.request('login', { username, password });
  },
  
  async checkSession() {
    if (!localStorage.getItem('wasender_token')) return { success: false };
    return this.request('checkSession');
  },

  // ==================== PENGIRIMAN PESAN ====================
  async sendMessage(data) {
    return this.request('send', data);
  },

  // ==================== PENGATURAN API ====================
  async getSettings() {
    return this.request('getSettings');
  },
  
  async updateSettings(apiUrl, apiKey) {
    return this.request('updateSettings', { httpRequest: apiUrl, apiKey: apiKey });
  },

  // ==================== SYSTEM STATUS ====================
  async checkApi() {
    return this.request('checkApi');
  },
  
  async getStatus() {
    return this.request('status');
  },

  // ==================== KELOLA PENGGUNA ====================
  async getUsers() {
    return this.request('getUsers');
  },
  
  async addUser(data) {
    return this.request('addUser', data);
  },
  
  async updateUser(data) {
    return this.request('updateUser', data);
  },
  
  async deleteUser(username) {
    return this.request('deleteUser', { username });
  },

  // ==================== LOGS ====================
  async getLogs() {
    return this.request('getLogs');
  },
  
  async clearLogs() {
    return this.request('clearLogs');
  }
};
