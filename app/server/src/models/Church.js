// A church, grouped under a parish and an archdeaconry.
import mongoose from "mongoose";

const churchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    parish: { type: String, trim: true, default: "" },
    archdeaconry: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);
// The same church name can exist in different parishes, but not twice in one
churchSchema.index({ name: 1, parish: 1 }, { unique: true });

export const Church = mongoose.model("Church", churchSchema);
