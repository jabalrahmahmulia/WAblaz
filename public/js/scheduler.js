/**
 * Scheduler.js - Modul manajemen jadwal pengiriman
 * Mengelola tampilan, penambahan, pembatalan, dan penghapusan jadwal
 */
const Scheduler = {
  schedules: [],

  /**
   * Muat dan tampilkan daftar jadwal dari server
   */
  async loadSchedules() {
    try {
      const result = await API.getSchedules();
      if (result.success) {
        this.schedules = result.data || [];
        this.renderScheduleTable(this.schedules);
      } else {
        UI.showToast('Gagal memuat jadwal: ' + (result.message || ''), 'error');
      }
    } catch (err) {
      UI.showToast('Gagal terhubung ke server', 'error');
      console.error('Load schedules error:', err);
    }
  },

  /**
   * Tambah jadwal baru
   */
  async addSchedule(data) {
    try {
      const result = await API.addSchedule(data);
      if (result.success) {
        UI.showToast('Jadwal berhasil ditambahkan', 'success');
        await this.loadSchedules();
        return true;
      } else {
        UI.showToast('Gagal menambahkan jadwal: ' + (result.message || ''), 'error');
        return false;
      }
    } catch (err) {
      UI.showToast('Gagal terhubung ke server', 'error');
      return false;
    }
  },

  /**
   * Batalkan jadwal (ubah status ke cancelled)
   */
  async cancelSchedule(id) {
    try {
      const result = await API.updateSchedule(id, { status: 'cancelled' });
      if (result.success) {
        UI.showToast('Jadwal berhasil dibatalkan', 'success');
        await this.loadSchedules();
      } else {
        UI.showToast('Gagal membatalkan jadwal', 'error');
      }
    } catch (err) {
      UI.showToast('Gagal terhubung ke server', 'error');
    }
  },

  /**
   * Hapus jadwal
   */
  async deleteSchedule(id) {
    try {
      const result = await API.deleteSchedule(id);
      if (result.success) {
        UI.showToast('Jadwal berhasil dihapus', 'success');
        await this.loadSchedules();
      } else {
        UI.showToast('Gagal menghapus jadwal', 'error');
      }
    } catch (err) {
      UI.showToast('Gagal terhubung ke server', 'error');
    }
  },

  /**
   * Render tabel jadwal ke DOM
   */
  renderScheduleTable(schedules) {
    const tbody = document.getElementById('schedule-tbody');
    const emptyState = document.getElementById('schedule-empty');
    const table = document.getElementById('schedule-table');

    if (!schedules || schedules.length === 0) {
      tbody.innerHTML = '';
      table.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    // Map status ke badge
    const statusBadge = (status) => {
      const map = {
        pending: UI.badge('Menunggu', 'warning'),
        processing: UI.badge('Diproses', 'info'),
        completed: UI.badge('Selesai', 'success'),
        cancelled: UI.badge('Dibatalkan', 'neutral'),
        failed: UI.badge('Gagal', 'error')
      };
      return map[status] || UI.badge(status, 'neutral');
    };

    tbody.innerHTML = schedules.map(s => {
      // Hitung jumlah target
      let targetCount = 0;
      try {
        const targets = s.targets ? s.targets.split('\n').filter(t => t.trim()) : [];
        targetCount = targets.length;
      } catch { targetCount = 0; }

      const canCancel = s.status === 'pending';
      const canDelete = s.status !== 'processing';

      return `<tr>
        <td class="mono">${UI.escapeHtml(s.id || '-')}</td>
        <td>${targetCount} nomor</td>
        <td>${UI.escapeHtml(UI.truncate(s.message, 40))}</td>
        <td>${UI.formatDate(s.scheduledAt)}</td>
        <td>${statusBadge(s.status)}</td>
        <td>
          ${canCancel ? `<button class="btn btn-secondary btn-small" onclick="Scheduler.cancelSchedule('${s.id}')">Batalkan</button>` : ''}
          ${canDelete ? `<button class="btn btn-danger btn-small" onclick="Scheduler.confirmDelete('${s.id}')">Hapus</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  },

  /**
   * Konfirmasi penghapusan jadwal
   */
  confirmDelete(id) {
    UI.showModal(
      'Hapus Jadwal',
      'Apakah Anda yakin ingin menghapus jadwal ini?',
      () => this.deleteSchedule(id)
    );
  }
};
