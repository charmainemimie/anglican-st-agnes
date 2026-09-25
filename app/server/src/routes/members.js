// Guild members and their yearly payments.
import { Router } from "express";
import { z } from "zod";
import { Member } from "../models/Member.js";
import { Church } from "../models/Church.js";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import { getSettings } from "../models/Settings.js";
import { audit } from "../models/AuditLog.js";
import { requireAuth, requireAdmin, assertChurchAccess, churchScope } from "../middleware/auth.js";
import { validate, name, text, year, date, dollars, objectId } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { account, allocate, ledger, feeFor, MAX_YEARS_AHEAD } from "../lib/tribute.js";
import { nowYear, todayLocal } from "../lib/months.js";
import { paidMaps, paidMap, entryFor } from "../lib/ledgerService.js";

const router = Router();
router.use(requireAuth);

// Load a member and check the user may see her church (404 otherwise)
async function loadMember(req) {
  const member = await Member.findById(req.params.id);
  if (!member) throw new HttpError(404, "Not found");
  assertChurchAccess(req.user, member.churchId);
  return member;
}

// What lists show for each member: arrears plus the last date she paid
const summary = (m, entry, fees, now) => ({
  id: m._id, name: m.name, phone: m.phone, joined: m.joined, status: m.status,
  archivedAt: m.archivedAt, archivedReason: m.archivedReason, churchId: m.churchId,
  lastPaidOn: entry.lastPaidOn,
  ...account(m, entry.paid, fees, now),
});

// Members of one church with their arrears
router.get("/church/:churchId", async (req, res) => {
  assertChurchAccess(req.user, req.params.churchId);
  const [members, settings] = await Promise.all([Member.find({ churchId: req.params.churchId }).lean(), getSettings()]);
  const maps = await paidMaps(members.map((m) => m._id));
  const now = nowYear();
  res.json({ members: members.map((m) => summary(m, entryFor(maps, m._id), settings.feeHistory, now)) });
});

// Name search across the churches this user can see
router.get("/search", validate(z.object({ q: z.string().trim().min(2).max(60) }), "query"), async (req, res) => {
  // Escape regex special characters so the search text is matched literally
  const safe = req.valid.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const members = await Member.find({ ...churchScope(req.user), name: { $regex: safe, $options: "i" } }).limit(20).lean();
  const [settings, maps] = await Promise.all([getSettings(), paidMaps(members.map((m) => m._id))]);
  const now = nowYear();
  res.json({ members: members.map((m) => summary(m, entryFor(maps, m._id), settings.feeHistory, now)) });
});

// Register details, shared by create and edit.
// dateOfBirth may be sent as "" to clear it.
const registerFields = {
  dateOfBirth: z.union([date, z.literal("")]).optional(),
  guardianName: text(100).optional(),
  guardianPhone: text(30).optional(),
  address: text(200).optional(),
};

// A birth date must be real and in the past
function checkBirthDate(d) {
  if (!d) return;
  if (d > todayLocal()) throw new HttpError(400, "Date of birth can't be in the future.");
  if (d < "1930-01-01") throw new HttpError(400, "Check the date of birth.");
}

const createSchema = z.object({
  churchId: objectId,
  name,
  phone: text(30).default(""),
  ...registerFields,
  joined: year,
  // Years already paid in the paper book, each with the date paid if it was written down
  previousPayments: z.array(z.object({ year, paidOn: date.optional() })).max(80).default([]),
});

