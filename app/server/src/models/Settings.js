// Diocese-wide settings, stored as a single document with key "main".
import mongoose from "mongoose";
import { DEFAULT_FEES } from "../lib/tribute.js";

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: "main", unique: true },
  archdeaconries: { type: [String], default: [] },
  // Yearly fee changes apply from a year onwards, so old years keep their old fee.
  // Default: $2 a year up to 2024, $5 a year from 2025.
  feeHistory: {
    type: [{ from: Number, feeCents: Number, _id: false }],
    default: () => DEFAULT_FEES,
  },
});

export const Settings = mongoose.model("Settings", settingsSchema);

// Fetch the settings document, creating it with defaults the first time
export async function getSettings() {
  return Settings.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, new: true });
}
