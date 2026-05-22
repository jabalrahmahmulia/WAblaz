/**
 * ============================================================
 * WAsender - Server Backend (Express.js)
 * ============================================================
 * Server utama untuk aplikasi WAsender WhatsApp Blast.
 * Menangani autentikasi, enkripsi, proxy API, dan penjadwalan.
 * 
 * Teknologi: Express.js, Node.js 18+ (native fetch & crypto)
 * Database: Google Sheets via Google Apps Script
 * ============================================================
 */

// Muat konfigurasi environment dari file .env
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Setup Multer untuk upload file
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Hanya file .jpg, .jpeg, .png, dan .pdf yang diizinkan'));
  }
});

// ============================================================
// Konfigurasi dari environment variables
// ============================================================
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-this';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-key-change-this!';
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || '';
const DEFAULT_API_URL = process.env.DEFAULT_API_URL || 'https://api.starsender.online/api/send';
const DEFAULT_API_KEY = process.env.DEFAULT_API_KEY || '';

// ============================================================
// Middleware
// ============================================================

// Aktifkan CORS untuk semua origin (development)
app.use(cors({
  origin: true,
  credentials: true
}));

// Parser JSON untuk request body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Sajikan file statis dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi session untuk autentikasi
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set true jika menggunakan HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // Session berlaku 24 jam
  }
}));

// ============================================================
// Fungsi Enkripsi & Dekripsi (AES-256-CBC)
// ============================================================

/**
 * Mempersiapkan encryption key agar tepat 32 karakter.
 * Jika kurang dari 32, akan di-pad dengan karakter '0'.
 * @returns {Buffer} Key dalam format Buffer
 */
function getEncryptionKey() {
  let key = ENCRYPTION_KEY;
  // Pastikan key tepat 32 karakter untuk AES-256
  if (key.length < 32) {
    key = key.padEnd(32, '0');
  }
  return Buffer.from(key.slice(0, 32), 'utf-8');
}

/**
 * Mengenkripsi teks menggunakan AES-256-CBC.
 * @param {string} text - Teks yang akan dienkripsi
 * @returns {string} Teks terenkripsi dalam format "iv:encrypted" (hex)
 */
function encrypt(text) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // Initialization Vector acak 16 byte
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    
    // Gabungkan IV dan teks terenkripsi dengan pemisah ':'
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('❌ Gagal mengenkripsi:', error.message);
    throw new Error('Enkripsi gagal');
  }
}

/**
 * Mendekripsi teks yang dienkripsi dengan fungsi encrypt().
 * @param {string} text - Teks terenkripsi dalam format "iv:encrypted" (hex)
 * @returns {string} Teks asli yang sudah didekripsi
 */
function decrypt(text) {
  try {
    const key = getEncryptionKey();
    const parts = text.split(':');
    
    // Pastikan format valid (iv:encrypted)
    if (parts.length < 2) {
      throw new Error('Format enkripsi tidak valid');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts.slice(1).join(':'); // Handle jika encrypted text mengandung ':'
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Gagal mendekripsi:', error.message);
    throw new Error('Dekripsi gagal');
  }
}

/**
 * Membuat hash SHA-256 dari password.
 * @param {string} password - Password yang akan di-hash
 * @returns {string} Hash dalam format hexadecimal
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf-8').digest('hex');
}

// ============================================================
// Helper: Komunikasi dengan Google Apps Script
// ============================================================

/**
 * Mengirim request ke Google Apps Script.
 * - Operasi baca (get*): menggunakan GET dengan query params
 * - Operasi tulis (add*, set*, update*, delete*, clear*): menggunakan POST dengan JSON body
 * 
 * @param {string} action - Nama action yang akan dipanggil
 * @param {Object} data - Data tambahan untuk dikirim
 * @returns {Object} Response dari Google Apps Script
 */
async function callGoogleScript(action, data = {}) {
  try {
    if (!GOOGLE_SCRIPT_URL) {
      throw new Error('GOOGLE_SCRIPT_URL belum dikonfigurasi di file .env');
    }
    
    let response;
    
    // Tentukan metode berdasarkan jenis operasi
    const isWriteOperation = /^(add|set|update|delete|clear)/i.test(action);
    
    if (isWriteOperation) {
      // Operasi tulis: gunakan POST dengan JSON body
      response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...data }),
        redirect: 'follow' // Google Apps Script sering redirect
      });
    } else {
      // Operasi baca: gunakan GET dengan query parameters
      const params = new URLSearchParams({ action, ...data });
      const url = `${GOOGLE_SCRIPT_URL}?${params.toString()}`;
      
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });
    }
    
    // Parse response sebagai JSON
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error(`❌ Gagal memanggil Google Script (action: ${action}):`, error.message);
    return { success: false, error: `Gagal berkomunikasi dengan database: ${error.message}` };
  }
}

