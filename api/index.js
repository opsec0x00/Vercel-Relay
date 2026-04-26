export const config = {
  runtime: "nodejs",
};

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = TARGET_BASE + url.pathname + url.search;

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

    // ✅ FIX: Proper body handling
    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await getRawBody(req);
    }

    // ✅ FIX: duplex required in Node fetch
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      duplex: "half",
      redirect: "manual",
    });

    // ✅ Copy headers
    upstream.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(upstream.status);

    // ✅ FIX: No pipe — use buffer
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);

  } catch (err) {
    console.error("Relay error:", err);
    res.status(502).send("Bad Gateway: Tunnel Failed");
  }
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
