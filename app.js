// LOGIN
if (localStorage.getItem("auth") !== "true") {
  document.getElementById("login").innerHTML = `
    <input id="mdp" type="password" placeholder="Mot de passe">
    <button onclick="login()">Connexion</button>
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

// SEMAINE
function week() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d - start) / 604800000);
}

// MATH
async function loadMath() {
  const men = await fetch("data/mathematicians-men.json").then(r => r.json());
  const women = await fetch("data/mathematicians-women.json").then(r => r.json());
  const all = [...men, ...women];

  const m = all[week() % all.length];

  document.getElementById("math-week").innerHTML = `
    <h3>${m.name}</h3>
    <p>${m.summary}</p>
  `;
}

// PROBLEME
async function loadProblem() {
  const p = await fetch("data/fun-problems.json").then(r => r.json());
  const prob = p[week() % p.length];

  document.getElementById("problem").innerText = prob.statement;
  document.getElementById("solution").innerText = prob.solution;
}

function toggleSolution() {
  document.getElementById("solution").classList.toggle("hidden");
}

// DOCS
async function loadDocs() {
  const docs = await fetch("data/documents.json").then(r => r.json());
  const container = document.getElementById("docs");

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

// INIT
loadMath();
loadProblem();
loadDocs();