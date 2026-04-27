export const config = {
  runtime: "edge"
};

const TARGET = (process.env.TARGET_DOMAIN || "").replace(/\/+$/, "");

const DROP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "x-vercel-id",
  "x-vercel-ip-country",
  "x-vercel-ip-city",
  "x-vercel-ip-latitude",
  "x-vercel-ip-longitude",
  "x-vercel-ip-timezone"
]);

export default async function handler(req) {
  if (!TARGET) {
    return new Response("TARGET_DOMAIN not set", { status: 500 });
  }

  const u = new URL(req.url);
  const targetUrl = TARGET + u.pathname + u.search;

  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (!DROP_HEADERS.has(k.toLowerCase())) {
      headers.set(k, v);
    }
  }

  return fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    redirect: "manual",
    duplex: "half"
  });
}