/**
 * App.js - Controller utama aplikasi WAsender
 * Mengelola routing, event binding, dan inisialisasi aplikasi
 */
const App = {
  currentPage: 'blast',

  /**
   * Inisialisasi aplikasi
   */
  async init() {
    // Periksa sesi yang masih aktif
    const isLoggedIn = await Auth.init();

    if (isLoggedIn) {
      this.showApp();
    } else {
      this.showLogin();
    }

    // Bind semua event listener
    this.bindEvents();

    // Setup routing berbasis hash
    this.setupRouting();

    // Mulai polling status
    setInterval(() => this.pollStatus(), 5000);
    setInterval(() => this.checkApiStatus(), 15000);
    this.checkApiStatus(); // Panggil sekali saat awal
  },

  /**
   * Cek koneksi ke StarSender API
   */
  async checkApiStatus() {
    if (!Auth.isLoggedIn()) return;
    try {
      const res = await API.checkApi();
      const dot = document.getElementById('api-status-dot');
      const text = document.getElementById('api-status-text');
      
      if (!dot || !text) return;
      
      if (res.active) {
        dot.className = 'status-dot active';
        text.textContent = 'API Aktif';
      } else {
        dot.className = 'status-dot inactive';
        text.textContent = res.message || 'API Tidak Aktif';
      }
    } catch (e) {
      const dot = document.getElementById('api-status-dot');
      const text = document.getElementById('api-status-text');
      if (dot && text) {
        dot.className = 'status-dot inactive';
        text.textContent = 'Koneksi Terputus';
      }
    }
  },

  /**
   * Polling status server untuk Global Blast Lock
   */
  async pollStatus() {
    if (!Auth.isLoggedIn()) return;
    try {
      const res = await API.getStatus();
      const btn = document.getElementById('btn-send');
      if (!btn) return;
      
      if (res.success && res.isBlasting && res.currentSender !== Auth.getUser().username) {
        btn.disabled = true;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Sistem Sedang Dipakai (${res.currentSender})</span>`;
      } else {
        btn.disabled = false;
        // Hanya ganti innerHTML jika isinya memang sebelumnya disabled, biar icon gak kedip2
        if (btn.innerHTML.includes('Sistem Sedang Dipakai')) {
          btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg><span>Kirim Pesan</span>`;
        }
      }
    } catch (e) {
      // Abaikan error jaringan untuk polling
    }
  },

  /**
   * Tampilkan aplikasi utama
   */
  showApp() {
    document.getElementById('page-login').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    // Navigasi ke halaman dari hash atau default ke blast
    const hash = window.location.hash.replace('#', '') || 'blast';
    this.navigate(hash);
  },

  /**
   * Tampilkan halaman login
   */
  showLogin() {
    document.getElementById('page-login').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';

    // Reset form login
    const form = document.getElementById('login-form');
    if (form) form.reset();
    const error = document.getElementById('login-error');
    if (error) error.style.display = 'none';
  },

  /**
   * Setup routing berbasis hash
   */
  setupRouting() {
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.replace('#', '') || 'blast';
      if (Auth.isLoggedIn()) {
        this.navigate(page);
      }
    });
  },

  /**
   * Navigasi ke halaman tertentu
   */
  async navigate(page) {
    // Validasi akses superadmin
    if (['settings', 'users'].includes(page) && !Auth.isSuperAdmin()) {
      UI.showToast('Anda tidak memiliki akses ke halaman ini', 'error');
      page = 'blast';
    }

    this.currentPage = page;
    window.location.hash = page;
    UI.showPage(page);

    // Muat data halaman
    await this.loadPageData(page);
  },

  /**
   * Muat data khusus halaman
   */
  async loadPageData(page) {
    try {
      switch (page) {
        case 'scheduler':
          // Removed
          break;
        case 'logs':
          await this.loadLogs();
          break;
        case 'settings':
          await this.loadSettings();
          break;
        case 'users':
          await this.loadUsers();
          break;
      }
    } catch (err) {
      console.error('Error loading page data:', err);
    }
  },

  /**
   * Bind semua event listener
   */
  bindEvents() {
    // Flatpickr inisialisasi
    if (typeof flatpickr !== 'undefined') {
      flatpickr("#schedule-datetime", { enableTime: true, dateFormat: "Y-m-d H:i", minDate: "today" });
      flatpickr("#new-expires-date", { dateFormat: "Y-m-d", minDate: "today" });
      flatpickr("#edit-expires-date", { dateFormat: "Y-m-d", minDate: "today" });
    }

    // ===== LOGIN =====
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Toggle password visibility
    document.getElementById('toggle-password').addEventListener('click', () => {
      const input = document.getElementById('login-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // ===== SIDEBAR NAVIGASI =====
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) this.navigate(page);
      });
    });

    // Sidebar toggle (mobile)
    document.getElementById('hamburger-toggle').addEventListener('click', () => UI.toggleSidebar());
    document.getElementById('sidebar-overlay').addEventListener('click', () => UI.closeSidebar());

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
      UI.showModal('Keluar', 'Apakah Anda yakin ingin keluar?', async () => {
        await Auth.logout();
        this.showLogin();
      });
    });

    // ===== BLAST PAGE =====
    // Hitung jumlah nomor di textarea
    document.getElementById('target-numbers').addEventListener('input', (e) => {
      const lines = e.target.value.trim().split('\n').filter(l => l.trim());
      document.getElementById('target-count').textContent = lines.length + ' nomor';
    });

    // Hitung karakter pesan
    document.getElementById('message-body').addEventListener('input', (e) => {
      document.getElementById('char-count').textContent = e.target.value.length + ' karakter';
    });

    // Removed schedule toggle


    // Tombol kirim
    document.getElementById('btn-send').addEventListener('click', () => this.handleSend());

    // Tombol hentikan
    document.getElementById('btn-stop').addEventListener('click', () => Sender.stop());

    // ===== SETTINGS PAGE =====
    document.getElementById('btn-save-settings')?.addEventListener('click', () => this.handleSaveSettings());

    // Toggle API key visibility
    document.getElementById('toggle-api-key')?.addEventListener('click', () => {
      const input = document.getElementById('setting-api-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // ===== KELOLA FILE DIHAPUS =====

    // ===== USERS PAGE =====
    document.getElementById('new-expires-type')?.addEventListener('change', (e) => {
      document.getElementById('new-expires-custom-group').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
    
    document.getElementById('edit-expires-type')?.addEventListener('change', (e) => {
      document.getElementById('edit-expires-custom-group').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    document.getElementById('btn-open-add-user')?.addEventListener('click', () => {
      const modal = document.getElementById('modal-add-user');
      modal.style.display = 'flex';
      requestAnimationFrame(() => modal.classList.add('show'));
    });

    document.getElementById('btn-submit-add-user')?.addEventListener('click', () => this.handleAddUser());
    document.getElementById('btn-submit-edit-user')?.addEventListener('click', () => this.handleEditUser());

    // ===== LOGS PAGE =====
    document.getElementById('btn-refresh-logs')?.addEventListener('click', () => this.loadLogs());
    document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
      UI.showModal('Hapus Semua Log', 'Apakah Anda yakin ingin menghapus semua log pengiriman?', async () => {
        try {
          await API.clearLogs();
          UI.showToast('Semua log berhasil dihapus', 'success');
          await this.loadLogs();
        } catch (err) {
          UI.showToast('Gagal menghapus log', 'error');
        }
      });
    });

    document.getElementById('btn-export-logs')?.addEventListener('click', () => this.exportLogs());

    // Filter log
    document.getElementById('log-search')?.addEventListener('input', () => this.filterLogs());
    document.getElementById('log-status-filter')?.addEventListener('change', () => this.filterLogs());

    // ===== SCHEDULER PAGE =====
    // Removed

    // ===== MODAL CLOSE =====
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        if (modalId) UI.closeModal(modalId);
      });
    });

    // Tutup modal dengan klik overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          UI.closeModal(overlay.id);
        }
      });
    });
  },

  // ==================== HANDLER ====================

  /**
   * Handle login
   */
  async handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    if (!username || !password) {
      errorEl.textContent = 'Nama pengguna dan kata sandi wajib diisi';
      errorEl.style.display = 'block';
      return;
    }

    // Tampilkan loading
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loader').style.display = 'inline-flex';
    btn.disabled = true;

    const result = await Auth.login(username, password);

    // Reset tombol
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loader').style.display = 'none';
    btn.disabled = false;

    if (result.success) {
      UI.showToast(`Selamat datang, ${result.user.username}!`, 'success');
      this.showApp();
    } else {
      errorEl.textContent = result.message || 'Login gagal';
      errorEl.style.display = 'block';
    }
  },

  /**
   * Handle pengiriman pesan blast
   */
  async handleSend() {
    const targetText = document.getElementById('target-numbers').value;
    const message = document.getElementById('message-body').value;
    const messageType = document.getElementById('message-type').value;
    const fileUpload = document.getElementById('file-upload').files[0];

    // Validasi input
    const targets = Sender.parseTargets(targetText);
    if (targets.length === 0) {
      UI.showToast('Masukkan minimal satu nomor target', 'error');
      return;
    }

    if (!message.trim() && !fileUpload) {
      UI.showToast('Pesan atau lampiran tidak boleh kosong', 'error');
      return;
    }
    
    let fileBase64 = '';
    let fileMimeType = '';
    let fileName = '';
    
    if (fileUpload) {
      try {
        UI.showToast('Membaca lampiran...', 'info');
        // Convert file to Base64
        const readBase64 = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            // result is "data:image/png;base64,iVBORw0KGgo..."
            const result = reader.result;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = error => reject(error);
        });
        
        fileBase64 = await readBase64(fileUpload);
        fileMimeType = fileUpload.type;
        fileName = fileUpload.name;
      } catch (e) {
        UI.showToast('Gagal memproses file lampiran', 'error');
        return;
      }
    }

    // Kirim langsung
    const settings = {
      messageType,
      fileBase64,
      fileMimeType,
      fileName,
      delayMin: document.getElementById('delay-min').value,
      delayMax: document.getElementById('delay-max').value,
      breakAfterMin: document.getElementById('break-after-min').value,
      breakAfterMax: document.getElementById('break-after-max').value,
      breakDelayMin: document.getElementById('break-delay-min').value,
      breakDelayMax: document.getElementById('break-delay-max').value
    };

    await Sender.start(targets, message, settings);
  },

  /**
   * Muat pengaturan API
   */
  async loadSettings() {
    try {
      const result = await API.getSettings();
      if (result.success) {
        document.getElementById('setting-api-url').value = result.data?.httpRequest || '';
        document.getElementById('setting-api-key').value = result.data?.apiKey || '';
      }
    } catch (err) {
      UI.showToast('Gagal memuat pengaturan', 'error');
    }
  },

  /**
   * Simpan pengaturan API
   */
  async handleSaveSettings() {
    const httpRequest = document.getElementById('setting-api-url').value.trim();
    const apiKey = document.getElementById('setting-api-key').value.trim();

    if (!httpRequest || !apiKey) {
      UI.showToast('URL dan API Key wajib diisi', 'error');
      return;
    }

    try {
      const result = await API.updateSettings(httpRequest, apiKey);
      if (result.success) {
        UI.showToast('Pengaturan berhasil disimpan dan terenkripsi', 'success');
      } else {
        UI.showToast('Gagal menyimpan pengaturan: ' + (result.message || ''), 'error');
      }
    } catch (err) {
      UI.showToast('Gagal terhubung ke server', 'error');
    }
  },

  /**
  },

  /**
   * Muat daftar pengguna
   */
  async loadUsers() {
    try {
      const result = await API.getUsers();
      if (result.success) {
        this.renderUsers(result.data || []);
      }
    } catch (err) {
      UI.showToast('Gagal memuat daftar pengguna', 'error');
    }
  },

  /**
   * Render tabel pengguna
   */
  renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    const emptyState = document.getElementById('users-empty');
    const table = document.getElementById('users-table');

    if (!users || users.length === 0) {
      tbody.innerHTML = '';
      table.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    const currentUser = Auth.getUser();

    tbody.innerHTML = users.map(u => {
      const roleBadge = u.role === 'superadmin'
        ? UI.badge('Super Admin', 'success')
        : UI.badge('Admin', 'info');

      const isSelf = currentUser && currentUser.username === u.username;

      return `<tr>
        <td>${UI.escapeHtml(u.namaPengguna || u.username)} ${isSelf ? '<span class="text-muted">(Anda)</span>' : ''}</td>
        <td>${UI.escapeHtml(u.username)}</td>
        <td>${roleBadge}</td>
        <td>${!u.expiresAt || u.expiresAt === 'lifetime' ? 'Lifetime' : UI.formatDate(u.expiresAt)}</td>
        <td style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-small" onclick="App.showEditUser('${UI.escapeHtml(u.username)}', '${UI.escapeHtml(u.namaPengguna || '')}', '${u.role}', '${u.expiresAt || 'lifetime'}')">Edit</button>
          ${isSelf ? '' : `<button class="btn btn-danger btn-small" onclick="App.handleDeleteUser('${UI.escapeHtml(u.username)}')">Hapus</button>`}
        </td>
      </tr>`;
    }).join('');
  },

  /**
   * Handle tambah pengguna baru
   */
  async handleAddUser() {
    const namaPengguna = document.getElementById('new-nama').value.trim();
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    
    let expiresAt = document.getElementById('new-expires-type').value;
    if (expiresAt === 'custom') {
      const dateVal = document.getElementById('new-expires-date').value;
      if (!dateVal) {
        UI.showToast('Tanggal masa aktif harus diisi', 'error');
        return;
      }
      expiresAt = new Date(dateVal).toISOString();
    } else if (expiresAt === '1month') {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      expiresAt = d.toISOString();
    }

    if (!username || !password || !namaPengguna) {
      UI.showToast('Nama, Username, dan kata sandi wajib diisi', 'error');
      return;
    }

    if (password.length < 6) {
      UI.showToast('Kata sandi minimal 6 karakter', 'error');
      return;
    }

    try {
      const result = await API.addUser(namaPengguna, username, password, role, expiresAt);
      if (result.success) {
        UI.showToast('Pengguna berhasil ditambahkan', 'success');
        UI.closeModal('modal-add-user');
        document.getElementById('form-add-user').reset();
        await this.loadUsers();
      } else {
        UI.showToast('Gagal menambahkan pengguna: ' + (result.message || ''), 'error');
      }
    } catch (err) {
      UI.showToast('Gagal terhubung ke server', 'error');
    }
  },

  /**
   * Handle hapus pengguna
   */
  handleDeleteUser(username) {
    UI.showModal(
      'Hapus Pengguna',
      `Apakah Anda yakin ingin menghapus pengguna "${username}"?`,
      async () => {
        try {
          const result = await API.deleteUser(username);
          if (result.success) {
            UI.showToast('Pengguna berhasil dihapus', 'success');
            await this.loadUsers();
          } else {
            UI.showToast('Gagal menghapus: ' + (result.message || ''), 'error');
          }
        } catch (err) {
          UI.showToast('Gagal terhubung ke server', 'error');
        }
      }
    );
  },

  /**
   * Tampilkan form edit pengguna
   */
  showEditUser(username, nama, role, expiresAt) {
    document.getElementById('edit-current-username').value = username;
    document.getElementById('edit-nama').value = nama;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-role').value = role;
    document.getElementById('edit-password').value = '';
    
    const typeSelect = document.getElementById('edit-expires-type');
    const customGroup = document.getElementById('edit-expires-custom-group');
    const dateInput = document.getElementById('edit-expires-date');
    
    if (!expiresAt || expiresAt === 'lifetime') {
      typeSelect.value = 'lifetime';
      customGroup.style.display = 'none';
    } else {
      typeSelect.value = 'custom';
      customGroup.style.display = 'block';
      dateInput.value = expiresAt.split('T')[0];
    }
    
    const modal = document.getElementById('modal-edit-user');
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
  },

  /**
   * Handle edit pengguna
   */
  async handleEditUser() {
    const currentUsername = document.getElementById('edit-current-username').value;
    const namaPengguna = document.getElementById('edit-nama').value.trim();
    const username = document.getElementById('edit-username').value.trim();
    const password = document.getElementById('edit-password').value;
    const role = document.getElementById('edit-role').value;
    
    let expiresAt = document.getElementById('edit-expires-type').value;
    if (expiresAt === 'custom') {
      const dateVal = document.getElementById('edit-expires-date').value;
      if (!dateVal) {
        UI.showToast('Tanggal masa aktif harus diisi', 'error');
        return;
      }
      expiresAt = new Date(dateVal).toISOString();
    }

    if (!username || !namaPengguna) {
      UI.showToast('Nama dan Username wajib diisi', 'error');
      return;
    }

    const data = { namaPengguna, username, role, expiresAt };
    if (password) {
      if (password.length < 6) {
        UI.showToast('Kata sandi minimal 6 karakter', 'error');
        return;
      }
      data.password = password;
    }

    try {
      const result = await API.updateUser(currentUsername, data);
      if (result.success) {
        UI.showToast('Pengguna berhasil diperbarui', 'success');
        UI.closeModal('modal-edit-user');
        
        // Update session jika edit diri sendiri
        if (currentUsername === Auth.getUser()?.username) {
          Auth.currentUser.namaPengguna = namaPengguna;
          Auth.currentUser.username = username;
          document.getElementById('user-name').textContent = namaPengguna;
        }
        
        await this.loadUsers();
      } else {
        UI.showToast('Gagal memperbarui pengguna: ' + (result.error || ''), 'error');
      }
    } catch (err) {
      UI.showToast('Gagal terhubung ke server', 'error');
    }
  },

  // ==================== LOG ====================

  allLogs: [],

  /**
   * Muat log pengiriman
   */
  async loadLogs() {
    try {
      const result = await API.getLogs();
      if (result.success) {
        this.allLogs = result.data || [];
        this.renderLogs(this.allLogs);
      }
    } catch (err) {
      UI.showToast('Gagal memuat log', 'error');
    }
  },

  /**
   * Render tabel log
   */
  renderLogs(logs) {
    const tbody = document.getElementById('logs-tbody');
    const emptyState = document.getElementById('logs-empty');
    const table = document.getElementById('logs-table');

    if (!logs || logs.length === 0) {
      tbody.innerHTML = '';
      table.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    tbody.innerHTML = logs.map(log => {
      const statusBadge = log.status === 'success'
        ? UI.badge('Berhasil', 'success')
        : UI.badge('Gagal', 'error');

      return `<tr>
        <td class="mono">${UI.escapeHtml(log.to || '-')}</td>
        <td>${UI.escapeHtml(UI.truncate(log.message, 40))}</td>
        <td>${statusBadge}</td>
        <td>${UI.formatDate(log.sentAt)}</td>
        <td>${UI.escapeHtml(log.sentBy || '-')}</td>
      </tr>`;
    }).join('');
  },

  /**
   * Filter log berdasarkan pencarian dan status
   */
  filterLogs() {
    const search = (document.getElementById('log-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('log-status-filter')?.value || 'all';

    let filtered = this.allLogs;

    if (search) {
      filtered = filtered.filter(log =>
        (log.to || '').toLowerCase().includes(search) ||
        (log.message || '').toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter);
    }

    this.renderLogs(filtered);
  },

  /**
   * Export log ke CSV
   */
  exportLogs() {
    if (!this.allLogs || this.allLogs.length === 0) {
      UI.showToast('Tidak ada log untuk diekspor', 'warning');
      return;
    }

    const headers = ['Nomor', 'Pesan', 'Status', 'Response', 'Waktu', 'Pengirim'];
    const rows = this.allLogs.map(log => [
      log.to || '',
      (log.message || '').replace(/"/g, '""'),
      log.status || '',
      (log.response || '').replace(/"/g, '""'),
      log.sentAt || '',
      log.sentBy || ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Download CSV
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wasender-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    UI.showToast('Log berhasil diekspor ke CSV', 'success');
  }
};

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', () => App.init());
