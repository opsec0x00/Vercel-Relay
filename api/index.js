export const config = {
  runtime: "nodejs",
};

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

// Headers that truly break proxying
const STRIP_HEADERS = new Set([
  "host",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(req, res) {
  if (!TARGET_BASE) {
    res.status(500).send("Misconfigured: TARGET_DOMAIN not set");
    return;
  }

  try {
    // ✅ Robust URL parsing
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = TARGET_BASE + url.pathname + url.search;

    // ✅ Copy headers safely
    const headers = {};
    let clientIp = null;

    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();

      if (STRIP_HEADERS.has(key)) continue;
      if (key.startsWith("x-vercel-")) continue;

      if (key === "x-real-ip") {
        clientIp = v;
        continue;
      }

      if (key === "x-forwarded-for") {
        if (!clientIp) clientIp = v;
        continue;
      }

      headers[key] = v;
    }

    if (clientIp) {
      headers["x-forwarded-for"] = clientIp;
    }

    // ✅ Proper raw body extraction (fixes 502)
    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await getRawBody(req);
    }

    // ✅ Forward request
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    // ✅ Forward response headers
    upstream.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(upstream.status);

    // ✅ Stream response
    if (upstream.body) {
      upstream.body.pipe(res);
    } else {
      res.end();
    }

  } catch (err) {
    console.error("Relay error:", err);
    res.status(502).send("Bad Gateway: Tunnel Failed");
  }
}

// ✅ Helper to properly read request body
async function getRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
