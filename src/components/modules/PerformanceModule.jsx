import React from 'react';
import EngineHost from './EngineHost';

export default function PerformanceModule() {
  return (
    <div className="workspace-card card">
      <EngineHost engineId="performance" />
    </div>
  );
}
