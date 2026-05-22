# WAsender - WhatsApp Blast Sender

Aplikasi web profesional untuk mengirim pesan WhatsApp massal menggunakan [StarSender API](https://docs.starsender.online).

## ✨ Fitur

- 🔐 **Login Role-Based** — Admin & Super Admin dengan hak akses berbeda
- 📨 **Blast Pesan** — Kirim pesan ke banyak nomor sekaligus
- ⏰ **Penjadwalan** — Jadwalkan pengiriman di waktu tertentu
- 🔒 **Enkripsi AES-256** — API Key & URL terenkripsi aman
- 📊 **Log Pengiriman** — Riwayat lengkap dengan export CSV
- 🎯 **Anti-Blokir** — Delay acak & istirahat otomatis
- 🎨 **Spintax & Parameter** — Variasi pesan dinamis
- 📱 **Responsif** — Tampilan optimal di semua perangkat

## 🚀 Panduan Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/USERNAME/WAsender.git
cd WAsender
npm install
```

### 2. Setup Google Sheets Database

1. Buat **Google Sheet** baru di [sheets.google.com](https://sheets.google.com)
2. Buka menu **Extensions > Apps Script**
3. Hapus semua kode default, lalu copy-paste isi file `google-apps-script.js`
4. Klik **Run > setup** untuk membuat sheet & user default
5. Deploy sebagai Web App:
   - Klik **Deploy > New deployment**
   - Pilih **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy** dan copy URL-nya

### 3. Konfigurasi Environment

Copy file environment dan isi dengan nilai Anda:

```bash
copy .env.example .env
```

Edit file `.env`:

```env
PORT=3000
SESSION_SECRET=ganti-dengan-kunci-rahasia-acak-panjang
ENCRYPTION_KEY=ganti-dengan-32-karakter-acak!!!
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/XXXXXX/exec
DEFAULT_API_URL=https://api.starsender.online/api/send
DEFAULT_API_KEY=api-key-starsender-anda
```

### 4. Jalankan Server

```bash
npm start
```

Buka browser di `http://localhost:3000`

## 🔑 Login Default

| Username | Password | Role |
|---|---|---|
| `superadmin` | `superadmin123` | Super Admin |
| `admin` | `admin123` | Admin |

> ⚠️ **Segera ganti password default setelah login pertama!**

## 📖 Cara Penggunaan

### Mengirim Pesan Blast

1. Login ke aplikasi
2. Masukkan nomor target (satu per baris):
   ```
   6281234567890
   6289876543210:Budi:Nilai1:Nilai2
   ```
3. Tulis pesan (mendukung Spintax):
   ```
   {Halo|Hi|Hey} {N}, ini pesan untuk nomor {P}. Kode: {R}
   ```
4. Atur delay dan istirahat
5. Klik **Kirim Pesan**

### Parameter Pesan

| Parameter | Keterangan |
|---|---|
| `{P}` | Nomor telepon |
| `{N}` | Nama (dari data target) |
| `{V1}`-`{V5}` | Nilai tambahan |
| `{R}` | Kode acak 6 karakter |
| `{opsi1\|opsi2\|opsi3}` | Spintax (pilih acak) |

### Pengaturan Anti-Blokir

- **Delay Pesan**: Jeda acak antar pesan (detik)
- **Istirahat Setelah**: Jumlah pesan sebelum istirahat
- **Delay Istirahat**: Durasi istirahat panjang (detik)

## 🔒 Keamanan

- API Key & URL disimpan **terenkripsi AES-256-CBC** di Google Sheets
- Password di-hash dengan **SHA-256**
- API Key **tidak pernah terekspos** ke browser (proxy server-side)
- Session **HTTP-only cookie** dengan expiry 24 jam

## 🏗️ Arsitektur

```
Browser (SPA) → Node.js Express → StarSender API
                       ↕
              Google Apps Script → Google Sheets
```

## 📁 Struktur File

```
WAsender/
├── server.js              # Express backend
├── package.json           # Dependencies
├── .env.example           # Template environment
├── .gitignore             # Git ignore rules
├── google-apps-script.js  # Script untuk Google Sheets
├── README.md
└── public/
    ├── index.html         # Single Page Application
    ├── css/
    │   └── style.css      # Design system
    └── js/
        ├── app.js         # Controller utama
        ├── auth.js        # Autentikasi
        ├── api.js         # Komunikasi API
        ├── sender.js      # Blast sender
        ├── scheduler.js   # Penjadwalan
        └── ui.js          # Komponen UI
```

## 📝 Lisensi

MIT License
