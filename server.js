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

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

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

app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  res.render("dashboard", { user: req.session.user });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ======================
// UPLOAD
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
// HEALTH
// ======================
app.get("/health", (req, res) => res.send("ok"));

// ======================
// START
// ======================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});