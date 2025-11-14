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

const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Setup ---
const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db("classcart_db");
const listingsCollection = db.collection("listings");
const usersCollection = db.collection("users");

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../public")));

// --- Session ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secretkey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  })
);

// --- ROUTE: Add Listing ---
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

    await listingsCollection.insertOne(newItem);
    res.status(201).json({ message: "Listing added successfully", item: newItem });
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ error: "Server error while adding item" });
  }
});

// --- ROUTE: Get All Listings ---
app.get("/api/listings", async (req, res) => {
  try {
    const listings = await listingsCollection.find().sort({ createdAt: -1 }).toArray();
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

    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) return res.status(409).json({ error: "Username already taken" });

    const existingEmail = await usersCollection.findOne({ email });
    if (existingEmail) return res.status(409).json({ error: "Email already registered" });

    const existingContact = contact ? await usersCollection.findOne({ contact }) : null;
    if (existingContact) return res.status(409).json({ error: "Mobile number already registered" });

    const hash = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({
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

    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "invalid credentials" });

    req.session.user = { username: user.username };
    return res.json({ ok: true, message: "Logged in", user: { username: user.username } });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

// --- PROFILE ---
app.get("/api/profile", async (req, res) => {
  try {
    if (!req.session || !req.session.user) return res.status(401).json({ error: "not authenticated" });

    const username = req.session.user.username;
    const user = await usersCollection.findOne({ username });
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

// --- Server Start ---
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
