import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

async function checkDatabaseSchema() {
  try {
    console.log("🔍 Checking database schema...");
    
    // Services tablosunun sütunlarını kontrol et
    const servicesColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'services' 
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Services table columns:");
    servicesColumns.rows.forEach((col) => {
      const columnInfo = col as unknown as ColumnInfo;
      console.log(`  - ${columnInfo.column_name}: ${columnInfo.data_type} (nullable: ${columnInfo.is_nullable})`);
    });
    
    // Service templates tablosunun sütunlarını kontrol et
    const templatesColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'service_templates' 
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Service templates table columns:");
    templatesColumns.rows.forEach((col) => {
      const columnInfo = col as unknown as ColumnInfo;
      console.log(`  - ${columnInfo.column_name}: ${columnInfo.data_type} (nullable: ${columnInfo.is_nullable})`);
    });
    
    // Mevcut hizmet sayısını kontrol et
    const serviceCount = await db.execute(sql`SELECT COUNT(*) as count FROM services`);
    console.log(`\n📊 Current services count: ${serviceCount.rows[0].count}`);
    
    // Mevcut hizmet şablonu sayısını kontrol et
    const templateCount = await db.execute(sql`SELECT COUNT(*) as count FROM service_templates`);
    console.log(`📊 Current service templates count: ${templateCount.rows[0].count}`);
    
  } catch (error) {
    console.error("❌ Error checking database schema:", error);
  } finally {
    process.exit(0);
  }
}

void checkDatabaseSchema();