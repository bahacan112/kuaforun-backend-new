import { Client } from 'pg';

async function createDatabase() {
  // Önce postgres varsayılan veritabanına bağlan
  const client = new Client({
    host: 'qssc0g40w8ogcww00koccww8.82.180.155.241.sslip.io',
    port: 5432,
    database: 'postgres', // Varsayılan veritabanı
    user: 'postgres',
    password: '4iZx3t7zND8t5Vxozwuob9OQnCAqm1Dol2kl9ZOQRHDZNxWhdpH73IkYupYS4N43',
    ssl: false
  });

  try {
    await client.connect();
    console.log('✅ Connected to postgres database');
    
    // new-backend veritabanının var olup olmadığını kontrol et
    const checkDb = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'new-backend'"
    );
    
    if (checkDb.rows.length === 0) {
      console.log('🔄 Creating new-backend database...');
      await client.query('CREATE DATABASE "new-backend"');
      console.log('✅ new-backend database created successfully');
    } else {
      console.log('ℹ️  new-backend database already exists');
    }
    
    await client.end();
    
    // Şimdi new-backend veritabanına bağlanmayı dene
    const newClient = new Client({
      host: 'qssc0g40w8ogcww00koccww8.82.180.155.241.sslip.io',
      port: 5432,
      database: 'new-backend',
      user: 'postgres',
      password: '4iZx3t7zND8t5Vxozwuob9OQnCAqm1Dol2kl9ZOQRHDZNxWhdpH73IkYupYS4N43',
      ssl: false
    });
    
    await newClient.connect();
    console.log('✅ Successfully connected to new-backend database');
    
    // Veritabanı versiyonunu kontrol et
    const result = await newClient.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version.split(' ')[1]);
    
    await newClient.end();
    
  } catch (err) {
    console.error('❌ Database operation failed:', err.message);
    console.error('Error code:', err.code);
    if (err.code === '28P01') {
      console.error('🔑 Authentication failed - please check username/password');
    } else if (err.code === '3D000') {
      console.error('📚 Database does not exist');
    }
  }
}

createDatabase();