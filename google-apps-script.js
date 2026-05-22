/**
 * ============================================================
 * WAsender - Google Apps Script Backend
 * ============================================================
 * Script ini berfungsi sebagai backend database menggunakan
 * Google Sheets. Salin script ini ke Google Apps Script Editor
 * pada spreadsheet Anda, lalu deploy sebagai Web App.
 * 
 * Sheet yang digunakan:
 * - Users     : Manajemen pengguna (username, password, role)
 * - Settings  : Konfigurasi aplikasi (API URL, API Key, dll)
 * - Logs      : Catatan pengiriman pesan
 * - Schedules : Jadwal pengiriman pesan terjadwal
 * ============================================================
 */

// ============================================================
// Konfigurasi nama sheet dan header kolom
// ============================================================
var SHEET_CONFIG = {
  Users: {
    name: 'Users',
    headers: ['namaPengguna', 'username', 'passwordHash', 'role', 'expiresAt', 'createdAt']
  },
  Settings: {
    name: 'Settings',
    headers: ['key', 'value']
  },
  Logs: {
    name: 'Logs',
    headers: ['id', 'to', 'message', 'status', 'response', 'sentAt', 'sentBy']
  },
  Schedules: {
    name: 'Schedules',
    headers: ['id', 'targets', 'message', 'fileUrl', 'scheduledAt', 'status', 'createdBy', 'delayMin', 'delayMax', 'breakAfter', 'breakDelayMin', 'breakDelayMax', 'createdAt']
  }
};

// ============================================================
// Fungsi utilitas untuk mendapatkan atau membuat sheet
// ============================================================

/**
 * Mendapatkan sheet berdasarkan nama. Jika belum ada, buat sheet baru
 * dengan header yang sesuai.
 * @param {string} sheetName - Nama sheet yang dicari
 * @returns {Sheet} Google Sheet object
 */
function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  // Jika sheet belum ada, buat baru dan tambahkan header
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var config = SHEET_CONFIG[sheetName];
    if (config && config.headers) {
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      // Format header: bold dan background warna
      sheet.getRange(1, 1, 1, config.headers.length)
        .setFontWeight('bold')
        .setBackground('#4a86c8')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  }
  
  return sheet;
}

/**
 * Mengambil semua data dari sheet sebagai array of objects.
 * Setiap baris dikonversi menjadi object dengan key dari header.
 * @param {string} sheetName - Nama sheet
 * @returns {Array} Array of row objects
 */
function getSheetData(sheetName) {
  var sheet = getOrCreateSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  
  // Jika hanya ada header atau sheet kosong, kembalikan array kosong
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var rows = [];
  
  // Konversi setiap baris menjadi object
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  
  return rows;
}

/**
 * Membuat hash SHA-256 dari sebuah string.
 * Digunakan untuk hashing password.
 * @param {string} input - String yang akan di-hash
 * @returns {string} Hash dalam format hexadecimal
 */
function sha256(input) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  var hash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var byte = rawHash[i];
    if (byte < 0) byte += 256;
    var hex = byte.toString(16);
    if (hex.length === 1) hex = '0' + hex;
    hash += hex;
  }
  return hash;
}

/**
 * Membuat response JSON standar.
 * @param {Object} result - Object yang akan dikembalikan sebagai JSON
 * @returns {TextOutput} ContentService text output
 */
