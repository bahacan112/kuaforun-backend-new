import { Client } from 'pg';

async function testAlternativeConnection() {
  // Farklı bağlantı konfigürasyonlarını dene
  const configs = [
    {
      name: 'Standard Connection',
      config: {
        host: 'qssc0g40w8ogcww00koccww8.82.180.155.241.sslip.io',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: '4iZx3t7zND8t5Vxozwuob9OQnCAqm1Dol2kl9ZOQRHDZNxWhdpH73IkYupYS4N43',
        ssl: false
      }
    },
    {
      name: 'With Connection Timeout',
      config: {
        host: 'qssc0g40w8ogcww00koccww8.82.180.155.241.sslip.io',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: '4iZx3t7zND8t5Vxozwuob9OQnCAqm1Dol2kl9ZOQRHDZNxWhdpH73IkYupYS4N43',
        ssl: false,
        connectionTimeoutMillis: 10000
      }
    }
  ];

  for (const { name, config } of configs) {
    console.log(`\n🔄 Testing: ${name}`);
    const client = new Client(config);
    
    try {
      await client.connect();
      console.log(`✅ ${name}: Connection successful!`);
      
      const result = await client.query('SELECT current_user, version()');
      console.log(`   Current user: ${result.rows[0].current_user}`);
      console.log(`   PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`);
      
      await client.end();
      return true; // Başarılı bağlantı bulundu
      
    } catch (err) {
      console.error(`❌ ${name}: Failed - ${err.message}`);
      console.error(`   Error code: ${err.code}`);
      
      if (err.code === '28P01') {
        console.error('   🔑 Authentication failed');
      } else if (err.code === '3D000') {
        console.error('   📚 Database does not exist');
      } else if (err.code === 'ECONNREFUSED') {
        console.error('   🔌 Connection refused');
      }
    }
  }
  
  console.error('\n❌ All connection attempts failed');
  console.error('💡 Suggestions:');
  console.error('   1. Check if the password is correct');
  console.error('   2. Verify the database server allows remote connections');
  console.error('   3. Check if the user has proper privileges');
  console.error('   4. Contact database administrator');
  
  return false;
}

testAlternativeConnection();