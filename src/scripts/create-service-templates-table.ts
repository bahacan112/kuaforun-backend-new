import { db } from '../db'

async function createServiceTemplatesTable() {
  try {
    console.log('Creating service_templates table...')
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS service_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        default_price DECIMAL(10,2) NOT NULL,
        default_duration_minutes INTEGER NOT NULL,
        category VARCHAR(100) NOT NULL,
        gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'unisex')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
    
    console.log('✅ service_templates table created successfully!')
    
  } catch (error) {
    console.error('Error creating service_templates table:', error)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

void createServiceTemplatesTable()