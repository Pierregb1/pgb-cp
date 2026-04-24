// ================= LOGIN =================
function login() {
  const id = document.getElementById("id").value;
  const mdp = document.getElementById("mdp").value;

  if (id === "eleve" && mdp === "jadorelesmaths") {
    localStorage.setItem("auth", "true");
    window.location.href = "home.html";
  } else {
    alert("Erreur");
  }
}

function logout() {
  localStorage.removeItem("auth");
  window.location.href = "index.html";
}

// ================= NAV =================
function goCourses() {
  window.location.href = "courses.html";
}

function goHome() {
  window.location.href = "home.html";
}

// ================= SECURITE =================
if (!window.location.pathname.includes("index.html")) {
  if (localStorage.getItem("auth") !== "true") {
    window.location.href = "index.html";
  }
}

// ================= SEMAINE =================
function week() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d - start) / 604800000);
}

// ================= HOME =================
async function loadHome() {
  if (!document.getElementById("math-week")) return;

  const men = await fetch("data/mathematicians-men.json").then(r => r.json());
  const women = await fetch("data/mathematicians-women.json").then(r => r.json());
  const all = [...men, ...women];

  const m = all[week() % all.length];

  document.getElementById("math-week").innerHTML =
    `<h3>${m.name}</h3><p>${m.summary}</p>`;

  const probs = await fetch("data/fun-problems.json").then(r => r.json());
  const p = probs[week() % probs.length];

  document.getElementById("problem").innerText = p.statement;
  document.getElementById("solution").innerText = p.solution;
}

function toggleSolution() {
  document.getElementById("solution").classList.toggle("hidden");
}

// ================= COURS =================
async function loadCourses() {
  if (!document.getElementById("docs")) return;

  const docs = await fetch("data/documents.json").then(r => r.json());
  const container = document.getElementById("docs");

  container.innerHTML = "";

  docs.forEach(d => {
    const div = document.createElement("div");
    div.className = "doc";
    div.innerText = d.titre;

    div.onclick = () => {
      document.getElementById("viewer").src = d.fichier;
    };

    container.appendChild(div);
  });
}

// ================= INIT =================
loadHome();
loadCourses();