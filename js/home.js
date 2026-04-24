function getWeekItem(arr) {
  const week = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  return arr[week % arr.length];
}

async function loadHome() {

  const men = await fetch("data/mathematicians-men.json").then(r => r.json());
  const women = await fetch("data/mathematicians-women.json").then(r => r.json());
  const problems = await fetch("data/fun-problems.json").then(r => r.json());

  const allMath = [...men, ...women];

  const m = getWeekItem(allMath);
  const p = getWeekItem(problems);

  document.getElementById("math").innerHTML = `
    <div class="card">
      <h2>${m.name} (${m.era})</h2>
      <p><b>Domaine :</b> ${m.field || ""}</p>
      <p>${m.summary}</p>
      <p><b>Travaux :</b> ${m.research}</p>
      <p><b>Formule :</b> ${m.formulas[0]}</p>
    </div>
  `;

  document.getElementById("problem").innerHTML = `
    <div class="card">
      <h2>${p.title}</h2>
      <p>${p.statement}</p>
      <p><b>Indice :</b> ${p.hint}</p>

      <button onclick="this.nextElementSibling.style.display='block'">
        Voir correction
      </button>

      <div style="display:none">
        <p>${p.solution}</p>
        <p><b>Formule :</b> ${p.formula}</p>
      </div>
    </div>
  `;
}