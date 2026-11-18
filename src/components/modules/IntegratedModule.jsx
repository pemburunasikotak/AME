import React, { useRef, useEffect, useState } from 'react';
import { buildIntegratedDocument } from '../../utils/integratedBuilder';
import LoadingSpinner from '../common/LoadingSpinner';

export default function IntegratedModule() {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const srcDoc = buildIntegratedDocument();
      iframe.srcdoc = srcDoc;
    } catch (err) {
      console.error('Failed to build Integrated Calculation document:', err);
      setLoading(false);
      return;
    }

    const handleLoad = () => {
      setLoading(false);
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;

        const fitHeight = () => {
          try {
            const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
            if (h && h >= 200 && h <= 25000) {
              iframe.style.setProperty('height', `${h + 10}px`, 'important');
            }
          } catch {}
        };

        fitHeight();
        const obs = new ResizeObserver(fitHeight);
        if (doc.body) obs.observe(doc.body);
      } catch (e) {
        console.warn('Integrated iframe setup warning:', e);
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, []);

  return (
    <div className="workspace-card card" style={{ padding: 0, overflow: 'visible', position: 'relative' }}>
      {loading && <LoadingSpinner message="Opening Integrated Calculation…" />}
      <iframe
        ref={iframeRef}
        id="integrated-frame"
        title="Integrated Calculation"
        scrolling="no"
        allow="fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
        style={{
          width: '100%',
          height: 'auto',
          minHeight: '400px',
          border: 'none',
          display: 'block'
        }}
      />
    </div>
  );
}
