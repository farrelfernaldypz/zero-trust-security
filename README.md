# Sistem Nilai Zero Trust Security

API untuk mengelola nilai mata kuliah Informatika Universitas Siliwangi. Project menerapkan prinsip **never trust, always verify**, **least privilege**, dan **assume breach** di tingkat aplikasi, dengan API Gateway sebagai Policy Enforcement Point (PEP) dan pemetaan komponen sesuai NIST SP 800-207.

Project ini menyediakan API backend dan dashboard frontend untuk demonstrasi Sistem Nilai Informatika. Frontend menggunakan API Gateway sebagai satu-satunya pintu komunikasi ke backend.

## Teknologi

- Node.js 20.19+ atau 22.12+ dan Express 4 (versi Node yang mendukung Vite 8).
- SQLite melalui `better-sqlite3`.
- JWT melalui `jsonwebtoken`; bcrypt melalui `bcryptjs`.
- `concurrently` untuk menjalankan ketiga proses bersama.
- Test menggunakan test runner bawaan Node.js (`node:test`).

Versi dependency yang digunakan tercatat di `package.json` dan `package-lock.json`.

## Arsitektur

Semua endpoint aplikasi diakses melalui Gateway pada port 3000. Gateway memeriksa identitas, device, role, kepemilikan, dan policy; mencatat keputusan; lalu meneruskan request operasional ke resource service. Service memeriksa `X-Gateway-Secret` dan memverifikasi signature, tipe, serta masa berlaku JWT sebelum mengakses database.

| Komponen | Port | Peran dan tanggung jawab |
|---|---:|---|
| API Gateway | 3000 | PEP; login, refresh/logout, autentikasi service, evaluasi policy, audit, dan proxy request. |
| Policy Engine | — | Modul `backend/src/gateway/policy.js` di Gateway; mengambil keputusan berdasarkan role dan data database. Fungsi autentikasi dan token ada di Gateway. |
| Service Nilai | 3001 | Resource nilai dan kelas; cek ulang dosen pengampu, status final, jam akses; meminta sinkronisasi melalui Gateway. |
| Service Transkrip | 3002 | Resource transkrip; hanya menerima sinkronisasi dengan token service. |
| SQLite bersama | — | Menyimpan user, device, kelas, nilai, refresh token, transkrip, dan audit log. |

Service Nilai dan Service Transkrip tetap memiliki endpoint `/health`, tetapi middleware Gateway secret dan token berjalan sebelum endpoint tersebut. Health check publik tersedia melalui `GET /health` di Gateway. Untuk pemeriksaan langsung ke service, sertakan gateway secret dan token valid.

## Struktur project

```text
backend/
  src/
    gateway/      server API Gateway dan policy engine
    services/     Service Nilai, Service Transkrip, dan middleware keamanan
    shared/       koneksi database, seed, token, dan jam akses
  tests/          integration.test.js
frontend/         dashboard React dan Vite
  public/
  src/            components, hooks, pages, services, styles, utils
  package.json    dependency dan script frontend
  package-lock.json
  .env.example    konfigurasi frontend tanpa secret
  .gitignore
  index.html
  vite.config.js
docs/
  DEMO_SCRIPT.md
  requests/       contoh request untuk REST Client
data/             database SQLite lokal (diabaikan oleh Git)
.env              konfigurasi lokal (diabaikan oleh Git)
.env.example      contoh konfigurasi backend tanpa secret aktif
.gitignore
README.md
package.json      script dan dependency backend di root
package-lock.json
```
## Persyaratan

- Node.js 20.19+ atau 22.12+ untuk menjalankan backend dan frontend Vite 8.
- npm.
- Port 3000, 3001, dan 3002 tersedia.

Contoh berikut menggunakan PowerShell di Windows. Jalankan script backend dari root project agar `.env` dan `DB_PATH=./data/zero-trust.sqlite` tetap menunjuk ke konfigurasi dan database lokal di root.

## Instalasi dan konfigurasi

