const USER = "eleve";
const PASS = "jadorelesmaths";

function login() {
  const id = document.getElementById("id").value;
  const mdp = document.getElementById("mdp").value;

  if (id === USER && mdp === PASS) {
    localStorage.setItem("auth", "ok");
    window.location.href = "dashboard.html";
  } else {
    alert("Refusé");
  }
}

function checkAuth() {
  if (localStorage.getItem("auth") !== "ok") {
    window.location.href = "login.html";
  }
}

function logout() {
  localStorage.removeItem("auth");
  window.location.href = "login.html";
}