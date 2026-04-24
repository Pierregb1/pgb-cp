const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const [,, email, password] = process.argv;

async function run() {

  // création table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT
    );
  `);

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    "INSERT INTO users(email, password) VALUES($1,$2)",
    [email, hash]
  );

  console.log("Utilisateur créé");

  process.exit();
}

// ⚠️ IMPORTANT
run();