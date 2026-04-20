let catalog = [];

const matiereSelect = document.getElementById("matiere");
const niveauSelect = document.getElementById("niveau");
const typeSelect = document.getElementById("type");
const searchInput = document.getElementById("search");
const documentList = document.getElementById("document-list");
const pdfViewer = document.getElementById("pdf-viewer");
const viewerTitle = document.getElementById("viewer-title");
const downloadLink = document.getElementById("download-link");

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function displayLabel(str) {
  const map = {
    "maths": "Maths",
    "physique": "Physique",
    "physique-chimie": "Physique-chimie",
    "troisieme": "Troisième",
    "premiere": "Première",
    "terminale": "Terminale",
    "superieure": "Supérieure",
    "cours": "Cours",
    "exos": "Exercices",
    "ds": "DS"
  };
  return map[str] || (str ? str.charAt(0).toUpperCase() + str.slice(1) : "");
}

function uniqueValues(items, key, filters = {}) {
  return [...new Set(
    items
      .filter(item =>
        Object.entries(filters).every(([k, v]) => !v || normalize(item[k]) === normalize(v))
      )
      .map(item => normalize(item[key]))
      .filter(Boolean)
  )].sort();
}

function fillSelect(select, values, placeholder, selectedValue = "") {
  const normalizedSelected = normalize(selectedValue);
  select.innerHTML = `<option value="">${placeholder}</option>`;

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = displayLabel(value);
    select.appendChild(option);
  });

  select.value = values.includes(normalizedSelected) ? normalizedSelected : "";
  select.disabled = values.length === 0;
}

function clearViewer() {
  viewerTitle.textContent = "Aucun document sélectionné";
  pdfViewer.src = "";
  downloadLink.href = "#";
  downloadLink.classList.add("hidden");
}

function openPdf(doc) {
  viewerTitle.textContent = doc.titre || "Document";
  pdfViewer.src = doc.fichier;
  downloadLink.href = doc.fichier;
  downloadLink.classList.remove("hidden");
}

function renderList(docs) {
  documentList.innerHTML = "";

  if (docs.length === 0) {
    documentList.innerHTML = `<li class="document-item">Aucun document trouvé.</li>`;
    clearViewer();
    return;
  }

  docs.forEach((doc, index) => {
    const li = document.createElement("li");
    li.className = "document-item";
    li.innerHTML = `
      <div class="doc-title">${doc.titre}</div>
      <div class="doc-meta">${displayLabel(doc.matiere)} · ${displayLabel(doc.niveau)} · ${displayLabel(doc.type)}</div>
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
  const matiere = normalize(matiereSelect.value);
  const niveau = normalize(niveauSelect.value);
  const type = normalize(typeSelect.value);
  const search = normalize(searchInput.value);

  const docs = catalog.filter(doc => {
    return (
      (!matiere || doc.matiere === matiere) &&
      (!niveau || doc.niveau === niveau) &&
      (!type || doc.type === type) &&
      (!search || normalize(doc.titre).includes(search))
    );
  });

  renderList(docs);
}

function updateFilters() {
  const matiere = normalize(matiereSelect.value);
  const niveau = normalize(niveauSelect.value);
  const currentType = normalize(typeSelect.value);

  const niveaux = uniqueValues(catalog, "niveau", { matiere });
  fillSelect(niveauSelect, niveaux, "-- Choisir --", niveau);

  const types = uniqueValues(catalog, "type", {
    matiere,
    niveau: normalize(niveauSelect.value)
  });
  fillSelect(typeSelect, types, "-- Choisir --", currentType);

  applyFilters();
}

async function init() {
  try {
    const response = await fetch(`catalog.json?v=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Impossible de charger catalog.json (${response.status})`);
    }

    const rawCatalog = await response.json();

    catalog = rawCatalog
      .map(doc => ({
        ...doc,
        matiere: normalize(doc.matiere),
        niveau: normalize(doc.niveau),
        type: normalize(doc.type),
        titre: String(doc.titre || "").trim(),
        fichier: String(doc.fichier || "").trim()
      }))
      .filter(doc => doc.matiere && doc.niveau && doc.type && doc.titre && doc.fichier);

    if (!Array.isArray(catalog) || catalog.length === 0) {
      documentList.innerHTML = `<li class="document-item">Aucun PDF détecté.</li>`;
      clearViewer();
      return;
    }

    const matieres = uniqueValues(catalog, "matiere");
    fillSelect(matiereSelect, matieres, "-- Choisir --");

    matiereSelect.addEventListener("change", () => {
      niveauSelect.value = "";
      typeSelect.value = "";
      updateFilters();
    });

    niveauSelect.addEventListener("change", () => {
      typeSelect.value = "";
      updateFilters();
    });

    typeSelect.addEventListener("change", applyFilters);
    searchInput.addEventListener("input", applyFilters);

    applyFilters();
  } catch (e) {
    console.error(e);
    documentList.innerHTML = `<li class="document-item">Erreur de chargement de catalog.json.</li>`;
    clearViewer();
  }
}

init();