// Churches. Everyone signed in can list the churches they have access to;
// only admins add, edit or remove them.
import { Router } from "express";
import { z } from "zod";
import { Church } from "../models/Church.js";
import { Member } from "../models/Member.js";
import { getSettings } from "../models/Settings.js";
import { audit } from "../models/AuditLog.js";
import { requireAuth, requireAdmin, assertChurchAccess } from "../middleware/auth.js";
import { validate, name, text } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { _id: { $in: req.user.churchIds } };
  res.json({ churches: await Church.find(filter).sort({ archdeaconry: 1, parish: 1, name: 1 }).lean() });
});

router.get("/:id", async (req, res) => {
  assertChurchAccess(req.user, req.params.id);
  const church = await Church.findById(req.params.id).lean();
  if (!church) throw new HttpError(404, "Not found");
  res.json({ church });
});

const churchSchema = z.object({ name, parish: text(100).default(""), archdeaconry: text(100).default("") });

// The archdeaconry must be one of the ones set up in Settings
async function checkArch(arch) {
  if (!arch) return;
  const s = await getSettings();
  if (!s.archdeaconries.includes(arch)) throw new HttpError(400, "Unknown archdeaconry.");
}

router.post("/", requireAdmin, validate(churchSchema), async (req, res) => {
  await checkArch(req.valid.archdeaconry);
  const church = await Church.create(req.valid);
  await audit(req, "church.create", church._id, req.valid);
  res.status(201).json({ church });
});

router.put("/:id", requireAdmin, validate(churchSchema), async (req, res) => {
  await checkArch(req.valid.archdeaconry);
  const church = await Church.findByIdAndUpdate(req.params.id, req.valid, { new: true, runValidators: true });
  if (!church) throw new HttpError(404, "Not found");
  await audit(req, "church.update", church._id, req.valid);
  res.json({ church });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  if (await Member.exists({ churchId: req.params.id })) throw new HttpError(400, "Move or remove its members first.");
  const church = await Church.findByIdAndDelete(req.params.id);
  if (!church) throw new HttpError(404, "Not found");
  await audit(req, "church.delete", church._id, { name: church.name });
  res.status(204).end();
});

export default router;
