async function loadDocs() {
  const container = document.getElementById("docs");
  container.innerHTML = "";

  const data = await fetch("data/catalog.json").then(r => r.json());

  const matiereFilter = document.getElementById("matiereFilter").value;
  const niveauFilter = document.getElementById("niveauFilter").value;
  const typeFilter = document.getElementById("typeFilter").value;

  data.forEach(doc => {

    if (matiereFilter && doc.matiere !== matiereFilter) return;
    if (niveauFilter && doc.niveau !== niveauFilter) return;
    if (typeFilter && doc.type !== typeFilter) return;

    container.innerHTML += `
      <div class="card">
        <h3>${doc.titre}</h3>
        <p>${doc.matiere} - ${doc.niveau} - ${doc.type}</p>

        <iframe src="${doc.pdf}" width="100%" height="400"></iframe>

        <a href="${doc.pdf}" target="_blank">Télécharger</a>
      </div>
    `;
  });
}