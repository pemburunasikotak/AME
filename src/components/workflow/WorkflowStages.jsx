import React from 'react';

export default function WorkflowStages({
  currentStage = 1,
  stages = [
    { num: '01', title: 'Choose method' },
    { num: '02', title: 'Input parameters' },
    { num: '03', title: 'Calculation results' }
  ]
}) {
  return (
    <div className="arus99-stages" id="arus99-stages" aria-label="Calculation workflow">
      {stages.map((stage, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStage;
        const isDone = stepNum < currentStage;
        return (
          <div
            key={stage.num}
            className={`arus99-stage ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
            data-stage={stage.title.toLowerCase().replace(/\s+/g, '-')}
          >
            <b>{stage.num}</b>
            <span>{stage.title}</span>
          </div>
        );
      })}
    </div>
  );
}