// ============================================================
// Cache Pengaturan (disimpan di memori selama 5 menit)
// ============================================================

let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_DURATION = 5 * 60 * 1000; // 5 menit dalam milidetik

/**
 * Mengambil pengaturan dengan mekanisme cache.
 * Cache akan diperbarui jika sudah lebih dari 5 menit.
 * @returns {Object} Pengaturan dari Google Script
 */
async function getCachedSettings() {
  const now = Date.now();
  
  // Gunakan cache jika masih valid
  if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_DURATION) {
    return settingsCache;
  }
  
  // Ambil pengaturan baru dari Google Script
  const result = await callGoogleScript('getSettings');
  
  if (result.success) {
    settingsCache = result.data;
    settingsCacheTime = now;
  }
  
  return result.success ? result.data : {};
}

/**
 * Menghapus cache pengaturan.
 * Dipanggil setelah pengaturan diperbarui.
 */
function clearSettingsCache() {
  settingsCache = null;
  settingsCacheTime = 0;
}

// ============================================================
// Middleware Autentikasi
// ============================================================

/**
 * Middleware: Memastikan user sudah login.
 * Jika belum login, kirim response 401 Unauthorized.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Anda harus login terlebih dahulu' });
}

/**
 * Middleware: Memastikan user adalah superadmin.
 * Memerlukan login terlebih dahulu (requireAuth).
 */
function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'superadmin') {
      return next();
    }
    return res.status(403).json({ success: false, error: 'Akses ditolak. Hanya superadmin yang diizinkan.' });
  }
  return res.status(401).json({ success: false, error: 'Anda harus login terlebih dahulu' });
}

// ============================================================
// Routes: Autentikasi
// ============================================================

/**
 * POST /auth/login
 * Proses login user dengan username dan password.
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validasi input
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username dan password diperlukan' });
    }
    
    // Hash password untuk perbandingan
    const hashedPassword = hashPassword(password);
    
    // Cari user di database
    const result = await callGoogleScript('getUserByUsername', { username });
    
    if (!result.success || !result.data) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }
    
    const user = result.data;
    
    // Bandingkan hash password
    if (user.passwordHash !== hashedPassword) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }
    
    // Cek expired
    if (user.expiresAt && user.expiresAt !== 'lifetime') {
      const expiredDate = new Date(user.expiresAt);
      if (expiredDate < new Date()) {
        return res.status(401).json({ success: false, error: 'Masa aktif akun telah habis' });
      }
    }
    
    // Simpan data user di session (tanpa password)
    req.session.user = {
      namaPengguna: user.namaPengguna || user.username,
      username: user.username,
      role: user.role
    };
    
    console.log(`✅ Login berhasil: ${username} (${user.role})`);
    
    return res.json({
      success: true,
      user: {
        username: user.username,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('❌ Error saat login:', error.message);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan server saat login' });
  }
});

/**
 * POST /auth/logout
 * Proses logout user dengan menghapus session.
 */
app.post('/auth/logout', (req, res) => {
  const username = req.session?.user?.username || 'Unknown';
  
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Error saat logout:', err.message);
      return res.status(500).json({ success: false, error: 'Gagal logout' });
    }
    
    console.log(`👋 Logout berhasil: ${username}`);
    return res.json({ success: true });
  });
});

/**
 * GET /auth/session
 * Mengecek status session user saat ini.
 */
app.get('/auth/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      loggedIn: true,
      user: req.session.user
    });
  }
  
  return res.json({ loggedIn: false });
});

// ============================================================
// Routes: Pengiriman Pesan (Send Message) & Upload
// ============================================================

/**
 * POST /api/upload
 * Endpoint untuk upload lampiran (media/dokumen).
 */
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Tidak ada file yang diunggah' });
    }
    // Dapatkan base URL
    const baseUrl = req.protocol + '://' + req.get('host');
    const fileUrl = baseUrl + '/uploads/' + req.file.filename;
    
    return res.json({ success: true, url: fileUrl });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal upload: ' + error.message });
  }
});