function jsonResponse(result) {
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Handler utama: doGet dan doPost
// ============================================================

/**
 * Handler untuk request GET.
 * Digunakan untuk operasi baca (get*).
 * @param {Object} e - Event object dari Google Apps Script
 */
function doGet(e) {
  try {
    var action = e.parameter.action;
    
    if (!action) {
      return jsonResponse({ success: false, error: 'Parameter "action" diperlukan' });
    }
    
    var result = routeAction(action, e.parameter);
    return jsonResponse(result);
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

/**
 * Handler untuk request POST.
 * Digunakan untuk operasi tulis (add*, set*, update*, delete*, clear*).
 * @param {Object} e - Event object dari Google Apps Script
 */
function doPost(e) {
  try {
    var data = {};
    
    // Parse body JSON dari request POST
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    
    var action = data.action;
    
    if (!action) {
      return jsonResponse({ success: false, error: 'Parameter "action" diperlukan' });
    }
    
    var result = routeAction(action, data);
    return jsonResponse(result);
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

/**
 * Router untuk mengarahkan action ke fungsi yang sesuai.
 * @param {string} action - Nama action yang diminta
 * @param {Object} params - Parameter/data dari request
 * @returns {Object} Hasil operasi
 */
function routeAction(action, params) {
  switch (action) {
    // ---- Users ----
    case 'getUsers':
      return getUsers();
    case 'addUser':
      return addUser(params);
    case 'updateUser':
      return updateUser(params);
    case 'deleteUser':
      return deleteUser(params);
    case 'getUserByUsername':
      return getUserByUsername(params);
    
    // ---- Settings ----
    case 'getSettings':
      return getSettings();
    case 'setSetting':
      return setSetting(params);
    
    // ---- Logs ----
    case 'getLogs':
      return getLogs();
    case 'addLog':
      return addLog(params);
    case 'clearLogs':
      return clearLogs();
    
    // ---- Schedules ----
    case 'getSchedules':
      return getSchedules();
    case 'addSchedule':
      return addSchedule(params);
    case 'updateScheduleStatus':
      return updateScheduleStatus(params);
    case 'deleteSchedule':
      return deleteSchedule(params);
    
    default:
      return { success: false, error: 'Action "' + action + '" tidak dikenali' };
  }
}

// ============================================================
// CRUD: Users
// Sheet: Users (A=namaPengguna, B=username, C=passwordHash, D=role, E=expiresAt, F=createdAt)
// ============================================================

/**
 * Mengambil semua data user.
 * @returns {Object} { success: true, data: [...] }
 */
function getUsers() {
  var data = getSheetData('Users');
  return { success: true, data: data };
}

/**
 * Menambahkan user baru.
 * @param {Object} params - { namaPengguna, username, passwordHash, role, expiresAt }
 * @returns {Object} Hasil operasi
 */
function addUser(params) {
  var sheet = getOrCreateSheet('Users');
  
  // Validasi parameter wajib
  if (!params.username || !params.passwordHash || !params.role) {
    return { success: false, error: 'Parameter username, passwordHash, dan role diperlukan' };
  }
  
  // Cek apakah username sudah ada
  var existing = getSheetData('Users');
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].username === params.username) {
      return { success: false, error: 'Username "' + params.username + '" sudah digunakan' };
    }
  }
  
  // Tambahkan baris baru
  var createdAt = new Date().toISOString();
  var namaPengguna = params.namaPengguna || params.username;
  var expiresAt = params.expiresAt || 'lifetime';
  
  sheet.appendRow([namaPengguna, params.username, params.passwordHash, params.role, expiresAt, createdAt]);
  
  return { success: true, data: { username: params.username, role: params.role, createdAt: createdAt } };
}

/**
 * Mengupdate user.
 * @param {Object} params - { currentUsername, namaPengguna, username, passwordHash, role, expiresAt }
 * @returns {Object} Hasil operasi
 */
function updateUser(params) {
  var sheet = getOrCreateSheet('Users');
  
  if (!params.currentUsername) {
    return { success: false, error: 'Parameter currentUsername diperlukan' };
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var usernameIdx = headers.indexOf('username');
  
  // Jika ganti username, cek duplikat
  if (params.username && params.username !== params.currentUsername) {
    for (var j = 1; j < data.length; j++) {
      if (data[j][usernameIdx] === params.username) {
        return { success: false, error: 'Username "' + params.username + '" sudah digunakan' };
      }
    }
  }
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][usernameIdx] === params.currentUsername) {
      if (params.namaPengguna) sheet.getRange(i + 1, headers.indexOf('namaPengguna') + 1).setValue(params.namaPengguna);
      if (params.username) sheet.getRange(i + 1, usernameIdx + 1).setValue(params.username);
      if (params.passwordHash) sheet.getRange(i + 1, headers.indexOf('passwordHash') + 1).setValue(params.passwordHash);
      if (params.role) sheet.getRange(i + 1, headers.indexOf('role') + 1).setValue(params.role);
      if (params.expiresAt) sheet.getRange(i + 1, headers.indexOf('expiresAt') + 1).setValue(params.expiresAt);
      
      return { success: true, data: { updated: params.username || params.currentUsername } };
    }
  }
  
  return { success: false, error: 'User tidak ditemukan' };
}

/**
 * Menghapus user berdasarkan username.
 * @param {Object} params - { username }
 * @returns {Object} Hasil operasi
 */
