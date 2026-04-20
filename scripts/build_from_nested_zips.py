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

ALLOWED_SUBJECTS = {"maths", "physique-chimie"}
ALLOWED_LEVELS = {"troisieme", "premiere", "terminale", "superieure"}
ALLOWED_TYPES = {"cours", "exos", "ds"}

SUBJECT_PATTERNS = {
    "maths": {
        "strong": [
            r"\bmath\b", r"\bmaths\b", r"\bmathematique\b", r"\bmathematiques\b",
            r"\balgebre\b", r"\banalyse\b", r"\bgeometrie\b", r"\bcomplexe\b",
            r"\bendomorph", r"\bdeterminant", r"\bdiagonal", r"\btrigonal",
            r"\bmatrice", r"\bmatrices\b", r"\bpolynome", r"\bpolynomes\b",
            r"\bfonction\b", r"\bfonctions\b", r"\bsuite\b", r"\bsuites\b",
            r"\bapplication\s+lineaire\b", r"\bespace\s+vectoriel\b",
            r"\bvaleurs?\s+propres?\b", r"\bvecteurs?\s+propres?\b",
            r"\banalyse\s+fonctionnelle\b", r"\bgeometrie\s+affine\b"
        ],
        "medium": [
            r"\brang\b", r"\bbase\b", r"\bsev\b", r"\bev\b", r"\bgradient\b",
            r"\bderivee\b", r"\bintegrale\b"
        ]
    },
    "physique-chimie": {
        "strong": [
            r"\bphy\b", r"\bphysique\b", r"\bchimie\b", r"\bphychim\b",
            r"\bspectro\b", r"\bcohesion\b", r"\belec\b", r"\belectricite\b",
            r"\bondes?\b", r"\bthermo\b", r"\bthermique\b", r"\boptique\b",
            r"\benergie\b", r"\bir\b", r"\binfrarouge\b", r"\bcalorimetre\b",
            r"\benthalpie\b", r"\breaction\b", r"\bresistance\b", r"\bcircuit\b",
            r"\btension\b", r"\bintensite\b"
        ],
        "medium": [
            r"\bmolecule\b", r"\bsolide\b", r"\bsolution\b", r"\bacide\b",
            r"\bbase\b", r"\btemperature\b"
        ]
    }
}

LEVEL_PATTERNS = {
    "troisieme": {
        "strong": [r"\b3eme\b", r"\b3e\b", r"\btroisieme\b"],
        "medium": [r"\bcollege\b", r"\bbrevet\b"]
    },
    "premiere": {
        "strong": [r"\bpremiere\b", r"\b1ere\b", r"\b1re\b"],
        "medium": [r"\bspecialite\b", r"\bspe\b"]
    },
    "terminale": {
        "strong": [r"\bterminale\b", r"\bterm\b", r"\btle\b"],
        "medium": [r"\bbac\b", r"\bgrand\s+oral\b"]
    },
    "superieure": {
        "strong": [r"\bsuperieure\b", r"\bprepa\b", r"\bpcsi\b", r"\bpsi\b", r"\bats\b", r"\bmid\b"],
        "medium": [r"\bcentrale\b", r"\banalyse\s+fonctionnelle\b", r"\balgebre\s+lin\b"]
    }
}

TYPE_PATTERNS = {
    "cours": {
        "strong": [r"\bcours\b", r"\bchap\b", r"\bchapitre\b", r"\blecon\b"],
        "medium": [r"\bresume\b", r"\bfiche\b", r"\bprogramme\b", r"\bnotions\b"]
    },
    "exos": {
        "strong": [r"\bexo\b", r"\bexos\b", r"\btd\b", r"\bcolle\b", r"\bfeuille\b"],
        "medium": [r"\bproblemes?\b", r"\bexercices?\b"]
    },
    "ds": {
        "strong": [r"\bds\b", r"\bdm\b", r"\bdevoir\b", r"\bcontrole\b"],
        "medium": [r"\btype\s+bac\b", r"\bpolytech\b", r"\bsujet\b", r"\bepreuve\b"]
    }
}

CORRECTION_PATTERNS = [r"\bcorr\b", r"\bcorrige\b", r"\bcorrection\b"]

