// First-time setup: creates the first diocesan admin account and loads the
// known archdeaconries and the Cathedral. Run once:  npm run create-admin
import readline from "node:readline/promises";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { User } from "../models/User.js";
import { Church } from "../models/Church.js";
import { getSettings } from "../models/Settings.js";
import { hashPassword, checkPolicy } from "../lib/passwords.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await connectDb();

// Starting structure (from the diocese's 2021 report). Edit later in Setup.
const settings = await getSettings();
if (!settings.archdeaconries.length) {
  settings.archdeaconries = ["Buhera", "Daramombe", "Masvingo", "Mutoredzanwa", "Shearly Cripps", "Shurugwi"];
  await settings.save();
  console.log("Added archdeaconries.");
}
if (!(await Church.exists({}))) {
  await Church.create({ name: "Cathedral of St Michael & All Angels", parish: "Cathedral", archdeaconry: "Masvingo" });
  console.log("Added the Cathedral.");
}

if (await User.exists({ role: "admin" })) {
  console.log("An admin already exists. Use Setup > Accounts in the app to add or hand over accounts.");
} else {
  const office = (await rl.question("Office (e.g. Diocesan Secretary): ")).trim() || "Diocesan Secretary";
  const holderName = (await rl.question("Name of the person in this office: ")).trim();
  const username = (await rl.question("Username: ")).trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error("Username: 3-40 letters, numbers, dots, dashes or underscores.");
  const password = await rl.question("Password (at least 10 characters, letters and numbers): ");
  const problem = checkPolicy(password, username);
  if (problem) throw new Error(problem);
  await User.create({ office, holderName, username, role: "admin", passwordHash: await hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date() });
  console.log(`Admin "${username}" created. Start the app and sign in.`);
}
rl.close();
await mongoose.disconnect();
