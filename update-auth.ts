import { pool } from './src/db/index.js';

async function updateAuthUserId() {
  try {
    await pool.query(`UPDATE users SET auth_user_id = auth_uuid WHERE auth_user_id IS NULL`);
    console.log('Updated auth_user_id values');
    await pool.end();
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

void updateAuthUserId();