SPECIAL_RULES = [
    {
        "name": "algèbre linéaire => maths supérieure",
        "patterns": [r"\balg(?:ebre)?\s*lin", r"\bapp\s*lin\b", r"\bendomorph", r"\bmatric", r"\bdeterminant", r"\bvaleurs?\s*propres?", r"\bdiagonal", r"\btrigonal", r"\brang\b"],
        "set": {"matiere": "maths", "niveau": "superieure"},
    },
    {
        "name": "analyse fonctionnelle => maths supérieure",
        "patterns": [r"\banalyse\s+fonctionnelle\b"],
        "set": {"matiere": "maths", "niveau": "superieure"},
    },
    {
        "name": "complexe / pcsi => maths supérieure",
        "patterns": [r"\bcomplexe\b", r"\bpcsi\b", r"\bpsi\b"],
        "set": {"matiere": "maths", "niveau": "superieure"},
    },
    {
        "name": "spectro / cohésion => physique-chimie première",
        "patterns": [r"\bspectro\b", r"\bcohesion\b", r"\binfrarouge\b", r"\bir\b"],
        "set": {"matiere": "physique-chimie", "niveau": "premiere"},
    },
    {
        "name": "électricité => physique-chimie terminale",
        "patterns": [r"\belec\b", r"\belectricite\b", r"\bcircuit\b", r"\bresistance\b", r"\btension\b", r"\bintensite\b"],
        "set": {"matiere": "physique-chimie", "niveau": "terminale"},
    },
]

NEGATIVE_HINTS = {
    "cours": [r"\bds\b", r"\bdm\b", r"\bcontrole\b", r"\bexo\b", r"\btd\b", r"\bcolle\b"],
    "exos": [r"\bcours\b", r"\bchapitre\b"],
    "ds": [r"\bcours\b", r"\bchapitre\b", r"\bresume\b", r"\bfiche\b"]
}


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
    subject_scores: dict | None = None
    level_scores: dict | None = None
    type_scores: dict | None = None
    applied_rules: list | None = None
    chosen_tex: str | None = None
    compiled: bool = False


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


def count_matches(text: str, patterns: list[str]) -> int:
    total = 0
    for p in patterns:
        total += len(re.findall(p, text))
    return total


def compute_scores(text_blocks: dict[str, tuple[str, float]], pattern_map: dict) -> dict[str, float]:
    scores = {}
    for label, strengths in pattern_map.items():
        score = 0.0
        for _, (text, weight) in text_blocks.items():
            strong_hits = count_matches(text, strengths.get("strong", []))
            medium_hits = count_matches(text, strengths.get("medium", []))
            score += weight * (5 * strong_hits + 2 * medium_hits)
        scores[label] = round(score, 2)
    return scores


def apply_negative_type_hints(type_scores: dict[str, float], text_blocks: dict[str, tuple[str, float]]) -> dict[str, float]:
    updated = dict(type_scores)
    merged_text = " ".join(text for text, _ in text_blocks.values())
    for label, patterns in NEGATIVE_HINTS.items():
        penalty = count_matches(merged_text, patterns)
        updated[label] = round(max(0.0, updated[label] - penalty), 2)
    return updated


def choose_best(scores: dict[str, float], min_score: float = 2.0, min_gap: float = 2.0):
    ordered = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    if not ordered:
        return None, "aucun score"
    best_label, best_score = ordered[0]
    second_score = ordered[1][1] if len(ordered) > 1 else 0.0

    if best_score < min_score:
        return None, f"score trop faible ({best_score})"
    if (best_score - second_score) < min_gap:
        return None, f"écart trop faible ({best_score} vs {second_score})"
    return best_label, f"choisi avec score {best_score} contre {second_score}"


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


def rank_tex_candidates(extract_dir: Path, inner_zip_name: str) -> list[Path]:
    tex_files = sorted(extract_dir.rglob("*.tex"))
    if not tex_files:
        return []

    zip_stem = normalize(Path(inner_zip_name).stem)

    def score_tex(p: Path):
        name = normalize(p.name)
        parts = normalize(str(p.relative_to(extract_dir)))
        score = 0
        if p.name.lower() == "main.tex":
            score += 100
        if name in {"cours.tex", "document.tex"}:
            score += 40
        if normalize(p.stem) == zip_stem:
            score += 35
        if "main" in name:
            score += 20
        if "corr" in name:
            score -= 5
        if "old" in name or "backup" in name:
            score -= 10
        if "annexe" in name:
            score -= 8
        if "/." in parts:
            score -= 20
        return (-score, len(parts), p.name.lower())

    return sorted(tex_files, key=score_tex)


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


def extract_title_from_tex(tex_content: str) -> str | None:
    m = re.search(r"\\title\{([^}]*)\}", tex_content, re.DOTALL)
    if m:
        title = re.sub(r"\s+", " ", m.group(1)).strip()
        return title if title else None
    return None