/**
 * POST /api/send
 * Mengirim pesan WhatsApp melalui StarSender API.
 * Memerlukan autentikasi.
 */
app.post('/api/send', requireAuth, async (req, res) => {
  try {
    const { to, body, messageType, file, delay, schedule } = req.body;
    
    // Validasi input minimal
    if (!to) {
      return res.status(400).json({ success: false, error: 'Nomor tujuan (to) diperlukan' });
    }
    
    // Ambil pengaturan API dari cache/database
    const settings = await getCachedSettings();
    
    if (!settings.apiUrl || !settings.apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Pengaturan API belum dikonfigurasi. Hubungi superadmin.'
      });
    }
    
    // Dekripsi URL dan API Key
    let apiUrl, apiKey;
    try {
      apiUrl = decrypt(settings.apiUrl);
      apiKey = decrypt(settings.apiKey);
    } catch (decryptError) {
      return res.status(500).json({
        success: false,
        error: 'Gagal mendekripsi pengaturan API. Konfigurasi mungkin rusak.'
      });
    }
    
    // Siapkan payload untuk StarSender API
    const payload = {
      messageType: messageType || 'text',
      to: to,
      body: body || ''
    };
    
    // Tambahkan file jika ada (untuk pesan media)
    if (file) {
      payload.file = file;
    }
    
    // Kirim request ke StarSender API
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      body: JSON.stringify(payload)
    });
    
    const apiResult = await apiResponse.json();
    
    let status = apiResponse.ok ? 'success' : 'failed';
    let responseStr = JSON.stringify(apiResult);
    
    // Cek apakah pesan error mengindikasikan bukan nomor WA
    if (!apiResponse.ok && apiResult && apiResult.message) {
      const msg = apiResult.message.toLowerCase();
      if (msg.includes('register') || msg.includes('not found') || msg.includes('invalid')) {
        apiResult.message = "Bukan nomor WhatsApp";
        responseStr = JSON.stringify(apiResult);
      }
    }
    
    // Catat log pengiriman ke database
    const logData = {
      to: to,
      message: (body || '').substring(0, 200), // Batasi panjang pesan di log
      status: status,
      response: responseStr.substring(0, 500),
      sentBy: req.session.user.username
    };
    
    // Simpan log secara asinkron (tidak perlu menunggu)
    callGoogleScript('addLog', logData).catch(err => {
      console.error('⚠️ Gagal menyimpan log:', err.message);
    });
    
    return res.json({
      success: apiResponse.ok,
      data: apiResult
    });
    
  } catch (error) {
    console.error('❌ Error saat mengirim pesan:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengirim pesan: ' + error.message });
  }
});

// ============================================================
// Routes: Pengaturan API (Settings)
// ============================================================

/**
 * GET /api/settings
 * Mengambil pengaturan API (hanya superadmin).
 * API URL dan Key didekripsi sebelum dikirim ke client.
 */
app.get('/api/settings', requireSuperAdmin, async (req, res) => {
  try {
    const settings = await getCachedSettings();
    
    let httpRequest = '';
    let apiKey = '';
    
    // Dekripsi nilai jika ada
    try {
      if (settings.apiUrl) httpRequest = decrypt(settings.apiUrl);
      if (settings.apiKey) apiKey = decrypt(settings.apiKey);
    } catch (decryptError) {
      console.error('⚠️ Gagal mendekripsi settings:', decryptError.message);
    }
    
    return res.json({
      success: true,
      data: {
        httpRequest: httpRequest,
        apiKey: apiKey
      }
    });
    
  } catch (error) {
    console.error('❌ Error mengambil settings:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengambil pengaturan' });
  }
});

/**
 * PUT /api/settings
 * Memperbarui pengaturan API (hanya superadmin).
 * API URL dan Key dienkripsi sebelum disimpan.
 */
