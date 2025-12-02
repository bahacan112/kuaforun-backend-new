import { db } from "../db/index.js";
import { ServicesService } from "../modules/services/services.service.js";
import { barberShops } from "../db/schema.js";

async function main() {
  console.log("Adding default services to existing shops...");
  
  const servicesService = new ServicesService();
  
  try {
    // Tüm mevcut kuaförleri al
    const shops = await db.select({
      id: barberShops.id,
      name: barberShops.name,
      gender: barberShops.gender
    }).from(barberShops);

    console.log(`Found ${shops.length} existing shops`);

    let totalAdded = 0;
    let processedShops = 0;

    for (const shop of shops) {
      try {
        console.log(`\nProcessing shop: ${shop.name} (ID: ${shop.id}, Gender: ${shop.gender})`);
        
        const result = await servicesService.addDefaultServicesToShop(shop.id);
        
        console.log(`  ✅ Added ${result.added} services to ${shop.name}`);
        totalAdded += result.added;
        processedShops++;
        
      } catch (error) {
        console.error(`  ❌ Error processing shop ${shop.name}:`, error instanceof Error ? error.message : String(error));
        // Continue with other shops even if one fails
      }
    }

    console.log(`\n🎉 Process completed!`);
    console.log(`Processed shops: ${processedShops}/${shops.length}`);
    console.log(`Total services added: ${totalAdded}`);
    
  } catch (error) {
    console.error("❌ Error adding services to existing shops:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

void main();