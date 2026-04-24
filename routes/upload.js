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
// DATABASE (SSL FORCÉ)
// ======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ======================
// UPLOAD CONFIG
// ======================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ======================
// FIND main.tex
// ======================
function findMainTex(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const full = path.join(dir, file);

    if (fs.statSync(full).isDirectory()) {
      const res = findMainTex(full);
      if (res) return res;
    }

    if (file === "main.tex") {
      return dir;
    }
  }

  return null;
}

// ======================
// UPLOAD ROUTE
// ======================
router.post("/", upload.single("zipfile"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Aucun fichier");

    if (!req.file.originalname.endsWith(".zip")) {
      return res.status(400).send("Format invalide");
    }

    const id = uuidv4();
    const extractPath = path.join("latex", id);

    fs.mkdirSync(extractPath, { recursive: true });

    console.log("📦 Unzip...");

    await fs.createReadStream(req.file.path)
      .pipe(unzipper.Extract({ path: extractPath }))
      .promise();

    const latexFolder = findMainTex(extractPath);

    if (!latexFolder) {
      return res.status(400).send("main.tex introuvable");
    }

    console.log("📄 main.tex trouvé :", latexFolder);

    let logs = "";

    try {
      logs = await compileLatex(latexFolder);
    } catch (err) {
      console.error("💥 ERREUR LATEX :", err);

      return res.status(500).send(`
        <h2>Erreur LaTeX</h2>
        <pre>${err}</pre>
      `);
    }

    const pdfSrc = path.join(latexFolder, "main.pdf");

    if (!fs.existsSync(pdfSrc)) {
      return res.status(500).send(`
        <h2>PDF non généré</h2>
        <pre>${logs}</pre>
      `);
    }

    const pdfDest = path.join("pdfs", `${id}.pdf`);
    fs.copyFileSync(pdfSrc, pdfDest);

    console.log("📄 PDF OK :", pdfDest);

    const { matiere, niveau, type } = classify(req.file.originalname);

    await pool.query(
      `INSERT INTO documents (titre, matiere, niveau, type, pdf_path)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.file.originalname, matiere, niveau, type, pdfDest]
    );

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