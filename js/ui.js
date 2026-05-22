/**
 * UI.js - Modul komponen antarmuka pengguna
 * Mengelola toast, modal, progress, sidebar, dan utilitas tampilan
 */
const UI = {
  // Peta judul halaman dalam Bahasa Indonesia
  pageTitles: {
    blast: 'Kirim Pesan',
    scheduler: 'Jadwal Pengiriman',
    logs: 'Log Pengiriman',
    settings: 'Pengaturan',
    users: 'Kelola Pengguna'
  },

  /**
   * Tampilkan halaman tertentu dan sembunyikan yang lain
   */
  showPage(pageId) {
    // Sembunyikan semua section halaman di content area
    document.querySelectorAll('.content-area .page-section').forEach(s => {
      s.style.display = 'none';
      s.classList.remove('active');
    });

    // Tampilkan halaman target
    const target = document.getElementById('page-' + pageId);
    if (target) {
      target.style.display = 'block';
      // Trigger animasi fade-in
      requestAnimationFrame(() => target.classList.add('active'));
    }

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageId);
    });

    // Update judul header
    const title = this.pageTitles[pageId] || pageId;
    document.getElementById('page-title').textContent = title;
    document.getElementById('breadcrumb').textContent = `Dashboard › ${title}`;

    // Tutup sidebar di mobile setelah navigasi
    this.closeSidebar();
  },

  /**
   * Tampilkan notifikasi toast
   * @param {string} message - Pesan yang ditampilkan
   * @param {string} type - Jenis: success, error, warning, info
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    // Animasi masuk
    requestAnimationFrame(() => toast.classList.add('show'));

    // Hapus otomatis setelah 4 detik
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  },

  /**
   * Tampilkan modal konfirmasi
   */
  showModal(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('modal-confirm-title').textContent = title;
    document.getElementById('modal-confirm-message').textContent = message;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));

    // Handler konfirmasi
    const okBtn = document.getElementById('modal-confirm-ok');
    const cancelBtn = document.getElementById('modal-confirm-cancel');

    const cleanup = () => {
      this.closeModal('modal-confirm');
      okBtn.replaceWith(okBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };

    okBtn.onclick = () => {
      cleanup();
      if (onConfirm) onConfirm();
    };

    cancelBtn.onclick = () => {
      cleanup();
      if (onCancel) onCancel();
    };
  },

  /**
   * Tutup modal berdasarkan ID
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
  },

  /**
   * Tampilkan spinner loading di dalam elemen
   */
  showLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.dataset.originalContent = el.innerHTML;
      el.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
    }
  },

  /**
   * Sembunyikan loading dan kembalikan konten asli
   */
  hideLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el && el.dataset.originalContent) {
      el.innerHTML = el.dataset.originalContent;
      delete el.dataset.originalContent;
    }
  },

  /**
   * Update tampilan progress bar
   */
  updateProgress(current, total, successCount, failCount) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    const remaining = total - current;

    document.getElementById('progress-bar').style.width = percentage + '%';
    document.getElementById('progress-percentage').textContent = percentage + '%';
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-sent').textContent = successCount;
    document.getElementById('stat-failed').textContent = failCount;
    document.getElementById('stat-remaining').textContent = remaining;

    // Update status badge
    const statusBadge = document.getElementById('progress-status');
    if (current >= total) {
      statusBadge.textContent = 'Selesai';
      statusBadge.className = 'badge badge-success';
    } else {
      statusBadge.textContent = 'Mengirim...';
      statusBadge.className = 'badge badge-info';
    }
  },

  /**
   * Format tanggal ke format Indonesia
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  },

  /**
   * Toggle sidebar untuk mobile
   */
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
    document.body.classList.toggle('sidebar-open');
  },

  /**
   * Tutup sidebar
   */
  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('sidebar-open');
  },

  /**
   * Buat HTML badge status
   */
  badge(text, type = 'neutral') {
    return `<span class="badge badge-${type}">${text}</span>`;
  },

  /**
   * Potong teks yang terlalu panjang
   */
  truncate(text, maxLength = 50) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },

  /**
   * Escape HTML untuk mencegah XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
