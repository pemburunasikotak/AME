import React from 'react';

export default function LoadingSpinner({ message = 'Loading…', className = '' }) {
  return (
    <div
      className={`loading ${className}`}
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '28px',
        color: '#657e91',
        fontSize: '13px',
        fontWeight: 500,
        gap: '10px'
      }}
    >
      <svg
        style={{
          width: '20px',
          height: '20px',
          animation: 'spin 1s linear infinite'
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
