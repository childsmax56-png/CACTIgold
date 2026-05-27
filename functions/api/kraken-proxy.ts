// Resolves a KrakenFiles hash to a direct audio URL via their POST API, then proxies it.
// Usage: GET /api/kraken-proxy?hash={hash}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function resolveKrakenUrl(hash: string): Promise<string | null> {
  // Try POST API (what KrakenFiles JS calls)
  try {
    const res = await fetch(
      `https://krakenfiles.com/api/file/${hash}/request-download-url`,
      {
        method: 'POST',
        signal: withTimeout(10000),
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Referer': `https://krakenfiles.com/view/${hash}/file.html`,
          'Origin': 'https://krakenfiles.com',
        },
      }
    );
    if (res.ok) {
      const data: any = await res.json().catch(() => null);
      const url = data?.data?.url ?? data?.url ?? null;
      if (url) return url;
    }
  } catch {
    // timeout or network error — fall through
  }

  // Scrape embed page as fallback
  const pagesToTry = [
    `https://krakenfiles.com/embed-player/${hash}`,
    `https://krakenfiles.com/view/${hash}/file.html`,
  ];
  const audioPattern = [
    /<(?:audio|source)[^>]+src=["']([^"']+)["']/i,
    /(?:fileUrl|file_url|audioUrl|audio_url|src)\s*[=:]\s*["'](https:\/\/[^"']+)["']/i,
    /"url"\s*:\s*"(https:\/\/[^"]+\.(?:mp3|wav|flac|m4a|ogg)[^"]*)"/i,
    /(https:\/\/(?:cdn\.|storage\.|s3)[^\s"'<>]+\.(?:mp3|wav|flac|m4a|ogg)(?:\?[^\s"'<>]*)?)/i,
  ];

  for (const pageUrl of pagesToTry) {
    try {
      const res = await fetch(pageUrl, {
        signal: withTimeout(8000),
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      for (const p of audioPattern) {
        const m = html.match(p);
        if (m?.[1]) return m[1];
      }
    } catch {
      continue;
    }
  }

  return null;
}

export const onRequestGet: PagesFunction = async (context) => {
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
  try {
    const rangeHeader = context.request.headers.get('Range');
    const upstream = await fetch(audioUrl, {
      signal: withTimeout(30000),
      headers: {
        'User-Agent': UA,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

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
      JSON.stringify({ error: 'Failed to stream audio', detail: err?.message, audioUrl }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
