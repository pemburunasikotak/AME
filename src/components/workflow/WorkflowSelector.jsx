import React from 'react';

/**
 * Reusable Workflow Selector card component.
 * Allows switching calculation variants cleanly across modules.
 */
export default function WorkflowSelector({
  heading,
  subheading,
  chosen,
  selectedTitle,
  selectedSubtitle,
  onChangeWorkflow,
  options = [],
  currentValue,
  onSelectOption,
  columns = 2
}) {
  return (
    <div id="workspace-toolbar" className="workspace-toolbar arus103-active">
      <div className="work-selector">
        <div className="arus99-workflow-heading" hidden={chosen}>
          <strong>{heading}</strong>
          <span>{subheading}</span>
        </div>

        {chosen && (
          <div className="arus99-workflow-selected">
            <div>
              <b>{selectedTitle}</b>
              <small>{selectedSubtitle}</small>
            </div>
            <button
              type="button"
              className="btn"
              onClick={onChangeWorkflow}
            >
              Change Workflow
            </button>
          </div>
        )}

        {!chosen && (
          <div
            className="workspace-method-cards arus103-workflow-cards"
            data-columns={columns}
            role="group"
            aria-label="Choose calculation mode"
            style={{ marginTop: '12px' }}
          >
            {options.map((opt) => {
              const isActive = currentValue === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`workspace-method-card ${isActive ? 'active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => onSelectOption(opt.value)}
                >
                  <strong>{opt.label}</strong>
                  <small>{opt.description}</small>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
