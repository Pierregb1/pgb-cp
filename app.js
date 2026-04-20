let catalog = [];
let filteredDocs = [];

const matiereSelect = document.getElementById("matiere");
const niveauSelect = document.getElementById("niveau");
const typeSelect = document.getElementById("type");
const searchInput = document.getElementById("search");
const documentList = document.getElementById("document-list");
const pdfViewer = document.getElementById("pdf-viewer");
const viewerTitle = document.getElementById("viewer-title");
const downloadLink = document.getElementById("download-link");

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function uniqueValues(items, key, filters = {}) {
  return [...new Set(
    items
      .filter(item =>
        Object.entries(filters).every(([k, v]) => !v || item[k] === v)
      )
      .map(item => item[key])
  )].sort();
}

function fillSelect(select, values, placeholder, keepValue = "") {
  select.innerHTML = `<option value="">${placeholder}</option>`;

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = capitalize(value);
    select.appendChild(option);
  });

  if (keepValue && values.includes(keepValue)) {
    select.value = keepValue;
  } else {
    select.value = "";
  }

  select.disabled = values.length === 0;
}

function openPdf(doc) {
  viewerTitle.textContent = doc.titre;
  pdfViewer.src = doc.fichier;
  downloadLink.href = doc.fichier;
  downloadLink.classList.remove("hidden");
}

function renderList(docs) {
  documentList.innerHTML = "";

  if (docs.length === 0) {
    documentList.innerHTML = `<li class="document-item">Aucun document trouvé.</li>`;
    viewerTitle.textContent = "Aucun document sélectionné";
    pdfViewer.src = "";
    downloadLink.href = "#";
    downloadLink.classList.add("hidden");
    return;
  }

  docs.forEach((doc, index) => {
    const li = document.createElement("li");
    li.className = "document-item";
    li.innerHTML = `
      <div class="doc-title">${doc.titre}</div>
      <div class="doc-meta">${capitalize(doc.matiere)} · ${capitalize(doc.niveau)} · ${doc.type.toUpperCase()}</div>
    `;

    li.addEventListener("click", () => {
      document.querySelectorAll(".document-item").forEach(el => el.classList.remove("active"));
      li.classList.add("active");
      openPdf(doc);
    });

    documentList.appendChild(li);

    if (index === 0) {
      li.classList.add("active");
      openPdf(doc);
    }
  });
}

function applyFilters() {
  const matiere = matiereSelect.value;
  const niveau = niveauSelect.value;
  const type = typeSelect.value;
  const search = searchInput.value.trim().toLowerCase();

  filteredDocs = catalog.filter(doc => {
    return (
      (!matiere || doc.matiere === matiere) &&
      (!niveau || doc.niveau === niveau) &&
      (!type || doc.type === type) &&
      (!search || doc.titre.toLowerCase().includes(search))
    );
  });

  renderList(filteredDocs);
}

function updateSelectors() {
  const currentMatiere = matiereSelect.value;
  const currentNiveau = niveauSelect.value;
  const currentType = typeSelect.value;

  const niveaux = uniqueValues(catalog, "niveau", {
    matiere: currentMatiere
  });
  fillSelect(niveauSelect, niveaux, "-- Choisir --", currentNiveau);

  const types = uniqueValues(catalog, "type", {
    matiere: currentMatiere,
    niveau: niveauSelect.value
  });
  fillSelect(typeSelect, types, "-- Choisir --", currentType);

  applyFilters();
}

async function init() {
  try {
    const response = await fetch("catalog.json");

    if (!response.ok) {
      throw new Error(`Impossible de charger catalog.json (${response.status})`);
    }

    catalog = await response.json();

    if (!Array.isArray(catalog) || catalog.length === 0) {
      documentList.innerHTML = `<li class="document-item">Aucun PDF détecté dans catalog.json.</li>`;
      return;
    }

    fillSelect(matiereSelect, uniqueValues(catalog, "matiere"), "-- Choisir --");
    matiereSelect.disabled = false;

    matiereSelect.addEventListener("change", updateSelectors);
    niveauSelect.addEventListener("change", updateSelectors);
    typeSelect.addEventListener("change", applyFilters);
    searchInput.addEventListener("input", applyFilters);
  } catch (error) {
    console.error(error);
    documentList.innerHTML = `<li class="document-item">Erreur de chargement de catalog.json.</li>`;
  }
}

init();