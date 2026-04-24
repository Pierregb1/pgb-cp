document.addEventListener("DOMContentLoaded", () => {

  const list = document.getElementById("document-list");
  const viewer = document.getElementById("pdf-viewer");

  // ======================
  // 🔥 CHARGER LES DOCS
  // ======================
  function loadDocuments() {

    fetch("/api/docs")
      .then(res => {
        if (!res.ok) throw new Error("Erreur API");
        return res.json();
      })
      .then(docs => {

        list.innerHTML = "";

        if (!docs || docs.length === 0) {
          list.innerHTML = "<li>Aucun document</li>";
          return;
        }

        docs.forEach(doc => {

          const li = document.createElement("li");

          // 🔹 affichage propre
          li.innerHTML = `
            <strong>${doc.titre}</strong><br>
            <small>
              ${doc.matiere || ""} |
              ${doc.niveau || ""} |
              ${doc.type || ""}
            </small>
          `;

          // 🔹 clic → ouvrir PDF
          li.onclick = () => {
            viewer.src = "/" + doc.pdf_path;
          };

          list.appendChild(li);
        });

      })
      .catch(err => {
        console.error("Erreur chargement docs :", err);
        list.innerHTML = "<li>Erreur chargement</li>";
      });
  }

  // ======================
  // 🔥 GESTION UPLOAD (AUTO REFRESH)
  // ======================
  const form = document.querySelector("form");

  if (form) {
    form.addEventListener("submit", (e) => {

      e.preventDefault();

      const formData = new FormData(form);

      fetch("/upload", {
        method: "POST",
        body: formData
      })
        .then(res => res.text())
        .then(msg => {
          alert(msg);

          // 🔥 recharge les documents après upload
          loadDocuments();
        })
        .catch(err => {
          console.error(err);
          alert("Erreur upload");
        });

    });
  }

  // ======================
  // INIT
  // ======================
  loadDocuments();

});