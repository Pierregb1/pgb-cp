// ================= LOGIN =================
if (localStorage.getItem("auth") !== "true") {
  document.getElementById("login").innerHTML = `
    <div class="login-box">
      <h2>Connexion</h2>
      <input id="mdp" type="password" placeholder="Mot de passe">
      <button onclick="login()">Connexion</button>
    </div>
  `;
} else {
  document.getElementById("app").style.display = "block";
}

function login() {
  if (document.getElementById("mdp").value === "admin123") {
    localStorage.setItem("auth", "true");
    location.reload();
  }
}

// ================= CHEMIN GITHUB PAGES =================
function getBasePath() {
  const path = window.location.pathname.split("/");
  return "/" + path[1]; // nom du repo
}

// ================= SEMAINE =================
function getWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now - start) / 604800000);
}

// ================= MATH =================
async function loadMath() {
  const men = await fetch("data/mathematicians-men.json").then(r => r.json());
  const women = await fetch("data/mathematicians-women.json").then(r => r.json());

  const all = [...men, ...women];
  const m = all[getWeek() % all.length];

  document.getElementById("math-week").innerHTML = `
    <h3>${m.name}</h3>
    <p>${m.summary}</p>
  `;
}

// ================= PROBLEME =================
async function loadProblem() {
  const probs = await fetch("data/fun-problems.json").then(r => r.json());
  const p = probs[getWeek() % probs.length];

  document.getElementById("problem").innerText = p.statement;
  document.getElementById("solution").innerText = p.solution;
}

function toggleSolution() {
  document.getElementById("solution").classList.toggle("hidden");
}

// ================= DOCS =================
async function loadDocs() {
  const container = document.getElementById("docs");

  try {
    const docs = await fetch("data/documents.json").then(r => r.json());

    container.innerHTML = "";

    docs.forEach(doc => {
      const div = document.createElement("div");
      div.className = "doc";

      div.innerHTML = `
        <h3>${doc.titre}</h3>
        <p>${doc.matiere || ""} ${doc.niveau || ""} ${doc.type || ""}</p>
      `;

      div.onclick = () => {
        const base = getBasePath();
        const fullPath = window.location.origin + base + "/" + doc.fichier;

        document.getElementById("viewer").src = fullPath;
      };

      container.appendChild(div);
    });

  } catch (e) {
    container.innerHTML = "<p>Aucun document</p>";
  }
}

// ================= INIT =================
loadMath();
loadProblem();
loadDocs();
