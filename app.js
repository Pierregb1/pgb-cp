document.addEventListener("DOMContentLoaded", () => {

  // LOGIN
  const btn = document.getElementById("loginBtn");
  if (btn) {
    btn.addEventListener("click", login);
  }

  checkAuth();

  loadHome();
  loadCourses();

});

// ================= LOGIN =================
function login() {
  const id = document.getElementById("id").value;
  const mdp = document.getElementById("mdp").value;

  if (id === "eleve" && mdp === "jadorelesmaths") {
    localStorage.setItem("auth", "true");
    window.location.href = "home.html";
  } else {
    alert("Identifiants incorrects");
  }
}

// ================= LOGOUT =================
function logout() {
  localStorage.removeItem("auth");
  window.location.href = "index.html";
}

// ================= SECURITE =================
function checkAuth() {
  const page = window.location.pathname;

  if (!page.includes("index.html")) {
    if (localStorage.getItem("auth") !== "true") {
      window.location.href = "index.html";
    }
  }
}

// ================= NAV =================
function goCourses() {
  window.location.href = "courses.html";
}

function goHome() {
  window.location.href = "home.html";
}

// ================= SEMAINE =================
function getWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now - start) / 604800000);
}

// ================= HOME =================
async function loadHome() {

  if (!document.getElementById("math-week")) return;

  try {
    const men = await fetch("data/mathematicians-men.json").then(r => r.json());
    const women = await fetch("data/mathematicians-women.json").then(r => r.json());

    const all = [...men, ...women];
    const m = all[getWeek() % all.length];

    document.getElementById("math-week").innerHTML =
      `<h3>${m.name}</h3><p>${m.summary}</p>`;
  } catch {}

  try {
    const probs = await fetch("data/fun-problems.json").then(r => r.json());
    const p = probs[getWeek() % probs.length];

    document.getElementById("problem").innerText = p.statement;
    document.getElementById("solution").innerText = p.solution;
  } catch {}
}

// ================= PROBLEME =================
function toggleSolution() {
  const el = document.getElementById("solution");
  if (el) el.classList.toggle("hidden");
}

// ================= COURS =================
async function loadCourses() {

  const container = document.getElementById("docs");
  if (!container) return;

  try {
    const docs = await fetch("data/documents.json").then(r => r.json());

    container.innerHTML = "";

    docs.forEach(d => {
      const div = document.createElement("div");
      div.className = "doc";
      div.innerHTML = `<h3>${d.titre}</h3>`;

      div.onclick = () => {
        document.getElementById("viewer").src = d.fichier;
      };

      container.appendChild(div);
    });

  } catch {
    container.innerHTML = "Aucun document";
  }
}