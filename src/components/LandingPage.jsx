import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage({ user }) {
  const workspaceTarget = user ? '/resistance' : '/login';
  const ctaLabel = user ? 'Buka Workspace' : 'Masuk ke Studio';

  const services = [
    {
      title: 'Analisis Hambatan Kapal & Uji Model',
      desc: 'Prediksi tahanan kapal menggunakan 12 famili metode empiris (Holtrop-Mennen, Hollenbach, Harvald, Series 60/62/64, Savitsky, dll.) serta ekstrapolasi data uji kolam tarik (MT01–MT08) ke skala penuh.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 17c4-3 6 3 10 0s6-3 10 0M3 9h18M5 5h14" />
        </svg>
      )
    },
    {
      title: 'Seleksi Propeller & Evaluasi Kavitasi',
      desc: 'Pemilihan propeller optimal pada mode KT Ship maupun KQ Power dengan pemeringkatan Top-20 kandidat, kurva karakteristik KT–10KQ–η₀–J, serta pengecekan batas kavitasi.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2" />
          <path d="M12 10C6 2 3 8 5 12s6 2 7 0M14 12c8-6 2-9-2-7s-2 6 0 7M12 14c-2 8 5 9 8 5s-2-6-8-5" />
        </svg>
      )
    },
    {
      title: 'Pemodelan Geometri CAD 3D Propeller',
      desc: 'Inspeksi dan kustomisasi geometri propeller 3D interaktif berbasis WebGL/WASM lengkap dengan pengaturan stasiun radial, tabel offset, hub, rake, serta sudut pandang ViewCube.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8" />
        </svg>
      )
    },
    {
      title: 'Integrasi Propulsi & Engine Matching',
      desc: 'Menghubungkan data tahanan lambung, faktor interaksi (wake fraction w & thrust deduction t), rasio gearbox, serta katalog mesin utama untuk mengevaluasi kecepatan operasi dan konsumsi bahan bakar (SFOC).',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h5l4 5 4-5h5M3 17h5l4-5 4 5h5" />
          <circle cx="3" cy="7" r="1" />
          <circle cx="3" cy="17" r="1" />
        </svg>
      )
    }
  ];

  const modules = [
    {
      tag: 'MODUL 01',
      title: 'Resistance & Extrapolation',
      desc: 'Perbandingan prediksi hambatan kapal lintas metode dan ekstrapolasi uji model.'
    },
    {
      tag: 'MODUL 02',
      title: 'Propeller Performance',
      desc: 'Kurva open-water KT–KQ–J dan tabel numerik untuk seri B, MAU/NAU, Gawn, dan Kaplan.'
    },
    {
      tag: 'MODUL 03',
      title: 'Propeller Selection',
      desc: 'Pencarian dimensi dan pitch propeller terbaik beserta preview CAD 3D langsung.'
    },
    {
      tag: 'MODUL 04',
      title: 'Propeller CAD Geometry',
      desc: 'Studio CAD 3D untuk modifikasi stasiun radial, penampang bilah, dan data offset.'
    },
    {
      tag: 'MODUL 05',
      title: 'Propulsion Interaction',
      desc: 'Estimasi wake fraction (w) dan thrust deduction (t) untuk kondisi di belakang lambung.'
    },
    {
      tag: 'MODUL 06',
      title: 'Integrated Calculation',
      desc: 'Alur kalkulasi terpadu dari histori hambatan hingga optimasi propeller dan rating mesin.'
    }
  ];

  const workflow = [
    {
      num: '01',
      title: 'Input Data Kapal',
      desc: 'Masukkan dimensi utama lambung dan kondisi operasi, atau muat proyek tersimpan.'
    },
    {
      num: '02',
      title: 'Hitung Hambatan & Interaksi',
      desc: 'Pilih metode tahanan empiris serta koefisien wake (w) dan thrust deduction (t).'
    },
    {
      num: '03',
      title: 'Seleksi & Preview 3D CAD',
      desc: 'Evaluasi kandidat propeller terbaik, cek kavitasi, dan tinjau model CAD 3D.'
    },
    {
      num: '04',
      title: 'Engine Matching & Simpan',
      desc: 'Cocokkan daya mesin dan gearbox dari katalog, lalu simpan hasilnya ke History.'
    }
  ];

  return (
    <div className="arus-lp">
      {/* Top Navbar */}
      <header className="arus-lp-nav">
        <div className="arus-lp-container arus-lp-nav-inner">
          <Link to="/" className="arus-lp-brand">
            <div className="arus-lp-logo">
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path
                  d="M3 19c5-2 7-9 13-9 5 0 7 6 13 5M3 26c5-2 7-9 13-9 5 0 7 6 13 5"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div className="arus-lp-brand-name">ARUS</div>
              <div className="arus-lp-brand-tag">MARINE ENGINEERING</div>
            </div>
          </Link>

          <nav className="arus-lp-nav-links" aria-label="Landing navigation">
            <a href="#layanan">Layanan Teknik</a>
            <a href="#modul">Modul Aplikasi</a>
            <a href="#alur">Alur Kerja</a>
          </nav>

          <div className="arus-lp-nav-actions">
            <Link to={workspaceTarget} className="arus-lp-btn arus-lp-btn-primary">
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="arus-lp-hero">
        <div className="arus-lp-container arus-lp-hero-grid">
          <div>
            <div className="arus-lp-eyebrow">Naval Architecture &amp; Propulsion Suite</div>
            <h1>Komputasi Hidrodinamika Kapal &amp; Desain Propulsi Terintegrasi</h1>
            <p>
              ARUS Marine Engineering menyediakan layanan perangkat lunak perhitungan teknik perkapalan — mulai dari prediksi hambatan lambung, seleksi propeller, pemodelan CAD 3D, hingga pencocokan sistem penggerak utama secara presisi dalam satu platform.
            </p>
            <div className="arus-lp-hero-cta">
              <Link to={workspaceTarget} className="arus-lp-btn arus-lp-btn-primary">
                {user ? 'Masuk ke Workspace →' : 'Mulai Hitung Sekarang →'}
              </Link>
              <a href="#layanan" className="arus-lp-btn arus-lp-btn-outline-light">
                Pelajari Layanan
              </a>
            </div>
          </div>

          <div className="arus-lp-hero-card">
            <div className="arus-lp-hero-card-title">Cakupan Komputasi ARUS</div>
            <div className="arus-lp-stats-grid">
              <div className="arus-lp-stat">
                <strong>12+</strong>
                <span>Metode Prediksi Hambatan Empiris &amp; Uji Model (MT01–MT08)</span>
              </div>
              <div className="arus-lp-stat">
                <strong>4 Seri</strong>
                <span>Keluarga Propeller: B-Series, MAU/NAU, Gawn &amp; Kaplan</span>
              </div>
              <div className="arus-lp-stat">
                <strong>3D CAD</strong>
                <span>Renderer WebGL/WASM &amp; Inspeksi Offset Geometri Bilah</span>
              </div>
              <div className="arus-lp-stat">
                <strong>End-to-End</strong>
                <span>Integrasi Tahanan, Kavitasi, Gearbox &amp; Katalog Mesin</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="layanan" className="arus-lp-section">
        <div className="arus-lp-container">
          <div className="arus-lp-section-head">
            <small>Layanan &amp; Kapabilitas</small>
            <h2>Solusi Rekayasa Perkapalan Berbasis Data &amp; Metode Standar</h2>
            <p>
              Dirancang untuk insinyur perkapalan, galangan, konsultan desain, dan akademisi guna mempercepat analisis performa lambung hingga pemilihan sistem propulsi.
            </p>
          </div>

          <div className="arus-lp-services-grid">
            {services.map((srv) => (
              <article key={srv.title} className="arus-lp-service-card">
                <div className="arus-lp-service-icon">{srv.icon}</div>
                <div>
                  <h3>{srv.title}</h3>
                  <p>{srv.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modul" className="arus-lp-section arus-lp-section-alt">
        <div className="arus-lp-container">
          <div className="arus-lp-section-head">
            <small>Ekosistem Modul</small>
            <h2>Enam Modul Spesialis dalam Satu Workspace</h2>
            <p>
              Setiap modul bekerja secara independen maupun terhubung langsung dalam alur kalkulasi terintegrasi.
            </p>
          </div>

          <div className="arus-lp-modules-grid">
            {modules.map((mod) => (
              <article key={mod.title} className="arus-lp-module-card">
                <span className="arus-lp-module-tag">{mod.tag}</span>
                <h3>{mod.title}</h3>
                <p>{mod.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="alur" className="arus-lp-section">
        <div className="arus-lp-container">
          <div className="arus-lp-section-head">
            <small>Alur Kerja</small>
            <h2>Dari Dimensi Lambung Hingga Rating Mesin</h2>
            <p>
              Proses terstruktur yang memastikan konsistensi parameter antara perhitungan tahanan, propeller, dan mesin penggerak.
            </p>
          </div>

          <div className="arus-lp-steps">
            {workflow.map((step) => (
              <div key={step.num} className="arus-lp-step">
                <div className="arus-lp-step-num">{step.num}</div>
                <h4>{step.title}</h4>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="arus-lp-section" style={{ paddingTop: 0 }}>
        <div className="arus-lp-container">
          <div className="arus-lp-cta-box">
            <div>
              <h2>Siap Memulai Perhitungan Kapal Anda?</h2>
              <p>
                Akses seluruh modul hidrodinamika, pemodelan 3D propeller, dan simulasi integrasi mesin di workspace ARUS.
              </p>
            </div>
            <Link to={workspaceTarget} className="arus-lp-btn arus-lp-btn-primary">
              {ctaLabel} →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="arus-lp-footer">
        <div className="arus-lp-container arus-lp-footer-inner">
          <div>
            <strong>ARUS Marine Engineering</strong> · Naval Architecture &amp; Propulsion Computation Suite
          </div>
          <div>
            © {new Date().getFullYear()} ARUS Marine Engineering. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
