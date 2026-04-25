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

// ========================
// 📂 PAGE COURS
// ========================
async function loadCourses() {
  const container = document.getElementById("docs");
  if (!container) return;

  try {
    const docs = await fetch("data/documents.json").then(r => r.json());

    container.innerHTML = "";

    docs.forEach(d => {
      const div = document.createElement("div");
      div.className = "doc";

      div.innerHTML = `
        <h3>${d.titre}</h3>
        <p>${d.matiere || ""} ${d.niveau || ""} ${d.type || ""}</p>
      `;

      div.onclick = () => {
        document.getElementById("viewer").src = d.fichier;
      };

      container.appendChild(div);
    });

  } catch (e) {
    console.log("Erreur chargement docs", e);
    container.innerHTML = "Aucun document";
  }
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