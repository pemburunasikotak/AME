import React, { useRef, useEffect, useState, useCallback } from 'react';
import { buildEngineDocument, getEngineMetadata } from '../../utils/engineBuilder';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

export default function EngineHost({
  engineId,
  workflowMode,
  onReady,
  onError
}) {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const engine = getEngineMetadata(engineId);

  // Helper function to apply workflowMode into the iframe document
  const applyWorkflowToDocument = useCallback((doc, mode) => {
    if (!doc || !mode) return;

    try {
      doc.body.dataset.arusUnifiedWorkflow = '1';

      if (engineId === 'selection') {
        const btn = doc.querySelector(`#method-${mode}`);
        if (btn) {
          const isActive = btn.classList.contains('active') || btn.getAttribute('aria-pressed') === 'true';
          if (!isActive) {
            btn.click();
          }
        }
      } else if (engineId === 'interaction' || engineId === 'interaction-grouped') {
        const select = doc.querySelector('#typeSelect');
        if (select && select.value !== mode) {
          select.value = mode;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    } catch (e) {
      console.warn('Workflow switch warning:', e);
    }
  }, [engineId]);

  // Effect 1: Initial document load and setup
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !engine) return;

    try {
      const srcDoc = buildEngineDocument(engineId);
      iframe.srcdoc = srcDoc;
    } catch (err) {
      console.error(`Failed to build document for engine ${engineId}:`, err);
      setErrorMsg('Failed to initialize computation engine.');
      setLoading(false);
      if (onError) onError(err);
      return;
    }

    let obs = null;

    const handleLoad = () => {
      setLoading(false);
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;

        if (workflowMode) {
          applyWorkflowToDocument(doc, workflowMode);
        }

        const fitHeight = () => {
          try {
            if (engineId === 'geometry') {
              const shell = doc.querySelector('.app-shell') || doc.body;
              if (shell) {
                const height = Math.ceil(
                  shell.getBoundingClientRect().bottom +
                  (doc.documentElement.scrollTop || doc.body.scrollTop || 0)
                );
                if (Number.isFinite(height) && height >= 200 && height <= 16000) {
                  iframe.style.setProperty('height', `${height}px`, 'important');
                }
              }
            } else {
              const bodyRect = Math.ceil(
                doc.body.getBoundingClientRect().bottom +
                (doc.documentElement.scrollTop || doc.body.scrollTop || 0)
              );
              const h = Math.max(bodyRect, Math.ceil(doc.body.scrollHeight));
              if (h && h >= 200 && h <= 16000) {
                iframe.style.setProperty('height', `${h + 12}px`, 'important');
              }
            }
          } catch {}
        };

        fitHeight();
        obs = new ResizeObserver(fitHeight);
        if (doc.body) obs.observe(doc.body);
        const shell = doc.querySelector('.app-shell');
        if (shell) obs.observe(shell);

        if (onReady) onReady(iframe);
      } catch (e) {
        console.warn('Iframe setup warning:', e);
      }
    };

    iframe.addEventListener('load', handleLoad);

    const handleMessage = (event) => {
      const data = event.data;
      if (!data || data.channel !== 'arus-offline-studio' || data.moduleId !== engineId) return;

      if (data.type === 'error') {
        setErrorMsg('The calculation could not be completed. Review the inputs and try again.');
        if (onError) onError(data.message);
      }
      if (data.type === 'ready') {
        setLoading(false);
      }
      if (data.type === 'resize') {
        const height = Number(data.height);
        if (Number.isFinite(height) && height >= 200 && height <= 16000) {
          iframe.style.setProperty('height', `${height}px`, 'important');
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      if (obs) obs.disconnect();
      iframe.removeEventListener('load', handleLoad);
      window.removeEventListener('message', handleMessage);
    };
  }, [engineId, onError, onReady, applyWorkflowToDocument, workflowMode, engine]);

  // Effect 2: Dynamically update workflowMode when user changes tabs (e.g., KT -> KQ)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !workflowMode) return;

    try {
      const doc = iframe.contentDocument;
      if (doc) {
        applyWorkflowToDocument(doc, workflowMode);
      }
    } catch (e) {
      console.warn('Dynamic mode switch warning:', e);
    }
  }, [workflowMode, applyWorkflowToDocument]);

  return (
    <div className="engine-area" style={{ position: 'relative', width: '100%', minHeight: 'auto' }}>
      {loading && <LoadingSpinner message="Opening calculation…" />}
      <ErrorMessage message={errorMsg} onRetry={() => window.location.reload()} />

      <iframe
        ref={iframeRef}
        className="engine-frame"
        id={`engine-${engineId}`}
        title={engine?.work || engineId}
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
