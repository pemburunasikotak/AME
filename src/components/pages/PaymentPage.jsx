import React from 'react';

export default function PaymentPage({ onNavigate }) {
  return (
    <section id="payment-page" className="info-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNT &amp; BILLING</div>
          <h1 className="title">Payments &amp; QRIS</h1>
          <p className="subtitle">Payment availability for this workspace.</p>
        </div>
      </div>
      <div className="card card-pad">
        <div className="payment-qr-stub">
          <strong>Payments are disabled</strong>
          <p>QRIS checkout is not active in the offline workspace.</p>
        </div>
        <div className="btn-row">
          <button
            className="btn"
            type="button"
            onClick={() => onNavigate('contact')}
          >
            Contact Us
          </button>
        </div>
      </div>
    </section>
  );
}
