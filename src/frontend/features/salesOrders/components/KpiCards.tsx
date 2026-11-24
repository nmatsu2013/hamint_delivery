import { DESIGN_TOKENS } from '../../../lib/designTokens';
import type { DashboardKpis } from '../../../types/api';

export function KpiCards({ kpis }: { kpis: DashboardKpis }) {
  const cards = [
    { label: '本日の受注', value: kpis.todayOrdersCount, color: DESIGN_TOKENS.kpiColors.today },
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
  ];
  return (
    <div className="kpi-grid">
      {cards.map((card) => (
        <div key={card.label} className="kpi-card" style={{ borderTopColor: card.color }}>
          <div className="kpi-label">{card.label}</div>
          <div>
            <span className="kpi-value">{card.value}</span>
            <span className="kpi-unit">件</span>
          </div>
        </div>
      ))}
    </div>
  );
}
