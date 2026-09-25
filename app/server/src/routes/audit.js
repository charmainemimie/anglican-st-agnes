// Activity log for the diocesan office.
import { Router } from "express";
import { z } from "zod";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", validate(z.object({ before: z.string().datetime().optional() }), "query"), async (req, res) => {
  const filter = req.valid.before ? { at: { $lt: new Date(req.valid.before) } } : {};
  const entries = await AuditLog.find(filter).sort({ at: -1 }).limit(100).lean();
  res.json({ entries });
});

export default router;
