import { Hono } from "hono";
import type { Context } from "hono";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";

const nominatimBase = "https://nominatim.openstreetmap.org";

export const openstreetmapRouter = new Hono();

openstreetmapRouter.use("/*", tenantMiddleware);

openstreetmapRouter.get("/search", async (c: Context) => {
  const q = c.req.query("q")?.trim();
  const limit = Number(c.req.query("limit") ?? "5");
  const lat = c.req.query("lat");
  const lng = c.req.query("lng") ?? c.req.query("lon");
  if (!q) return c.json({ error: "q gerekli" }, 400);

  const params = new URLSearchParams({
    q,
    format: "json",
    addressdetails: "1",
    limit: String(isFinite(limit) && limit > 0 ? limit : 5),
    "accept-language": "tr",
  });
  try {
    const url = `${nominatimBase}/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "kuaforun-backend/1.0 (+https://kuaforun.com)",
      },
    });
    if (!res.ok) return c.json({ error: `OSM error ${res.status}` }, 502);
    const json = await res.json();
    return c.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return c.json({ error: msg }, 500);
  }
});

openstreetmapRouter.get("/reverse", async (c: Context) => {
  const lat = c.req.query("lat");
  const lon = c.req.query("lng") ?? c.req.query("lon");
  if (!lat || !lon) return c.json({ error: "lat ve lng gerekli" }, 400);
  const params = new URLSearchParams({
    lat,
    lon,
    format: "json",
    addressdetails: "1",
    "accept-language": "tr",
  });
  try {
    const url = `${nominatimBase}/reverse?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "kuaforun-backend/1.0 (+https://kuaforun.com)",
      },
    });
    if (!res.ok) return c.json({ error: `OSM error ${res.status}` }, 502);
    const json = await res.json();
    return c.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return c.json({ error: msg }, 500);
  }
});

export default openstreetmapRouter;