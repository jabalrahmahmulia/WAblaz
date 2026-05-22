/**
 * API.js - Modul komunikasi API
 * Mengelola semua request HTTP ke backend server
 */
const API = {
  /**
   * Wrapper fetch dengan penanganan error dan autentikasi
   */
  async request(url, options = {}) {
    try {
      const defaultOptions = {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      };

      const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
      };

      const res = await fetch(url, mergedOptions);

      // Jika sesi habis (401), arahkan ke login
      if (res.status === 401) {
        Auth.currentUser = null;
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('page-login').style.display = 'flex';
        UI.showToast('Sesi telah berakhir, silakan login kembali', 'warning');
        throw new Error('Sesi berakhir');
      }

      const data = await res.json();
      return data;
    } catch (err) {
      if (err.message === 'Sesi berakhir') throw err;
      console.error(`API Error [${url}]:`, err);
      throw new Error('Gagal terhubung ke server');
    }
  },

  // ==================== SYSTEM STATUS ====================

  /**
   * Cek status koneksi ke StarSender API
   */
  async checkApi() {
    return this.request('/api/check-api');
  },

  /**
   * Cek status kesibukan server (Global Lock)
   */
  async getStatus() {
    return this.request('/api/status');
  },

  // ==================== PENGIRIMAN PESAN ====================

  /**
   * Kirim pesan melalui StarSender API
   */
  async sendMessage(to, body, messageType = 'text', file = '', delay = 0, schedule = 0) {
    const payload = { to, body, messageType };
    if (file) payload.file = file;
    if (delay) payload.delay = delay;
    if (schedule) payload.schedule = schedule;

    return this.request('/api/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Upload file lampiran
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Panggil fetch langsung karena FormData otomatis men-set Content-Type multipart/form-data
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    if (res.status === 401) {
      throw new Error('Sesi berakhir');
    }
    
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Upload gagal');
    }
    
    return data;
  },

  // ==================== KELOLA FILE MEDIA ====================

  /**
   * Mendapatkan daftar file yang diupload (superadmin)
   */
  async getFiles() {
    return this.request('/api/files');
  },

  /**
   * Menghapus file (superadmin)
   */
  async deleteFile(filename) {
    return this.request(`/api/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
  },

  // ==================== PENGATURAN ====================

  /**
   * Ambil pengaturan API (superadmin only)
   */
  async getSettings() {
    return this.request('/api/settings');
  },

  /**
   * Update pengaturan API (superadmin only)
   */
  async updateSettings(httpRequest, apiKey) {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ httpRequest, apiKey })
    });
  },

  // ==================== PENGGUNA ====================

  /**
   * Ambil daftar pengguna (superadmin only)
   */
  async getUsers() {
    return this.request('/api/users');
  },

  /**
   * Tambah pengguna baru (superadmin only)
   */
  async addUser(namaPengguna, username, password, role, expiresAt) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ namaPengguna, username, password, role, expiresAt })
    });
  },

  /**
   * Update pengguna (superadmin only)
   */
  async updateUser(currentUsername, data) {
    return this.request(`/api/users/${encodeURIComponent(currentUsername)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * Hapus pengguna (superadmin only)
   */
  async deleteUser(username) {
    return this.request(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE'
    });
  },

  // ==================== LOG ====================

  /**
   * Ambil log pengiriman
   */
  async getLogs() {
    return this.request('/api/logs');
  },

  /**
   * Tambah entri log
   */
  async addLog(logData) {
    return this.request('/api/logs', {
      method: 'POST',
      body: JSON.stringify(logData)
    });
  },

  /**
   * Hapus semua log
   */
  async clearLogs() {
    return this.request('/api/logs', {
      method: 'DELETE'
    });
  },

  // ==================== JADWAL ====================

  /**
   * Ambil daftar jadwal
   */
  async getSchedules() {
    return this.request('/api/schedules');
  },

  /**
   * Tambah jadwal baru
   */
  async addSchedule(scheduleData) {
    return this.request('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData)
    });
  },

  /**
   * Update status jadwal
   */
  async updateSchedule(id, data) {
    return this.request(`/api/schedules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  /**
   * Hapus jadwal
   */
  async deleteSchedule(id) {
    return this.request(`/api/schedules/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }
};
