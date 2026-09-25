// A St Agnes Guild member (a girl). Payments live in the Payment collection.
import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    // Register details. Many members are minors, so only what the guild needs is kept.
    dateOfBirth: { type: String, default: null }, // "YYYY-MM-DD"
    guardianName: { type: String, trim: true, default: "" },
    guardianPhone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" }, // home address or village
    churchId: { type: mongoose.Schema.Types.ObjectId, ref: "Church", required: true, index: true },
    joined: { type: Number, required: true }, // year she joined; tribute owed from this year
    status: { type: String, enum: ["active", "archived"], default: "active" },
    archivedAt: Number, // last year she owes for
    archivedReason: String, // e.g. "Married"
    // Bumped on every payment so two treasurers can't allocate the same year at once
    ledgerVersion: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
memberSchema.index({ churchId: 1, status: 1 });
memberSchema.index({ name: 1 });

export const Member = mongoose.model("Member", memberSchema);