router.post("/", validate(createSchema), async (req, res) => {
  const v = req.valid;
  assertChurchAccess(req.user, v.churchId);
  if (!(await Church.exists({ _id: v.churchId }))) throw new HttpError(404, "Not found");
  const now = nowYear();
  const today = todayLocal();
  if (v.joined > now) throw new HttpError(400, "Joining year can't be in the future.");
  checkBirthDate(v.dateOfBirth);
  for (const p of v.previousPayments) {
    if (p.year < v.joined || p.year > now + MAX_YEARS_AHEAD) throw new HttpError(400, `${p.year} is outside her membership years.`);
    if (p.paidOn && p.paidOn > today) throw new HttpError(400, "A paid date can't be in the future.");
  }
  if (new Set(v.previousPayments.map((p) => p.year)).size !== v.previousPayments.length) throw new HttpError(400, "Each year can only be listed once.");

  const member = await Member.create({
    churchId: v.churchId, name: v.name, phone: v.phone, joined: v.joined, createdBy: req.user._id,
    dateOfBirth: v.dateOfBirth || null, guardianName: v.guardianName || "", guardianPhone: v.guardianPhone || "", address: v.address || "",
  });

  // Copy the paper book: one receipt per year so each keeps its own paid date
  if (v.previousPayments.length) {
    const settings = await getSettings();
    await Payment.insertMany(v.previousPayments.map((p) => {
      const cents = feeFor(settings.feeHistory, p.year);
      return {
        memberId: member._id, churchId: member.churchId, amountCents: cents, allocations: [{ year: p.year, cents }],
        receivedOn: p.paidOn || null, note: p.paidOn ? "From paper book" : "From paper book, date not recorded",
        recordedBy: req.user._id,
      };
    }));
  }
  await audit(req, "member.create", member._id, { name: v.name, churchId: v.churchId, yearsCarriedOver: v.previousPayments.map((p) => p.year) });
  res.status(201).json({ member: { id: member._id } });
});

// One member with her full ledger and receipts
router.get("/:id", async (req, res) => {
  const member = await loadMember(req);
  const [settings, entry, receipts, church] = await Promise.all([
    getSettings(),
    paidMap(member._id),
    Payment.find({ memberId: member._id }).sort({ receivedOn: -1, createdAt: -1 }).limit(200).lean(),
    Church.findById(member.churchId).lean(),
  ]);
  // Show who recorded each receipt by office and name, not just an id
  const userIds = [...new Set(receipts.flatMap((r) => [r.recordedBy, r.voidedBy]).filter(Boolean).map(String))];
  const users = await User.find({ _id: { $in: userIds } }).select("office holderName").lean();
  const who = Object.fromEntries(users.map((u) => [u._id, u.holderName ? `${u.holderName} (${u.office})` : u.office]));
  const now = nowYear();
  res.json({
    member: {
      ...summary(member, entry, settings.feeHistory, now),
      dateOfBirth: member.dateOfBirth, guardianName: member.guardianName, guardianPhone: member.guardianPhone, address: member.address,
    },
    church,
    ledger: ledger(member, entry.paid, entry.dates, settings.feeHistory, now),
    receipts: receipts.map((r) => ({
      id: r._id, amountCents: r.amountCents, allocations: r.allocations, receivedOn: r.receivedOn, note: r.note,
      recordedBy: who[r.recordedBy] || "Unknown", recordedAt: r.createdAt, voided: r.voided, voidReason: r.voidReason,
      voidedBy: r.voidedBy ? who[r.voidedBy] || "Unknown" : undefined,
    })),
  });
});

const updateSchema = z.object({ name: name.optional(), phone: text(30).optional(), joined: year.optional(), churchId: objectId.optional(), ...registerFields });

router.patch("/:id", validate(updateSchema), async (req, res) => {
  const member = await loadMember(req);
  const v = req.valid;
  // Moving a member to another church is a diocesan decision
  if (v.churchId && v.churchId !== member.churchId.toString()) {
    if (req.user.role !== "admin") throw new HttpError(403, "Only the diocesan office can move a member.");
    if (!(await Church.exists({ _id: v.churchId }))) throw new HttpError(400, "Unknown church.");
    await Payment.updateMany({ memberId: member._id }, { churchId: v.churchId });
  }
  if (v.joined && v.joined > nowYear()) throw new HttpError(400, "Joining year can't be in the future.");
  checkBirthDate(v.dateOfBirth);
  if (v.dateOfBirth === "") v.dateOfBirth = null;
  Object.assign(member, v);
  member.ledgerVersion += 1;
  await member.save();
  // Log which fields changed, not the personal details themselves
  await audit(req, "member.update", member._id, { name: member.name, fields: Object.keys(v) });
  res.json({ ok: true });
});

// Archive (e.g. married): stops tributes after `lastYear`, keeps all history
router.post("/:id/archive", validate(z.object({ reason: text(40).min(1), lastYear: year })), async (req, res) => {
  const member = await loadMember(req);
  if (req.valid.lastYear < member.joined) throw new HttpError(400, "Last year can't be before she joined.");
  if (req.valid.lastYear > nowYear()) throw new HttpError(400, "Last year can't be in the future.");
  member.status = "archived";
  member.archivedReason = req.valid.reason;
  member.archivedAt = req.valid.lastYear;
  member.ledgerVersion += 1;
  await member.save();
  await audit(req, "member.archive", member._id, req.valid);
  res.json({ ok: true });
});

