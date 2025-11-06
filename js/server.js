// server.js — keep this file inside /js/
import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// --- Serve static files (go up one directory from /js/) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, ".."))); // serve from project root

// --- MongoDB Setup ---
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "classcart_db";
const client = new MongoClient(MONGO_URI);

// helper: connect and get collection
async function getCollection(name) {
  if (!client.topology) await client.connect(); // ensure connected
  const db = client.db(DB_NAME);
  return db.collection(name);
}

/* --- REGISTER endpoint --- */
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, email, studentid, contact } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username & password required" });

    const users = await getCollection("users");
    const exists = await users.findOne({ username });
    if (exists) return res.status(409).json({ error: "username exists" });

    await users.insertOne({
      username,
      password, // plain text for demo only — use bcrypt later
      email,
      studentid,
      contact,
      createdAt: new Date(),
    });

    return res.status(201).json({ ok: true, message: "Registered" });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

/* --- LOGIN endpoint --- */
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await getCollection("users");
    const user = await users.findOne({ username, password });
    if (!user)
      return res.status(401).json({ error: "invalid credentials" });

    return res.json({
      ok: true,
      message: "Logged in",
      user: { username: user.username },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

/* --- START SERVER --- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
