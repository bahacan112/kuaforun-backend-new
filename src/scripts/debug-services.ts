import { db } from "../db/index.js";
import { barberShops, services } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("Debugging services and shops...");
  
  try {
    // Tüm kuaförleri listele
    const shops = await db.select({
      id: barberShops.id,
      name: barberShops.name,
      gender: barberShops.gender
    }).from(barberShops).limit(5);

    console.log(`\nFound ${shops.length} shops (showing first 5):`);
    for (const shop of shops) {
      console.log(`- ID: ${shop.id}, Name: ${shop.name}, Gender: ${shop.gender}`);
      
      // Bu shop'ın hizmetlerini listele
      const shopServices = await db
        .select({
          id: services.id,
          name: services.name,
          price: services.price
        })
        .from(services)
        .where(eq(services.barberShopId, shop.id))
        .limit(3);
      
      console.log(`  Services (${shopServices.length}):`);
      for (const service of shopServices) {
        console.log(`    - ${service.name} (${service.price} TL)`);
      }
    }

    // Toplam hizmet sayısını kontrol et
    const totalServices = await db.select({ count: sql`count(*)` }).from(services);
    console.log(`\nTotal services in database: ${totalServices[0].count}`);
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

void main();