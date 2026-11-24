const TOKYO_TIME_ZONE = 'Asia/Tokyo';

/**
 * Asia/Tokyo の YYYY-MM-DD を返す。
 * 受入テストや帳票の基準日を固定したい場合は BUSINESS_DATE=YYYY-MM-DD を設定する。
 */
export function todayInTokyo(now = new Date()): string {
  const override = process.env.BUSINESS_DATE;
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    return override;
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TOKYO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/** Date を Asia/Tokyo の YYYY-MM-DD に変換する。 */
export function toDateString(date: Date): string {
  return todayInTokyo(date);
}

/** YYYY-MM-DD の妥当性チェック。 */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** YYYY-MM-DD を採番用のUTC Dateに変換する（日付部分のみ利用）。 */
export function dateStringToUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** 業務日付（BUSINESS_DATE または Asia/Tokyo の今日）をUTC Dateとして返す。 */
export function todayAsUtcDate(now = new Date()): Date {
  return dateStringToUtcDate(todayInTokyo(now));
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
