// Resolves a KrakenFiles hash to a direct audio URL via their POST API, then proxies it.
// Usage: GET /api/kraken-proxy?hash={hash}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function resolveKrakenUrl(hash: string): Promise<string | null> {
  // Try POST API first (what KrakenFiles JS calls internally)
  try {
    const res = await fetchWithTimeout(
      `https://krakenfiles.com/api/file/${hash}/request-download-url`,
      {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Referer': `https://krakenfiles.com/view/${hash}/file.html`,
          'Origin': 'https://krakenfiles.com',
        },
      },
      10000
    );
    if (res.ok) {
      const data: any = await res.json().catch(() => null);
      const url = data?.data?.url ?? data?.url ?? null;
      if (url) return url;
    }
  } catch {
    // timeout or blocked — fall through to HTML scraping
  }

  // Scrape embed/view page as fallback
  const pagesToTry = [
    `https://krakenfiles.com/embed-player/${hash}`,
    `https://krakenfiles.com/view/${hash}/file.html`,
  ];
  const audioPatterns = [
    /<(?:audio|source)[^>]+src=["']([^"']+)["']/i,
    /(?:fileUrl|file_url|audioUrl|audio_url|src)\s*[=:]\s*["'](https:\/\/[^"']+)["']/i,
    /"url"\s*:\s*"(https:\/\/[^"]+\.(?:mp3|wav|flac|m4a|ogg)[^"]*)"/i,
    /(https:\/\/(?:cdn\.|storage\.|s3)[^\s"'<>]+\.(?:mp3|wav|flac|m4a|ogg)(?:\?[^\s"'<>]*)?)/i,
  ];

  for (const pageUrl of pagesToTry) {
    try {
      const res = await fetchWithTimeout(
        pageUrl,
        { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*;q=0.9' } },
        8000
      );
      if (!res.ok) continue;
      const html = await res.text();
      for (const pattern of audioPatterns) {
        const m = html.match(pattern);
        if (m?.[1]) return m[1];
      }
    } catch {
      continue;
    }
  }

  return null;
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const hash = url.searchParams.get('hash');

    if (!hash) {
      return new Response('Missing hash parameter', { status: 400 });
    }

    const audioUrl = await resolveKrakenUrl(hash);

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve KrakenFiles URL', hash }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Proxy the audio with Range support for seeking
    const rangeHeader = context.request.headers.get('Range');
    const upstream = await fetchWithTimeout(
      audioUrl,
      {
        headers: {
          'User-Agent': UA,
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
      },
      30000
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
