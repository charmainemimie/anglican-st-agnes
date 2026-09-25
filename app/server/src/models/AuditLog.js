// Who did what and when. Written for every change; read by admins only.
import mongoose from "mongoose";

const auditSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  username: String, // copied so the log stays readable after a handover
  action: { type: String, required: true }, // e.g. "payment.create"
  target: String, // id of the thing changed
  details: mongoose.Schema.Types.Mixed,
  ip: String,
});

export const AuditLog = mongoose.model("AuditLog", auditSchema);

// Record an action. Logging failures are reported but never break the request.
export async function audit(req, action, target, details = {}) {
  try {
    await AuditLog.create({ userId: req.user?._id, username: req.user?.username, action, target: target ? String(target) : undefined, details, ip: req.ip });
  } catch (e) {
    console.error("Audit log write failed:", e.message);
  }
}
