// quick-check.js — verbose diagnostics
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

console.log("→ quick-check.js starting");
console.log("cwd:", process.cwd());
console.log("node version:", process.version);

const loaded = dotenv.config();
if (loaded.error) {
  console.error("⚠️ dotenv failed to load .env:", loaded.error);
} else {
  console.log("✅ .env loaded");
}

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "classcart_db";

console.log("MONGO_URI present?", !!MONGO_URI);
console.log("DB_NAME:", DB_NAME);

if (!MONGO_URI) {
  console.error("❌ No MONGO_URI found in environment. Check your .env in project root.");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 5000, // fail fast if cannot reach server
});

async function main() {
  try {
    console.log("Attempting to connect to MongoDB...");
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db(DB_NAME);
    const users = await db.collection("users").find({}).toArray();
    console.log(`📋 Found ${users.length} user(s) in ${DB_NAME}.users`);
    console.table(users);
  } catch (err) {
    console.error("❌ Error while checking DB:", err);
  } finally {
    try { await client.close(); } catch (e) {}
    console.log("→ quick-check.js finished");
  }
}

main();
