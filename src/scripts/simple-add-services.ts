import { db } from "../db/index.js";
import { barberShops, services } from "../db/schema.js";
import { MALE_SERVICES } from "../modules/services/service-templates.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Adding services to shops directly...");
  
  try {
    // İlk kuaförü al
    const shop = await db.select({
      id: barberShops.id,
      name: barberShops.name,
      gender: barberShops.gender
    }).from(barberShops).limit(1);

    if (shop.length === 0) {
      console.log("No shops found!");
      return;
    }

    const firstShop = shop[0];
    console.log(`\nProcessing shop: ${firstShop.name} (ID: ${firstShop.id}, Gender: ${firstShop.gender})`);

    // İlk 3 erkek hizmetini ekle
    const servicesToAdd = MALE_SERVICES.slice(0, 3);
    
    for (const template of servicesToAdd) {
      console.log(`Adding service: ${template.name}`);
      
      try {
        await db.insert(services).values({
          barberShopId: firstShop.id,
          serviceTemplateId: null,
          name: template.name,
          price: template.defaultPrice.toString(),
          durationMinutes: template.defaultDurationMinutes,
          description: template.description,
          category: template.category,
          isActive: true,
        });
        
        console.log(`  ✅ Successfully added: ${template.name}`);
      } catch (error) {
        console.error(`  ❌ Error adding ${template.name}:`, error instanceof Error ? error.message : String(error));
      }
    }

    // Eklenen hizmetleri kontrol et
    const addedServices = await db
      .select()
      .from(services)
      .where(eq(services.barberShopId, firstShop.id));
    
    console.log(`\n✅ Total services for ${firstShop.name}: ${addedServices.length}`);
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

void main();