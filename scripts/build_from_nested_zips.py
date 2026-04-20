import io
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
OUTER_ZIP = ROOT / "source_bundle" / "Overleaf Projects.zip"
PDF_ROOT = ROOT / "pdfs"
CATALOG_PATH = ROOT / "catalog.json"
REPORT_PATH = ROOT / "tri_report.json"
OVERRIDES_PATH = ROOT / "manual_overrides.json"

ALLOWED_LEVELS = {"troisieme", "premiere", "terminale", "superieure"}
ALLOWED_TYPES = {"cours", "exos", "ds"}

SUBJECT_PATTERNS = {
    "maths": [
        r"\bmath\b", r"\bmaths\b", r"\bmathematique\b", r"\bmathematiques\b",
        r"\balgebre\b", r"\banalyse\b", r"\bgeometrie\b", r"\bcomplexe\b",
        r"\bfonctionnelle\b", r"\bpcsi\b", r"\bendomorphisme\b", r"\bdeterminants?\b"
    ],
    "physique-chimie": [
        r"\bphy\b", r"\bphysique\b", r"\bchimie\b", r"\bphychim\b",
        r"\bspectro\b", r"\bcohesion\b", r"\belec\b", r"\belectricite\b",
        r"\bir\b", r"\bondes?\b"
    ],
}

LEVEL_PATTERNS = {
    "troisieme": [r"\b3eme\b", r"\b3e\b", r"\btroisieme\b", r"\bcollege\b"],
    "premiere": [r"\bpremiere\b", r"\b1ere\b", r"\b1re\b", r"\bprem\b"],
    "terminale": [r"\bterminale\b", r"\bterm\b", r"\btle\b", r"\bbac\b"],
    "superieure": [r"\bsuperieure\b", r"\bprepa\b", r"\bpcsi\b", r"\bpsi\b", r"\bats\b"]
}

TYPE_PATTERNS = {
    "cours": [r"\bcours\b", r"\bchap\b", r"\bchapitre\b", r"\bprog\b", r"\bresume\b", r"\bfiche\b"],
    "exos": [r"\bexo\b", r"\bexos\b", r"\btd\b", r"\bcolle\b", r"\bfeuille\b"],
    "ds": [r"\bds\b", r"\bdm\b", r"\bdevoir\b", r"\bcontrole\b", r"\btype bac\b", r"\bpolytech\b"]
}

CORRECTION_PATTERNS = [r"\bcorr\b", r"\bcorrige\b", r"\bcorrection\b"]

@dataclass
class TriResult:
    source_inner_zip: str
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

def safe_slug(text: str) -> str:
    text = strip_accents(text.lower())
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "document"

def load_overrides() -> dict:
    if not OVERRIDES_PATH.exists():
        return {}
    try:
        return json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}

def ensure_dirs():
    for subject in ["maths", "physique-chimie"]:
        for level in ALLOWED_LEVELS:
            for type_doc in ALLOWED_TYPES:
                (PDF_ROOT / subject / level / type_doc).mkdir(parents=True, exist_ok=True)
    (PDF_ROOT / "a_verifier").mkdir(parents=True, exist_ok=True)

def clean_generated_pdfs():
    for old_pdf in PDF_ROOT.rglob("*.pdf"):
        old_pdf.unlink()

def choose_tex_file(extract_dir: Path) -> Path | None:
    main_tex = next(iter(sorted(extract_dir.rglob("main.tex"))), None)
    if main_tex is not None:
        return main_tex

    tex_files = sorted(extract_dir.rglob("*.tex"))
    if len(tex_files) == 1:
        return tex_files[0]

    return None

def compile_tex(tex_path: Path) -> Path | None:
    workdir = tex_path.parent
    try:
        for _ in range(2):
            result = subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", tex_path.name],
                cwd=workdir,
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

    pdf = tex_path.with_suffix(".pdf")
    return pdf if pdf.exists() else None

