import json
import re
import shutil
import subprocess
import tempfile
import unicodedata
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INCOMING = ROOT / "incoming_zips"
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
    "superieure": [r"\bsuperieure\b", r"\bprepa\b", r"\bpcsi\b", r"\bmid\b"]
}

TYPE_PATTERNS = {
    "cours": [r"\bcours\b", r"\bchap\b", r"\bchapitre\b", r"\bprog\b"],
    "exos": [r"\bexo\b", r"\bexos\b", r"\btd\b", r"\bcolle\b"],
    "ds": [r"\bds\b", r"\bdm\b", r"\bdevoir\b", r"\bcontrole\b", r"\btype bac\b", r"\bpolytech\b"]
}

CORRECTION_PATTERNS = [r"\bcorr\b", r"\bcorrige\b", r"\bcorrection\b"]


@dataclass
class TriResult:
    source_zip: str
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
    text = strip_accents(text.lower())
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


def extract_main_tex(zip_path: Path, dest_dir: Path) -> Path | None:
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(dest_dir)

    tex_files = sorted(dest_dir.rglob("main.tex"))
    if tex_files:
        return tex_files[0]

    other_tex = sorted(dest_dir.rglob("*.tex"))
    return other_tex[0] if other_tex else None


def compile_tex(tex_path: Path) -> Path | None:
    workdir = tex_path.parent
    try:
        for _ in range(2):
            subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", tex_path.name],
                cwd=workdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )
    except Exception:
        return None

    pdf = tex_path.with_suffix(".pdf")
    return pdf if pdf.exists() else None


def safe_slug(text: str) -> str:
    text = strip_accents(text.lower())
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "document"


def decide_fields(zip_name: str, tex_content: str) -> TriResult:
    combined = normalize(zip_name + " " + tex_content[:4000])

    subject, subject_hits = detect_unique(combined, SUBJECT_PATTERNS)
    level, level_hits = detect_unique(combined, LEVEL_PATTERNS)
    type_doc, type_hits = detect_unique(combined, TYPE_PATTERNS)
    is_correction = matches_any(combined, CORRECTION_PATTERNS)

    title = prettify_title(zip_name, is_correction)

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
        source_zip=zip_name,
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


def build():
    ensure_dirs()
    catalog = []
    report = []

    for old_pdf in PDF_ROOT.rglob("*.pdf"):
        if "a_verifier" in old_pdf.parts or "maths" in old_pdf.parts or "physique-chimie" in old_pdf.parts:
            old_pdf.unlink()

    for zip_path in sorted(INCOMING.glob("*.zip")):
        with tempfile.TemporaryDirectory() as tmp:
            tmpdir = Path(tmp)
            tex_path = extract_main_tex(zip_path, tmpdir)
            tex_content = tex_path.read_text(encoding="utf-8", errors="ignore") if tex_path else ""

            result = decide_fields(zip_path.name, tex_content)
            compiled_pdf = compile_tex(tex_path) if tex_path else None

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