// Account management for the diocesan office (admins only).
import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { Church } from "../models/Church.js";
import { audit } from "../models/AuditLog.js";
import { requireAuth, requireAdmin, revokeSessions } from "../middleware/auth.js";
import { validate, objectId, name, text } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { hashPassword, tempPassword } from "../lib/passwords.js";

const router = Router();
router.use(requireAuth, requireAdmin);

const username = z.string().trim().toLowerCase().min(3, "needs at least 3 characters").max(40)
  .regex(/^[a-z0-9._-]+$/, "use only letters, numbers, dots, dashes and underscores");

// Check that every church id given actually exists
async function checkChurches(ids) {
  if (!ids.length) return;
  const n = await Church.countDocuments({ _id: { $in: ids } });
  if (n !== ids.length) throw new HttpError(400, "One of the churches doesn't exist.");
}

// Never leave the diocese without an active admin
async function assertAnotherAdmin(exceptId) {
  const n = await User.countDocuments({ role: "admin", active: true, _id: { $ne: exceptId } });
  if (n === 0) throw new HttpError(400, "There must always be at least one active diocesan admin.");
}

router.get("/", async (req, res) => {
  const users = await User.find().sort({ role: 1, office: 1 });
  res.json({ users: users.map((u) => u.toPublic()) });
});

const createSchema = z.object({
  office: name,
  holderName: text(100).default(""),
  username,
  role: z.enum(["admin", "treasurer"]),
  churchIds: z.array(objectId).max(50).default([]),
});

// Create an account. The temporary password is shown ONCE in the response
// and must be changed at first sign-in. Only its hash is stored.
router.post("/", validate(createSchema), async (req, res) => {
  const v = req.valid;
  if (v.role === "treasurer" && !v.churchIds.length) throw new HttpError(400, "Pick at least one church for a treasurer.");
  await checkChurches(v.churchIds);
  const temp = tempPassword();
  const user = await User.create({
    ...v,
    churchIds: v.role === "admin" ? [] : v.churchIds,
    passwordHash: await hashPassword(temp),
    mustChangePassword: true,
  });
  await audit(req, "user.create", user._id, { office: v.office, username: v.username, role: v.role });
  res.status(201).json({ user: user.toPublic(), tempPassword: temp });
});

const updateSchema = z.object({
  office: name.optional(),
  role: z.enum(["admin", "treasurer"]).optional(),
  churchIds: z.array(objectId).max(50).optional(),
  active: z.boolean().optional(),
});

router.patch("/:id", validate(updateSchema), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, "Not found");
  const v = req.valid;
  const isSelf = user._id.equals(req.user._id);
  if (isSelf && (v.active === false || v.role === "treasurer")) throw new HttpError(400, "You can't remove your own admin access.");
  if (user.role === "admin" && (v.active === false || v.role === "treasurer")) await assertAnotherAdmin(user._id);
  if (v.churchIds) await checkChurches(v.churchIds);

  Object.assign(user, v);
  if (user.role === "admin") user.churchIds = [];
  if (user.role === "treasurer" && !user.churchIds.length) throw new HttpError(400, "Pick at least one church for a treasurer.");
  await user.save();
  // Deactivating or changing access ends existing sessions immediately
  if (v.active === false || v.role || v.churchIds) await revokeSessions(user._id);
  await audit(req, "user.update", user._id, v);
  res.json({ user: user.toPublic() });
});

const handoverSchema = z.object({ holderName: name, username });

// HANDOVER: a new person takes over this office.
// New username, new one-time password, everyone signed out, old passwords can't come back.
router.post("/:id/handover", validate(handoverSchema), async (req, res) => {
  const user = await User.findById(req.params.id).select("+passwordHash +previousHashes");
  if (!user) throw new HttpError(404, "Not found");
  const temp = tempPassword();
  user.handovers.push({ fromHolder: user.holderName, toHolder: req.valid.holderName, by: req.user._id });
  user.holderName = req.valid.holderName;
  user.username = req.valid.username;
  // Keep old hashes so the previous holder's password can never be set again
  user.previousHashes = [user.passwordHash, ...user.previousHashes].slice(0, 5);
  user.passwordHash = await hashPassword(temp);
  user.mustChangePassword = true;
  user.failedLogins = 0;
  user.lockedUntil = undefined;
  user.active = true;
  await user.save();
  await revokeSessions(user._id);
  await audit(req, "user.handover", user._id, { to: req.valid.holderName, username: req.valid.username });
  res.json({ user: user.toPublic(), tempPassword: temp });
});

// Forgotten password: new one-time password, same person
router.post("/:id/reset-password", async (req, res) => {
  const user = await User.findById(req.params.id).select("+passwordHash +previousHashes");
  if (!user) throw new HttpError(404, "Not found");
  const temp = tempPassword();
  user.previousHashes = [user.passwordHash, ...user.previousHashes].slice(0, 5);
  user.passwordHash = await hashPassword(temp);
  user.mustChangePassword = true;
  user.failedLogins = 0;
  user.lockedUntil = undefined;
  await user.save();
  await revokeSessions(user._id);
  await audit(req, "user.reset_password", user._id);
  res.json({ user: user.toPublic(), tempPassword: temp });
});

export default router;
