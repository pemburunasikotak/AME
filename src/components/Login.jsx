import React, { useState } from 'react';
import './Login.css';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('engineer@arus.marine');
  const [password, setPassword] = useState('arus2026');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Silakan masukkan email/username dan password.');
      return;
    }

    setLoading(true);
    // Simulate brief authentication process
    setTimeout(() => {
      // Default credentials or any non-empty input
      if (password.length < 4) {
        setError('Password minimal 4 karakter.');
        setLoading(false);
        return;
      }

      onLogin({
        username: username.trim(),
        role: 'Naval Architect / Marine Engineer',
        loginTime: new Date().toISOString()
      }, rememberMe);
      setLoading(false);
    }, 450);
  };

  return (
    <div className="arus-login-container">
      <div className="arus-login-card">
        <div className="arus-login-header">
          <div className="arus-login-logo">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path
                d="M3 19c5-2 7-9 13-9 5 0 7 6 13 5M3 26c5-2 7-9 13-9 5 0 7 6 13 5"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="arus-login-title">ARUS</h1>
          <p className="arus-login-subtitle">MARINE ENGINEERING COMPUTATION SUITE</p>
          <span className="arus-login-badge">Integrated Offline Studio v165</span>
        </div>

        <form onSubmit={handleSubmit} className="arus-login-form">
          {error && <div className="arus-login-error">{error}</div>}

          <div className="arus-form-group">
            <label htmlFor="username">Email / Engineering ID</label>
            <div className="arus-input-wrapper">
              <svg className="arus-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="engineer@arus.marine"
                required
              />
            </div>
          </div>

          <div className="arus-form-group">
            <label htmlFor="password">Password</label>
            <div className="arus-input-wrapper">
              <svg className="arus-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="arus-login-options">
            <label className="arus-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Ingat saya di perangkat ini</span>
            </label>
            <span className="arus-demo-hint">Demo: <code>arus2026</code></span>
          </div>

          <button type="submit" className="arus-login-btn" disabled={loading}>
            {loading ? (
              <span className="arus-btn-loading">
                <span className="arus-spinner"></span> Memverifikasi...
              </span>
            ) : (
              'Masuk ke Sistem ARUS'
            )}
          </button>
        </form>

        <div className="arus-login-footer">
          <div className="arus-modules-summary">
            <span>6 Modul Terintegrasi:</span>
            <div className="arus-tags">
              <span>01. Resistance</span>
              <span>02. Performance</span>
              <span>03. Selection</span>
              <span>04. PropCad CAD</span>
              <span>05. Propulsion Interaction</span>
              <span>06. Integrated EPM</span>
            </div>
          </div>
          <div className="arus-copyright">
            © 2026 ARUS Marine Engineering · ITS Marine Hydrodynamics
          </div>
        </div>
      </div>
    </div>
  );
}