Dari folder project:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` dan ganti placeholder berikut dengan nilai acak milikmu:

- `JWT_SECRET`: minimal 32 karakter.
- `GATEWAY_SECRET`.
- `SERVICE_CLIENT_SECRET`.

Jangan commit atau membagikan `.env`. `.gitignore` mengabaikan file tersebut, `node_modules`, serta database SQLite dan file sementara WAL/SHM. `.env.example` berisi placeholder tanpa secret aktif. `package-lock.json` dipertahankan agar instalasi dapat diulang dengan `npm ci`.

Port, path database, URL Gateway, masa berlaku token, zona waktu, dan jendela akses juga dapat diubah melalui `.env`. Nilai default masa berlaku: access token `10m`, refresh token `86400` detik (1 hari), dan service token `5m`. Jam akses default 07.00 sampai sebelum 21.00 di zona waktu `Asia/Jakarta`.

## Inisialisasi database dan data demo

```powershell
npm run init-db
```

Seed dapat dijalankan ulang: proses menggunakan insert yang menghindari duplikasi data. Seed membuat 1 admin, 2 dosen, 3 mahasiswa, 2 kelas dengan dosen pengampu berbeda, device terdaftar, nilai, dan transkrip awal. Database lokal tidak perlu dihapus untuk menjalankan seed.

## Menjalankan aplikasi

Untuk menjalankan tiga proses bersama:

```powershell
npm run dev
```

Atau buka tiga terminal di folder project dan jalankan satu per satu:

```powershell
npm run gateway
npm run nilai
npm run transkrip
```

Gateway menyediakan health check di `http://localhost:3000/health`. Request aplikasi dikirim ke port 3000, bukan langsung ke port service.

## Akun dan device demo

| Username | Password | Role | Device ID |
|---|---|---|---|
| `admin` | `Admin123!` | admin | `device-admin-001` |
| `dosen1` | `Dosen123!` | dosen, pengampu IF101 | `device-dosen-001` |
| `dosen2` | `Dosen123!` | dosen, pengampu IF102 | `device-dosen-002` |
| `mhs1` | `Mhs123!` | mahasiswa, NIM 227006001 | `device-mhs-001` |
| `mhs2` | `Mhs123!` | mahasiswa, NIM 227006002 | `device-mhs-002` |
| `mhs3` | `Mhs123!` | mahasiswa, NIM 227006003 | `device-mhs-003` |

Password demo di atas disimpan sebagai hash bcrypt di database hasil seed.

## Endpoint

Semua endpoint berikut dilayani melalui Gateway `http://localhost:3000`. Kecuali endpoint `/auth/*` dan health check Gateway, request user operasional memerlukan access token Bearer dan `X-Device-ID` terdaftar.

| Method | Path | Akses dan ketentuan |
|---|---|---|
| `GET` | `/health` | Health check Gateway. |
| `POST` | `/auth/login` | Username, password, dan `X-Device-ID` valid. |
| `POST` | `/auth/refresh` | Refresh token aktif; token lama dirotasi. |
| `POST` | `/auth/logout` | Mencabut refresh token aktif. |
| `POST` | `/auth/service` | Client ID dan secret service valid; menerbitkan token service. |
| `GET` | `/nilai` | Mahasiswa melihat nilai sendiri; dosen melihat nilai kelas ampuan. |
| `PUT` | `/nilai/:id` | Dosen pengampu; nilai belum final; dalam jam akses. Body: `{ "score": 90 }`. |
| `POST` | `/kelas/:id/finalisasi` | Dosen pengampu dalam jam akses; sinkronisasi transkrip dipanggil melalui Gateway. |
| `GET` | `/transkrip/:nim` | Mahasiswa hanya untuk NIM sendiri; admin dapat melihat seluruh mahasiswa. |
| `POST` | `/transkrip/sinkron` | Khusus token service; token user, termasuk admin, ditolak. Biasanya dipanggil Service Nilai. |
| `GET` | `/admin/audit` | Admin dengan device terdaftar; menampilkan sampai 200 keputusan terbaru. |

Endpoint `/health` pada Service Nilai dan Service Transkrip tersedia di port masing-masing dan dijaga middleware service. Aplikasi tidak mem-proxy endpoint health service lewat Gateway.

## Contoh request PowerShell

Login mahasiswa, simpan token, lalu baca nilai dan transkrip miliknya:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
  -Headers @{ 'X-Device-ID' = 'device-mhs-001' } `
  -ContentType 'application/json' `
  -Body '{"username":"mhs1","password":"Mhs123!"}'

