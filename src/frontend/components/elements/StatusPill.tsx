import { statusPillStyle } from '../../lib/designTokens';

export function StatusPill({ status }: { status: string }) {
  return (
    <span className="pill" style={statusPillStyle(status)}>
      {status}
    </span>
  );
}