function deleteUser(params) {
  var sheet = getOrCreateSheet('Users');
  
  if (!params.username) {
    return { success: false, error: 'Parameter username diperlukan' };
  }
  
  var data = sheet.getDataRange().getValues();
  
  // Cari baris yang sesuai (mulai dari baris 2 karena baris 1 adalah header)
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === params.username) {
      sheet.deleteRow(i + 1); // +1 karena index sheet dimulai dari 1
      return { success: true, data: { deleted: params.username } };
    }
  }
  
  return { success: false, error: 'User "' + params.username + '" tidak ditemukan' };
}

/**
 * Mencari user berdasarkan username.
 * @param {Object} params - { username }
 * @returns {Object} Data user jika ditemukan
 */
function getUserByUsername(params) {
  if (!params.username) {
    return { success: false, error: 'Parameter username diperlukan' };
  }
  
  var users = getSheetData('Users');
  
  for (var i = 0; i < users.length; i++) {
    if (users[i].username === params.username) {
      return { success: true, data: users[i] };
    }
  }
  
  return { success: false, error: 'User "' + params.username + '" tidak ditemukan' };
}

// ============================================================
// CRUD: Settings
// Sheet: Settings (A=key, B=value)
// ============================================================

/**
 * Mengambil semua pengaturan sebagai key-value pairs.
 * @returns {Object} { success: true, data: { key1: value1, ... } }
 */
function getSettings() {
  var data = getSheetData('Settings');
  var settings = {};
  
  for (var i = 0; i < data.length; i++) {
    settings[data[i].key] = data[i].value;
  }
  
  return { success: true, data: settings };
}

/**
 * Menyimpan atau mengubah pengaturan berdasarkan key.
 * Jika key sudah ada, value akan diperbarui.
 * Jika key belum ada, baris baru akan ditambahkan.
 * @param {Object} params - { key, value }
 * @returns {Object} Hasil operasi
 */
function setSetting(params) {
  var sheet = getOrCreateSheet('Settings');
  
  if (!params.key) {
    return { success: false, error: 'Parameter key diperlukan' };
  }
  
  var data = sheet.getDataRange().getValues();
  
  // Cari key yang sudah ada dan update nilainya
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === params.key) {
      sheet.getRange(i + 1, 2).setValue(params.value || '');
      return { success: true, data: { key: params.key, value: params.value } };
    }
  }
  
  // Jika key belum ada, tambahkan baris baru
  sheet.appendRow([params.key, params.value || '']);
  return { success: true, data: { key: params.key, value: params.value } };
}

// ============================================================
// CRUD: Logs
// Sheet: Logs (A=id, B=to, C=message, D=status, E=response, F=sentAt, G=sentBy)
// ============================================================

/**
 * Mengambil semua log pengiriman (terbaru duluan, maks 500).
 * @returns {Object} { success: true, data: [...] }
 */
function getLogs() {
  var data = getSheetData('Logs');
  
  // Urutkan dari yang terbaru (berdasarkan sentAt)
  data.sort(function(a, b) {
    return new Date(b.sentAt) - new Date(a.sentAt);
  });
  
  // Batasi maksimal 500 log
  if (data.length > 500) {
    data = data.slice(0, 500);
  }
  
  return { success: true, data: data };
}

/**
 * Menambahkan catatan log baru.
 * @param {Object} params - { to, message, status, response, sentBy }
 * @returns {Object} Hasil operasi
 */
function addLog(params) {
  var sheet = getOrCreateSheet('Logs');
  
  // Buat ID unik berdasarkan timestamp
  var id = 'LOG_' + new Date().getTime();
  var sentAt = new Date().toISOString();
  
  sheet.appendRow([
    id,
    params.to || '',
    params.message || '',
    params.status || '',
    params.response || '',
    sentAt,
    params.sentBy || ''
  ]);
  
  return { success: true, data: { id: id, sentAt: sentAt } };
}

/**
 * Menghapus semua log (hanya menyisakan header).
 * @returns {Object} Hasil operasi
 */
function clearLogs() {
  var sheet = getOrCreateSheet('Logs');
  var lastRow = sheet.getLastRow();
  
  // Hapus semua baris kecuali header
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  return { success: true, data: { message: 'Semua log berhasil dihapus' } };
}

// ============================================================
// CRUD: Schedules
// Sheet: Schedules (A=id, B=targets, C=message, D=fileUrl, E=scheduledAt,
//        F=status, G=createdBy, H=delayMin, I=delayMax, J=breakAfter,
//        K=breakDelayMin, L=breakDelayMax, M=createdAt)
// ============================================================

