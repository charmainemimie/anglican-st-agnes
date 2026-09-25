// Validates request bodies / queries with Zod. Unknown fields are stripped, so a
// client can never sneak extra fields (like role:"admin") into a database write.
import { z } from "zod";
import mongoose from "mongoose";
import { DATE_RE } from "../lib/months.js";

export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const first = result.error.issues[0];
    return res.status(400).json({ error: `${first.path.join(".") || "input"}: ${first.message}` });
  }
  req.valid = result.data;
  next();
};

// Reusable field rules
export const year = z.coerce.number().int("must be a whole year").min(1950, "is too early").max(2100, "is too late");
export const date = z.string().regex(DATE_RE, "must be a date like 2026-09-25");
export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), "invalid id");
export const text = (max = 100) => z.string().trim().max(max);
export const name = z.string().trim().min(1, "is required").max(100);
// Money arrives in dollars from the form and is stored as integer cents
export const dollars = z.coerce.number().positive("must be more than 0").max(10000, "is too large")
  .transform((v) => Math.round(v * 100));
