// js/server.js
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
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
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
      ],
      credentials: true,
    })
  );

  app.use((req, res, next) => {
    console.log("🔎", req.method, req.url);
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

  // sessions
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

  app.use((req, res, next) => {
    // small session debug
    // console.log("🔐 session.user=", req.session?.user ?? null);
    next();
  });

  // -------- listings ----------
  app.post("/api/add-listing-base64", async (req, res) => {
    try {
      const {
        title, description, price, category, imageUrl,
        username, sellerName, condition, location
      } = req.body;

      if (!title || !price || !category || !imageUrl || !username) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const listings = getCollection("listings");
      const newItem = {
        title,
        description: description || "",
        price: parseFloat(price),
        category,
        imageUrl,
        username,
        sellerName: sellerName || username,
        condition: condition || "",
        location: location || "",
        createdAt: new Date(),
      };

      const insert = await listings.insertOne(newItem);
      newItem._id = insert.insertedId;
      res.status(201).json({ message: "Listing added", item: newItem });
    } catch (err) {
      console.error("Add listing error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/listings", async (req, res) => {
    try {
      const listings = await getCollection("listings")
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.json(listings);
    } catch (err) {
      console.error("Get listings error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    try {
      const rawId = req.params.id;
      const col = getCollection("listings");
      let item = null;
      if (/^[0-9a-fA-F]{24}$/.test(rawId)) {
        try { item = await col.findOne({ _id: new ObjectId(rawId) }); } catch (e) { item = null; }
      }
      if (!item) {
        item = await col.findOne({ $or: [{ id: rawId }, { _id: rawId }] });
      }
      if (!item) return res.status(404).json({ error: "Listing not found" });
      res.json(item);
    } catch (err) {
      console.error("Get listing by id error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // -------- auth & users (register/login/profile) ----------
  app.post("/api/register", async (req, res) => {
    try {
      const { name, email, studentid, username, password, confirm, contact = "" } = req.body ?? {};
      if (!username || !password) return res.status(400).json({ error: "username & password required" });
      if (password !== confirm) return res.status(400).json({ error: "Passwords do not match" });

      const users = getCollection("users");
      if (await users.findOne({ username })) return res.status(409).json({ error: "Username taken" });
      if (email && (await users.findOne({ email }))) return res.status(409).json({ error: "Email registered" });
      if (contact && (await users.findOne({ contact }))) return res.status(409).json({ error: "Contact registered" });

      const hash = await bcrypt.hash(password, 10);
      await users.insertOne({
        name: name?.trim() || "",
        email: email?.trim() || "",
        studentid: String(studentid || "").trim(),
        contact: String(contact || "").trim(),
        username: username.trim(),
        password: hash,
        createdAt: new Date(),
        dobEditCount: 0,
        imageUrl: ''
      });
      return res.status(201).json({ ok: true, message: "Registered" });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: "server error" });
    }
  });

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
      return res.json({ ok: true, message: "Logged in", user: { username: user.username } });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "server error" });
    }
  });

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
        dobEditCount: user.dobEditCount || 0,
        imageUrl: user.imageUrl || ''
      });
    } catch (err) {
      console.error("Profile get error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/profile", async (req, res) => {
    try {
      if (!req.session || !req.session.user) return res.status(401).json({ error: "not authenticated" });
      const username = req.session.user.username;
      const users = getCollection("users");
      const user = await users.findOne({ username });
      if (!user) return res.status(404).json({ error: "User not found" });

      const { name, contact, gender, dob } = req.body ?? {};
      const updates = {};
      if (typeof name === "string") updates.name = name.trim();
      if (typeof contact === "string") updates.contact = String(contact).trim();
      if (typeof gender === "string") updates.gender = gender;

      if (typeof dob === "string" && dob !== "") {
        const dobDate = new Date(dob);
        if (Number.isNaN(dobDate.getTime())) return res.status(400).json({ error: "Invalid birthdate format" });

        const now = new Date();
        const minAllowed = new Date(now); minAllowed.setFullYear(minAllowed.getFullYear() - 35);
        const maxAllowed = new Date("2014-12-31T23:59:59.999Z");

        const dobYMD = dobDate.toISOString().slice(0,10);
        const minYMD = minAllowed.toISOString().slice(0,10);
        const maxYMD = maxAllowed.toISOString().slice(0,10);

        if (dobYMD < minYMD || dobYMD > maxYMD) {
          return res.status(400).json({ error: `Birthdate must be between ${minYMD} and ${maxYMD}.` });
        }

        const existingDob = user.dob || "";
        const dobEditCount = user.dobEditCount || 0;
        if (existingDob && dob !== existingDob) {
          if (dobEditCount >= 1) return res.status(403).json({ error: "Birthdate can only be edited once." });
          updates.dob = dob;
          updates.dobEditCount = dobEditCount + 1;
        } else if (!existingDob) {
          updates.dob = dob;
          updates.dobEditCount = 0;
        }
      }

      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });
      if (updates.contact && updates.contact !== user.contact) {
        const exists = await users.findOne({ contact: updates.contact });
        if (exists) return res.status(409).json({ error: "Mobile number already registered" });
      }

      const result = await users.updateOne({ username }, { $set: updates });
      if (result.matchedCount === 0) return res.status(404).json({ error: "User not found" });

      const updated = await users.findOne({ username }, { projection: { password: 0 } });
      res.json({ ok: true, message: "Profile updated", user: {
        username: updated.username, name: updated.name, email: updated.email,
        contact: updated.contact || "", gender: updated.gender || "", dob: updated.dob || "",
        dobEditCount: updated.dobEditCount || 0, imageUrl: updated.imageUrl || ''
      }});
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/profile/picture", async (req, res) => {
    try {
      if (!req.session || !req.session.user) return res.status(401).json({ error: "not authenticated" });
      let { imageBase64 } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== "string") return res.status(400).json({ error: "Missing field: imageBase64" });

      let mime = null; let b64 = null;
      const dataUriMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (dataUriMatch) { mime = dataUriMatch[1].toLowerCase(); b64 = dataUriMatch[2]; }
      else {
        try {
          const parsed = JSON.parse(imageBase64);
          if (parsed && parsed.base64) { b64 = parsed.base64; mime = (parsed.mime || parsed.type || '').toLowerCase() || null; }
        } catch (_) { b64 = imageBase64.replace(/\s+/g, ''); }
      }
      if (!b64) return res.status(400).json({ error: "Could not extract base64 image data." });

      const buffer = Buffer.from(b64, 'base64');
      if (buffer.length === 0) return res.status(400).json({ error: "Empty image data" });
      if (buffer.length > 2 * 1024 * 1024) return res.status(413).json({ error: "Image too large (max 2MB)" });

      if (!mime) {
        if (buffer.slice(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]))) mime = 'image/png';
        else if (buffer.slice(0,3).equals(Buffer.from([0xFF,0xD8,0xFF]))) mime = 'image/jpeg';
        else if (buffer.slice(0,4).equals(Buffer.from([0x52,0x49,0x46,0x46])) && buffer.slice(8,12).toString() === 'WEBP') mime = 'image/webp';
      }
      const allowed = ['image/png','image/jpeg','image/jpg','image/webp'];
      if (!mime || !allowed.includes(mime)) return res.status(400).json({ error: "Unsupported image mime" });

      const users = getCollection("users");
      const username = req.session.user.username;
      const dataUrl = `data:${mime};base64,${b64}`;
      await users.updateOne({ username }, { $set: { imageUrl: dataUrl } });
      const updated = await users.findOne({ username }, { projection: { password: 0 } });
      return res.json({ ok: true, message: "Profile picture updated", user: { username: updated.username, imageUrl: updated.imageUrl }});
    } catch (err) {
      console.error("Profile picture upload error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });


  // -------- SIMPLE MEETUP ORDERS (NEW) ----------
  // Create a new order (buyer reserves for meetup)
  app.post("/api/orders/create", async (req, res) => {
    try {
      if (!req.session || !req.session.user) return res.status(401).json({ error: "not authenticated" });
      const buyer = req.session.user.username;
      const { itemId } = req.body ?? {};
      if (!itemId) return res.status(400).json({ error: "itemId required" });

      const listings = getCollection("listings");
      let item = null;
      if (/^[0-9a-fA-F]{24}$/.test(itemId)) {
        try { item = await listings.findOne({ _id: new ObjectId(itemId) }); } catch(_) { item = null; }
      }
      if (!item) {
        item = await listings.findOne({ $or: [{ id: itemId }, { _id: itemId }] });
      }
      if (!item) return res.status(404).json({ error: "Item not found" });

      const seller = item.username || item.sellerName || null;
      if (!seller) return res.status(400).json({ error: "Seller not found for item" });
      if (seller === buyer) return res.status(400).json({ error: "Cannot buy your own item" });

      const orders = getCollection("orders");
      const doc = {
        itemId: item._id ?? item.id ?? null,
        itemSnapshot: { title: item.title || "", price: item.price || 0, imageUrl: item.imageUrl || "" },
        buyer,
        seller,
        status: "pending",
        meetupConfirmedByBuyer: false,
        meetupConfirmedBySeller: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const insert = await orders.insertOne(doc);
      doc._id = insert.insertedId;
      res.status(201).json({ ok: true, order: doc });
    } catch (err) {
      console.error("Create order error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get orders for logged-in user (buyer or seller)
  app.get("/api/orders/my", async (req, res) => {
    try {
      if (!req.session || !req.session.user) return res.status(401).json({ error: "not authenticated" });
      const username = req.session.user.username;
      const orders = await getCollection("orders").find({
        $or: [{ buyer: username }, { seller: username }]
      }).sort({ createdAt: -1 }).toArray();
      res.json(orders);
    } catch (err) {
      console.error("Get my orders error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Confirm meetup: either buyer or seller confirms they met and completed the exchange
  // POST /api/orders/:id/confirm  sets meetupConfirmedByBuyer or meetupConfirmedBySeller depending on who calls
  app.post("/api/orders/:id/confirm", async (req, res) => {
    try {
      if (!req.session || !req.session.user) return res.status(401).json({ error: "not authenticated" });
      const username = req.session.user.username;
      const id = req.params.id;
      const orders = getCollection("orders");
      let q = {};
      if (/^[0-9a-fA-F]{24}$/.test(id)) q._id = new ObjectId(id); else q._id = id;
      const order = await orders.findOne(q);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const updates = {};
      if (username === order.buyer) updates.meetupConfirmedByBuyer = true;
      else if (username === order.seller) updates.meetupConfirmedBySeller = true;
      else return res.status(403).json({ error: "Not authorized" });

      updates.updatedAt = new Date();
      await orders.updateOne(q, { $set: updates });

      // fetch updated doc
      const updated = await orders.findOne(q);

      // if both confirmed => set status completed
      if (updated.meetupConfirmedByBuyer && updated.meetupConfirmedBySeller) {
        await orders.updateOne(q, { $set: { status: "completed", updatedAt: new Date() } });
      }

      const final = await orders.findOne(q);
      res.json({ ok: true, order: final });
    } catch (err) {
      console.error("Confirm order error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Optionally: cancel order (buyer only)
  app.post("/api/orders/:id/cancel", async (req, res) => {
    try {
      if (!req.session || !req.session.user) return res.status(401).json({ error: "not authenticated" });
      const username = req.session.user.username;
      const id = req.params.id;
      const orders = getCollection("orders");
      let q = {};
      if (/^[0-9a-fA-F]{24}$/.test(id)) q._id = new ObjectId(id); else q._id = id;
      const order = await orders.findOne(q);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.buyer !== username) return res.status(403).json({ error: "Only buyer can cancel" });
      await orders.updateOne(q, { $set: { status: "cancelled", updatedAt: new Date() } });
      const updated = await orders.findOne(q);
      res.json({ ok: true, order: updated });
    } catch (err) {
      console.error("Cancel order error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // health
  app.get("/__health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // start
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => console.log(`✅ Server running at http://localhost:${PORT}`));
}

start().catch(err => { console.error("Startup failed:", err); process.exit(1); });