/**
 * Mengambil semua jadwal pengiriman.
 * @returns {Object} { success: true, data: [...] }
 */
function getSchedules() {
  var data = getSheetData('Schedules');
  return { success: true, data: data };
}

/**
 * Menambahkan jadwal pengiriman baru.
 * @param {Object} params - Data jadwal
 * @returns {Object} Hasil operasi
 */
function addSchedule(params) {
  var sheet = getOrCreateSheet('Schedules');
  
  // Buat ID unik berdasarkan timestamp
  var id = 'SCH_' + new Date().getTime();
  var createdAt = new Date().toISOString();
  
  sheet.appendRow([
    id,
    params.targets || '',
    params.message || '',
    params.fileUrl || '',
    params.scheduledAt || '',
    params.status || 'pending',
    params.createdBy || '',
    params.delayMin || 1,
    params.delayMax || 3,
    params.breakAfter || 10,
    params.breakDelayMin || 30,
    params.breakDelayMax || 60,
    createdAt
  ]);
  
  return { success: true, data: { id: id, createdAt: createdAt } };
}

/**
 * Memperbarui status jadwal berdasarkan ID.
 * @param {Object} params - { id, status }
 * @returns {Object} Hasil operasi
 */
function updateScheduleStatus(params) {
  var sheet = getOrCreateSheet('Schedules');
  
  if (!params.id || !params.status) {
    return { success: false, error: 'Parameter id dan status diperlukan' };
  }
  
  var data = sheet.getDataRange().getValues();
  
  // Cari baris dengan ID yang sesuai
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === params.id) {
      sheet.getRange(i + 1, 6).setValue(params.status); // Kolom F = status
      return { success: true, data: { id: params.id, status: params.status } };
    }
  }
  
  return { success: false, error: 'Jadwal dengan ID "' + params.id + '" tidak ditemukan' };
}

/**
 * Menghapus jadwal berdasarkan ID.
 * @param {Object} params - { id }
 * @returns {Object} Hasil operasi
 */
function deleteSchedule(params) {
  var sheet = getOrCreateSheet('Schedules');
  
  if (!params.id) {
    return { success: false, error: 'Parameter id diperlukan' };
  }
  
  var data = sheet.getDataRange().getValues();
  
  // Cari baris dengan ID yang sesuai
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === params.id) {
      sheet.deleteRow(i + 1);
      return { success: true, data: { deleted: params.id } };
    }
  }
  
  return { success: false, error: 'Jadwal dengan ID "' + params.id + '" tidak ditemukan' };
}

// ============================================================
// Fungsi Setup: Inisialisasi awal spreadsheet
// ============================================================

/**
 * Fungsi setup untuk inisialisasi spreadsheet.
 * Membuat semua sheet yang dibutuhkan beserta header dan
 * menambahkan user default (superadmin dan admin).
 * 
 * Jalankan fungsi ini SEKALI setelah membuat spreadsheet baru.
 */
function setup() {
  // Buat semua sheet yang diperlukan
  var sheetNames = ['Users', 'Settings', 'Logs', 'Schedules'];
  for (var i = 0; i < sheetNames.length; i++) {
    getOrCreateSheet(sheetNames[i]);
  }
  
  // Hash password default menggunakan SHA-256
  var superadminHash = sha256('superadmin123');
  var adminHash = sha256('admin123');
  
  var sheet = getOrCreateSheet('Users');
  var now = new Date().toISOString();
  
  // Cek apakah sudah ada data user
  var existingUsers = getSheetData('Users');
  if (existingUsers.length === 0) {
    // Tambahkan user default: superadmin
    sheet.appendRow(['Super Admin', 'superadmin', superadminHash, 'superadmin', 'lifetime', now]);
    // Tambahkan user default: admin
    sheet.appendRow(['Admin', 'admin', adminHash, 'admin', 'lifetime', now]);
    
    Logger.log('✅ User default berhasil ditambahkan:');
    Logger.log('   - superadmin / superadmin123 (role: superadmin)');
    Logger.log('   - admin / admin123 (role: admin)');
  } else {
    Logger.log('ℹ️ User sudah ada, tidak menambahkan user default.');
  }
  
  Logger.log('✅ Setup selesai! Semua sheet telah dibuat.');
  Logger.log('📋 Sheet yang tersedia: ' + sheetNames.join(', '));
}
