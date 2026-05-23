/**
 * Sender.js - Modul pengirim pesan blast
 * Mengelola antrian pengiriman, delay, istirahat, dan progress tracking
 */
const Sender = {
  isRunning: false,
  shouldStop: false,
  queue: [],
  currentIndex: 0,
  stats: { total: 0, sent: 0, failed: 0 },

  /**
   * Parse nomor target dari textarea
   * Format: 62858xxx atau 62858xxx:Nama:Nilai1:Nilai2:Nilai3:Nilai4:Nilai5
   * @returns {Array<{number, name, values}>}
   */
  parseTargets(text) {
    if (!text || !text.trim()) return [];

    return text.trim().split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(':');
        return {
          number: parts[0].trim(),
          name: parts[1] || '',
          values: parts.slice(2).map(v => v.trim())
        };
      });
  },

  /**
   * Proses spintax dalam pesan
   * Contoh: {Halo|Hi|Hey} -> pilih salah satu secara acak
   */
  processSpintax(text) {
    if (!text) return '';
    return text.replace(/\{([^{}]+)\}/g, (match, content) => {
      // Hanya proses jika mengandung pipe (|) — itu spintax
      if (!content.includes('|')) return match;
      const options = content.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  },

  /**
   * Ganti parameter dalam pesan dengan nilai aktual
   * {P} = Nomor, {N} = Nama, {V1}-{V5} = Nilai, {R} = Kode Acak
   */
  replaceParams(message, target) {
    if (!message) return '';

    let result = message;
    result = result.replace(/\{P\}/gi, target.number || '');
    result = result.replace(/\{N\}/gi, target.name || '');
    result = result.replace(/\{R\}/gi, this.generateRandomCode());

    // Mengganti {V1}, {V2}, ... {V...}
    result = result.replace(/\{V(\d+)\}/gi, (match, p1) => {
      const index = parseInt(p1, 10) - 1;
      if (target.values && index >= 0 && index < target.values.length) {
        return target.values[index] || '';
      }
      return '';
    });

    return result;
  },

  /**
   * Generate kode acak (alfanumerik)
   */
  generateRandomCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Angka acak antara min dan max (inklusif)
   */
  randomBetween(min, max) {
    min = parseInt(min) || 1;
    max = parseInt(max) || min;
    if (min > max) [min, max] = [max, min];
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Fungsi sleep/delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Tambah log ke area progress
   */
  addProgressLog(number, status, message) {
    const logArea = document.getElementById('progress-log');
    if (!logArea) return;

    const time = new Date().toLocaleTimeString('id-ID');
    const statusIcon = status === 'success' ? '✅' : '❌';
    const statusClass = status === 'success' ? 'text-success' : 'text-error';

    const entry = document.createElement('div');
    entry.className = 'progress-log-entry';
    entry.innerHTML = `<span class="mono text-muted">[${time}]</span> ${statusIcon} <span class="${statusClass}">${UI.escapeHtml(number)}</span> — ${UI.escapeHtml(message)}`;

    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
  },

  /**
   * Mulai proses pengiriman blast
   */
  async start(targets, messageTemplate, settings) {
    if (this.isRunning) {
      UI.showToast('Pengiriman sedang berjalan', 'warning');
      return;
    }

    if (!targets || targets.length === 0) {
      UI.showToast('Tidak ada nomor target', 'error');
      return;
    }

    if (!messageTemplate.trim()) {
      UI.showToast('Pesan tidak boleh kosong', 'error');
      return;
    }

    // Reset state
    this.isRunning = true;
    this.shouldStop = false;
    this.queue = targets;
    this.currentIndex = 0;
    this.stats = { total: targets.length, sent: 0, failed: 0 };

    // Tampilkan progress section
    const progressSection = document.getElementById('progress-section');
    progressSection.style.display = 'block';
    document.getElementById('progress-log').innerHTML = '';
    UI.updateProgress(0, targets.length, 0, 0);

    // Toggle tombol
    document.getElementById('btn-send').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'flex';

    // Konfigurasi delay
    const {
      messageType = 'text',
      fileBase64 = '',
      fileMimeType = '',
      fileName = '',
      delayMin = 3,
      delayMax = 5,
      breakAfterMin = 10,
      breakAfterMax = 15,
      breakDelayMin = 4,
      breakDelayMax = 8
    } = settings;

    // Tentukan kapan istirahat
    let breakAfter = this.randomBetween(breakAfterMin, breakAfterMax);
    let messagesSinceBreak = 0;

    this.addProgressLog('SISTEM', 'success', `Memulai pengiriman ke ${targets.length} nomor...`);

    // Proses setiap target
    for (let i = 0; i < targets.length; i++) {
      if (this.shouldStop) {
        this.addProgressLog('SISTEM', 'failed', 'Pengiriman dihentikan oleh pengguna');
        break;
      }

      const target = targets[i];
      this.currentIndex = i;

      // Proses spintax dan parameter untuk setiap pesan (agar berbeda-beda)
      const processedMessage = this.replaceParams(
        this.processSpintax(messageTemplate),
        target
      );

      try {
        // Kirim pesan via API
        const payload = {
          to: target.number,
          body: processedMessage,
          messageType: messageType
        };

        // Tambahkan file jika ada
        if (fileBase64) {
          payload.fileBase64 = fileBase64;
          payload.fileMimeType = fileMimeType;
          payload.fileName = fileName;
        }

        const result = await API.sendMessage(payload);

        if (result.success) {
          this.stats.sent++;
          this.addProgressLog(target.number, 'success', 'Pesan terkirim');
        } else {
          this.stats.failed++;
          this.addProgressLog(target.number, 'failed', result.message || 'Gagal mengirim');
        }
      } catch (err) {
        this.stats.failed++;
        this.addProgressLog(target.number, 'failed', err.message || 'Error koneksi');
      }

      // Update progress
      UI.updateProgress(i + 1, targets.length, this.stats.sent, this.stats.failed);
      messagesSinceBreak++;

      // Jika belum selesai dan belum dihentikan, tambahkan delay
      if (i < targets.length - 1 && !this.shouldStop) {
        // Cek apakah perlu istirahat
        if (messagesSinceBreak >= breakAfter) {
          const breakDuration = this.randomBetween(breakDelayMin, breakDelayMax);
          this.addProgressLog('SISTEM', 'success', `Istirahat ${breakDuration} detik setelah ${messagesSinceBreak} pesan...`);
          await this.sleep(breakDuration * 1000);

          // Reset counter dan tentukan break berikutnya
          messagesSinceBreak = 0;
          breakAfter = this.randomBetween(breakAfterMin, breakAfterMax);
        } else {
          // Delay normal antar pesan
          const delay = this.randomBetween(delayMin, delayMax);
          this.addProgressLog('SISTEM', 'success', `Menunggu ${delay} detik...`);
          await this.sleep(delay * 1000);
        }
      }
    }

    // Selesai
    this.isRunning = false;
    document.getElementById('btn-send').style.display = 'flex';
    document.getElementById('btn-stop').style.display = 'none';

    const statusBadge = document.getElementById('progress-status');
    if (this.shouldStop) {
      statusBadge.textContent = 'Dihentikan';
      statusBadge.className = 'badge badge-warning';
      UI.showToast(`Pengiriman dihentikan. ${this.stats.sent} terkirim, ${this.stats.failed} gagal.`, 'warning');
    } else {
      statusBadge.textContent = 'Selesai';
      statusBadge.className = 'badge badge-success';
      UI.showToast(`Pengiriman selesai! ${this.stats.sent} terkirim, ${this.stats.failed} gagal.`, 'success');
    }

    this.addProgressLog('SISTEM', 'success', `Selesai — Terkirim: ${this.stats.sent}, Gagal: ${this.stats.failed}`);
  },

  /**
   * Hentikan pengiriman
   */
  stop() {
    this.shouldStop = true;
    UI.showToast('Menghentikan pengiriman...', 'warning');
  }
};
