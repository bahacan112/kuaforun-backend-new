import { ServicesService } from '../modules/services/services.service'

async function main() {
  const svc = new ServicesService()
  const res = await svc.seedServiceTemplates()
  console.log(`[seed-service-templates] inserted=${res.inserted} skipped=${res.skipped}`)
}

main().catch((err) => { console.error(err); process.exit(1) })