app.put('/api/settings', requireSuperAdmin, async (req, res) => {
  try {
    const { httpRequest, apiKey } = req.body;
    
    if (!httpRequest || !apiKey) {
      return res.status(400).json({ success: false, error: 'httpRequest dan apiKey diperlukan' });
    }
    
    // Enkripsi sebelum menyimpan
    const encryptedUrl = encrypt(httpRequest);
    const encryptedKey = encrypt(apiKey);
    
    // Simpan ke Google Script
    const urlResult = await callGoogleScript('setSetting', { key: 'apiUrl', value: encryptedUrl });
    const keyResult = await callGoogleScript('setSetting', { key: 'apiKey', value: encryptedKey });
    
    if (!urlResult.success || !keyResult.success) {
      return res.status(500).json({ success: false, error: 'Gagal menyimpan pengaturan' });
    }
    
    // Hapus cache agar pengaturan baru langsung digunakan
    clearSettingsCache();
    
    console.log(`⚙️ Pengaturan API diperbarui oleh: ${req.session.user.username}`);
    
    return res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Error memperbarui settings:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui pengaturan' });
  }
});

// ============================================================
// Routes: Manajemen User
// ============================================================

/**
 * GET /api/users
 * Mengambil daftar semua user (hanya superadmin).
 * Field passwordHash dihapus dari response.
 */
app.get('/api/users', requireSuperAdmin, async (req, res) => {
  try {
    const result = await callGoogleScript('getUsers');
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    // Hapus field passwordHash dari setiap user untuk keamanan
    const users = (result.data || []).map(user => ({
      namaPengguna: user.namaPengguna || user.username,
      username: user.username,
      role: user.role,
      expiresAt: user.expiresAt || 'lifetime',
      createdAt: user.createdAt
    }));
    
    return res.json({ success: true, data: users });
    
  } catch (error) {
    console.error('❌ Error mengambil users:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengambil daftar user' });
  }
});

/**
 * POST /api/users
 * Menambahkan user baru (hanya superadmin).
 * Password di-hash sebelum disimpan.
 */
app.post('/api/users', requireSuperAdmin, async (req, res) => {
  try {
    const { namaPengguna, username, password, role, expiresAt } = req.body;
    
    // Validasi input
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, error: 'Username, password, dan role diperlukan' });
    }
    
    // Validasi role yang diizinkan
    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role harus admin atau superadmin' });
    }
    
    // Hash password sebelum disimpan
    const passwordHash = hashPassword(password);
    
    const result = await callGoogleScript('addUser', {
      namaPengguna,
      username,
      passwordHash,
      role,
      expiresAt
    });
    
    if (result.success) {
      console.log(`👤 User baru ditambahkan: ${username} (${role}) oleh ${req.session.user.username}`);
    }
    
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Error menambah user:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal menambahkan user' });
  }
});

/**
 * PUT /api/users/:username
 * Mengedit user (hanya superadmin).
 */
app.put('/api/users/:username', requireSuperAdmin, async (req, res) => {
  try {
    const currentUsername = req.params.username;
    const { namaPengguna, username, password, role, expiresAt } = req.body;
    
    const params = { currentUsername };
    if (namaPengguna) params.namaPengguna = namaPengguna;
    if (username) params.username = username;
    if (role) params.role = role;
    if (expiresAt) params.expiresAt = expiresAt;
    
    if (password) {
      params.passwordHash = hashPassword(password);
    }
    
    const result = await callGoogleScript('updateUser', params);
    
    if (result.success) {
      console.log(`👤 User diperbarui: ${currentUsername} oleh ${req.session.user.username}`);
    }
    
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Error edit user:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengedit user' });
  }
});

/**
 * DELETE /api/users/:username
 * Menghapus user berdasarkan username (hanya superadmin).
 * Tidak bisa menghapus diri sendiri atau superadmin terakhir.
 */
app.delete('/api/users/:username', requireSuperAdmin, async (req, res) => {
  try {
    const targetUsername = req.params.username;
    
    // Tidak boleh menghapus akun sendiri
    if (targetUsername === req.session.user.username) {
      return res.status(400).json({
        success: false,
        error: 'Anda tidak bisa menghapus akun sendiri'
      });
    }
    
    // Cek apakah target adalah superadmin terakhir
    const usersResult = await callGoogleScript('getUsers');
    if (usersResult.success) {
      const superadmins = (usersResult.data || []).filter(u => u.role === 'superadmin');
      const targetUser = (usersResult.data || []).find(u => u.username === targetUsername);
      
      if (targetUser && targetUser.role === 'superadmin' && superadmins.length <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Tidak bisa menghapus superadmin terakhir'
        });
      }
    }
    
    const result = await callGoogleScript('deleteUser', { username: targetUsername });
    
    if (result.success) {
      console.log(`🗑️ User dihapus: ${targetUsername} oleh ${req.session.user.username}`);
    }
    
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Error menghapus user:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal menghapus user' });
  }
});

