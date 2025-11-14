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

  // ===== CORS: restrict to known local origins so cookies are sent =====
  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        // If you use Live Server or other dev servers, add them here:
        // "http://localhost:5500",
        // "http://127.0.0.1:5500"
      ],
      credentials: true,
    })
  );

  // ===== Small debug middleware to inspect cookies & session during development =====
  app.use((req, res, next) => {
    console.log("🔎 Incoming request:", req.method, req.url);
    console.log("Cookies header:", req.headers.cookie || "(none)");
    // session will not be available until session middleware is attached,
    // so this shows undefined for static file requests; it's still useful.
    // We'll attach another logger after session middleware below for full info.
    next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use(express.static(path.join(__dirname, "../public")));

  function getCollection(name) {
    return client.db(DB_NAME).collection(name);
  }

  // Sessions
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

  // Additional debug after session middleware to inspect session presence
  app.use((req, res, next) => {
    console.log("🔐 Session check:", req.method, req.url, "session.user=", req.session?.user ?? null);
    next();
  });

  // --- Add Listing ---
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

  // --- Get Listings ---
  app.get("/api/listings", async (req, res) => {
    try {
      const listings = await getCollection("listings")
        .find()
        .sort({ createdAt: -1 })
        .toArray();

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

      if (await users.findOne({ username })) return res.status(409).json({ error: "Username already taken" });
      if (await users.findOne({ email })) return res.status(409).json({ error: "Email already registered" });

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
        dobEditCount: 0
      });

      return res.status(201).json({ ok: true, message: "Registered" });
    } catch (err) {
      console.error("Register error:", err);
      if (err?.code === 11000) return res.status(409).json({ error: "Duplicate key error" });
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

  // --- PROFILE (GET) ---
  app.get("/api/profile", async (req, res) => {
    try {
      if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "not authenticated" });
      }

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
        dobEditCount: user.dobEditCount || 0,
        imageUrl: user.imageUrl || ''
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // --- PROFILE (PUT) - Update profile with DOB validation & one-time edit ---
  app.put("/api/profile", async (req, res) => {
    try {
      if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "not authenticated" });
      }

      const username = req.session.user.username;
      const users = getCollection("users");
      const user = await users.findOne({ username });
      if (!user) return res.status(404).json({ error: "User not found" });

      // Accept only these fields from client
      const { name, contact, gender, dob } = req.body ?? {};

      const updates = {};
      if (typeof name === "string") updates.name = name.trim();
      if (typeof contact === "string") updates.contact = String(contact).trim();
      if (typeof gender === "string") updates.gender = gender;

      // --- DOB validation & one-time-edit rule ---
      if (typeof dob === "string" && dob !== "") {
        // parse incoming dob
        const dobDate = new Date(dob);
        if (Number.isNaN(dobDate.getTime())) {
          return res.status(400).json({ error: "Invalid birthdate format" });
        }

        // compute dynamic bounds
        const now = new Date();
        const minAllowed = new Date(now);
        minAllowed.setFullYear(minAllowed.getFullYear() - 35); // oldest allowed DOB: no earlier than this (max age 35)
        // youngest allowed fixed to 2014 (end of year)
        const maxAllowed = new Date("2014-12-31T23:59:59.999Z");

        // normalize to yyyy-mm-dd for clear comparison
        const dobYMD = dobDate.toISOString().slice(0,10);
        const minYMD = minAllowed.toISOString().slice(0,10);
        const maxYMD = maxAllowed.toISOString().slice(0,10);

        if (dobYMD < minYMD || dobYMD > maxYMD) {
          return res.status(400).json({
            error: `Birthdate must be between ${minYMD} and ${maxYMD}.`
          });
        }

        // enforce one-time edit rule:
        const existingDob = user.dob || "";
        const dobEditCount = user.dobEditCount || 0;

        if (existingDob && dob !== existingDob) {
          if (dobEditCount >= 1) {
            return res.status(403).json({ error: "Birthdate can only be edited once." });
          }
          // allow change and increment counter
          updates.dob = dob;
          updates.dobEditCount = dobEditCount + 1;
        } else if (!existingDob) {
          // initial set (no existing dob)
          updates.dob = dob;
          // initialise edit counter to 0 (no edits yet)
          updates.dobEditCount = 0;
        }
        // if dob provided but equal to existingDob => no change
      }

      // if nothing to update
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      // ensure contact uniqueness if changed
      if (updates.contact && updates.contact !== user.contact) {
        const exists = await users.findOne({ contact: updates.contact });
        if (exists) return res.status(409).json({ error: "Mobile number already registered" });
      }

      const result = await users.updateOne({ username }, { $set: updates });

      if (result.matchedCount === 0) return res.status(404).json({ error: "User not found" });

      const updated = await users.findOne({ username }, { projection: { password: 0 } });

      res.json({
        ok: true,
        message: "Profile updated",
        user: {
          username: updated.username,
          name: updated.name,
          email: updated.email,
          contact: updated.contact || "",
          gender: updated.gender || "",
          dob: updated.dob || "",
          dobEditCount: updated.dobEditCount || 0,
          imageUrl: updated.imageUrl || ''
        },
      });
    } catch (err) {
      console.error("Profile update error:", err);
      return res.status(500).json({ error: "Server error while updating profile" });
    }
  });

  // --- PROFILE PICTURE (PUT) - hardened, supports data URIs and raw base64 ---
  app.put("/api/profile/picture", async (req, res) => {
    try {
      if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "not authenticated" });
      }

      let { imageBase64 } = req.body ?? {};

      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ error: "Missing field: imageBase64 (string expected)" });
      }

      // Accept data URI OR raw base64 OR JSON-with-base64 string
      let mime = null;
      let b64 = null;

      // 1) data:<mime>;base64,AAA...
      const dataUriMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (dataUriMatch) {
        mime = dataUriMatch[1].toLowerCase();
        b64 = dataUriMatch[2];
      } else {
        // 2) maybe it's a JSON string like {"base64":"AAA","mime":"image/png"}
        try {
          const parsed = JSON.parse(imageBase64);
          if (parsed && parsed.base64) {
            b64 = parsed.base64;
            mime = (parsed.mime || parsed.type || '').toLowerCase() || null;
          }
        } catch (_) {
          // not JSON, treat as raw base64
          b64 = imageBase64.replace(/\s+/g, '');
        }
      }

      if (!b64) {
        return res.status(400).json({ error: "Could not extract base64 image data. Send a data URL or { base64, mime }." });
      }

      const buffer = Buffer.from(b64, 'base64');

      // quick size check
      if (buffer.length === 0) {
        return res.status(400).json({ error: "Empty image data" });
      }
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(413).json({ error: "Image too large (max 2MB)" });
      }

      // infer mime if missing using "magic numbers"
      if (!mime) {
        if (buffer.slice(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]))) mime = 'image/png';
        else if (buffer.slice(0,3).equals(Buffer.from([0xFF,0xD8,0xFF]))) mime = 'image/jpeg';
        else if (buffer.slice(0,4).equals(Buffer.from([0x52,0x49,0x46,0x46]))) {
          // RIFF — could be WEBP (RIFF....WEBP)
          if (buffer.slice(8,12).toString() === 'WEBP') mime = 'image/webp';
        }
      }

      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!mime || !allowed.includes(mime)) {
        return res.status(400).json({ error: "Unsupported image mime type. Use PNG / JPEG / WEBP." });
      }

      // store as data URL on user doc (quick implementation)
      const users = getCollection("users");
      const username = req.session.user.username;
      const dataUrl = `data:${mime};base64,${b64}`;

      await users.updateOne({ username }, { $set: { imageUrl: dataUrl } });

      const updated = await users.findOne({ username }, { projection: { password: 0 } });

      return res.json({
        ok: true,
        message: "Profile picture updated",
        user: {
          username: updated.username,
          imageUrl: updated.imageUrl
        }
      });
    } catch (err) {
      console.error("Profile picture upload error:", err);
      return res.status(500).json({ error: "Server error while saving picture" });
    }
  });

  // --- HEALTH CHECK ---
  app.get("/__health", (req, res) =>
    res.json({ ok: true, time: new Date().toISOString() })
  );

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
