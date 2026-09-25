// A receipt. This is the source of truth for what has been paid.
// Receipts are never edited or deleted, only voided with a reason, so there
// is always an audit trail of money received.
import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema(
  { year: { type: Number, required: true }, cents: { type: Number, required: true, min: 1 } },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true, index: true },
    churchId: { type: mongoose.Schema.Types.ObjectId, ref: "Church", required: true, index: true },
    amountCents: { type: Number, required: true, min: 1 }, // integers only: $5 = 500
    allocations: { type: [allocationSchema], required: true },
    // Date the money was paid, "YYYY-MM-DD". Empty only for old payments copied
    // from the paper books where the date wasn't written down.
    receivedOn: { type: String, default: null },
    note: { type: String, default: "" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    voided: { type: Boolean, default: false },
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    voidReason: String,
  },
  { timestamps: true }
);
paymentSchema.index({ memberId: 1, voided: 1 });
paymentSchema.index({ receivedOn: 1, voided: 1 });

export const Payment = mongoose.model("Payment", paymentSchema);
