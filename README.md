# ARUS Marine Engineering

Platform komputasi hidrodinamika kapal dan desain sistem propulsi terintegrasi berbasis web (**React + Vite**). Aplikasi ini mencakup prediksi hambatan kapal, evaluasi kinerja propeller, seleksi propeller ($K_T$ & $K_Q$), pemodelan geometri CAD 3D (WebGL/WASM), interaksi propulsi, hingga pencocokan mesin utama (*engine matching*).

---

## Fitur & Modul Utama

1. **Landing Page (`/`)** — Halaman pengenalan layanan teknik perkapalan, cakupan modul, dan alur kerja ARUS.
2. **Resistance & Extrapolation (`/resistance`)** — Prediksi hambatan kapal dengan 12 famili metode empiris serta ekstrapolasi hasil uji model (*towing-tank* `MT01–MT08`) ke skala penuh.
3. **Propeller Performance (`/performance`)** — Pembangkitan kurva *open-water* $K_T - 10K_Q - \eta_0 - J$, tabel numerik, dan preview CAD 3D untuk seri B-Series, MAU/NAU, Gawn, dan Kaplan.
4. **Propeller Selection (`/selection`)** — Pemilihan propeller pada mode **KT Ship** maupun **KQ Power**, lengkap dengan preview 3D CAD dan mode **Fullscreen** untuk diagram serta model 3D.
5. **Propeller CAD Geometry (`/geometry`)** — Studio CAD 3D berbasis WebGL/WebAssembly untuk inspeksi bilah propeller, stasiun radial, dan data offset.
6. **Propulsion Interaction (`/propulsion`)** — Estimasi faktor arus ikut (*wake fraction* $w$) dan deduksi gaya dorong (*thrust deduction* $t$).
7. **Integrated Calculation (`/integrated`)** — Alur perhitungan terpadu dari histori hambatan lambung, seleksi Top-20 propeller, pengecekan kavitasi, rasio gearbox, hingga evaluasi rating mesin & SFOC.
8. **Halaman Pendukung**:
   - **History (`/history`)** — Riwayat hasil kalkulasi yang tersimpan di browser.
   - **Guide Book (`/guide`)** — Panduan ringkas penggunaan modul.
   - **Contact Us (`/contact`)**, **My Account (`/account`)**, dan **Payments / QRIS (`/payment`)**.

---

## Teknologi yang Digunakan

- **Frontend**: React 19, React Router DOM
- **Build Tool**: Vite 8
- **3D Rendering**: WebGL + WebAssembly (`cadWasmBinary.js` / `cadWasmKernel.js`)
- **Linter**: Oxlint

---

## Struktur Direktori

```text
src/
├── components/
│   ├── common/              # LoadingSpinner, ErrorMessage
│   ├── layout/              # Sidebar (collapsible), Topbar, ModuleHeader
│   ├── modules/             # EngineHost, ResistanceModule, PerformanceModule,
│   │                        # SelectionModule, GeometryModule, PropulsionModule,
│   │                        # IntegratedModule, LoadProjectModal
│   ├── pages/               # HistoryPage, GuidePage, ContactPage, AccountPage, PaymentPage
│   ├── workflow/            # WorkflowSelector, WorkflowStages
│   ├── LandingPage.jsx      # Halaman utama (/)
│   ├── Login.jsx            # Halaman masuk (/login)
│   └── StudioShell.jsx      # Shell utama workspace & routing modul
├── data/
│   ├── bridge/              # Skrip bridge modular (fullscreen, CAD preview, layout, workflow)
│   ├── cadViewer/           # Komponen viewer 3D CAD (HTML, CSS, WASM kernel, WebGL, ViewCube)
│   ├── integrated/modules/  # Logika modular Integrated Calculation
│   ├── arusEngines.json     # Payload engine kalkulasi
│   └── arusIcons.json       # Ikon SVG navigasi
├── services/
│   ├── authService.js       # Abstraksi autentikasi (siap integrasi Backend API)
│   └── calculationService.js# Abstraksi layanan kalkulasi & histori (siap integrasi Backend API)
├── styles/
│   ├── engineTheme/         # Tema CSS modular untuk engine iframe
│   ├── arusStudio.css       # Styling utama workspace & sidebar
│   └── integratedStyles.css # Styling modul Integrated Calculation
├── utils/
│   ├── engineBuilder.js     # Penyusun dokumen engine + tema + bridge + CAD viewer
│   └── integratedBuilder.js # Penyusun dokumen Integrated Calculation
├── App.jsx                  # Konfigurasi routing utama
└── main.jsx                 # Entry point React
```

---

## Cara Menjalankan Proyek

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Menjalankan Mode Development
```bash
npm run dev
```
Aplikasi akan berjalan di server lokal Vite (misal `http://localhost:5173/` atau port berikutnya jika terpakai).

### 3. Build Produksi
```bash
npm run build
```
Hasil build akan tersimpan di folder `dist/`.

### 4. Preview Build & Linter
```bash
npm run preview
npm run lint
```

---

## Akun Demo Default

Saat masuk melalui halaman `/login`, tersedia kredensial bawaan untuk pengujian:
- **Email / Username**: `engineer@arus.marine`
- **Password**: `arus2026`

---

## Kesiapan Integrasi Backend

Lapisan service telah dipisahkan di `src/services/authService.js` dan `src/services/calculationService.js`. Untuk menghubungkan ke REST API backend di masa mendatang, cukup aktifkan flag `USE_BACKEND_AUTH` / `USE_BACKEND_API` dan sesuaikan `VITE_API_BASE_URL` tanpa perlu mengubah struktur komponen UI.
