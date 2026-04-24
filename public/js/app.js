document.addEventListener("DOMContentLoaded", () => {
  console.log("JS LOADED");

  fetch("/catalog.json")
    .then(res => res.json())
    .then(docs => {
      console.log("DOCS:", docs);

      const list = document.getElementById("document-list");
      const viewer = document.getElementById("pdf-viewer");

      if (!list) {
        console.error("document-list not found");
        return;
      }

      list.innerHTML = "";

      docs.forEach(doc => {
        const li = document.createElement("li");

        li.textContent = doc.titre;
        li.style.cursor = "pointer";
        li.style.margin = "10px 0";

        li.onclick = () => {
          viewer.src = "/" + doc.fichier;
        };

        list.appendChild(li);
      });
    })
    .catch(err => console.error("Erreur :", err));
});