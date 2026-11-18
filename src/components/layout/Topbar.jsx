import React from 'react';
import { Link } from 'react-router-dom';

export default function Topbar({
  crumb,
  onToggleSidebar,
  onSaveHistory,
  saveDisabled,
  saveStatus,
  onLogout
}) {

  return (
    <header className="topbar app-header">
      <div className="breadcrumbs">
        <button
          id="menu-toggle"
          className="btn btn-icon"
          type="button"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          onClick={onToggleSidebar}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M9 4v16" />
          </svg>
        </button>
        <Link to="/resistance">
          ARUS
        </Link>
        <span>›</span>
        <strong id="crumb">{crumb}</strong>
      </div>

      <div className="top-actions">
        {saveStatus && <span id="history-save-status" role="status" style={{ fontSize: '12px', color: '#38a169', marginRight: '8px' }}>{saveStatus}</span>}
        <button
          className="btn btn-save-top"
          id="save-history"
          type="button"
          disabled={saveDisabled}
          onClick={onSaveHistory}
        >
          Save to History
        </button>

        <Link className="pill quota-trigger" to="/account">
          Offline access
        </Link>

        <Link
          className="profile-trigger"
          to="/account"
          aria-label="Account"
        >
          <span className="account-text">My Account</span>
          <span className="avatar">AR</span>
        </Link>

        <button
          type="button"
          id="arus-logout-btn"
          className="btn"
          style={{
            background: '#e53e3e',
            color: '#fff',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
            border: 'none',
            marginLeft: '8px'
          }}
          title="Keluar / Logout"
          onClick={onLogout}
        >
          <span>Keluar</span>
        </button>
      </div>
    </header>
  );
}
