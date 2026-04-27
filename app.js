// ========================
// 🔐 LOGIN
// ========================
function login() {
  const id = document.getElementById("id")?.value;
  const mdp = document.getElementById("mdp")?.value;

  console.log("LOGIN CLICK"); // debug

  if (id === "eleve" && mdp === "jadorelesmaths") {
    localStorage.setItem("auth", "true");
    window.location.href = "home.html";
  } else {
    alert("Identifiant ou mot de passe incorrect");
  }
}
// ===== NORMALISATION =====
function normalize(value, type) {
  if (!value) return value;

  value = value.toLowerCase();

  if (type === "matiere") {
    if (["math", "maths", "mathematique", "mathematiques"].includes(value)) return "maths";
    if (["phy", "physique", "physiquechimie", "physique-chimie", "pc"].includes(value)) return "physique";
  }

  if (type === "niveau") {
    if (["term", "terminale", "tle"].includes(value)) return "terminale";
    if (["premiere", "prem", "1ere"].includes(value)) return "premiere";
    if (["troisieme", "3eme", "3ieme"].includes(value)) return "3eme";
    if (["sup", "superieur", "superieure", "supérieur", "supérieure"].includes(value)) return "superieur";
  }

  if (type === "type") {
    if (["exo", "exos", "td", "exercice", "exercices"].includes(value)) return "exercice";
    if (["ds", "devoir"].includes(value)) return "ds";
    if (["corr", "corrige", "correction"].includes(value)) return "corrige";
    if (["cours"].includes(value)) return "cours";
  }

  return value;
}
// ========================
// 🔓 LOGOUT
// ========================
function logout() {
  localStorage.removeItem("auth");
  window.location.href = "index.html";
}

// ========================
// 🔒 PROTECTION DES PAGES
// ========================
function checkAuth() {
  const path = window.location.pathname;

  // autoriser index.html sans login
  if (!path.includes("index.html")) {
    if (localStorage.getItem("auth") !== "true") {
      window.location.href = "index.html";
    }
  }
}

// ========================
// 🔁 NAVIGATION
// ========================
function goCourses() {
  window.location.href = "courses.html";
}

function goHome() {
  window.location.href = "home.html";
}

// ========================
// 📅 SEMAINE
// ========================
function getWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now - start) / 604800000);
}

// ========================
// 🧠 PAGE ACCUEIL
// ========================
async function loadHome() {
  if (!document.getElementById("math-week")) return;

  try {
    const men = await fetch("data/mathematicians-men.json").then(r => r.json());
    const women = await fetch("data/mathematicians-women.json").then(r => r.json());

    const all = [...men, ...women];
    const m = all[getWeek() % all.length];

    document.getElementById("math-week").innerHTML = `
      <h3>${m.name}</h3>
      <p>${m.summary}</p>
    `;
  } catch (e) {
    console.log("Erreur chargement mathématiciens", e);
  }

  try {
    const probs = await fetch("data/fun-problems.json").then(r => r.json());
    const p = probs[getWeek() % probs.length];

    document.getElementById("problem").innerText = p.statement;
    
    document.getElementById("solution").innerText = p.solution;
  } catch (e) {
    console.log("Erreur chargement problème", e);
  }
}

// ========================
// 🧩 PROBLEME
// ========================
function toggleSolution() {
  const el = document.getElementById("solution");
  if (el) el.classList.toggle("hidden");
}

// ====== PARTIE COURS ======

async function loadDocs() {
  const res = await fetch("data/documents.json");
  const docs = await res.json();

  const matieres = [...new Set(docs.map(d => normalize(d.matiere, "matiere")))];
  const niveaux = [...new Set(docs.map(d => d.niveau))];
  const types = [...new Set(docs.map(d => d.type))];

  fillSelect("matiere", matieres);
  fillSelect("niveau", niveaux);
  fillSelect("type", types);

  displayDocs(docs);

  document.getElementById("matiere").onchange = () => filterDocs(docs);
  document.getElementById("niveau").onchange = () => filterDocs(docs);
  document.getElementById("type").onchange = () => filterDocs(docs);
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">Tous</option>`;
  values.forEach(v => {
    select.innerHTML += `<option value="${v}">${v}</option>`;
  });
}

function filterDocs(docs) {
  const m = document.getElementById("matiere").value;
  const n = document.getElementById("niveau").value;
  const t = document.getElementById("type").value;

  const filtered = docs.filter(d =>
    (!m || normalize(d.matiere, "matiere") === m) &&
    (!n || d.niveau === n) &&
    (!t || d.type === t)
  );

  displayDocs(filtered);
}

function displayDocs(docs) {
  const container = document.getElementById("docs");
  if (!container) return;

  container.innerHTML = "";

  docs.forEach(doc => {
    const div = document.createElement("div");
    div.className = "doc";

    div.innerHTML = `
      <h3>${doc.titre}</h3>
      <p>${normalize(doc.matiere,"matiere")} • ${doc.niveau} • ${doc.type}</p>
    `;

    div.onclick = () => {
      document.getElementById("viewer").src = doc.fichier;
    };

    container.appendChild(div);
  });
}

// lancer uniquement sur la page cours
if (document.getElementById("docs")) {
  loadDocs();
}

// ========================
// 🚀 INIT GLOBAL
// ========================
document.addEventListener("DOMContentLoaded", () => {

  checkAuth();

  // HOME
  loadHome();

  // COURS
  loadCourses();

});

// ===== RANDOM SEMAINE =====

function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now - start) / (1000 * 60 * 60 * 24 * 7));
}

function pickWeekly(array) {
  const week = getWeekNumber();
  return array[week % array.length];
}

// ===== LOAD HOME AMÉLIORÉ =====

async function loadHomeEnhanced() {

  // PROBLEMS
  const resProb = await fetch("data/fun-problems.json");
  const problems = await resProb.json();

  const p = pickWeekly(problems);

  if (document.getElementById("problem-box")) {
    document.getElementById("problem-box").innerHTML = `
      <h3>${p.title}</h3>
      <p><b>Énoncé :</b> ${p.statement}</p>
      <p><i>Indice :</i> ${p.hint}</p>
      <button onclick="toggleSolution()">Voir correction</button>
      <p id="solution" class="hidden">${p.solution}</p>
    `;
  }

  // MATHS
  const men = await (await fetch("data/mathematicians-men.json")).json();
  const women = await (await fetch("data/mathematicians-women.json")).json();

  const all = [...men, ...women];
  const m = pickWeekly(all);

  if (document.getElementById("math-week")) {
    document.getElementById("math-week").innerHTML = `
      <h3>${m.name} (${m.era})</h3>
      <p>${m.summary}</p>
      <p><b>Travaux :</b> ${m.research}</p>
      <p><b>Formules :</b></p>
      <ul>
        ${m.formulas.map(f => `<li>${f}</li>`).join("")}
      </ul>
    `;
  }
}

// AUTO LOAD SANS CASSER L'ANCIEN
if (document.getElementById("math-week")) {
  loadHomeEnhanced();
}