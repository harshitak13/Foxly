const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/foxly' });
  await client.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query("INSERT INTO users (name, email) VALUES ('test_del', 'test_del@example.com') RETURNING id");
    const id = r.rows[0].id;
    console.log("Inserted user:", id);
    
    // Add references
    await client.query("INSERT INTO audit_log (user_id, action) VALUES ($1, 'test')", [id]);
    await client.query("INSERT INTO credentials (user_id, credential_id, public_key) VALUES ($1, 'cred1', 'pubkey')", [id]);
    
    // Delete user
    console.log("Deleting user...");
    await client.query("DELETE FROM users WHERE id = $1", [id]);
    console.log("Delete OK!");
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}
run();
