// Display helpers. Money arrives from the server in cents; tributes are yearly.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 500 -> "$5", 250 -> "$2.50"
export const money = (cents) => {
  const v = (cents || 0) / 100;
  return "$" + (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2));
};

// "2026-03-14" -> "14 Mar 2026"; empty -> "date not recorded"
export const formatDate = (d) => (d ? `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : "date not recorded");

// Today as "YYYY-MM-DD" in the phone's local time (not UTC)
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const thisYear = () => new Date().getFullYear();

// [2021, 2022, 2023, 2025] -> "2021–2023, 2025"
export function summariseYears(list = []) {
  if (!list.length) return "";
  const runs = [];
  let start = list[0], prev = list[0];
  for (const y of list.slice(1)) {
    if (y === prev + 1) { prev = y; continue; }
    runs.push([start, prev]);
    start = prev = y;
  }
  runs.push([start, prev]);
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
