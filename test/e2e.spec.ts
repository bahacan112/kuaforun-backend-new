import app from "../src/app"

async function json(path: string, init?: RequestInit) {
  const res = await app.request(new Request(`http://localhost${path}`, init))
  const body = await res.json()
  return { status: res.status, body }
}

async function text(path: string, init?: RequestInit) {
  const res = await app.request(new Request(`http://localhost${path}`, init))
  const body = await res.text()
  return { status: res.status, body }
}

it("serves swagger openapi.json", async () => {
  const { status, body } = await json("/docs/openapi.json", { headers: { "x-forwarded-prefix": "/kuaforun" } })
  expect(status).toBe(200)
  expect(body.info?.title).toBeDefined()
  expect(Array.isArray(body.servers)).toBe(true)
})

it("serves swagger ui html", async () => {
  const { status, body } = await text("/docs", { headers: { "x-forwarded-prefix": "/kuaforun" } })
  expect(status).toBe(200)
  expect(body.includes("SwaggerUI")) .toBe(true)
})

it("health endpoint", async () => {
  const { status, body } = await json("/health")
  expect(status).toBe(200)
  expect(body.ok).toBe(true)
})