// ============================================================
// Routes: Log Pengiriman
// ============================================================

/**
 * GET /api/logs
 * Mengambil log pengiriman pesan.
 */
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const result = await callGoogleScript('getLogs');
    return res.json(result);
  } catch (error) {
    console.error('❌ Error mengambil logs:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengambil log' });
  }
});

/**
 * POST /api/logs
 * Menambahkan entri log baru.
 */
app.post('/api/logs', requireAuth, async (req, res) => {
  try {
    const { to, message, status, response } = req.body;
    
    const result = await callGoogleScript('addLog', {
      to,
      message,
      status,
      response: typeof response === 'object' ? JSON.stringify(response) : response,
      sentBy: req.session.user.username
    });
    
    return res.json(result);
  } catch (error) {
    console.error('❌ Error menambah log:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal menambahkan log' });
  }
});

/**
 * DELETE /api/logs
 * Menghapus semua log pengiriman.
 */
app.delete('/api/logs', requireSuperAdmin, async (req, res) => {
  try {
    const result = await callGoogleScript('clearLogs');
    if (result.success) {
      console.log(`🗑️ Semua log dihapus oleh: ${req.session.user.username}`);
    }
    return res.json(result);
  } catch (error) {
    console.error('❌ Error menghapus logs:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal menghapus log' });
  }
});

// ============================================================
// Routes: Jadwal Pengiriman (Schedules)
// ============================================================

/**
 * GET /api/schedules
 * Mengambil semua jadwal pengiriman.
 */
app.get('/api/schedules', requireAuth, async (req, res) => {
  try {
    const result = await callGoogleScript('getSchedules');
    return res.json(result);
  } catch (error) {
    console.error('❌ Error mengambil schedules:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengambil jadwal' });
  }
});

/**
 * POST /api/schedules
 * Menambahkan jadwal pengiriman baru.
 */
app.post('/api/schedules', requireAuth, async (req, res) => {
  try {
    const {
      targets, message, fileUrl, scheduledAt,
      delayMin, delayMax, breakAfter, breakDelayMin, breakDelayMax
    } = req.body;
    
    if (!targets || !message || !scheduledAt) {
      return res.status(400).json({
        success: false,
        error: 'Targets, message, dan scheduledAt diperlukan'
      });
    }
    
    const result = await callGoogleScript('addSchedule', {
      targets: typeof targets === 'object' ? JSON.stringify(targets) : targets,
      message,
      fileUrl: fileUrl || '',
      scheduledAt,
      status: 'pending',
      createdBy: req.session.user.username,
      delayMin: delayMin || 1,
      delayMax: delayMax || 3,
      breakAfter: breakAfter || 10,
      breakDelayMin: breakDelayMin || 30,
      breakDelayMax: breakDelayMax || 60
    });
    
    if (result.success) {
      console.log(`📅 Jadwal baru ditambahkan oleh: ${req.session.user.username}`);
    }
    
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Error menambah schedule:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal menambahkan jadwal' });
  }
});

/**
 * PATCH /api/schedules/:id
 * Memperbarui status jadwal berdasarkan ID.
 */
app.patch('/api/schedules/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status diperlukan' });
    }
    
    const result = await callGoogleScript('updateScheduleStatus', { id, status });
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Error update schedule:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui jadwal' });
  }
});

/**
 * DELETE /api/schedules/:id
 * Menghapus jadwal berdasarkan ID.
 */
app.delete('/api/schedules/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await callGoogleScript('deleteSchedule', { id });
    
    if (result.success) {
      console.log(`🗑️ Jadwal dihapus: ${id} oleh ${req.session.user.username}`);
    }
    
    return res.json(result);
    
  } catch (error) {
    console.error('❌ Error menghapus schedule:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal menghapus jadwal' });
  }
});

// ============================================================
// Inisialisasi Pengaturan Default
// ============================================================

/**
 * Memeriksa dan menginisialisasi pengaturan API default
 * pada saat server pertama kali dijalankan.
 * Jika pengaturan belum ada, enkripsi dan simpan nilai default.
 */
