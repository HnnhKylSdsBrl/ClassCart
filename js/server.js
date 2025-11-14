/* js/server.js */
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

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "classcart_db";
if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI);

async function start() {
  await client.connect();
  console.log("✅ MongoDB connected");

  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use(express.static(path.join(__dirname, "../public")));

  function getCollection(name) {
    return client.db(DB_NAME).collection(name);
  }

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
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
      },
    })
  );

  // --- ROUTE: Add Listing (base64 image or imageUrl) ---
  app.post("/api/add-listing-base64", async (req, res) => {
    try {
      const {
        title,
        description,
        price,
        category,
        imageUrl,
        username,
        sellerName,
        condition,
        location,
      } = req.body;

      if (!title || !price || !category || !imageUrl || !username) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const listings = getCollection("listings");
      const newItem = {
        title,
        description,
        price: parseFloat(price),
        category,
        imageUrl,
        username,
        sellerName,
        condition,
        location,
        createdAt: new Date(),
      };

      await listings.insertOne(newItem);
      res.status(201).json({ message: "Listing added successfully", item: newItem });
    } catch (error) {
      console.error("Error adding item:", error);
      res.status(500).json({ error: "Server error while adding item" });
    }
  });

  // --- ROUTE: Get All Listings ---
  app.get("/api/listings", async (req, res) => {
    try {
      const listings = await getCollection("listings").find().sort({ createdAt: -1 }).toArray();
      res.json(listings);
    } catch (error) {
      console.error("Error fetching listings:", error);
      res.status(500).json({ error: "Server error fetching listings" });
    }
  });

  // --- REGISTER ---
  app.post("/api/register", async (req, res) => {
    try {
      const { name, email, studentid, username, password, confirm, contact = "" } = req.body ?? {};
      if (!username || !password) return res.status(400).json({ error: "username & password required" });
      if (password !== confirm) return res.status(400).json({ error: "Passwords do not match" });

      const users = getCollection("users");

      const existingUser = await users.findOne({ username });
      if (existingUser) return res.status(409).json({ error: "Username already taken" });

      const existingEmail = await users.findOne({ email });
      if (existingEmail) return res.status(409).json({ error: "Email already registered" });

      const existingContact = contact ? await users.findOne({ contact }) : null;
      if (existingContact) return res.status(409).json({ error: "Mobile number already registered" });

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
      if (err && err.code === 11000) return res.status(409).json({ error: "Duplicate key error" });
      return res.status(500).json({ error: "server error" });
    }
  });

  // --- LOGIN ---
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      if (!username || !password) return res.status(400).json({ error: "username & password required" });

      const users = getCollection("users");
      const user = await users.findOne({ username });

      if (!user) return res.status(401).json({ error: "invalid credentials" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: "invalid credentials" });

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

  // --- LOGOUT ---
  app.post("/api/logout", (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error("Logout error:", err);
          res.clearCookie("classcart.sid");
          return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie("classcart.sid");
        return res.json({ ok: true, message: "Logged out" });
      });
    } catch (err) {
      console.error("Logout exception:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // --- PROFILE ---
  app.get("/api/profile", async (req, res) => {
    try {
      if (!req.session || !req.session.user) return res.status(401).json({ error: "not authenticated" });

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
  app.get("/__health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // --- START SERVER ---
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

start()
  .then(() => console.log("🚀 Startup sequence complete."))
  .catch((err) => {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  });
