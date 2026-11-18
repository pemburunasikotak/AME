import React, { useState } from 'react';

const HISTORY_KEY = 'arus-offline-history-v1';

export default function HistoryPage() {
  const [records, setRecords] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState('');

  const filtered = records.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [item.title, item.method, item.snapshot]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <section id="history-page" className="info-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DESIGN WORKSPACE</div>
          <h1 className="title">History</h1>
          <p className="subtitle">Saved calculations on this browser from the last 30 days.</p>
        </div>
        <span className="heading-meta">Local storage</span>
      </div>

      <div className="card card-pad">
        <h2 className="panel-title">Your saved results</h2>
        <p className="contact-intro">
          Use Save to History after a calculation to keep a snapshot of its inputs and results.
        </p>
        <label className="field">
          Search history
          <input
            className="input"
            id="history-search"
            type="search"
            placeholder="Module, method or result"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      <div id="history-list" className="history-list" style={{ marginTop: '20px' }}>
        {filtered.length === 0 ? (
          <p className="info-card">No saved calculations found in this browser.</p>
        ) : (
          filtered.map((item, idx) => (
            <details key={idx} className="info-card history-entry" style={{ marginBottom: '12px', padding: '14px', background: '#fff', borderRadius: '10px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                {item.title || item.work || 'Calculation'} · {item.method || 'Default'}
                <span style={{ float: 'right', fontSize: '11px', color: '#657d8b' }}>
                  {item.savedAt ? new Date(item.savedAt).toLocaleString() : ''}
                </span>
              </summary>
              <pre style={{ marginTop: '10px', fontSize: '12px', whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                {item.snapshot || JSON.stringify(item, null, 2)}
              </pre>
            </details>
          ))
        )}
      </div>
    </section>
  );
}
