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

function uniqueValues(items, key, filters = {}) {
  return [...new Set(
    items
      .filter(item => Object.entries(filters).every(([k, v]) => !v || item[k] === v))
      .map(item => item[key])
  )].sort();
}

function fillSelect(select, values, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = capitalize(value);
    select.appendChild(option);
  });
  select.disabled = values.length === 0;
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderList(docs) {
  documentList.innerHTML = "";

  if (docs.length === 0) {
    documentList.innerHTML = `<li class="document-item">Aucun document trouvé.</li>`;
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

    if (index === 0) {
      setTimeout(() => li.click(), 0);
    }

    documentList.appendChild(li);
  });
}

function openPdf(doc) {
  viewerTitle.textContent = doc.titre;
  pdfViewer.src = doc.fichier;
  downloadLink.href = doc.fichier;
  downloadLink.classList.remove("hidden");
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
  const matiere = matiereSelect.value;
  const niveau = niveauSelect.value;

  fillSelect(
    niveauSelect,
    uniqueValues(catalog, "niveau", { matiere }),
    "-- Choisir --"
  );

  if (niveau && !uniqueValues(catalog, "niveau", { matiere }).includes(niveau)) {
    niveauSelect.value = "";
  }

  fillSelect(
    typeSelect,
    uniqueValues(catalog, "type", { matiere, niveau: niveauSelect.value }),
    "-- Choisir --"
  );

  if (!uniqueValues(catalog, "type", { matiere, niveau: niveauSelect.value }).includes(typeSelect.value)) {
    typeSelect.value = "";
  }

  applyFilters();
}

async function init() {
  const response = await fetch("catalog.json");
  catalog = await response.json();

  fillSelect(matiereSelect, uniqueValues(catalog, "matiere"), "-- Choisir --");

  matiereSelect.addEventListener("change", updateSelectors);
  niveauSelect.addEventListener("change", updateSelectors);
  typeSelect.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", applyFilters);
}

init();