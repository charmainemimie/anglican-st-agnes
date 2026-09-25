// A login account. Each account belongs to an OFFICE (e.g. "Diocesan Secretary",
// "Treasurer, St Mary's Mucheke"). When a new person takes over the office,
// an admin performs a handover: new username, new temporary password,
// all existing sessions ended.
import mongoose from "mongoose";

const handoverSchema = new mongoose.Schema(
  {
    fromHolder: String,
    toHolder: String,
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    office: { type: String, required: true, trim: true },
    holderName: { type: String, trim: true, default: "" }, // the person currently in the office
    role: { type: String, enum: ["admin", "treasurer"], required: true },
    churchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Church" }], // treasurers only

    // select:false keeps password hashes out of every query unless explicitly asked for
    passwordHash: { type: String, required: true, select: false },
    previousHashes: { type: [String], default: [], select: false }, // blocks re-using recent passwords
    mustChangePassword: { type: Boolean, default: true }, // true for new, reset or handed-over accounts
    passwordChangedAt: Date,

    // Brute-force protection
    failedLogins: { type: Number, default: 0 },
    lockedUntil: Date,

    active: { type: Boolean, default: true },
    lastLoginAt: Date,
    handovers: { type: [handoverSchema], default: [] },
  },
  { timestamps: true }
);

// Shape sent to the browser: never includes hashes or lockout counters
userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    office: this.office,
    holderName: this.holderName,
    role: this.role,
    churchIds: this.churchIds.map(String),
    mustChangePassword: this.mustChangePassword,
    active: this.active,
    lastLoginAt: this.lastLoginAt,
    passwordChangedAt: this.passwordChangedAt,
    handovers: this.handovers,
  };
};

export const User = mongoose.model("User", userSchema);
