import { formatDate } from '../../../lib/format';
import type { ProgressStep } from '../../../types/api';

export function ProgressStepper({ steps }: { steps: ProgressStep[] }) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <div key={step.key} className={step.completed ? 'step completed' : 'step'}>
          <div className="step-dot">{step.completed ? '✓' : index + 1}</div>
          <div className="step-label">{step.label}</div>
          <div className="step-date">{step.completedAt ? formatDate(step.completedAt) : '—'}</div>
        </div>
      ))}
    </div>
  );
}
