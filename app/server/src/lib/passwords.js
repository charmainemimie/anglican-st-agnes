// Password hashing, policy checks and temporary password generation.
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

// bcrypt work factor. 12 is about 250ms per hash: slow for attackers, fine for users.
const COST = 12;
// How many previous passwords can't be reused
export const HISTORY = 5;

export const hashPassword = (pw) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

// A real hash of a random value. Compared against when the username doesn't exist,
// so a wrong username takes as long as a wrong password (no username guessing by timing).
export const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), COST);

// A few of the most common passwords, rejected outright
const COMMON = new Set(["password", "password1", "password123", "1234567890", "qwertyuiop", "anglican123", "stagnes123", "masvingo123", "zimbabwe123", "letmein123", "welcome123", "iloveyou12"]);

// Returns an error message, or null if the password is acceptable
export function checkPolicy(pw, username) {
  if (typeof pw !== "string" || pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 128) return "Use at most 128 characters.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common. Choose another.";
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return "Don't include your username in the password.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Use at least one letter and one number.";
  return null;
}

// True if the password matches any of the stored hashes
export async function matchesAny(pw, hashes) {
  for (const h of hashes) if (await bcrypt.compare(pw, h)) return true;
  return false;
}

// One-time password handed to a new office holder, e.g. "k7mq-x3pr-w9tb".
// No look-alike characters (0/O, 1/l/I) so it can be read out over the phone.
export function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const chunk = () => Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `${chunk()}-${chunk()}-${chunk()}`;
}
