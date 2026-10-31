# Naskah Demo (sekitar 7–8 menit)

## Persiapan sebelum merekam

1. Pastikan `.env` berisi secret lokal dan port default `3000`, `3001`, `3002`.
2. Jalankan `npm run init-db`, lalu `npm run dev`. Seed tidak mereset data yang sudah ada. Jika kelas IF101 sudah pernah difinalisasi dan perlu demo ulang, gunakan database demo baru dengan mengubah `DB_PATH` di `.env` ke `./data/demo-zero-trust.sqlite`, jalankan seed, lalu restart aplikasi. Ini menjaga database lokal yang lama.
3. Gunakan Postman atau PowerShell. Jangan tampilkan secret di `.env` atau menyalin nilai token ke rekaman lebih lama dari yang dibutuhkan.

## 0:00–0:45 — Tujuan dan arsitektur

Tampilkan struktur folder dan README. Jelaskan Gateway pada port 3000 sebagai PEP, Policy Engine sebagai PE/PA, Service Nilai pada port 3001, Service Transkrip pada port 3002, serta database SQLite bersama. Sebutkan bahwa UI tidak diwajibkan tugas; pengujian memakai API. Tekankan service memverifikasi gateway secret dan JWT.

## 0:45–1:25 — Startup dan seed

Tunjukkan tiga proses yang berjalan dari `npm run dev` dan `GET http://localhost:3000/health`. Sebutkan isi seed: satu admin, dua dosen, tiga mahasiswa, dua kelas yang dosen pengampunya berbeda, dan satu device per user. Password tersimpan sebagai hash.

## 1:25–2:20 — Login, device, dan masa token

Login `mhs1` dengan `X-Device-ID: device-mhs-001` melalui `POST /auth/login`. Tunjukkan token access dan refresh di respons tanpa membacakan nilainya. Tunjukkan `ACCESS_TOKEN_TTL=10m`, `REFRESH_TOKEN_TTL_SECONDS=86400`, dan `SERVICE_TOKEN_TTL=5m` dari `.env.example`. Coba login dengan device salah dan tunjukkan 403. Di `backend/src/gateway/server.js`, sorot verifikasi bcrypt, pemeriksaan device, dan penyimpanan hash refresh token.

## 2:20–3:15 — Least privilege mahasiswa dan admin

Dengan token mhs1 dan `device-mhs-001`, kirim `GET /nilai` serta `GET /transkrip/227006001`; keduanya berhasil dan hanya menampilkan data milik mhs1. Coba `GET /transkrip/227006002`; hasilnya 403. Lalu login sebagai `admin` dengan `device-admin-001` dan tunjukkan `GET /transkrip/227006002` berhasil. Jelaskan policy membaca NIM target dari database.

## 3:15–4:25 — Dosen, kepemilikan kelas, dan jam akses

Login `dosen1` dengan `device-dosen-001`. Tampilkan `GET /nilai`, lalu `PUT /nilai/1` dengan body `{"score":87}`. Coba `PUT /nilai/4` yang termasuk kelas IF102 milik dosen lain; gateway harus mengembalikan 403. Tunjukkan pemeriksaan pengampu dan jendela akses 07.00–21.00 di `backend/src/gateway/policy.js` dan `backend/src/shared/access-window.js`. `.env` menyediakan `ACCESS_START_HOUR`, `ACCESS_END_HOUR`, dan `TIMEZONE` untuk mengatur jam demo.

## 4:25–5:30 — Finalisasi dan sinkronisasi melalui Gateway

Kirim `POST /kelas/if101/finalisasi` menggunakan token dan device dosen1. Tunjukkan respons sukses, kemudian `GET /transkrip/227006001` dengan akun mhs1 untuk melihat nilai IF101 yang terbaru. Di `backend/src/services/nilai.js`, sorot bahwa Service Nilai meminta token lewat `POST /auth/service`, lalu mengirim `POST /transkrip/sinkron` ke URL Gateway. Tunjukkan audit request sinkronisasi dengan subject `nilai-service`.

## 5:30–6:20 — Direct service dan token service

Kirim `GET http://localhost:3001/nilai` dan `GET http://localhost:3002/health` tanpa header; keduanya ditolak. Ulangi salah satu request dengan gateway secret tetapi tanpa token valid; tetap ditolak. Di Gateway, coba `POST /transkrip/sinkron` memakai token mhs1 atau admin; hasilnya 403. Sinkronisasi hanya berhasil dengan token service yang diterbitkan melalui client ID dan secret.

## 6:20–7:15 — Refresh, logout, dan audit

Panggil `POST /auth/refresh` dengan refresh token mhs1; token baru diterbitkan dan token lama tidak dapat dipakai ulang. Untuk logout, panggil `POST /auth/logout` memakai refresh token aktif akun admin, lalu coba `POST /auth/refresh` dengan token yang sama; hasilnya 401. Dengan access token admin dan `device-admin-001`, buka `GET /admin/audit`; tunjukkan timestamp, subject, endpoint, device bila tersedia, keputusan allow/deny, serta alasan. Sebutkan audit tidak menyimpan password, JWT, refresh token, atau secret.

## 7:15–7:45 — Rangkuman

Hubungkan demo ke never trust/always verify (gateway dan service memverifikasi), least privilege (role, kepemilikan, dan device), assume breach (service langsung terlindungi), dan pemetaan NIST SP 800-207. File ini adalah panduan; video direkam dan dikumpulkan terpisah.
