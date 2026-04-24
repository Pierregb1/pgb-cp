const { Pool } = require("pg");

async function init() {

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log("Connexion à la base...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        titre TEXT,
        matiere TEXT,
        niveau TEXT,
        type TEXT,
        pdf_path TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Table 'documents' créée avec succès ✅");

  } catch (err) {
    console.error("Erreur :", err);
  } finally {
    await pool.end();
  }
}

init();