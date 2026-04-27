// pages/api/[...path].js
export const config = { runtime: 'edge' }; // Edge = lower latency

export default async function handler(req) {
  const ORIGIN = 'https://xray.breached.tf'; // your actual server

  const url = new URL(req.url);
  const targetUrl = ORIGIN + url.pathname + url.search;

  // Forward the request transparently
  const proxyReq = new Request(targetUrl, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
    duplex: 'half',
  });

  const response = await fetch(proxyReq);

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
