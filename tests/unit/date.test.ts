import { afterEach, describe, expect, it } from 'vitest';
import { addDays, isValidDateString, todayInTokyo } from '../../src/server/config/date';

describe('業務日付', () => {
  afterEach(() => {
    delete process.env.BUSINESS_DATE;
  });

  it('BUSINESS_DATEで基準日を固定できる', () => {
    process.env.BUSINESS_DATE = '2026-11-24';
    expect(todayInTokyo(new Date('2026-11-25T00:30:00Z'))).toBe('2026-11-24');
  });

  it('未設定時はAsia/Tokyoの日付', () => {
    expect(todayInTokyo(new Date('2026-11-25T00:30:00Z'))).toBe('2026-11-25');
  });

  it('日付の加算と妥当性', () => {
    expect(addDays('2026-11-24', 30)).toBe('2026-12-24');
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2028-02-29')).toBe(true);
  });
});
