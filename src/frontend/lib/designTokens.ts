export const DESIGN_TOKENS = {
  colors: {
    bg: '#FFFFFF',
    textMain: '#1A2B42',
    textMuted: '#5B6B80',
    headerBg: '#162840',
    headerActiveBorder: '#4FD1C0',
    accentButton: '#00A497',
    accentText: '#2A7F6C',
    cardBg: '#F6F8FA',
    borderLight: '#E1E7EE',
    borderTable: '#DDE5EE',
    tableHeaderBg: '#ECF0F4',
  },
  statusPills: {
    受付: { bg: '#EAF0F5', fg: '#3F5068' },
    発注済: { bg: '#DDF0E8', fg: '#1F6B57' },
    '輸入・輸送中': { bg: '#FFEFC7', fg: '#6E4700' },
    入荷済: { bg: '#E4E3F7', fg: '#413A8C' },
    出荷済: { bg: '#DDEBFA', fg: '#1F4E86' },
    完了: { bg: '#E3E8EE', fg: '#3F5068' },
    取消: { bg: '#FDE8E8', fg: '#9B1C1C' },
    下書き: { bg: '#EAF0F5', fg: '#3F5068' },
    一部入荷: { bg: '#FFEFC7', fg: '#6E4700' },
    入荷完了: { bg: '#DDF0E8', fg: '#1F6B57' },
    書類準備中: { bg: '#EAF0F5', fg: '#3F5068' },
    申請済: { bg: '#DDEBFA', fg: '#1F4E86' },
    確認中: { bg: '#FFEFC7', fg: '#6E4700' },
    承認: { bg: '#DDF0E8', fg: '#1F6B57' },
    差戻し: { bg: '#FDE8E8', fg: '#9B1C1C' },
    準備中: { bg: '#EAF0F5', fg: '#3F5068' },
    発送済: { bg: '#DDEBFA', fg: '#1F4E86' },
    納品済: { bg: '#DDF0E8', fg: '#1F6B57' },
    不達: { bg: '#FDE8E8', fg: '#9B1C1C' },
    未請求: { bg: '#EAF0F5', fg: '#3F5068' },
    請求済: { bg: '#DDEBFA', fg: '#1F4E86' },
    一部入金: { bg: '#FFEFC7', fg: '#6E4700' },
    入金済: { bg: '#DDF0E8', fg: '#1F6B57' },
    使用可: { bg: '#DDF0E8', fg: '#1F6B57' },
    保留: { bg: '#FFEFC7', fg: '#6E4700' },
    回収: { bg: '#FDE8E8', fg: '#9B1C1C' },
  } as Record<string, { bg: string; fg: string }>,
  kpiColors: {
    today: '#00A497',
    pending: '#7DB7E8',
    inTransit: '#E0A92B',
    unpaid: '#D9604F',
  },
  paymentStatusColors: {
    未請求: '#5B6B80',
    '未入金（請求済）': '#9A2B1F',
    入金済: '#14633A',
  } as Record<string, string>,
  progressStepColors: [
    '#16A34A', // 1: 受注 (緑)
    '#65A30D', // 2: 発注 (黄緑)
    '#84CC16', // 3: 輸入申請 (黄緑〜黄)
    '#EAB308', // 4: 輸送・通関 (黄色)
    '#F59E0B', // 5: 入庫・検品 (山吹色 / 黄橙)
    '#EA580C', // 6: 出荷 (オレンジ)
    '#F43F5E', // 7: 納品 (コーラルピンク)
    '#EC4899', // 8: 入金 (ピンク)
  ],
  progressStepTextColors: [
    '#16A34A', // 1: 緑
    '#65A30D', // 2: 黄緑
    '#4D7C0F', // 3: 黄緑
    '#B45309', // 4: 黄色 (テキスト視認性確保)
    '#C2410C', // 5: 山吹色
    '#EA580C', // 6: オレンジ
    '#E11D48', // 7: コーラルピンク
    '#DB2777', // 8: ピンク
  ],
};

export function statusPillStyle(status: string): { backgroundColor: string; color: string } {
  const pill = DESIGN_TOKENS.statusPills[status] ?? { bg: '#EAF0F5', fg: '#3F5068' };
  return { backgroundColor: pill.bg, color: pill.fg };
}
