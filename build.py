from pathlib import Path
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).parent.resolve()
PDF_ROOT = ROOT / "pdfs"
OVERLEAF_ROOT = ROOT / "overleaf_sources"
CATALOG_PATH = ROOT / "catalog.json"

# Convention de classement :
# overleaf_sources/
#   maths/terminale/cours/mon_projet/main.tex
#   physique/premiere/ds/autre_projet/main.tex
#
# Le PDF final sera copié dans :
# pdfs/maths/terminale/cours/nom-du-fichier.pdf

def slugify(name: str) -> str:
    return (
        name.lower()
        .replace("é", "e")
        .replace("è", "e")
        .replace("ê", "e")
        .replace("à", "a")
        .replace("ù", "u")
        .replace("î", "i")
        .replace("ô", "o")
        .replace("ç", "c")
        .replace("'", "")
        .replace(" ", "-")
    )

def compile_tex_project(project_dir: Path) -> Path | None:
    tex_files = list(project_dir.glob("*.tex"))
    if not tex_files:
        return None

    main_tex = project_dir / "main.tex"
    if not main_tex.exists():
        main_tex = tex_files[0]

    try:
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", main_tex.name],
            cwd=project_dir,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", main_tex.name],
            cwd=project_dir,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
    except subprocess.CalledProcessError as e:
        print(f"Erreur de compilation dans {project_dir}:")
        print(e.stdout.decode(errors="ignore"))
        print(e.stderr.decode(errors="ignore"))
        return None

    pdf_path = project_dir / main_tex.with_suffix(".pdf").name
    return pdf_path if pdf_path.exists() else None

def rebuild_pdfs():
    if not OVERLEAF_ROOT.exists():
        print("Dossier overleaf_sources introuvable.")
        return

    for matiere_dir in OVERLEAF_ROOT.iterdir():
        if not matiere_dir.is_dir():
            continue
        for niveau_dir in matiere_dir.iterdir():
            if not niveau_dir.is_dir():
                continue
            for type_dir in niveau_dir.iterdir():
                if not type_dir.is_dir():
                    continue
                for project_dir in type_dir.iterdir():
                    if not project_dir.is_dir():
                        continue

                    pdf = compile_tex_project(project_dir)
                    if pdf:
                        target_dir = PDF_ROOT / matiere_dir.name / niveau_dir.name / type_dir.name
                        target_dir.mkdir(parents=True, exist_ok=True)

                        target_name = slugify(project_dir.name) + ".pdf"
                        target_pdf = target_dir / target_name
                        shutil.copy2(pdf, target_pdf)
                        print(f"PDF copié : {target_pdf.relative_to(ROOT)}")

def build_catalog():
    entries = []

    for pdf in PDF_ROOT.rglob("*.pdf"):
        rel = pdf.relative_to(ROOT).as_posix()
        parts = pdf.relative_to(PDF_ROOT).parts

        if len(parts) < 4:
            continue

        matiere, niveau, type_doc = parts[0], parts[1], parts[2]
        titre = pdf.stem.replace("-", " ").replace("_", " ").title()

        entries.append({
            "matiere": matiere,
            "niveau": niveau,
            "type": type_doc,
            "titre": titre,
            "fichier": rel
        })

    entries.sort(key=lambda x: (x["matiere"], x["niveau"], x["type"], x["titre"]))

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    print(f"catalog.json généré avec {len(entries)} documents.")

def main():
    args = sys.argv[1:]

    if not args or "all" in args:
        rebuild_pdfs()
        build_catalog()
    else:
        if "pdfs" in args:
            rebuild_pdfs()
        if "catalog" in args:
            build_catalog()

if __name__ == "__main__":
    main()