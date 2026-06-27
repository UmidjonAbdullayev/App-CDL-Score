const REPORTS_BASE = 512_000;
const REPORTS_BASELINE_DATE = new Date('2026-05-29T00:00:00.000Z');

function seededDailyBonus(dateKey: string): number {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (Math.imul(31, h) + dateKey.charCodeAt(i)) | 0;
  const norm = Math.abs(h) / 2147483648;
  return Math.floor(norm * 90) + 10; // 10–99
}

export function getCarrierReportsCount(): number {
  const daysSince = Math.floor(
    (Date.now() - REPORTS_BASELINE_DATE.getTime()) / (1000 * 60 * 60 * 24)
  );
  let bonus = 0;
  for (let d = 0; d <= Math.max(0, daysSince); d++) {
    const date = new Date(REPORTS_BASELINE_DATE);
    date.setUTCDate(date.getUTCDate() + d);
    bonus += seededDailyBonus(date.toISOString().slice(0, 10));
  }
  return REPORTS_BASE + bonus;
}