def extract_sections_from_tex(tex_content: str) -> str:
    parts = []
    for pattern in [r"\\section\{([^}]*)\}", r"\\subsection\{([^}]*)\}", r"\\chapter\{([^}]*)\}", r"\\part\{([^}]*)\}"]:
        parts.extend(re.findall(pattern, tex_content, re.DOTALL))
    return " ".join(parts)


def extract_documentclass_from_tex(tex_content: str) -> str:
    m = re.search(r"\\documentclass(?:\[[^\]]*\])?\{([^}]*)\}", tex_content)
    return m.group(1).strip() if m else ""


def extract_inputs(tex_content: str) -> str:
    inputs = re.findall(r"\\(?:input|include)\{([^}]*)\}", tex_content)
    return " ".join(inputs)


def apply_special_rules(text: str):
    forced = {}
    applied = []
    for rule in SPECIAL_RULES:
        if any(re.search(p, text) for p in rule["patterns"]):
            forced.update(rule["set"])
            applied.append(rule["name"])
    return forced, applied


def decide_fields(inner_zip_name: str, tex_path: Path, tex_content: str, overrides: dict) -> TriResult:
    inner_basename = Path(inner_zip_name).name
    tex_name = tex_path.name
    tex_title = extract_title_from_tex(tex_content)
    tex_sections = extract_sections_from_tex(tex_content)
    tex_docclass = extract_documentclass_from_tex(tex_content)
    tex_inputs = extract_inputs(tex_content)

    merged = normalize(
        inner_basename + " " +
        tex_name + " " +
        (tex_title or "") + " " +
        tex_sections + " " +
        tex_docclass + " " +
        tex_inputs + " " +
        tex_content
    )

    is_correction = any(re.search(p, merged) for p in CORRECTION_PATTERNS)
    title = tex_title or prettify_title(inner_basename, is_correction)
    override = overrides.get(inner_basename, {})

    text_blocks = {
        "zip_name": (normalize(inner_basename), 4.0),
        "tex_name": (normalize(tex_name), 2.5),
        "title": (normalize(tex_title or ""), 4.0),
        "sections": (normalize(tex_sections), 3.5),
        "inputs": (normalize(tex_inputs), 2.0),
        "documentclass": (normalize(tex_docclass), 1.5),
        "content_head": (normalize(tex_content[:15000]), 1.5),
        "content_full": (normalize(tex_content), 0.5),
    }

    subject_scores = compute_scores(text_blocks, SUBJECT_PATTERNS)
    level_scores = compute_scores(text_blocks, LEVEL_PATTERNS)
    type_scores = apply_negative_type_hints(compute_scores(text_blocks, TYPE_PATTERNS), text_blocks)

    forced, applied_rules = apply_special_rules(merged)

    subject, subject_reason = choose_best(subject_scores, min_score=2.0, min_gap=1.0)
    level, level_reason = choose_best(level_scores, min_score=2.0, min_gap=0.8)
    type_doc, type_reason = choose_best(type_scores, min_score=2.0, min_gap=0.8)

    if "matiere" in forced:
        subject = forced["matiere"]
        subject_reason = f"forcé par règle: {forced['matiere']}"
    if "niveau" in forced:
        level = forced["niveau"]
        level_reason = f"forcé par règle: {forced['niveau']}"
    if "type" in forced:
        type_doc = forced["type"]
        type_reason = f"forcé par règle: {forced['type']}"

    if type_doc is None:
        base_name = normalize(inner_basename)
        if re.search(r"\bcours\b", base_name):
            type_doc = "cours"
            type_reason = "déduit du nom"
        elif re.search(r"\b(td|exo|colle|feuille)\b", base_name):
            type_doc = "exos"
            type_reason = "déduit du nom"
        elif re.search(r"\b(ds|dm|devoir|controle)\b", base_name):
            type_doc = "ds"
            type_reason = "déduit du nom"

    if override:
        subject = override.get("matiere", subject)
        level = override.get("niveau", level)
        type_doc = override.get("type", type_doc)
        reason = "classé via override manuel"
        confidence = "manual"
        status = "ok"
    else:
        reason = "; ".join([
            f"matière: {subject_reason}",
            f"niveau: {level_reason}",
            f"type: {type_reason}"
        ])
        if applied_rules:
            reason += "; règles: " + ", ".join(applied_rules)

        status = "ok" if subject and level and type_doc else "needs_review"

        top_values = [
            max(subject_scores.values(), default=0),
            max(level_scores.values(), default=0),
            max(type_scores.values(), default=0)
        ]
        confidence = "high" if status == "ok" and min(top_values) >= 6 else ("medium" if status == "ok" else "low")

    if subject and subject not in ALLOWED_SUBJECTS:
        status = "needs_review"
    if level and level not in ALLOWED_LEVELS:
        status = "needs_review"
    if type_doc and type_doc not in ALLOWED_TYPES:
        status = "needs_review"

    return TriResult(
        source_inner_zip=inner_basename,
        detected_subject=subject,
        detected_level=level,
        detected_type=type_doc,
        is_correction=is_correction,
        confidence=confidence,
        status=status,
        reason=reason,
        output_pdf=None,
        title=title,
        subject_scores=subject_scores,
        level_scores=level_scores,
        type_scores=type_scores,
        applied_rules=applied_rules,
        chosen_tex=tex_name
    )


