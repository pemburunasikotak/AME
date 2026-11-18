import React from 'react';

export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div
      className="engine-error"
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff5f5',
        border: '1px solid #feb2b2',
        color: '#c53030',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '12px',
        marginBottom: '14px',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: '#c53030',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