async function initializeSettings() {
  try {
    console.log('🔧 Memeriksa pengaturan awal...');
    
    const result = await callGoogleScript('getSettings');
    
    if (result.success) {
      const settings = result.data || {};
      
      // Jika apiUrl belum ada, simpan nilai default (terenkripsi)
      if (!settings.apiUrl && DEFAULT_API_URL) {
        const encryptedUrl = encrypt(DEFAULT_API_URL);
        await callGoogleScript('setSetting', { key: 'apiUrl', value: encryptedUrl });
        console.log('✅ Default API URL berhasil disimpan (terenkripsi)');
      }
      
      // Jika apiKey belum ada, simpan nilai default (terenkripsi)
      if (!settings.apiKey && DEFAULT_API_KEY) {
        const encryptedKey = encrypt(DEFAULT_API_KEY);
        await callGoogleScript('setSetting', { key: 'apiKey', value: encryptedKey });
        console.log('✅ Default API Key berhasil disimpan (terenkripsi)');
      }
      
      if (settings.apiUrl && settings.apiKey) {
        console.log('✅ Pengaturan API sudah terkonfigurasi');
      }
    } else {
      console.log('⚠️ Tidak dapat memeriksa pengaturan. Pastikan GOOGLE_SCRIPT_URL sudah dikonfigurasi.');
    }
  } catch (error) {
    console.error('⚠️ Gagal inisialisasi pengaturan:', error.message);
    console.log('   Pastikan GOOGLE_SCRIPT_URL sudah benar di file .env');
  }
}

// ============================================================
// Schedule Checker: Pemeriksa Jadwal Otomatis
// ============================================================

/**
 * Fungsi utilitas untuk delay (pause) dalam milidetik.
 * @param {number} ms - Durasi delay dalam milidetik
 * @returns {Promise} Promise yang resolve setelah delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Menghasilkan delay acak antara min dan max detik.
 * @param {number} minSec - Delay minimum dalam detik
 * @param {number} maxSec - Delay maksimum dalam detik
 * @returns {number} Delay acak dalam milidetik
 */
