import { MALE_SERVICES, FEMALE_SERVICES, ALL_SERVICE_TEMPLATES } from "../modules/services/service-templates.js";

async function main() {
  console.log("Debugging service templates...");
  
  console.log(`\nMALE_SERVICES count: ${MALE_SERVICES.length}`);
  console.log("First 3 male services:");
  MALE_SERVICES.slice(0, 3).forEach((service, index) => {
    console.log(`  ${index + 1}. Name: "${service.name}", Gender: ${service.gender}, Price: ${service.defaultPrice}`);
  });

  console.log(`\nFEMALE_SERVICES count: ${FEMALE_SERVICES.length}`);
  console.log("First 3 female services:");
  FEMALE_SERVICES.slice(0, 3).forEach((service, index) => {
    console.log(`  ${index + 1}. Name: "${service.name}", Gender: ${service.gender}, Price: ${service.defaultPrice}`);
  });

  console.log(`\nALL_SERVICE_TEMPLATES count: ${ALL_SERVICE_TEMPLATES.length}`);
  console.log("First 3 all services:");
  ALL_SERVICE_TEMPLATES.slice(0, 3).forEach((service, index) => {
    console.log(`  ${index + 1}. Name: "${service.name}", Gender: ${service.gender}, Price: ${service.defaultPrice}`);
  });

  process.exit(0);
}

void main();