import { DESIGN_TOKENS } from '../../../lib/designTokens';
import type { DashboardKpis } from '../../../types/api';

export function KpiCards({ kpis }: { kpis: DashboardKpis }) {
  const cards = [
    {
      label: '発注待ち（受付）',
      value: kpis.pendingOrdersCount,
      color: DESIGN_TOKENS.kpiColors.pending,
    },
    {
      label: '輸入・輸送中',
      value: kpis.inTransitOrdersCount,
      color: DESIGN_TOKENS.kpiColors.inTransit,
    },
    { label: '未入金', value: kpis.unpaidInvoicesCount, color: DESIGN_TOKENS.kpiColors.unpaid },
    {
      label: '今月の受注',
      value: kpis.currentMonthOrdersCount,
      color: DESIGN_TOKENS.kpiColors.today,
    },
  ];
  return (
    <div className="summary-chips">
      {cards.map((card) => (
        <div key={card.label} className="summary-chip" style={{ borderLeftColor: card.color }}>
          <span className="summary-label">{card.label}</span>
          <span className="summary-value">{card.value}</span>
          <span className="summary-unit">件</span>
        </div>
      ))}
    </div>
  );
}