router.post("/:id/restore", async (req, res) => {
  const member = await loadMember(req);
  member.status = "active";
  member.archivedAt = undefined;
  member.archivedReason = undefined;
  member.ledgerVersion += 1;
  await member.save();
  await audit(req, "member.restore", member._id);
  res.json({ ok: true });
});

// Permanent delete, admins only. Archiving is almost always the better choice.
router.delete("/:id", requireAdmin, async (req, res) => {
  const member = await loadMember(req);
  const receipts = await Payment.countDocuments({ memberId: member._id });
  await Payment.deleteMany({ memberId: member._id });
  await member.deleteOne();
  await audit(req, "member.delete", member._id, { name: member.name, receiptsDeleted: receipts });
  res.status(204).end();
});

/* ---------------- Payments ---------------- */

const paySchema = z.object({
  amount: dollars,
  year: year.optional(), // pay one specific year only
  paidOn: date, // the date the money was paid: always required for new payments
  note: text(200).default(""),
});
// Preview doesn't need the date yet
const previewSchema = paySchema.partial({ paidOn: true });

// Shows which years an amount would cover, without saving
router.post("/:id/payments/preview", validate(previewSchema), async (req, res) => {
  const member = await loadMember(req);
  const [settings, entry] = await Promise.all([getSettings(), paidMap(member._id)]);
  res.json(allocate(member, entry.paid, settings.feeHistory, req.valid.amount, nowYear(), req.valid.year));
});

router.post("/:id/payments", validate(paySchema), async (req, res) => {
  const v = req.valid;
  if (v.paidOn > todayLocal()) throw new HttpError(400, "The date paid can't be in the future.");

  // Optimistic locking: claim the member's ledger version before allocating.
  // If another treasurer records a payment at the same moment, one of the two
  // retries with fresh numbers, so the same year is never paid twice.
  for (let attempt = 0; attempt < 3; attempt++) {
    const member = await loadMember(req);
    const [settings, entry] = await Promise.all([getSettings(), paidMap(member._id)]);
    const { allocations, leftoverCents } = allocate(member, entry.paid, settings.feeHistory, v.amount, nowYear(), v.year);
    if (!allocations.length) throw new HttpError(400, v.year ? `${v.year} is already paid.` : "Nothing left to pay.");
    if (leftoverCents > 0) {
      throw new HttpError(400, `That's $${(leftoverCents / 100).toFixed(2)} more than she owes, even paying next year in advance. Enter $${((v.amount - leftoverCents) / 100).toFixed(2)} or less.`);
    }
    const claimed = await Member.updateOne({ _id: member._id, ledgerVersion: member.ledgerVersion }, { $inc: { ledgerVersion: 1 } });
    if (claimed.modifiedCount !== 1) continue; // someone else got there first: recompute

    const payment = await Payment.create({
      memberId: member._id, churchId: member.churchId, amountCents: v.amount, allocations,
      receivedOn: v.paidOn, note: v.note, recordedBy: req.user._id,
    });
    await audit(req, "payment.create", payment._id, { memberId: member._id, amountCents: v.amount, paidOn: v.paidOn, years: allocations.map((a) => a.year) });
    return res.status(201).json({ payment: { id: payment._id, allocations } });
  }
  throw new HttpError(409, "Another payment was being saved for her at the same time. Try again.");
});

// Void a receipt (mistakes, bounced payments). Never deleted, for the audit trail.
router.post("/payments/:paymentId/void", validate(z.object({ reason: text(200).min(3, "give a short reason") })), async (req, res) => {
  const payment = await Payment.findById(req.params.paymentId);
  if (!payment) throw new HttpError(404, "Not found");
  assertChurchAccess(req.user, payment.churchId);
  if (payment.voided) throw new HttpError(400, "Already voided.");
  payment.voided = true;
  payment.voidedAt = new Date();
  payment.voidedBy = req.user._id;
  payment.voidReason = req.valid.reason;
  await payment.save();
  await Member.updateOne({ _id: payment.memberId }, { $inc: { ledgerVersion: 1 } });
  await audit(req, "payment.void", payment._id, { reason: req.valid.reason, amountCents: payment.amountCents });
  res.json({ ok: true });
});

export default router;