def decide_fields(inner_zip_name: str, tex_content: str, overrides: dict) -> TriResult:
    override = overrides.get(inner_zip_name, {})
    title = prettify_title(inner_zip_name, False)

    combined = normalize(inner_zip_name + " " + tex_content[:5000])

    subject, subject_hits = detect_unique(combined, SUBJECT_PATTERNS)
    level, level_hits = detect_unique(combined, LEVEL_PATTERNS)
    type_doc, type_hits = detect_unique(combined, TYPE_PATTERNS)
    is_correction = matches_any(combined, CORRECTION_PATTERNS)

    if is_correction:
        title = prettify_title(inner_zip_name, True)

    if override:
        subject = override.get("matiere", subject)
        level = override.get("niveau", level)
        type_doc = override.get("type", type_doc)

    reason_parts = []
    confidence = "high"
    status = "ok"

    if not override:
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
    else:
        reason_parts.append("classé via override manuel")

    if subject and subject not in {"maths", "physique-chimie"}:
        status = "needs_review"
        confidence = "low"
        reason_parts.append("matière invalide")

    if level and level not in ALLOWED_LEVELS:
        status = "needs_review"
        confidence = "low"
        reason_parts.append("niveau invalide")

    if type_doc and type_doc not in ALLOWED_TYPES:
        status = "needs_review"
        confidence = "low"
        reason_parts.append("type invalide")

    if status == "ok" and not reason_parts:
        reason_parts.append("détection claire")

    return TriResult(
        source_inner_zip=inner_zip_name,
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

def build():
    ensure_dirs()
    clean_generated_pdfs()

    catalog = []
    report = []
    overrides = load_overrides()

    if not OUTER_ZIP.exists():
        print(f"Gros zip introuvable: {OUTER_ZIP}")
        CATALOG_PATH.write_text("[]", encoding="utf-8")
        REPORT_PATH.write_text("[]", encoding="utf-8")
        return

    with zipfile.ZipFile(OUTER_ZIP) as outer:
        inner_names = sorted(outer.namelist())

        for inner_name in inner_names:
            if not inner_name.lower().endswith(".zip"):
                report.append(asdict(TriResult(
                    source_inner_zip=inner_name,
                    detected_subject=None,
                    detected_level=None,
                    detected_type=None,
                    is_correction=False,
                    confidence="low",
                    status="needs_review",
                    reason="élément ignoré: pas un zip interne",
                    output_pdf=None,
                    title=inner_name
                )))
                continue

            try:
                inner_bytes = outer.read(inner_name)
            except Exception as e:
                report.append(asdict(TriResult(
                    source_inner_zip=inner_name,
                    detected_subject=None,
                    detected_level=None,
                    detected_type=None,
                    is_correction=False,
                    confidence="low",
                    status="needs_review",
                    reason=f"lecture du zip interne impossible: {e}",
                    output_pdf=None,
                    title=inner_name
                )))
                continue

            with tempfile.TemporaryDirectory() as tmp:
                extract_dir = Path(tmp) / "project"
                extract_dir.mkdir(parents=True, exist_ok=True)

                try:
                    with zipfile.ZipFile(io.BytesIO(inner_bytes)) as inner_zip:
                        inner_zip.extractall(extract_dir)
                except Exception as e:
                    report.append(asdict(TriResult(
                        source_inner_zip=inner_name,
                        detected_subject=None,
                        detected_level=None,
                        detected_type=None,
                        is_correction=False,
                        confidence="low",
                        status="needs_review",
                        reason=f"zip interne invalide: {e}",
                        output_pdf=None,
                        title=inner_name
                    )))
                    continue

                tex_path = choose_tex_file(extract_dir)
                if tex_path is None:
                    report.append(asdict(TriResult(
                        source_inner_zip=inner_name,
                        detected_subject=None,
                        detected_level=None,
                        detected_type=None,
                        is_correction=False,
                        confidence="low",
                        status="needs_review",
                        reason="aucun main.tex trouvé et pas de .tex unique",
                        output_pdf=None,
                        title=Path(inner_name).stem
                    )))
                    continue

                tex_content = tex_path.read_text(encoding="utf-8", errors="ignore")
                result = decide_fields(Path(inner_name).name, tex_content, overrides)

                print(f"Projet: {inner_name}")
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