// Server-side sessions. The browser only holds a random token in an httpOnly
// cookie; we store its SHA-256 hash, so a leaked database can't be used to log in.
// Sessions can be revoked instantly (logout, password change, handover).
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  // MongoDB deletes the document automatically once this date passes (TTL index)
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  ip: String,
  userAgent: String,
});

export const Session = mongoose.model("Session", sessionSchema);
