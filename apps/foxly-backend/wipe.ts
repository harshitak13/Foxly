import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL("./.env.local", import.meta.url)), override: true });
dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)), override: true });

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("No DATABASE_URL found");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('TRUNCATE TABLE users CASCADE;');
    console.log("Successfully deleted all accounts from the database.");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