function randomDelay(minSec, maxSec) {
  const min = Math.max(1, parseInt(minSec) || 1);
  const max = Math.max(min, parseInt(maxSec) || 3);
  return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

/**
 * Memproses jadwal pengiriman yang sudah waktunya.
 * Dijalankan setiap 30 detik oleh setInterval.
 * 
 * Alur kerja:
 * 1. Ambil semua jadwal dari database
 * 2. Filter jadwal yang pending dan waktunya sudah tiba
 * 3. Update status menjadi 'processing'
 * 4. Kirim pesan ke semua target dengan delay antar pesan
 * 5. Update status menjadi 'completed' atau 'failed'
 */
async function checkSchedules() {
  // Lewati jika Google Script URL belum dikonfigurasi
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'your-google-apps-script-web-app-url') return;
  
  try {
    const result = await callGoogleScript('getSchedules');
    
    if (!result.success || !result.data) return;
    
    const now = new Date();
    
    // Filter jadwal yang pending dan waktunya sudah tiba
    const pendingSchedules = result.data.filter(schedule => {
      if (schedule.status !== 'pending') return false;
      const scheduledTime = new Date(schedule.scheduledAt);
      return scheduledTime <= now;
    });
    
    // Proses setiap jadwal yang memenuhi syarat
    for (const schedule of pendingSchedules) {
      console.log(`⏰ Memproses jadwal: ${schedule.id}`);
      
      // Update status menjadi 'processing'
      await callGoogleScript('updateScheduleStatus', {
        id: schedule.id,
        status: 'processing'
      });
      
      try {
        // Parse daftar target (bisa berupa JSON string atau string biasa)
        let targets = [];
        try {
          targets = JSON.parse(schedule.targets);
        } catch {
          // Jika bukan JSON, anggap sebagai daftar yang dipisahkan koma
          targets = schedule.targets.split(',').map(t => t.trim()).filter(Boolean);
        }
        
        if (!Array.isArray(targets)) targets = [targets];
        
        // Ambil pengaturan API
        const settings = await getCachedSettings();
        let apiUrl, apiKey;
        
        try {
          apiUrl = decrypt(settings.apiUrl);
          apiKey = decrypt(settings.apiKey);
        } catch {
          throw new Error('Gagal mendekripsi pengaturan API');
        }
        
        // Konfigurasi delay dari jadwal
        const delayMin = parseInt(schedule.delayMin) || 1;
        const delayMax = parseInt(schedule.delayMax) || 3;
        const breakAfter = parseInt(schedule.breakAfter) || 10;
        const breakDelayMin = parseInt(schedule.breakDelayMin) || 30;
        const breakDelayMax = parseInt(schedule.breakDelayMax) || 60;
        
        let successCount = 0;
        let failCount = 0;
        
        // Kirim pesan ke setiap target
        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          
          try {
            // Siapkan payload
            const payload = {
              messageType: schedule.fileUrl ? 'image' : 'text',
              to: target,
              body: schedule.message || ''
            };
            
            if (schedule.fileUrl) {
              payload.file = schedule.fileUrl;
            }
            
            // Kirim request ke StarSender API
            const apiResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey
              },
              body: JSON.stringify(payload)
            });
            
            const apiResult = await apiResponse.json();
            
            // Catat log pengiriman
            await callGoogleScript('addLog', {
              to: target,
              message: (schedule.message || '').substring(0, 200),
              status: apiResponse.ok ? 'success' : 'failed',
              response: JSON.stringify(apiResult).substring(0, 500),
              sentBy: schedule.createdBy || 'scheduler'
            });
            
            if (apiResponse.ok) {
              successCount++;
            } else {
              failCount++;
            }
            
          } catch (sendError) {
            console.error(`❌ Gagal kirim ke ${target}:`, sendError.message);
            failCount++;
            
            // Log error
            await callGoogleScript('addLog', {
              to: target,
              message: (schedule.message || '').substring(0, 200),
              status: 'failed',
              response: sendError.message,
              sentBy: schedule.createdBy || 'scheduler'
            });
          }
          
          // Delay antar pesan untuk menghindari blocking
          if (i < targets.length - 1) {
            // Jeda istirahat setelah sejumlah pesan tertentu
            if ((i + 1) % breakAfter === 0) {
              const breakDelay = randomDelay(breakDelayMin, breakDelayMax);
              console.log(`☕ Istirahat ${Math.round(breakDelay / 1000)} detik setelah ${i + 1} pesan...`);
              await sleep(breakDelay);
            } else {
              // Delay normal antar pesan
              const normalDelay = randomDelay(delayMin, delayMax);
              await sleep(normalDelay);
            }
          }
        }
        
        // Update status akhir
        const finalStatus = failCount === 0 ? 'completed' : (successCount === 0 ? 'failed' : 'partial');
        await callGoogleScript('updateScheduleStatus', {
          id: schedule.id,
          status: finalStatus
        });
        
        console.log(`✅ Jadwal ${schedule.id} selesai: ${successCount} berhasil, ${failCount} gagal (status: ${finalStatus})`);
        
      } catch (processError) {
        console.error(`❌ Gagal memproses jadwal ${schedule.id}:`, processError.message);
        
        // Update status menjadi failed
        await callGoogleScript('updateScheduleStatus', {
          id: schedule.id,
          status: 'failed'
        });
      }
    }
    
  } catch (error) {
    // Jangan log error jika Google Script URL belum dikonfigurasi
    if (GOOGLE_SCRIPT_URL) {
      console.error('⚠️ Error pada schedule checker:', error.message);
    }
  }
}

// ============================================================
// Jalankan Server
// ============================================================

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║                                              ║');
  console.log('║     🚀 WAsender Server Berjalan!             ║');
  console.log('║                                              ║');
  console.log(`║     📡 Port    : ${PORT}                          ║`);
  console.log(`║     🌐 URL     : http://localhost:${PORT}         ║`);
  console.log('║     📁 Static  : ./public                    ║');
  console.log('║                                              ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  
  // Inisialisasi pengaturan default saat server dimulai
  if (GOOGLE_SCRIPT_URL) {
    initializeSettings();
  } else {
    console.log('⚠️  GOOGLE_SCRIPT_URL belum dikonfigurasi.');
    console.log('   Silakan atur di file .env untuk menghubungkan ke database.');
  }
  
  // Jalankan schedule checker setiap 30 detik
  setInterval(checkSchedules, 30 * 1000);
  console.log('⏰ Schedule checker aktif (interval: 30 detik)');
});
