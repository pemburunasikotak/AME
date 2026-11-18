import React, { useState } from 'react';
import WorkflowSelector from '../workflow/WorkflowSelector';
import EngineHost from './EngineHost';

export default function ResistanceModule() {
  const [selectedVariant, setSelectedVariant] = useState('resistance');
  const [chosen, setChosen] = useState(true);

  const options = [
    {
      value: 'resistance',
      label: 'Ship Resistance',
      description: 'From vessel dimensions and speed (12 method families)'
    },
    {
      value: 'model-test',
      label: 'Model Test Extrapolation',
      description: 'From towing-tank measurements (MT01–MT08)'
    }
  ];

  return (
    <div className="workspace-card card">
      <WorkflowSelector
        heading="Choose Calculation Workflow"
        subheading="Select Resistance or Model Test Extrapolation"
        chosen={chosen}
        selectedTitle={selectedVariant === 'resistance' ? 'Ship Resistance' : 'Model Test Extrapolation'}
        selectedSubtitle={
          selectedVariant === 'resistance'
            ? 'Empirical ship resistance methods'
            : 'Extrapolation from measured model-test data'
        }
        onChangeWorkflow={() => setChosen(false)}
        options={options}
        currentValue={selectedVariant}
        onSelectOption={(val) => {
          setSelectedVariant(val);
          setChosen(true);
        }}
        columns={2}
      />

      <EngineHost engineId={selectedVariant} />
    </div>
  );
}
