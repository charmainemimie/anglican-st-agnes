// MongoDB connection via Mongoose.
import mongoose from "mongoose";
import { config } from "./config.js";

// Only allow queries on fields defined in the schemas
mongoose.set("strictQuery", true);
// NoSQL injection (e.g. sending {"$gt": ""} as a password) is blocked because every
// request body goes through a Zod schema that only accepts plain strings/numbers,
// route params are always strings, and Express 5's default "simple" query parser
// never turns ?a[b]=c into objects.

export async function connectDb() {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB");
}
