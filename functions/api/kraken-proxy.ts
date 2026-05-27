// Resolves a KrakenFiles hash to a direct audio URL, then proxies it.
// Usage: GET /api/kraken-proxy?hash={hash}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function resolveKrakenUrl(hash: string): Promise<{ url: string | null; debug: string }> {
  // Try POST API first (what KrakenFiles JS calls internally)
  try {
    const res = await fetchWithTimeout(
      `https://krakenfiles.com/api/file/${hash}/request-download-url`,
      {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/json',
          'Accept': 'application/json, */*',
          'Referer': `https://krakenfiles.com/view/${hash}/file.html`,
          'Origin': 'https://krakenfiles.com',
        },
      },
      8000
    );
    const body = await res.text().catch(() => '');
    if (res.ok) {
      try {
        const data: any = JSON.parse(body);
        const url = data?.data?.url ?? data?.url ?? null;
        if (url) return { url, debug: `post-api:${res.status}:ok` };
      } catch { /* not JSON */ }
    }
    return { url: null, debug: `post-api:${res.status}:${body.slice(0, 300)}` };
  } catch (e: any) {
    const reason = e?.name === 'AbortError' ? 'timeout' : (e?.message ?? String(e));
    return { url: null, debug: `post-api:error:${reason}` };
  }
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const hash = url.searchParams.get('hash');

    if (!hash) {
      return new Response('Missing hash parameter', { status: 400 });
    }

    const { url: audioUrl, debug } = await resolveKrakenUrl(hash);

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve KrakenFiles URL', hash, debug }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Proxy the audio with Range support for seeking
    const rangeHeader = context.request.headers.get('Range');
    const upstream = await fetchWithTimeout(
      audioUrl,
      { headers: { 'User-Agent': UA, ...(rangeHeader ? { Range: rangeHeader } : {}) } },
      25000
    );

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges');
    for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-disposition']) {
      const val = upstream.headers.get(key);
      if (val) headers.set(key, val);
    }

    return new Response(upstream.body, { status: upstream.status, headers });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Unhandled exception', detail: err?.message ?? String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
