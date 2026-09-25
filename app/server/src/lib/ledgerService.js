// Database helpers that turn receipts into "paid per year" figures.
import mongoose from "mongoose";
import { Payment } from "../models/Payment.js";

// For many members at once, one aggregation instead of one query per member.
// Returns { memberId: { paid: {2026: 500}, dates: {2026: ["2026-03-14"]}, lastPaidOn } }
export async function paidMaps(memberIds) {
  if (!memberIds.length) return {};
  const rows = await Payment.aggregate([
    { $match: { memberId: { $in: memberIds.map((id) => new mongoose.Types.ObjectId(String(id))) }, voided: false } },
    { $unwind: "$allocations" },
    {
      $group: {
        _id: { m: "$memberId", year: "$allocations.year" },
        cents: { $sum: "$allocations.cents" },
        dates: { $addToSet: "$receivedOn" }, // every date money was paid towards this year
      },
    },
  ]);
  const out = {};
  for (const r of rows) {
    const e = (out[r._id.m.toString()] ||= { paid: {}, dates: {}, lastPaidOn: null });
    const dates = r.dates.filter(Boolean).sort();
    e.paid[r._id.year] = r.cents;
    e.dates[r._id.year] = dates;
    const last = dates[dates.length - 1];
    if (last && (!e.lastPaidOn || last > e.lastPaidOn)) e.lastPaidOn = last;
  }
  return out;
}

const EMPTY = { paid: {}, dates: {}, lastPaidOn: null };
export const paidMap = async (memberId) => (await paidMaps([memberId]))[String(memberId)] || EMPTY;
export const entryFor = (maps, id) => maps[String(id)] || EMPTY;
