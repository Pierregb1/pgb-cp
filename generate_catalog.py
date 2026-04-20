import json
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
PDF_ROOT = ROOT / "pdfs"
CATALOG_PATH = ROOT / "catalog.json"

def prettify_title(filename: str) -> str:
    name = Path(filename).stem
    name = name.replace("_", " ").replace("-", " ")
    return name[:1].upper() + name[1:]

def main():
    entries = []

    if not PDF_ROOT.exists():
        print("Le dossier 'pdfs' est introuvable.")
        return

    for pdf in PDF_ROOT.rglob("*.pdf"):
        rel_parts = pdf.relative_to(PDF_ROOT).parts

        # On attend : matiere / niveau / type / fichier.pdf
        if len(rel_parts) < 4:
            print(f"Ignoré (arborescence trop courte) : {pdf}")
            continue

        matiere = rel_parts[0].lower()
        niveau = rel_parts[1].lower()
        type_doc = rel_parts[2].lower()

        rel_path = pdf.relative_to(ROOT).as_posix()

        entries.append({
            "matiere": matiere,
            "niveau": niveau,
            "type": type_doc,
            "titre": prettify_title(pdf.name),
            "fichier": rel_path
        })

    entries.sort(key=lambda x: (x["matiere"], x["niveau"], x["type"], x["titre"]))

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    print(f"catalog.json créé avec {len(entries)} document(s).")

if __name__ == "__main__":
    main()