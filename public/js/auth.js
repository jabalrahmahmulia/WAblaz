/**
 * Auth.js - Modul autentikasi pengguna
 * Mengelola login, logout, dan sesi pengguna
 */
const Auth = {
  currentUser: null,

  /**
   * Login dengan username dan password
   */
  async login(username, password) {
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.updateUIForRole();
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message || 'Login gagal' };
      }
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: 'Gagal terhubung ke server' };
    }
  },

  /**
   * Logout pengguna
   */
  async logout() {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    this.currentUser = null;
    // Tampilkan halaman login
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('page-login').style.display = 'flex';
  },

  /**
   * Periksa sesi yang masih aktif
   */
  async checkSession() {
    try {
      const res = await fetch('/auth/session', {
        credentials: 'include'
      });
      const data = await res.json();

      if (data.loggedIn && data.user) {
        this.currentUser = data.user;
        this.updateUIForRole();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Session check error:', err);
      return false;
    }
  },

  /**
   * Cek apakah pengguna sudah login
   */
  isLoggedIn() {
    return !!this.currentUser;
  },

  /**
   * Cek apakah pengguna adalah superadmin
   */
  isSuperAdmin() {
    return this.currentUser?.role === 'superadmin';
  },

  /**
   * Ambil data pengguna saat ini
   */
  getUser() {
    return this.currentUser;
  },

  /**
   * Update tampilan UI berdasarkan role pengguna
   */
  updateUIForRole() {
    if (!this.currentUser) return;

    // Update info pengguna di sidebar
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    const roleBadge = document.getElementById('user-role-badge');

    if (avatar) avatar.textContent = (this.currentUser.namaPengguna || this.currentUser.username).charAt(0).toUpperCase();
    if (name) name.textContent = this.currentUser.namaPengguna || this.currentUser.username;
    if (roleBadge) {
      roleBadge.textContent = this.currentUser.role === 'superadmin' ? 'Super Admin' : 'Admin';
      roleBadge.className = this.currentUser.role === 'superadmin'
        ? 'badge badge-role badge-superadmin'
        : 'badge badge-role badge-admin';
    }

    // Tampilkan/sembunyikan elemen khusus superadmin
    document.querySelectorAll('.superadmin-only').forEach(el => {
      el.style.display = this.isSuperAdmin() ? '' : 'none';
    });
  }
};
