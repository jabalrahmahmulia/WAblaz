/**
 * ============================================================
 * Modul Autentikasi (Serverless)
 * ============================================================
 */

const Auth = {
  currentUser: null,

  /**
   * Proses login dan simpan token di localStorage
   */
  async login(username, password) {
    try {
      const data = await API.login(username, password);
      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('wasender_token', data.token);
        localStorage.setItem('wasender_user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || data.error || 'Login gagal' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Gagal terhubung ke server' };
    }
  },

  /**
   * Proses logout dengan menghapus token
   */
  async logout() {
    localStorage.removeItem('wasender_token');
    localStorage.removeItem('wasender_user');
    this.currentUser = null;
    return true;
  },

  /**
   * Cek apakah user sedang login
   */
  isLoggedIn() {
    return !!localStorage.getItem('wasender_token');
  },

  /**
   * Ambil data user yang sedang login
   */
  getUser() {
    if (!this.currentUser) {
      const stored = localStorage.getItem('wasender_user');
      if (stored) {
        try {
          this.currentUser = JSON.parse(stored);
        } catch(e){}
      }
    }
    return this.currentUser;
  },

  /**
   * Cek apakah user adalah superadmin
   */
  isSuperAdmin() {
    const user = this.getUser();
    return user && user.role === 'superadmin';
  },

  /**
   * Inisialisasi awal (cek validitas token ke server)
   */
  async init() {
    if (this.isLoggedIn()) {
      try {
        const data = await API.checkSession();
        if (data.success) {
          this.currentUser = data.user;
          localStorage.setItem('wasender_user', JSON.stringify(data.user));
          return true;
        } else {
          await this.logout();
          return false;
        }
      } catch (error) {
        // Jika error koneksi, biarkan saja login sementara
        return true;
      }
    }
    return false;
  }
};
