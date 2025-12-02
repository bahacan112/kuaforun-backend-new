import { Client } from 'pg';

async function checkDatabaseAndUsers() {
  // Önce postgres veritabanına bağlan ve tüm veritabanlarını listele
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
    
    // Tüm veritabanlarını listele
    const databases = await client.query(`
      SELECT datname, datdba::regrole::text as owner 
      FROM pg_database 
      WHERE datistemplate = false 
      ORDER BY datname
    `);
    
    console.log('📊 Available databases:');
    databases.rows.forEach(db => {
      console.log(`   - ${db.datname} (owner: ${db.owner})`);
    });
    
    // new-backend var mı?
    const newBackendExists = databases.rows.some(db => db.datname === 'new-backend');
    
    if (newBackendExists) {
      console.log('\n✅ new-backend database exists!');
      const newBackendDb = databases.rows.find(db => db.datname === 'new-backend');
      console.log(`   Owner: ${newBackendDb.owner}`);
      
      // Eğer owner postgres değilse, o kullanıcı ile bağlanmayı dene
      if (newBackendDb.owner !== 'postgres') {
        console.log(`\n🔄 Trying to connect with owner user: ${newBackendDb.owner}`);
        await testWithOwner(newBackendDb.owner);
      }
    } else {
      console.log('\n❌ new-backend database not found');
    }
    
    await client.end();
    
  } catch (err) {
    console.error('❌ Failed to connect to postgres database:', err.message);
    console.error('Error code:', err.code);
  }
}

async function testWithOwner(ownerUser) {
  try {
    const client = new Client({
      host: 'qssc0g40w8ogcww00koccww8.82.180.155.241.sslip.io',
      port: 5432,
      database: 'new-backend',
      user: ownerUser,
      password: '4iZx3t7zND8t5Vxozwuob9OQnCAqm1Dol2kl9ZOQRHDZNxWhdpH73IkYupYS4N43', // Aynı şifre?
      ssl: false
    });
    
    await client.connect();
    console.log(`✅ Successfully connected to new-backend as ${ownerUser}!`);
    
    const result = await client.query('SELECT current_user, current_database()');
    console.log(`   Current user: ${result.rows[0].current_user}`);
    console.log(`   Current database: ${result.rows[0].current_database}`);
    
    await client.end();
    return true;
    
  } catch (err) {
    console.error(`❌ Connection failed with ${ownerUser}:`, err.message);
    return false;
  }
}

checkDatabaseAndUsers();