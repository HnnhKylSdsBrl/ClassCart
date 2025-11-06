// js/server.js
import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// serve static files from project root (one level up from /js/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "..")));

// MongoDB setup
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "classcart_db";
const client = new MongoClient(MONGO_URI);

// helper to ensure connection and get collection
async function getCollection(name) {
  if (!client.topology) await client.connect();
  const db = client.db(DB_NAME);
  return db.collection(name);
}

/* --- Validation helpers (server-side) --- */
function validateFullName(name) {
  if (!name) return "Full name required";
  const s = name.trim();
  if (s.length < 8 || s.length > 25) return "Full name must be 8–25 characters";
  if (!/^[A-Za-z ]+$/.test(s)) return "Full name must contain only letters and spaces";
  return null;
}

function validateSchoolEmail(email) {
  if (!email) return "Email required";
  if (!/@mcm\.edu\.ph$/i.test(email)) return "School email must end with @mcm.edu.ph";
  return null;
}

function validateStudentId(id) {
  if (!id) return "Student ID required";
  const s = String(id).trim();
  if (!/^\d{10}$/.test(s)) return "Student ID must be exactly 10 digits";
  if (!/^202\d{7}$/.test(s)) return "Student ID must start with 202";
  return null;
}

function validateUsername(username) {
  if (!username) return "Username required";
  if (!/^[A-Za-z0-9._-]{3,20}$/.test(username)) return "Username must be 3–20 chars (letters, numbers, . _ -)";
  return null;
}

function validatePassword(pw) {
  if (!pw) return "Password required";
  // 8-15 chars, at least one digit and one letter, allows case sensitivity
  const re = /^(?=.*\d)(?=.*[A-Za-z])[A-Za-z\d]{8,15}$/;
  if (!re.test(pw)) return "Password must be 8–15 chars and include letters and numbers";
  return null;
}

/* --- REGISTER endpoint --- */
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, studentid, username, password, confirm } = req.body;

    // server-side validation
    let err =
      validateFullName(name) ||
      validateSchoolEmail(email) ||
      validateStudentId(studentid) ||
      validateUsername(username) ||
      validatePassword(password);
    if (err) return res.status(400).json({ error: err });

    if (password !== confirm) return res.status(400).json({ error: "Password and confirm password do not match" });

    const users = await getCollection("users");

    // username uniqueness
    const existingUser = await users.findOne({ username });
    if (existingUser) return res.status(409).json({ error: "Username already taken" });

    // password uniqueness check: compare against existing hashed passwords
    // (okay for small datasets; for large DBs remove this or use a different policy)
    const cursor = users.find({}, { projection: { password: 1 } });
    while (await cursor.hasNext()) {
      const u = await cursor.next();
      if (u && u.password) {
        const same = await bcrypt.compare(password, u.password);
        if (same) {
          return res.status(400).json({ error: "Please choose a more unique password" });
        }
      }
    }

    // hash password and save
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    await users.insertOne({
      name: name.trim(),
      email: email.trim(),
      studentid: String(studentid).trim(),
      username: username.trim(),
      password: hash,
      createdAt: new Date()
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
    if (!username || !password) return res.status(400).json({ error: "username & password required" });

    const users = await getCollection("users");
    const user = await users.findOne({ username: username });
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    // case-sensitive password check using bcrypt.compare
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "invalid credentials" });

    // success — return minimal user info
    return res.json({ ok: true, message: "Logged in", user: { username: user.username, name: user.name } });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
