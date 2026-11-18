import React from 'react';

/**
 * Module Header component for page title, eyebrow, and brief description
 */
export default function ModuleHeader({ eyebrow = 'CALCULATION MODULE', title, description }) {
  if (!title) return null;
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow" id="page-eyebrow">{eyebrow}</div>
        <h1 className="title" id="page-title">{title}</h1>
        {description && <p className="subtitle" id="page-description">{description}</p>}
      </div>
    </div>
  );
}
