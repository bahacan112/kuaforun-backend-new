const { pool } = require('./src/db/index');

async function checkForeignKeys() {
  try {
    const result = await pool.query(`
      SELECT 
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'users'
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    
    console.log('Foreign keys referencing users table:');
    result.rows.forEach(row => {
      console.log(`${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name} (${row.constraint_name})`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Query failed:', err);
    process.exit(1);
  }
}

checkForeignKeys();