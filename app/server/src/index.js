// Server entry point.
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { loadSession } from "./middleware/auth.js";
import { csrfGuard, apiLimiter } from "./middleware/security.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import settingsRoutes from "./routes/settings.js";
import churchRoutes from "./routes/churches.js";
import memberRoutes from "./routes/members.js";
import reportRoutes from "./routes/reports.js";
import auditRoutes from "./routes/audit.js";
import registerRoutes from "./routes/register.js";

const app = express();

// Behind a proxy (Nginx, Render, Railway...) this makes req.ip and HTTPS detection correct
if (config.TRUST_PROXY) app.set("trust proxy", config.TRUST_PROXY);
app.disable("x-powered-by");

// Security headers: strict Content Security Policy (only our own scripts, styles, fonts),
// no framing (clickjacking), HSTS in production, no MIME sniffing, etc.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "same-origin" },
  })
);

// Small JSON bodies only: nothing in this app needs more than a few KB
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

// API: rate limit, CSRF check, session, then routes. API responses are never cached.
app.use("/api", apiLimiter, csrfGuard, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
}, loadSession);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/churches", churchRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/register", registerRoutes);
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api", notFound);

// In production the server also serves the built React app from client/dist
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: "7d", immutable: true }));
  // Any other path returns the app shell (the app uses #/ routes, so this is just "/")
  app.get("/{*splat}", (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(errorHandler);

await connectDb();
app.listen(config.PORT, () => console.log(`St Agnes register API on port ${config.PORT}`));
