import json
import re
import shutil
import subprocess
import tempfile
import unicodedata
from dataclasses import dataclass, asdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
LATEX_ROOT = ROOT / "latex_sources"
PDF_ROOT = ROOT / "pdfs"
CATALOG_PATH = ROOT / "catalog.json"
REPORT_PATH = ROOT / "tri_report.json"

ALLOWED_LEVELS = {"troisieme", "premiere", "terminale", "superieure"}
ALLOWED_TYPES = {"cours", "exos", "ds"}

SUBJECT_PATTERNS = {
    "maths": [
        r"\bmath\b", r"\bmaths\b", r"\bmathematique\b", r"\bmathematiques\b",
        r"\balgebre\b", r"\banalyse\b", r"\bgeometrie\b", r"\bcomplexe\b",
        r"\bfonctionnelle\b", r"\bpcsi\b"
    ],
    "physique-chimie": [
        r"\bphy\b", r"\bphysique\b", r"\bchimie\b", r"\bphychim\b",
        r"\bspectro\b", r"\bcohesion\b", r"\belec\b", r"\belectricite\b"
    ],
}

LEVEL_PATTERNS = {
    "troisieme": [r"\b3eme\b", r"\b3e\b", r"\btroisieme\b"],
    "premiere": [r"\bpremiere\b", r"\b1ere\b", r"\b1re\b", r"\bprem\b"],
    "terminale": [r"\bterminale\b", r"\bterm\b", r"\btle\b"],
    "superieure": [
        r"\bsuperieure\b", r"\bprepa\b", r"\bpcsi\b",
        r"\balgebre\b", r"\bcomplexe\b", r"\banalyse fonctionnelle\b"
    ]
}

TYPE_PATTERNS = {
    "cours": [r"\bcours\b", r"\bchap\b", r"\bchapitre\b", r"\bprog\b"],
    "exos": [r"\bexo\b", r"\bexos\b", r"\btd\b", r"\bcolle\b"],
    "ds": [r"\bds\b", r"\bdm\b", r"\bdevoir\b", r"\bcontrole\b", r"\btype bac\b", r"\bpolytech\b"]
}

CORRECTION_PATTERNS = [r"\bcorr\b", r"\bcorrige\b", r"\bcorrection\b"]


@dataclass
class TriResult:
    source_tex: str
    detected_subject: str | None
    detected_level: str | None
    detected_type: str | None
    is_correction: bool
    confidence: str
    status: str
    reason: str
    output_pdf: str | None
    title: str


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def normalize(text: str) -> str:
    text = strip_accents(str(text).lower())
    text = text.replace("&", " ")
    text = text.replace("_", " ")
    text = text.replace("-", " ")
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def matches_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text) for p in patterns)


def detect_unique(text: str, pattern_map: dict[str, list[str]]) -> tuple[str | None, list[str]]:
    hits = [key for key, patterns in pattern_map.items() if matches_any(text, patterns)]
    if len(hits) == 1:
        return hits[0], hits
    return None, hits


def prettify_title(filename: str, is_correction: bool) -> str:
    stem = Path(filename).stem
    stem = stem.replace("_", " ").replace("-", " ")
    stem = re.sub(r"\s+", " ", stem).strip()
    if is_correction and "corr" not in stem.lower():
        stem += " - corrigé"
    return stem[:1].upper() + stem[1:] if stem else "Document"


