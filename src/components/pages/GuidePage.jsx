import React from 'react';

export default function GuidePage() {
  return (
    <section id="guide-page" className="info-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">HELP CENTER</div>
          <h1 className="title">Guide Book</h1>
          <p className="subtitle">A quick reference for your ARUS calculations.</p>
        </div>
      </div>
      <div className="guide-overview">
        <article className="guide-step">
          <span className="guide-number">01</span>
          <b>Choose a method</b>
          <p>Open a module from Engineering workflow and select the method you need.</p>
        </article>
        <article className="guide-step">
          <span className="guide-number">02</span>
          <b>Enter your data</b>
          <p>Check units and replace example values with measured or project data. Run Selection after editing inputs.</p>
        </article>
        <article className="guide-step">
          <span className="guide-number">03</span>
          <b>Review and save</b>
          <p>Review method warnings and results, then choose Save to History. Download controls are temporarily hidden.</p>
        </article>
      </div>
      <div className="card card-pad">
        <details className="guide-chapter" open>
          <summary>Resistance and model tests</summary>
          <div className="guide-body">
            MT01–MT08 extrapolate measured towing or geosim data. Examples are provided; replace them with real measurements. MT03 returns form factor. MT04 needs at least three geometrically similar models.
          </div>
        </details>
        <details className="guide-chapter" open>
          <summary>Propeller selection and efficiency</summary>
          <div className="guide-body">
            KT Ship uses resistance and diameter. KQ Power uses engine power and RPM. η₀ is open-water efficiency; its marked value is evaluated at the operating J.
          </div>
        </details>
        <details className="guide-chapter" open>
          <summary>Geometry and saved results</summary>
          <div className="guide-body">
            Drag to orbit the propeller. Smooth tip preview is a visual option; native section data is retained. Download controls will be configured later. History is stored in this browser and is not synchronized between devices.
          </div>
        </details>
      </div>
    </section>
  );
}
