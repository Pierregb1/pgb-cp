const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const app = express();

// 🔹 DATABASE
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

// 🔹 MIDDLEWARES
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// 🔹 STATIC FILES (TRÈS IMPORTANT)
app.use(express.static(path.join(__dirname, "public")));
app.use("/pdfs", express.static(path.join(__dirname, "pdfs")));
app.use(express.static(__dirname)); // 👉 pour catalog.json

// 🔹 SESSION
app.use(session({
  secret: process.env.SESSION_SECRET || "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

// 🔹 VIEW ENGINE
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 🔹 UTILS
function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, filePath)));
  } catch (e) {
    console.log("Erreur lecture JSON:", filePath);
    return [];
  }
}

// 🔹 WEEKLY LOGIC
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

// 🔹 ROUTES

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

  } catch (e) {
    console.error(e);
    res.status(500).send("Erreur serveur");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// 🔥 DASHBOARD (IMPORTANT)
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  // 👉 on ne passe PLUS les documents ici
  // 👉 ils sont chargés côté JS avec fetch("/catalog.json")

  res.render("dashboard", {
    user: req.session.user
  });
});

// 🔹 WEEKLY API
app.get("/api/weekly", (req, res) => {
  const men = loadJSON("data/mathematicians-men.json");
  const women = loadJSON("data/mathematicians-women.json");
  const problems = loadJSON("data/fun-problems.json");

  const weekKey = getISOWeekKey();

  res.json({
    man: pickWeeklyItem(men, weekKey, "men"),
    woman: pickWeeklyItem(women, weekKey, "women"),
    problem: pickWeeklyItem(problems, weekKey, "problems"),
    weekKey
  });
});

// 🔹 HEALTH
app.get("/health", (req, res) => res.send("ok"));

// 🔹 START
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});