// Resolves a KrakenFiles hash to a direct download URL and streams the file.
// Usage: GET /api/kraken-proxy?hash={hash}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const hash = url.searchParams.get('hash');

  if (!hash) return new Response('Missing hash parameter', { status: 400 });

  // Step 1: Request a signed download URL from KrakenFiles
  let downloadUrl: string;
  try {
    const apiRes = await fetch(
      `https://krakenfiles.com/api/file/${hash}/request-download-url`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Referer': `https://krakenfiles.com/view/${hash}/file.html`,
          'Origin': 'https://krakenfiles.com',
        },
      }
    );

    if (!apiRes.ok) {
      const body = await apiRes.text().catch(() => '');
      return new Response(`KrakenFiles API ${apiRes.status}: ${body}`, { status: 502 });
    }

    const data: any = await apiRes.json();
    downloadUrl = data?.data?.url ?? data?.url ?? '';

    if (!downloadUrl) {
      return new Response(`No URL in KrakenFiles response: ${JSON.stringify(data)}`, { status: 502 });
    }
  } catch (err: any) {
    return new Response(`KrakenFiles API error: ${err?.message ?? err}`, { status: 502 });
  }

  // Step 2: Proxy the file, forwarding Range header so seeking works
  try {
    const upstream = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(context.request.headers.get('Range')
          ? { Range: context.request.headers.get('Range')! }
          : {}),
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
    return new Response(`Failed to stream file: ${err?.message ?? err}`, { status: 502 });
  }
};
