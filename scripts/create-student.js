
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT
  );
`);
const [,, email, password] = process.argv;

async function run() {
  if (!email || !password) {
    console.log("Usage: node scripts/create-student.js email password");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO users(email, password) VALUES($1,$2) ON CONFLICT (email) DO NOTHING",
    [email, hash]
  );
  console.log("Utilisateur créé ou déjà existant");
  process.exit();
}

run();
