// Error helpers. Express 5 forwards errors thrown in async handlers here automatically.
import { config } from "../config.js";

// Throw this for expected problems: it becomes a clean JSON error for the client
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  // Malformed JSON body
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request body" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request too large" });
  // Duplicate key from a unique index (e.g. same username twice)
  if (err.code === 11000) return res.status(409).json({ error: "That already exists." });
  // Invalid ObjectId in a URL
  if (err.name === "CastError") return res.status(404).json({ error: "Not found" });
  // Anything else: log it, but never send internals (stack traces) to the browser
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server.", ...(config.isProd ? {} : { detail: err.message }) });
}
