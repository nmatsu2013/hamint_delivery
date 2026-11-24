import { formatDate } from '../../../lib/format';
import { DESIGN_TOKENS } from '../../../lib/designTokens';
import type { ProgressStep } from '../../../types/api';

export function ProgressStepper({ steps }: { steps: ProgressStep[] }) {
  return (
    <div className="stepper">
      {steps.map((step, index) => {
        const stepColor = DESIGN_TOKENS.progressStepColors[index] ?? '#00A497';
        return (
          <div key={step.key} className={step.completed ? 'step completed' : 'step'}>
            <div
              className="step-dot"
              style={
                step.completed
                  ? {
                      backgroundColor: stepColor,
                      boxShadow: `0 0 0 1px ${stepColor}`,
                    }
                  : undefined
              }
            >
              {step.completed ? '✓' : index + 1}
            </div>
            <div
              className="step-label"
              style={step.completed ? { color: stepColor } : undefined}
            >
              {step.label}
            </div>
            <div className="step-date">{step.completedAt ? formatDate(step.completedAt) : '—'}</div>
          </div>
        );
      })}
    </div>
  );
}
