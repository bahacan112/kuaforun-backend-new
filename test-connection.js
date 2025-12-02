import { Client } from "pg";

async function testConnection() {
  const client = new Client({
    host: "qssc0g40w8ogcww00koccww8.82.180.155.241.sslip.io",
    port: 5432,
    database: "new-backend",
    user: "postgres",
    password:
      "4iZx3t7zND8t5Vxozwuob9OQnCAqm1Dol2kl9ZOQRHDZNxWhdpH73IkYupYS4N43",
    ssl: false,
  });

  try {
    await client.connect();
    console.log("✅ PostgreSQL connection successful!");

    const result = await client.query("SELECT version()");
    console.log("PostgreSQL version:", result.rows[0].version);

    const dbResult = await client.query("SELECT current_database()");
    console.log("Current database:", dbResult.rows[0].current_database);

    await client.end();
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err.message);
    console.error("Error code:", err.code);
    console.error("Error detail:", err.detail);
  }
}

testConnection();