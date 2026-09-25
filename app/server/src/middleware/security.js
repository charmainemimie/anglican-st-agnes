// Request-level protections: CSRF and rate limits.
import rateLimit from "express-rate-limit";
import { config } from "../config.js";

// CSRF protection. Our session cookie is SameSite=Strict, and every state-changing
// request must also carry a custom header. Browsers won't let another website send
// that header without a CORS preflight, which this server never approves.
// The Origin header, when present, must match the app's own address.
export function csrfGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("X-Requested-With") !== "stagnes") return res.status(403).json({ error: "Request blocked" });
  const origin = req.get("Origin");
  if (origin && origin !== config.APP_ORIGIN) return res.status(403).json({ error: "Request blocked" });
  next();
}

// General API limit per IP address
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Wait a few minutes and try again." },
});

// Tight limit on login attempts per IP (account lockout adds per-username protection)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Wait 15 minutes and try again." },
});
