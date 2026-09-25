// Sessions and permission checks.
import crypto from "node:crypto";
import { config } from "../config.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { HttpError } from "./errors.js";

// "__Host-" prefix makes browsers insist the cookie is Secure, host-only and path=/,
// which stops subdomains from overwriting it. It needs HTTPS, so only in production.
export const COOKIE = config.isProd ? "__Host-stagnes" : "stagnes_sid";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const cookieOptions = () => ({
  httpOnly: true, // JavaScript in the page can't read it (protects against XSS theft)
  secure: config.isProd, // HTTPS only in production
  sameSite: "strict", // never sent on requests from other sites
  path: "/",
  maxAge: config.SESSION_TTL_HOURS * 3600 * 1000,
});

// Start a session after a successful login
export async function startSession(req, res, user) {
  const token = crypto.randomBytes(32).toString("base64url"); // 256 bits of randomness
  await Session.create({
    tokenHash: sha256(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + config.SESSION_TTL_HOURS * 3600 * 1000),
    ip: req.ip,
    userAgent: (req.get("User-Agent") || "").slice(0, 200),
  });
  res.cookie(COOKIE, token, cookieOptions());
}

export async function endSession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) await Session.deleteOne({ tokenHash: sha256(token) });
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
}

// Sign a user out everywhere (optionally keeping the current session)
export const revokeSessions = (userId, exceptSessionId) =>
  Session.deleteMany({ userId, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) });

// Runs on every API request: attaches req.user if the cookie is a valid session
export async function loadSession(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token || typeof token !== "string" || token.length > 100) return next();
  const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!session) return next();

  // Idle timeout: sign out if unused for too long (e.g. a shared phone left open)
  const idleMs = config.SESSION_IDLE_MINUTES * 60 * 1000;
  if (Date.now() - session.lastSeenAt.getTime() > idleMs) {
    await session.deleteOne();
    return next();
  }

  const user = await User.findById(session.userId);
  if (!user || !user.active) {
    await session.deleteOne();
    return next();
  }
  // Refresh "last seen" at most once a minute to avoid a write on every request
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 1000) {
    session.lastSeenAt = new Date();
    await session.save();
  }
  req.user = user;
  req.sessionDoc = session;
  next();
}

// Must be signed in. Accounts with a temporary password can only change it.
export function requireAuth(req, res, next) {
  if (!req.user) throw new HttpError(401, "Please sign in.", "UNAUTHENTICATED");
  if (req.user.mustChangePassword) throw new HttpError(403, "Choose a new password to continue.", "PASSWORD_CHANGE_REQUIRED");
  next();
}

// Signed in, even with a temporary password (only used by /me and change-password)
export function requireLogin(req, res, next) {
  if (!req.user) throw new HttpError(401, "Please sign in.", "UNAUTHENTICATED");
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") throw new HttpError(403, "Only the diocesan office can do this.");
  next();
}

// Can this user work with this church? Admins: all. Treasurers: only assigned ones.
export const canAccessChurch = (user, churchId) =>
  user.role === "admin" || user.churchIds.some((id) => id.toString() === String(churchId));

export function assertChurchAccess(user, churchId) {
  // 404 rather than 403 so treasurers can't probe which ids exist elsewhere
  if (!canAccessChurch(user, churchId)) throw new HttpError(404, "Not found");
}

// Mongo filter limiting a query to the user's churches
export const churchScope = (user) => (user.role === "admin" ? {} : { churchId: { $in: user.churchIds } });
