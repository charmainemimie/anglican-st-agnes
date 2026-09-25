// The guild register: every girl with her personal details.
// Scoped like everything else: treasurers only see their own churches.
import { Router } from "express";
import { z } from "zod";
import { Member } from "../models/Member.js";
import { Church } from "../models/Church.js";
import { audit } from "../models/AuditLog.js";
import { requireAuth, churchScope, assertChurchAccess } from "../middleware/auth.js";
import { validate, objectId } from "../middleware/validate.js";
import { todayLocal } from "../lib/months.js";

const router = Router();
router.use(requireAuth);

const filterSchema = z.object({
  churchId: objectId.optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
});

// Age in whole years on a given day
export function ageOn(dob, today) {
  if (!dob) return null;
  let age = +today.slice(0, 4) - +dob.slice(0, 4);
  if (today.slice(5) < dob.slice(5)) age -= 1; // birthday not reached yet this year
  return age;
}

// Members matching the filters, sorted by church then name
async function load(req) {
  const { churchId, status } = req.valid;
  if (churchId) assertChurchAccess(req.user, churchId);
  const filter = { ...churchScope(req.user), ...(churchId ? { churchId } : {}), ...(status === "all" ? {} : { status }) };
  const churchFilter = req.user.role === "admin" ? {} : { _id: { $in: req.user.churchIds } };
  const [members, churches] = await Promise.all([Member.find(filter).sort({ name: 1 }).lean(), Church.find(churchFilter).lean()]);
  const byId = Object.fromEntries(churches.map((c) => [c._id.toString(), c]));
  const today = todayLocal();
  return members
    .map((m) => {
      const c = byId[m.churchId.toString()] || {};
      return {
        id: m._id, name: m.name, phone: m.phone, dateOfBirth: m.dateOfBirth, age: ageOn(m.dateOfBirth, today),
        guardianName: m.guardianName, guardianPhone: m.guardianPhone, address: m.address,
        joined: m.joined, status: m.status, archivedAt: m.archivedAt, archivedReason: m.archivedReason,
        church: c.name || "", parish: c.parish || "", archdeaconry: c.archdeaconry || "",
      };
    })
    .sort((a, b) => a.archdeaconry.localeCompare(b.archdeaconry) || a.church.localeCompare(b.church) || a.name.localeCompare(b.name));
}

router.get("/", validate(filterSchema, "query"), async (req, res) => {
  res.json({ members: await load(req) });
});

// Spreadsheet programs run cells starting with = + - @ as formulas; neutralise them
const cell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

router.get("/export.csv", validate(filterSchema, "query"), async (req, res) => {
  const rows = await load(req);
  const head = ["Archdeaconry", "Parish", "Church", "Name", "Date of birth", "Age", "Phone", "Parent/guardian", "Guardian phone", "Address/village", "Joined", "Status", "Archived reason", "Archived year"];
  const lines = [head.map(cell).join(",")];
  for (const r of rows) {
    lines.push([r.archdeaconry, r.parish, r.church, r.name, r.dateOfBirth, r.age, r.phone, r.guardianName, r.guardianPhone, r.address, r.joined, r.status, r.archivedReason, r.archivedAt].map(cell).join(","));
  }
  // Personal data leaving the system is always logged
  await audit(req, "register.export", req.valid.churchId, { rows: rows.length, status: req.valid.status });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="st-agnes-register-${todayLocal()}.csv"`);
  res.send("\uFEFF" + lines.join("\r\n")); // BOM so Excel reads it as UTF-8
});

export default router;
