export const config = { runtime: 'edge' };

const ORIGIN = 'https://xray.breached.tf';
const ORIGIN_HOST = 'xray.breached.tf';

export default async function handler(req) {
  const url = new URL(req.url);

  // Reconstruct the exact target URL — path + query string, untouched
  const target = ORIGIN + url.pathname + url.search;

  // Copy all incoming headers, override Host to match origin
  const headers = new Headers(req.headers);
  headers.set('host', ORIGIN_HOST);

  // Don't forward encoding headers — let fetch handle it natively
  headers.delete('accept-encoding');

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  const upstream = await fetch(target, {
    method: req.method,
    headers: headers,
    body: hasBody ? req.body : null,
  });

  // Forward everything back 1:1 — status, headers, body
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
