const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const uploadRoute = require("./routes/upload");

const app = express();

// ======================
// DATABASE (SSL FORCÉ)
// ======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ======================
// MIDDLEWARES
// ======================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// 🔥 SERVIR LES PDF CORRECTEMENT
app.use("/pdfs", express.static(path.join(__dirname, "pdfs")));

app.use(express.static(__dirname));

app.use(session({
  secret: process.env.SESSION_SECRET || "dev_secret",
  resave: false,
  saveUninitialized: false
}));

// ======================
// VIEW ENGINE
// ======================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ======================
// ROUTES
// ======================
app.get("/", (req, res) => {
  res.render("index");
});

// ----------------------
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// ----------------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.render("login", { error: "Utilisateur inconnu" });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.render("login", { error: "Mot de passe incorrect" });
    }

    req.session.user = {
      id: user.id,
      email: user.email
    };

    res.redirect("/dashboard");

  } catch (err) {
    console.error("💥 ERREUR LOGIN :", err);
    res.status(500).send("Erreur serveur");
  }
});

// ----------------------
app.get("/dashboard", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  try {
    const result = await pool.query(
      "SELECT * FROM documents ORDER BY created_at DESC"
    );

    res.render("dashboard", {
      user: req.session.user,
      documents: result.rows
    });

  } catch (err) {
    console.error("💥 ERREUR DASHBOARD :", err);
    res.status(500).send("Erreur serveur");
  }
});

// ----------------------
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ======================
// UPLOAD ROUTE
// ======================
app.use("/upload", uploadRoute);

// ======================
// API DOCS
// ======================
app.get("/api/docs", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM documents ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("💥 ERREUR API DOCS :", err);
    res.status(500).send("Erreur DB");
  }
});

// ======================
// DEBUG PDF (TEMPORAIRE)
// ======================
app.get("/debug-pdfs", (req, res) => {
  const fs = require("fs");
  const dir = path.join(__dirname, "pdfs");

  if (!fs.existsSync(dir)) {
    return res.send("❌ dossier pdfs introuvable");
  }

  const files = fs.readdirSync(dir);

  res.send(`
    <h2>PDFs sur le serveur :</h2>
    <pre>${JSON.stringify(files, null, 2)}</pre>
  `);
});

// ======================
// HEALTH
// ======================
app.get("/health", (req, res) => res.send("ok"));

// ======================
// START
// ======================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});