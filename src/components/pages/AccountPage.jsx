import React from 'react';

export default function AccountPage({ onNavigate, onLogout }) {
  return (
    <section id="account-page" className="info-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNT</div>
          <h1 className="title">My Account</h1>
          <p className="subtitle">Your local ARUS calculation workspace.</p>
        </div>
      </div>
      <div className="card card-pad">
        <h2 className="panel-title">Offline access</h2>
        <p className="contact-intro">Calculators run locally without signing in. Saved History belongs to this browser.</p>
        <div className="btn-row">
          <button
            className="btn"
            type="button"
            onClick={() => onNavigate('history')}
          >
            Open History
          </button>
        </div>
      </div>
      <div className="card card-pad" id="account-calculation-access" style={{ marginTop: '18px' }}>
        <h2 className="panel-title">Calculation Access</h2>
        <div className="quota-number">Unlimited</div>
        <p className="contact-intro">
          Calculations in this offline workspace run locally and do not consume online credits.
        </p>
        <div className="btn-row" style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn"
            type="button"
            onClick={() => onNavigate('payment')}
          >
            Payment status
          </button>
          <button
            className="btn"
            type="button"
            style={{ background: '#e53e3e', borderColor: '#c53030', color: '#fff' }}
            onClick={onLogout}
          >
            Keluar / Logout from ARUS
          </button>
        </div>
      </div>
    </section>
  );
}
