const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test each column individually to find the missing one
const columns = [
  "id",
  "password_hash",
  "role",
  "tenant_id",
  "email",
  "name",
  "phone",
  "email_verified_at",
  "phone_verified_at",
  "registration_approved_at",
  "gender",
  "profile_image_url",
  "date_of_birth",
  "bio",
  "address",
  "city",
  "country",
  "preferences",
  "auth_user_id",
  "created_at",
  "updated_at",
];

async function testColumns() {
  console.log("Testing each column individually...");
  for (const column of columns) {
    try {
      await pool.query(`SELECT ${column} FROM users LIMIT 1`);
      console.log(`✅ ${column} - OK`);
    } catch (err) {
      console.log(`❌ ${column} - ERROR: ${err.message}`);
    }
  }

  // Now test the full query
  console.log("\nTesting full query...");
  const fullQuery = `SELECT id, password_hash, role, tenant_id, email, name, phone, 
    email_verified_at, phone_verified_at, registration_approved_at, 
    gender, profile_image_url, date_of_birth, bio, address, 
    city, country, preferences, auth_user_id, created_at, updated_at 
    FROM users WHERE (users.email = $1 AND users.tenant_id = $2) LIMIT $3`;

  try {
    await pool.query(fullQuery, ["test@example.com", "kuaforun", 1]);
    console.log("✅ Full query - OK");
  } catch (err) {
    console.log("❌ Full query - ERROR:", err.message);
    console.log("Position:", err.position);
    console.log("Hint:", err.hint);
  }

  pool.end();
}

testColumns();
