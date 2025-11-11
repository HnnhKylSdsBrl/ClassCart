// js/server.js
import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import session from "express-session";
import MongoStore from "connect-mongo";

dotenv.config();

// --- MongoDB Setup ---
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "classcart_db";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI); // removed deprecated useUnifiedTopology

// --- MAIN SERVER FUNCTION ---
async function start() {
  // connect to MongoDB
  await client.connect();
  console.log("✅ MongoDB connected");

  const app = express();

  // --- Middlewares ---
  app.use(
    cors({
      origin: true, // for local dev; specify explicit origin in production
      credentials: true,
    })
  );
  app.use(express.json());

  // --- Sessions ---
  app.use(
    session({
      name: "classcart.sid",
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ client, dbName: DB_NAME }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // secure: true, // enable for HTTPS
        maxAge: 1000 * 60 * 60 * 24, // 1 day
      },
    })
  );

  // --- Static Files ---
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use(express.static(path.join(__dirname, ".."))); // serve project root

  // --- Helper: get collection ---
  function getCollection(name) {
    return client.db(DB_NAME).collection(name);
  }

  // --- REGISTER ---
  app.post("/api/register", async (req, res) => {
    try {
      const {
        name,
        email,
        studentid,
        username,
        password,
        confirm,
        contact = ""
      } = req.body ?? {};

      // basic required checks
      if (!username || !password) {
        return res.status(400).json({ error: "username & password required" });
      }
      if (password !== confirm) {
        return res.status(400).json({ error: "Passwords do not match" });
      }

      const users = getCollection("users");

      // log incoming body for debug (remove in production)
      console.log("[/api/register] body:", { name, email, studentid, username, contact });

      // uniqueness checks
      const existingUser = await users.findOne({ username });
      if (existingUser) return res.status(409).json({ error: "Username already taken" });

      const existingEmail = await users.findOne({ email });
      if (existingEmail) return res.status(409).json({ error: "Email already registered" });

      const existingContact = contact ? await users.findOne({ contact }) : null;
      if (existingContact) return res.status(409).json({ error: "Mobile number already registered" });

      // hash & insert
      const hash = await bcrypt.hash(password, 10);
      await users.insertOne({
        name: name?.trim() || "",
        email: email?.trim() || "",
        studentid: String(studentid || "").trim(),
        contact: String(contact || "").trim(),
        username: username.trim(),
        password: hash,
        createdAt: new Date(),
      });

      return res.status(201).json({ ok: true, message: "Registered" });
    } catch (err) {
      console.error("Register error:", err);

    // handle Mongo duplicate key more explicitly if present
      if (err && err.code === 11000) {
        return res.status(409).json({ error: "Duplicate key error" });
      }

     return res.status(500).json({ error: "server error" });
    }
  });

  // --- LOGIN ---
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      if (!username || !password)
        return res
          .status(400)
          .json({ error: "username & password required" });

      const users = getCollection("users");
      const user = await users.findOne({ username });

      if (!user)
        return res.status(401).json({ error: "invalid credentials" });

      const match = await bcrypt.compare(password, user.password);
      if (!match)
        return res.status(401).json({ error: "invalid credentials" });

      // set session
      req.session.user = { username: user.username };

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

  // --- PROFILE (uses session) ---
  app.get("/api/profile", async (req, res) => {
    try {
      if (!req.session || !req.session.user)
        return res.status(401).json({ error: "not authenticated" });

      const username = req.session.user.username;
      const users = getCollection("users");
      const user = await users.findOne({ username });
      if (!user) return res.status(404).json({ error: "User not found" });

      res.json({
        username: user.username,
        name: user.name,
        email: user.email,
        contact: user.contact || "",
        gender: user.gender || "",
        dob: user.dob || "",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // --- Default route for sanity check ---
  app.get("/__health", (req, res) =>
    res.json({ ok: true, time: new Date().toISOString() })
  );

  // --- START SERVER ---
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

// --- CALL start() ---
start()
  .then(() => console.log("🚀 Startup sequence complete."))
  .catch((err) => {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  });
