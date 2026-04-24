
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const fs = require("fs");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use("/pdfs", express.static("pdfs"));

app.use(session({
  secret: process.env.SESSION_SECRET || "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

app.set("view engine", "ejs");

function loadJSON(path) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (e) {
    return [];
  }
}

function loadDocuments() {
  return loadJSON("catalog.json");
}

function getISOWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

function pickWeeklyItem(list, seedKey, salt) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const seed = hashString(`${seedKey}-${salt}`);
  return list[seed % list.length];
}

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (result.rows.length === 0) {
      return res.render("login", { error: "Utilisateur inconnu" });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.render("login", { error: "Mot de passe incorrect" });
    }
    req.session.user = { id: user.id, email: user.email };
    res.redirect("/dashboard");
  } catch (e) {
    res.status(500).send("Erreur serveur");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const docs = loadDocuments();
  res.render("dashboard", { documents: docs, user: req.session.user });
});

// Weekly API
app.get("/api/weekly", (req, res) => {
  const men = loadJSON("data/mathematicians-men.json");
  const women = loadJSON("data/mathematicians-women.json");
  const problems = loadJSON("data/fun-problems.json");
  const weekKey = getISOWeekKey();
  const man = pickWeeklyItem(men, weekKey, "men");
  const woman = pickWeeklyItem(women, weekKey, "women");
  const problem = pickWeeklyItem(problems, weekKey, "problems");
  res.json({ man, woman, problem, weekKey });
});

// health
app.get("/health", (req, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));
