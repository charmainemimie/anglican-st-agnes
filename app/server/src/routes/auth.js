// Sign in, sign out, current user, change password.
import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { Church } from "../models/Church.js";
import { audit } from "../models/AuditLog.js";
import { validate } from "../middleware/validate.js";
import { loginLimiter } from "../middleware/security.js";
import { startSession, endSession, revokeSessions, requireLogin } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { verifyPassword, hashPassword, checkPolicy, matchesAny, DUMMY_HASH, HISTORY } from "../lib/passwords.js";

const router = Router();
const MAX_FAILS = 5; // wrong passwords before the account locks
const LOCK_MINUTES = 15;

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(60),
  password: z.string().min(1).max(128),
});

router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.valid;
  const user = await User.findOne({ username }).select("+passwordHash");
  // Same message for every failure so attackers can't tell which part was wrong
  const fail = new HttpError(401, "Incorrect username or password.");

  if (!user) {
    await verifyPassword(password, DUMMY_HASH); // equal timing whether or not the user exists
    throw fail;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, `Too many wrong passwords. This account is locked for ${LOCK_MINUTES} minutes.`);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok || !user.active) {
    if (user.active) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        user.failedLogins = 0;
        await audit({ user, ip: req.ip }, "auth.locked", user._id);
      }
      await user.save();
    }
    throw fail;
  }

  user.failedLogins = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  await startSession(req, res, user);
  await audit({ user, ip: req.ip }, "auth.login", user._id);
  res.json({ user: await publicWithChurches(user) });
});

router.post("/logout", async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

router.get("/me", requireLogin, async (req, res) => {
  res.json({ user: await publicWithChurches(req.user) });
});

const changeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

router.post("/change-password", requireLogin, validate(changeSchema), async (req, res) => {
  const user = await User.findById(req.user._id).select("+passwordHash +previousHashes");
  if (!(await verifyPassword(req.valid.currentPassword, user.passwordHash))) {
    throw new HttpError(400, "Your current password is wrong.");
  }
  const problem = checkPolicy(req.valid.newPassword, user.username);
  if (problem) throw new HttpError(400, problem);
  // No reusing the current, temporary or recent passwords
  if (await matchesAny(req.valid.newPassword, [user.passwordHash, ...user.previousHashes])) {
    throw new HttpError(400, "Choose a password you haven't used before.");
  }
  user.previousHashes = [user.passwordHash, ...user.previousHashes].slice(0, HISTORY);
  user.passwordHash = await hashPassword(req.valid.newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save();
  // Sign out every other device that was using the old password
  await revokeSessions(user._id, req.sessionDoc._id);
  await audit(req, "auth.password_changed", user._id);
  res.json({ user: await publicWithChurches(user) });
});

// User info plus the names of their churches (handy for treasurers)
async function publicWithChurches(user) {
  const pub = user.toPublic();
  if (user.role === "treasurer") {
    pub.churches = await Church.find({ _id: { $in: user.churchIds } }).select("name parish archdeaconry").lean();
  }
  return pub;
}

export default router;
