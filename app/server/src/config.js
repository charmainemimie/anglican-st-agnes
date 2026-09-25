// Loads and validates environment variables once at start-up.
// The server refuses to start if anything required is missing or malformed.
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_TTL_HOURS: z.coerce.number().min(1).max(24 * 30).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().min(5).max(24 * 60).default(60),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  TZ_NAME: z.string().default("Africa/Harare"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Print which variables are wrong, without echoing their values
  console.error("Invalid configuration:", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  process.exit(1);
}

export const config = { ...parsed.data, isProd: parsed.data.NODE_ENV === "production" };
