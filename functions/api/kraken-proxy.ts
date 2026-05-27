// Fetches the KrakenFiles embed page, extracts the direct audio URL, and proxies it.
// Usage: GET /api/kraken-proxy?hash={hash}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

function extractAudioUrl(html: string): string | null {
  const patterns = [
    // <audio src="..."> or <source src="...">
    /<audio[^>]+src=["']([^"']+)["']/i,
    /<source[^>]+src=["']([^"']+)["']/i,
    // JavaScript variable assignments
    /(?:fileUrl|file_url|audioUrl|audio_url|downloadUrl|download_url|src)\s*[=:]\s*["'](https:\/\/[^"']+)["']/i,
    // JSON-style url fields pointing to audio/CDN
    /"url"\s*:\s*"(https:\/\/[^"]+\.(?:mp3|wav|flac|m4a|ogg|aiff)[^"]*)"/i,
    // Any https CDN URL with an audio extension
    /(https:\/\/(?:cdn|storage|files|s3)[^\s"'<>]+\.(?:mp3|wav|flac|m4a|ogg|aiff)(?:\?[^\s"'<>]*)?)/i,
    // Broader CDN pattern (krakenfiles or Amazon S3)
    /(https:\/\/[^\s"'<>]*krakenfiles[^\s"'<>]*\/(?:download|file|cdn)[^\s"'<>]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const hash = url.searchParams.get('hash');

  if (!hash) return new Response('Missing hash parameter', { status: 400 });

  // Try embed page first, then the regular view page as fallback
  const pagesToTry = [
    `https://krakenfiles.com/embed-player/${hash}`,
    `https://krakenfiles.com/view/${hash}/file.html`,
  ];

  let audioUrl: string | null = null;

  for (const pageUrl of pagesToTry) {
    let html: string;
    try {
      const res = await fetch(pageUrl, { headers: BROWSER_HEADERS });
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }

    audioUrl = extractAudioUrl(html);
    if (audioUrl) break;
  }

  if (!audioUrl) {
    // Last resort: try the POST API
    try {
      const apiRes = await fetch(
        `https://krakenfiles.com/api/file/${hash}/request-download-url`,
        {
          method: 'POST',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/json',
            'Referer': `https://krakenfiles.com/view/${hash}/file.html`,
            'Origin': 'https://krakenfiles.com',
          },
        }
      );
      if (apiRes.ok) {
        const data: any = await apiRes.json().catch(() => null);
        audioUrl = data?.data?.url ?? data?.url ?? null;
      }
    } catch {
      // ignore
    }
  }

  if (!audioUrl) {
    return new Response(
      `Could not extract audio URL from KrakenFiles page for hash: ${hash}`,
      { status: 502 }
    );
  }

  // Proxy the audio file with Range support for seeking
  try {
    const rangeHeader = context.request.headers.get('Range');
    const upstream = await fetch(audioUrl, {
      headers: {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges');

    for (const key of ['content-type', 'content-disposition', 'content-length', 'content-range', 'accept-ranges']) {
      const val = upstream.headers.get(key);
      if (val) headers.set(key, val);
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err: any) {
    return new Response(`Failed to stream audio: ${err?.message ?? err}`, { status: 502 });
  }
};
