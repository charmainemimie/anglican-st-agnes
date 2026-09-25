// Tribute maths, kept free of database code so it can be unit tested.
// Tributes are paid once per YEAR. Money is in whole CENTS ($5 = 500) to avoid
// floating-point rounding errors.
import { yearRange } from "./months.js";

// How many years ahead a member may pay in advance
export const MAX_YEARS_AHEAD = 1;

// Fee history, e.g. [{from:1950, feeCents:200}, {from:2025, feeCents:500}]
// means $2 a year up to 2024 and $5 a year from 2025.
export const DEFAULT_FEES = [{ from: 1950, feeCents: 200 }, { from: 2025, feeCents: 500 }];

// Fee (in cents) for a given year
export function feeFor(feeHistory, year) {
  const hist = [...feeHistory].sort((a, b) => a.from - b.from);
  let fee = hist[0]?.feeCents ?? 500;
  for (const h of hist) if (h.from <= year) fee = h.feeCents;
  return fee;
}

// Last year a member owes for: the current year while active, or her archive year
export const lastDueYear = (member, now) => (member.status === "archived" ? member.archivedAt : now);

// Total owed and the years still short.
// `paid` is { 2025: 500, 2026: 200 } built from non-voided receipts.
export function account(member, paid, feeHistory, now) {
  const end = lastDueYear(member, now);
  let owedCents = 0;
  const owingYears = [];
  for (const y of yearRange(member.joined, end)) {
    const short = feeFor(feeHistory, y) - (paid[y] || 0);
    if (short > 0) {
      owedCents += short;
      owingYears.push(y);
    }
  }
  return { owedCents, owingYears };
}

// Spread a payment over the oldest unpaid years first.
// If `onlyYear` is given, the payment may only go to that year.
export function allocate(member, paid, feeHistory, amountCents, now, onlyYear = null) {
  const limit = member.status === "archived" ? member.archivedAt : now + MAX_YEARS_AHEAD;
  const years = onlyYear ? [onlyYear] : yearRange(member.joined, limit);
  const allocations = [];
  let left = amountCents;
  for (const y of years) {
    if (left <= 0) break;
    if (y < member.joined || y > limit) continue; // outside her membership
    const short = feeFor(feeHistory, y) - (paid[y] || 0);
    if (short <= 0) continue;
    const put = Math.min(short, left);
    allocations.push({ year: y, cents: put });
    left -= put;
  }
  return { allocations, leftoverCents: left };
}

// Year-by-year ledger for the member page, newest first.
// `dates` is { 2026: ["2026-03-14"], ... }: the dates each year was paid.
export function ledger(member, paid, dates, feeHistory, now) {
  const end = lastDueYear(member, now);
  const lastPaidYear = Math.max(member.joined, ...Object.keys(paid).map(Number));
  const top = Math.max(end, lastPaidYear);
  const rows = [];
  for (let y = top; y >= member.joined; y--) {
    const fee = feeFor(feeHistory, y);
    const p = paid[y] || 0;
    let status = "notdue"; // an advance year, or after archiving
    if (p >= fee) status = "paid";
    else if (p > 0) status = "part";
    else if (y <= end) status = "owed";
    rows.push({ year: y, feeCents: fee, paidCents: p, status, paidOn: dates[y] || [] });
  }
  return rows;
}
