// Date helpers. Tributes are YEARLY, so years are plain integers (2026).
import { config } from "../config.js";

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Today's date "YYYY-MM-DD" in the diocese's time zone (Zimbabwe), not the server's
export function todayLocal(tz = config.TZ_NAME) {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Current year in the diocese's time zone
export const nowYear = (tz) => +todayLocal(tz).slice(0, 4);

// Every year from a to b inclusive (empty if a > b)
export function yearRange(a, b) {
  const out = [];
  for (let y = a; y <= b; y++) out.push(y);
  return out;
}