def compile_tex(tex_path: Path) -> Path | None:
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)

        # Copie tout le contenu de latex_sources dans le dossier temporaire
        # pour que les \input, images ou .sty communs restent accessibles
        for item in LATEX_ROOT.iterdir():
            target = tmpdir / item.name
            if item.is_dir():
                shutil.copytree(item, target)
            else:
                shutil.copy2(item, target)

        tmp_tex = tmpdir / tex_path.name

        if not tmp_tex.exists():
            return None

        try:
            for _ in range(2):
                result = subprocess.run(
                    ["pdflatex", "-interaction=nonstopmode", tmp_tex.name],
                    cwd=tmpdir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                print(f"\n--- Compilation de {tex_path.name} ---")
                print(result.stdout)
                if result.returncode != 0:
                    print(result.stderr)
                    return None
        except Exception as e:
            print(f"Erreur de compilation inattendue pour {tex_path}: {e}")
            return None

        pdf = tmp_tex.with_suffix(".pdf")
        if not pdf.exists():
            return None

        final_pdf = LATEX_ROOT / pdf.name
        shutil.copy2(pdf, final_pdf)
        return final_pdf


def safe_slug(text: str) -> str:
    text = strip_accents(text.lower())
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "document"


def decide_fields(tex_name: str, tex_content: str) -> TriResult:
    combined = normalize(tex_name + " " + tex_content[:4000])

    subject, subject_hits = detect_unique(combined, SUBJECT_PATTERNS)
    level, level_hits = detect_unique(combined, LEVEL_PATTERNS)
    type_doc, type_hits = detect_unique(combined, TYPE_PATTERNS)
    is_correction = matches_any(combined, CORRECTION_PATTERNS)

    title = prettify_title(tex_name, is_correction)

    reason_parts = []
    confidence = "high"
    status = "ok"

    if len(subject_hits) > 1:
        status = "needs_review"
        confidence = "low"
        reason_parts.append(f"matière ambiguë: {subject_hits}")
    elif not subject:
        status = "needs_review"
        confidence = "low"
        reason_parts.append("matière introuvable")

    if len(level_hits) > 1:
        status = "needs_review"
        confidence = "low"
        reason_parts.append(f"niveau ambigu: {level_hits}")
    elif not level:
        status = "needs_review"
        confidence = "low"
        reason_parts.append("niveau introuvable")

    if len(type_hits) > 1:
        status = "needs_review"
        confidence = "low"
        reason_parts.append(f"type ambigu: {type_hits}")
    elif not type_doc:
        status = "needs_review"
        confidence = "low"
        reason_parts.append("type introuvable")

    if status == "ok":
        reason_parts.append("détection claire")

    return TriResult(
        source_tex=tex_name,
        detected_subject=subject,
        detected_level=level,
        detected_type=type_doc,
        is_correction=is_correction,
        confidence=confidence,
        status=status,
        reason="; ".join(reason_parts),
        output_pdf=None,
        title=title
    )


def ensure_dirs():
    for subject in ["maths", "physique-chimie"]:
        for level in ALLOWED_LEVELS:
            for type_doc in ALLOWED_TYPES:
                (PDF_ROOT / subject / level / type_doc).mkdir(parents=True, exist_ok=True)
    (PDF_ROOT / "a_verifier").mkdir(parents=True, exist_ok=True)


def clean_generated_pdfs():
    for old_pdf in PDF_ROOT.rglob("*.pdf"):
        old_pdf.unlink()
    for old_pdf in LATEX_ROOT.glob("*.pdf"):
        old_pdf.unlink()


def build():
    ensure_dirs()
    clean_generated_pdfs()

    catalog = []
    report = []

    if not LATEX_ROOT.exists():
        print("latex_sources introuvable.")
        with open(CATALOG_PATH, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)
        return

    tex_files = sorted(LATEX_ROOT.glob("*.tex"))

    for tex_path in tex_files:
        tex_content = tex_path.read_text(encoding="utf-8", errors="ignore")
        result = decide_fields(tex_path.name, tex_content)

        print(f"Fichier: {tex_path.name}")
        print(f"Détection: matiere={result.detected_subject}, niveau={result.detected_level}, type={result.detected_type}, status={result.status}, raison={result.reason}")

        compiled_pdf = compile_tex(tex_path)

        if compiled_pdf is None:
            result.status = "needs_review"
            result.confidence = "low"
            result.reason += "; compilation échouée"

        if result.status == "ok" and compiled_pdf is not None:
            out_dir = PDF_ROOT / result.detected_subject / result.detected_level / result.detected_type
        else:
            out_dir = PDF_ROOT / "a_verifier"

        out_pdf = out_dir / f"{safe_slug(result.title)}.pdf"

        if compiled_pdf is not None:
            shutil.copy2(compiled_pdf, out_pdf)
            result.output_pdf = out_pdf.relative_to(ROOT).as_posix()

            if result.status == "ok":
                catalog.append({
                    "matiere": result.detected_subject,
                    "niveau": result.detected_level,
                    "type": result.detected_type,
                    "titre": result.title,
                    "fichier": result.output_pdf
                })

        report.append(asdict(result))

    catalog.sort(key=lambda x: (x["matiere"], x["niveau"], x["type"], x["titre"].lower()))

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"{len(catalog)} PDF classés automatiquement.")
    print(f"Rapport écrit dans {REPORT_PATH}")


if __name__ == "__main__":
    build()