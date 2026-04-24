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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
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

    if (!req.file.originalname.endsWith(".zip")) {
      return res.status(400).send("Format invalide (zip uniquement)");
    }

    const id = uuidv4();
    const extractPath = path.join("latex", id);

    fs.mkdirSync(extractPath, { recursive: true });

    console.log("📦 Extraction du zip...");

    // ======================
    // UNZIP
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

    console.log("📄 main.tex trouvé dans :", latexFolder);

    // ======================
    // 🔥 COMPILATION LATEX
    // ======================
    console.log("🔥 Compilation LaTeX...");

    let latexLogs = "";

    try {
      latexLogs = await compileLatex(latexFolder);
    } catch (err) {
      console.error("💥 ERREUR LATEX :", err);

      return res.status(500).send(`
        <h2>Erreur LaTeX</h2>
        <pre>${err}</pre>
      `);
    }

    console.log("✅ Compilation terminée");

    const pdfSrc = path.join(latexFolder, "main.pdf");

    if (!fs.existsSync(pdfSrc)) {
      return res.status(500).send(`
        <h2>PDF non généré</h2>
        <pre>${latexLogs}</pre>
      `);
    }

    const pdfDest = path.join("pdfs", `${id}.pdf`);

    fs.copyFileSync(pdfSrc, pdfDest);

    console.log("📄 PDF généré :", pdfDest);

    // ======================
    // CLASSIFICATION
    // ======================
    const { matiere, niveau, type } = classify(req.file.originalname);

    // ======================
    // DATABASE
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
    // CLEAN TEMP
    // ======================
    fs.unlinkSync(req.file.path);

    res.send("Upload + compilation OK 🚀");

  } catch (err) {
    console.error("💥 ERREUR SERVEUR :", err);

    res.status(500).send(`
      <h2>Erreur serveur</h2>
      <pre>${err}</pre>
    `);
  }
});

module.exports = router;