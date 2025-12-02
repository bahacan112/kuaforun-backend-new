import { Hono } from "hono";
import { openApiSpec } from "./spec.min";

import { getSwaggerHtml } from "./ui";

export const docsRouter = new Hono();

// OpenAPI JSON'ı ortamına göre dinamik server'larla döndür
// Gateway üzerinden (/kuaforun/*) geliyorsa server olarak "/kuaforun" ekleyelim
// Doğrudan servis portundan erişiliyorsa (4000), "/" temel yolunu kullanalım
// Not: Referer başlığı, Swagger UI sayfa URL'sini taşıdığı için bu ayrımı sağlamaya yardımcı olur

docsRouter.get("/openapi.json", (c) => {
  const referer = c.req.header("referer") ?? "";
  const forwardedPrefix = c.req.header("x-forwarded-prefix") ?? "";
  let servers: { url: string }[];
  try {
    const refPath = new URL(referer).pathname;
    const isViaGateway =
      forwardedPrefix.startsWith("/kuaforun") ||
      refPath.startsWith("/kuaforun");
    servers = isViaGateway
      ? [{ url: "/kuaforun" }, { url: "/" }]
      : [{ url: "/" }, { url: "/kuaforun" }];
  } catch {
    // Referer yoksa veya parse edilemediyse, her iki seçeneği de sunalım
    const isViaGateway = forwardedPrefix.startsWith("/kuaforun");
    servers = isViaGateway
      ? [{ url: "/kuaforun" }, { url: "/" }]
      : [{ url: "/" }, { url: "/kuaforun" }];
  }
  const allowedPrefixes = ["/admin-barber", "/customer", "/public", "/super-admin", "/auth"];
  const entries = Object.entries(openApiSpec.paths as Record<string, any>);
  const filteredPaths = Object.fromEntries(entries.filter(([p]) => allowedPrefixes.some((pr) => p.startsWith(pr))));
  // Collect used tags from filtered paths
  const used = new Set<string>();
  for (const [, ops] of Object.entries(filteredPaths)) {
    for (const method of ["get","post","put","patch","delete"]) {
      const op = (ops as any)[method];
      if (op && Array.isArray(op.tags)) {
        for (const t of op.tags) used.add(String(t));
      }
    }
  }
  const tags = [
    { name: "auth" },
    { name: "admin-barber" },
    { name: "customer" },
    { name: "public" },
    { name: "super-admin" },
  ];
  const spec = { ...openApiSpec, servers, paths: filteredPaths, tags };
  return c.json(spec);
});

docsRouter.get("/", (c) => {
  const referer = c.req.header("referer") ?? "";
  const forwardedPrefix = c.req.header("x-forwarded-prefix") ?? "";

  // Varsayılan olarak root üzerinden servis edilir
  let openApiUrl = "/docs/openapi.json";
  let basePath = "";

  try {
    const refererUrl = new URL(referer);
    const isViaGateway =
      forwardedPrefix.startsWith("/kuaforun") ||
      refererUrl.pathname.startsWith("/kuaforun");
    basePath = isViaGateway ? "/kuaforun" : "";
    // Mutlak URL yerine aynı origin'i kullanan kök-relative URL üretelim (mixed-content ve internal host sorunlarını önler)
    openApiUrl = `${basePath}/docs/openapi.json`;
  } catch {
    // Referer yoksa isteğin URL'sinden çıkarım yap
    try {
      const reqUrl = new URL(c.req.url);
      const isViaGateway =
        forwardedPrefix.startsWith("/kuaforun") ||
        reqUrl.pathname.startsWith("/kuaforun");
      basePath = isViaGateway ? "/kuaforun" : "";
      openApiUrl = `${basePath}/docs/openapi.json`;
    } catch {
      // Son çare: root yolu
      openApiUrl = `${basePath}/docs/openapi.json`;
    }
  }

  // Serve manual HTML to guarantee header injection via requestInterceptor
  return c.html(getSwaggerHtml(openApiUrl));
});
