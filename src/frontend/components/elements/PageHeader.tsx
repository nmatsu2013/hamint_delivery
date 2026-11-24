import type { ReactNode } from 'react';
import { formatToday } from '../../lib/format';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  showDate?: boolean;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  showDate = true,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      <div className="inline">
        {actions}
        {showDate ? (
          <div className="date-box">
            <div className="date-box-label">表示日</div>
            <div className="date-box-value">{formatToday()}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
