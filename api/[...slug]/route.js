export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// ✏️ CHANGE THIS to your real server (must be HTTPS)
const ORIGIN = 'https://xray.breached.tf';

async function proxy(request, { params }) {
  try {
    const slug = (await params).slug ?? [];
    const path = '/' + slug.join('/');
    const search = new URL(request.url).search ?? '';
    const target = `${ORIGIN}${path}${search}`;

    console.log(`[relay] ${request.method} ${target}`);

    const headers = new Headers();
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower !== 'host' && lower !== 'x-forwarded-host') {
        headers.set(key, value);
      }
    });

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
    };

    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = request.body;
      init.duplex = 'half';
    }

    const response = await fetch(target, init);

    const resHeaders = new Headers(response.headers);
    // Remove headers that Vercel shouldn't forward back
    resHeaders.delete('content-encoding');
    resHeaders.delete('transfer-encoding');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });

  } catch (err) {
    console.error('[relay] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export const GET     = proxy;
export const POST    = proxy;
export const PUT     = proxy;
export const DELETE  = proxy;
export const PATCH   = proxy;
export const HEAD    = proxy;
export const OPTIONS = proxy;
