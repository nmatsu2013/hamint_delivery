export const CONSUMPTION_TAX_RATE = 0.1;

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function clampPageSize(limit?: number): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

export function parseOffset(offset?: number): number {
  if (!offset || Number.isNaN(offset) || offset < 0) {
    return 0;
  }
  return Math.trunc(offset);
}