def make_report_entry(name: str, reason: str, title: str | None = None) -> dict:
    return asdict(TriResult(
        source_inner_zip=Path(name).name,
        detected_subject=None,
        detected_level=None,
        detected_type=None,
        is_correction=False,
        confidence="low",
        status="needs_review",
        reason=reason,
        output_pdf=None,
        title=title or Path(name).stem
    ))


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
        all_entries = sorted(outer.namelist())

        inner_zip_entries = []
        for name in all_entries:
            normalized_name = name.strip()
            if normalized_name.endswith("/"):
                report.append(make_report_entry(name, "dossier dans le gros zip, ignoré"))
                continue
            if normalized_name.lower().endswith(".zip"):
                inner_zip_entries.append(name)
            else:
                report.append(make_report_entry(name, "élément non-zip dans le gros zip, ignoré"))

        seen_inner = set()

        for inner_name in inner_zip_entries:
            inner_key = inner_name.strip().lower()
            if inner_key in seen_inner:
                report.append(make_report_entry(inner_name, "zip interne dupliqué, ignoré"))
                continue
            seen_inner.add(inner_key)

            try:
                inner_bytes = outer.read(inner_name)
            except Exception as e:
                report.append(make_report_entry(inner_name, f"lecture du zip interne impossible: {e}"))
                continue

            with tempfile.TemporaryDirectory() as tmp:
                extract_dir = Path(tmp) / "project"
                extract_dir.mkdir(parents=True, exist_ok=True)

                try:
                    with zipfile.ZipFile(io.BytesIO(inner_bytes)) as inner_zip:
                        inner_zip.extractall(extract_dir)
                except Exception as e:
                    report.append(make_report_entry(inner_name, f"zip interne invalide: {e}"))
                    continue

                tex_candidates = rank_tex_candidates(extract_dir, inner_name)
                if not tex_candidates:
                    report.append(make_report_entry(inner_name, "aucun fichier .tex trouvé"))
                    continue

                compiled_pdf = None
                result = None

                for tex_path in tex_candidates:
                    tex_content = tex_path.read_text(encoding="utf-8", errors="ignore")
                    candidate_result = decide_fields(Path(inner_name).name, tex_path, tex_content, overrides)

                    print(f"Projet: {inner_name}")
                    print(f"Essai avec: {tex_path.name}")
                    print(f"Détection: matiere={candidate_result.detected_subject}, niveau={candidate_result.detected_level}, type={candidate_result.detected_type}, status={candidate_result.status}, confiance={candidate_result.confidence}")

                    compiled_pdf = compile_tex(tex_path)
                    if compiled_pdf is not None:
                        result = candidate_result
                        result.compiled = True
                        break

                if result is None:
                    report.append(asdict(TriResult(
                        source_inner_zip=Path(inner_name).name,
                        detected_subject=None,
                        detected_level=None,
                        detected_type=None,
                        is_correction=False,
                        confidence="low",
                        status="needs_review",
                        reason="aucun .tex compilable trouvé dans le zip interne",
                        output_pdf=None,
                        title=Path(inner_name).stem
                    )))
                    continue

                if result.status == "ok":
                    out_dir = PDF_ROOT / result.detected_subject / result.detected_level / result.detected_type
                else:
                    out_dir = PDF_ROOT / "a_verifier"

                out_pdf = out_dir / f"{safe_slug(result.title)}.pdf"
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
    print(f"{len(report)} entrées écrites dans le rapport.")
    print(f"Rapport écrit dans {REPORT_PATH}")


if __name__ == "__main__":
    build()