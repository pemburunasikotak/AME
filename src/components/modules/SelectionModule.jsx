import React, { useState } from 'react';
import WorkflowSelector from '../workflow/WorkflowSelector';
import EngineHost from './EngineHost';

export default function SelectionModule() {
  const [workflowMode, setWorkflowMode] = useState('kt');
  const [chosen, setChosen] = useState(true);

  const options = [
    {
      value: 'kt',
      label: 'KT Ship',
      description: 'Resistance and diameter known · select propeller from thrust requirement'
    },
    {
      value: 'kq',
      label: 'KQ Power',
      description: 'Engine power and RPM known · select propeller from torque requirement'
    }
  ];

  return (
    <div className="workspace-card card">
      <WorkflowSelector
        heading="Choose Propeller Selection Mode"
        subheading="Select KT Ship or KQ Power"
        chosen={chosen}
        selectedTitle={workflowMode === 'kt' ? 'KT Ship' : 'KQ Power'}
        selectedSubtitle={
          workflowMode === 'kt'
            ? 'Resistance and diameter known · select propeller from thrust requirement'
            : 'Engine power and RPM known · select propeller from torque requirement'
        }
        onChangeWorkflow={() => setChosen(false)}
        options={options}
        currentValue={workflowMode}
        onSelectOption={(val) => {
          setWorkflowMode(val);
          setChosen(true);
        }}
        columns={2}
      />

      <EngineHost engineId="selection" workflowMode={workflowMode} />
    </div>
  );
}