$headers = @{
  Authorization = "Bearer $($login.accessToken)"
  'X-Device-ID' = 'device-mhs-001'
}
Invoke-RestMethod -Uri http://localhost:3000/nilai -Headers $headers
Invoke-RestMethod -Uri http://localhost:3000/transkrip/227006001 -Headers $headers
```

Contoh request lain tersedia di `docs/requests/demo.http`.

## Mekanisme keamanan

- **Never trust, always verify:** Gateway memeriksa JWT, expiry, device, dan policy untuk setiap request user operasional. Service memverifikasi kembali gateway secret dan JWT yang diteruskan.
- **Least privilege:** role dan kepemilikan dicek terhadap database. Mahasiswa hanya mendapat nilai sendiri; dosen dibatasi pada kelas ampuannya; admin hanya memiliki akses transkrip lintas mahasiswa.
- **Assume breach:** port service bukan jalur untuk melewati pemeriksaan. Request langsung tanpa gateway secret atau token valid ditolak, termasuk endpoint health service.
- **Token:** access token berisi subject dan role. Refresh token disimpan sebagai SHA-256 hash, dirotasi pada refresh, dan dicabut saat logout. Token service memiliki role `service` dan hanya dapat mengakses sinkronisasi transkrip.
- **Konteks:** request user harus membawa device yang terdaftar. Perubahan nilai dan finalisasi dibatasi jam akses yang dapat dikonfigurasi.
- **Audit:** Gateway mencatat timestamp, subject, endpoint, device bila tersedia, keputusan allow/deny, metode, dan alasan. Password, JWT, refresh token, serta secret tidak dicatat.
- **Sinkronisasi:** finalisasi meminta token service ke Gateway lalu memanggil endpoint sinkronisasi melalui Gateway. Service Transkrip menerapkan transaksi database untuk batch sinkronisasi. Jika sinkronisasi gagal, status finalisasi dibatalkan.

## Pengujian

Jalankan seluruh test:

```powershell
npm test
```

Test memakai port dan database terpisah (`3100`–`3102`, `data/integration-test.sqlite`) dan membersihkan database test setelah selesai. Cakupannya termasuk kredensial, JWT, refresh/logout, device, pembatasan role dan kepemilikan, status final, sinkronisasi token service, akses langsung ke service/health check, jam akses, serta audit allow/deny.

Video demonstrasi 6–9 menit merupakan luaran terpisah. `docs/DEMO_SCRIPT.md` berisi urutan demonstrasi yang sesuai dengan implementasi.

## Frontend

Frontend React memakai CSS modular dan Vite 8 (Node.js 20.19+ atau 22.12+). Source backend ada di `backend/src`, dan test integrasi ada di `backend/tests/integration.test.js`. Semua request browser memakai base URL `/api`; server development Vite meneruskan request tersebut ke API Gateway. Target default-nya `http://localhost:3000`, dapat diubah melalui `frontend/.env` tanpa mengubah URL API di komponen. Frontend tidak mengakses port Service Nilai atau Service Transkrip secara langsung, sehingga backend tidak memerlukan perubahan CORS.

Jalankan backend dari terminal pertama di folder project:

```powershell
npm run dev
```

Siapkan frontend dari terminal kedua:

```powershell
cd frontend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Buka `http://localhost:5173`. Untuk menampilkan akun seed pada halaman login selama demonstrasi, ubah `VITE_DEMO_MODE=true` di `frontend/.env`; default-nya `false`. Akun yang ditampilkan sama dengan tabel akun demo di atas. Token hanya disimpan di `sessionStorage` dan dibersihkan ketika logout. Mekanisme ini ditujukan untuk demonstrasi lokal, bukan penyimpanan token produksi.

Dashboard mahasiswa memakai `GET /nilai` dan `GET /transkrip/:nim` untuk NIM akun yang login. Dashboard dosen memakai `GET /nilai`, `PUT /nilai/:id`, dan `POST /kelas/:id/finalisasi`. Dashboard Admin memakai `GET /admin/audit` dan `GET /transkrip/:nim`. Backend belum menyediakan endpoint daftar mahasiswa atau pencarian nama; karena itu halaman Admin meminta NIM secara eksplisit dan tidak menampilkan daftar statis atau data rekaan. Role di antarmuka mengikuti hasil login dan seluruh otorisasi tetap diputuskan oleh backend.
