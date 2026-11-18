import React, { useState } from 'react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'Technical question',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const mailto = `mailto:Riyanprihandanu@gmail.com?subject=${encodeURIComponent(
      `[ARUS Inquiry] ${formData.topic}`
    )}&body=${encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    )}`;
    window.location.href = mailto;
  };

  return (
    <section id="contact-page" className="info-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SUPPORT</div>
          <h1 className="title">Contact Us</h1>
          <p className="subtitle">Questions, feedback and technical collaboration.</p>
        </div>
        <span className="heading-meta">ARUS · Support</span>
      </div>
      <div className="contact-full">
        <form id="contact-form" className="card card-pad" onSubmit={handleSubmit}>
          <h2 className="panel-title">Send an inquiry</h2>
          <div className="contact-form-grid">
            <label className="field">
              Name
              <input
                className="input"
                name="name"
                required
                autoComplete="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </label>
            <label className="field">
              Email
              <input
                className="input"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </label>
            <label className="field full">
              Topic
              <select
                className="select"
                name="topic"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              >
                <option>Technical question</option>
                <option>Calculation feedback</option>
                <option>Project collaboration</option>
              </select>
            </label>
            <label className="field full">
              Message
              <textarea
                className="contact-input"
                name="message"
                minLength="10"
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              ></textarea>
            </label>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" type="submit">
              Open Email Draft
            </button>
          </div>
        </form>
        <div className="contact-aside">
          <div className="card card-pad">
            <h2 className="panel-title">ARUS Marine Engineering Project</h2>
            <p className="contact-intro">Technical &amp; Project Coordination</p>
            <a className="contact-link" href="mailto:Riyanprihandanu@gmail.com">
              Riyanprihandanu@gmail.com
            </a>
          </div>
          <div className="card card-pad">
            <h2 className="panel-title">Include project context</h2>
            <p className="contact-intro">
              Include the calculation method, input conditions and the result or question you want to discuss.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
