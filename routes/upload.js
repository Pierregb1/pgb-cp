const express = require("express");
const multer = require("multer");
const unzipper = require("unzipper");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const { compileLatex } = require("../services/latex");
const { classify } = require("../services/classify");

const router = express.Router();

// ======================
// DATABASE
// ======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ======================
// UPLOAD CONFIG
// ======================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// ======================
// 🔍 TROUVER main.tex
// ======================
function findMainTex(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      const result = findMainTex(fullPath);
      if (result) return result;
    }

    if (file === "main.tex") {
      return dir;
    }
  }

  return null;
}

// ======================
// ROUTE UPLOAD
// ======================
router.post("/", upload.single("zipfile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("Aucun fichier envoyé");
    }

    // 🔐 sécurité : vérifier extension
    if (!req.file.originalname.endsWith(".zip")) {
      return res.status(400).send("Format invalide (zip uniquement)");
    }

    const id = uuidv4();

    const extractPath = path.join("latex", id);
    fs.mkdirSync(extractPath, { recursive: true });

    // ======================
    // 📦 UNZIP
    // ======================
    await fs.createReadStream(req.file.path)
      .pipe(unzipper.Extract({ path: extractPath }))
      .promise();

    // ======================
    // 🔍 TROUVER main.tex
    // ======================
    const latexFolder = findMainTex(extractPath);

    if (!latexFolder) {
      return res.status(400).send("main.tex introuvable dans le zip");
    }

    // ======================
    // 🔥 COMPILATION LATEX
    // ======================
    await compileLatex(latexFolder);

    const pdfSrc = path.join(latexFolder, "main.pdf");

    if (!fs.existsSync(pdfSrc)) {
      return res.status(500).send("Erreur : PDF non généré");
    }

    const pdfDest = path.join("pdfs", `${id}.pdf`);
    fs.copyFileSync(pdfSrc, pdfDest);

    // ======================
    // 🧠 CLASSIFICATION
    // ======================
    const { matiere, niveau, type } = classify(req.file.originalname);

    // ======================
    // 💾 DATABASE
    // ======================
    await pool.query(
      `INSERT INTO documents (titre, matiere, niveau, type, pdf_path)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        req.file.originalname,
        matiere,
        niveau,
        type,
        pdfDest
      ]
    );

    // ======================
    // 🧹 CLEAN TEMP FILE
    // ======================
    fs.unlinkSync(req.file.path);

    res.send("Upload + compilation OK 🚀");

  } catch (err) {
    console.error("Erreur upload :", err);
    res.status(500).send("Erreur serveur lors de la compilation LaTeX");
  }
});

module.exports = router;