// Archdeaconries and the monthly tribute amount.
import { Router } from "express";
import { z } from "zod";
import { getSettings } from "../models/Settings.js";
import { Church } from "../models/Church.js";
import { audit } from "../models/AuditLog.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validate, year, dollars, name } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { feeFor } from "../lib/tribute.js";
import { nowYear } from "../lib/months.js";

const router = Router();
router.use(requireAuth);

const shape = (s) => ({
  archdeaconries: s.archdeaconries,
  feeHistory: s.feeHistory,
  currentFeeCents: feeFor(s.feeHistory, nowYear()),
  currentYear: nowYear(),
});

router.get("/", async (req, res) => res.json(shape(await getSettings())));

router.put("/archdeaconries", requireAdmin, validate(z.object({ archdeaconries: z.array(name).max(50) })), async (req, res) => {
  const s = await getSettings();
  const next = [...new Set(req.valid.archdeaconries)].sort();
  // Don't allow removing an archdeaconry that still has churches
  const removed = s.archdeaconries.filter((a) => !next.includes(a));
  if (removed.length && (await Church.exists({ archdeaconry: { $in: removed } }))) {
    throw new HttpError(400, "Move its churches to another archdeaconry first.");
  }
  s.archdeaconries = next;
  await s.save();
  await audit(req, "settings.archdeaconries", null, { archdeaconries: next });
  res.json(shape(s));
});

// Change the yearly tribute from a given year onwards (earlier years keep their fee)
router.post("/fees", requireAdmin, validate(z.object({ from: year, fee: dollars })), async (req, res) => {
  const s = await getSettings();
  s.feeHistory = [...s.feeHistory.filter((h) => h.from !== req.valid.from), { from: req.valid.from, feeCents: req.valid.fee }]
    .sort((a, b) => a.from - b.from);
  await s.save();
  await audit(req, "settings.fee", null, { from: req.valid.from, feeCents: req.valid.fee });
  res.json(shape(s));
});

export default router;
