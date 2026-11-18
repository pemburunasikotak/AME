import React, { useState } from 'react';
import WorkflowSelector from '../workflow/WorkflowSelector';
import EngineHost from './EngineHost';

export default function PropulsionModule() {
  const [workflowMode, setWorkflowMode] = useState('all');
  const [chosen, setChosen] = useState(true);

  const getDetail = (m) => {
    if (m === 'all') return 'Calculate both wake fraction and thrust deduction where supported';
    if (m === 'wake') return 'Estimate wake fraction (w) from vessel particulars';
    return 'Estimate thrust deduction (t) from vessel particulars';
  };

  const getTitle = (m) => {
    if (m === 'all') return 'Wake Fraction & Thrust Deduction';
    if (m === 'wake') return 'Wake Fraction (w)';
    return 'Thrust Deduction (t)';
  };

  const options = [
    {
      value: 'all',
      label: 'Wake & Thrust Combined',
      description: 'Calculate both coefficients where the method supports them'
    },
    {
      value: 'wake',
      label: 'Wake Fraction (w)',
      description: 'Estimate the wake fraction from vessel particulars'
    },
    {
      value: 'thrust',
      label: 'Thrust Deduction (t)',
      description: 'Estimate the thrust deduction from vessel particulars'
    }
  ];

  return (
    <div className="workspace-card card">
      <WorkflowSelector
        heading="Choose Interaction Mode"
        subheading="Select wake fraction, thrust deduction, or combined calculation"
        chosen={chosen}
        selectedTitle={getTitle(workflowMode)}
        selectedSubtitle={getDetail(workflowMode)}
        onChangeWorkflow={() => setChosen(false)}
        options={options}
        currentValue={workflowMode}
        onSelectOption={(val) => {
          setWorkflowMode(val);
          setChosen(true);
        }}
        columns={3}
      />

      <EngineHost engineId="interaction" workflowMode={workflowMode} />
    </div>
  );
}
