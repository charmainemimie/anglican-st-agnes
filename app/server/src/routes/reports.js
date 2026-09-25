// Totals for the overview page and the arrears export.
import { Router } from "express";
import { Church } from "../models/Church.js";
import { Member } from "../models/Member.js";
import { Payment } from "../models/Payment.js";
import { getSettings } from "../models/Settings.js";
import { audit } from "../models/AuditLog.js";
import { requireAuth, churchScope } from "../middleware/auth.js";
import { account } from "../lib/tribute.js";
import { nowYear, todayLocal } from "../lib/months.js";
import { paidMaps, entryFor } from "../lib/ledgerService.js";

const router = Router();
router.use(requireAuth);

// Everything the user may see, with arrears worked out per member
async function load(user) {
  const churchFilter = user.role === "admin" ? {} : { _id: { $in: user.churchIds } };
  const [churches, members, settings] = await Promise.all([
    Church.find(churchFilter).sort({ archdeaconry: 1, parish: 1, name: 1 }).lean(),
    Member.find(churchScope(user)).lean(),
    getSettings(),
  ]);
  const maps = await paidMaps(members.map((m) => m._id));
  const now = nowYear();
  for (const m of members) {
    const e = entryFor(maps, m._id);
    Object.assign(m, account(m, e.paid, settings.feeHistory, now), { lastPaidOn: e.lastPaidOn });
  }
  return { churches, members, now };
}

router.get("/overview", async (req, res) => {
  const { churches, members, now } = await load(req.user);
  const year = now;

  // Money actually received this calendar year, per church
  const collected = await Payment.aggregate([
    { $match: { ...churchScope(req.user), voided: false, receivedOn: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } },
    { $group: { _id: "$churchId", cents: { $sum: "$amountCents" } } },
  ]);
  const collectedBy = Object.fromEntries(collected.map((c) => [c._id.toString(), c.cents]));

  const rows = churches.map((c) => {
    const ms = members.filter((m) => m.churchId.equals(c._id));
    return {
      id: c._id, name: c.name, parish: c.parish, archdeaconry: c.archdeaconry,
      active: ms.filter((m) => m.status === "active").length,
      archived: ms.filter((m) => m.status === "archived").length,
      owedCents: ms.reduce((s, m) => s + m.owedCents, 0),
      owingMembers: ms.filter((m) => m.owedCents > 0).length,
      collectedCents: collectedBy[c._id.toString()] || 0,
    };
  });
  res.json({ year, churches: rows });
});

// Spreadsheet programs run cells starting with = + - @ as formulas.
// Prefix them with ' so a member named "=HYPERLINK(...)" can't attack the office PC.
const cell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

router.get("/arrears.csv", async (req, res) => {
  const { churches, members } = await load(req.user);
  const byId = Object.fromEntries(churches.map((c) => [c._id.toString(), c]));
  const lines = [["Archdeaconry", "Parish", "Church", "Member", "Phone", "Status", "Owed (USD)", "Years owed", "Last date paid"].map(cell).join(",")];
  for (const m of members.filter((x) => x.owedCents > 0).sort((a, b) => b.owedCents - a.owedCents)) {
    const c = byId[m.churchId.toString()] || {};
    lines.push([c.archdeaconry, c.parish, c.name, m.name, m.phone, m.status, (m.owedCents / 100).toFixed(2), m.owingYears.join(" "), m.lastPaidOn || "Never"].map(cell).join(","));
  }
  await audit(req, "report.arrears_export", null, { rows: lines.length - 1 });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="st-agnes-arrears-${todayLocal()}.csv"`);
  res.send("\uFEFF" + lines.join("\r\n")); // BOM so Excel reads it as UTF-8
});

export default router;
