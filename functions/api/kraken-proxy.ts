// Resolves a KrakenFiles hash to a direct download URL and streams the file.
// Usage: GET /api/kraken-proxy?hash={hash}
// KrakenFiles view URLs look like: https://krakenfiles.com/view/{hash}/file.html

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const hash = url.searchParams.get('hash');

  if (!hash) return new Response('Missing hash parameter', { status: 400 });

  // Step 1: Ask KrakenFiles for a signed download URL
  let downloadUrl: string;
  try {
    const apiRes = await fetch(
      `https://krakenfiles.com/api/file/${hash}/request-download-url`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );
    if (!apiRes.ok) {
      return new Response(`KrakenFiles API error: ${apiRes.status}`, { status: 502 });
    }
    const data: any = await apiRes.json();
    downloadUrl = data?.data?.url ?? data?.url;
    if (!downloadUrl) {
      return new Response('No download URL in KrakenFiles response', { status: 502 });
    }
  } catch (err) {
    return new Response('Failed to contact KrakenFiles API', { status: 502 });
  }

  // Step 2: Proxy the file back to the client with CORS headers
  try {
    const fileRes = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    const ct = fileRes.headers.get('content-type');
    if (ct) headers.set('Content-Type', ct);
    const cd = fileRes.headers.get('content-disposition');
    if (cd) headers.set('Content-Disposition', cd);
    const cl = fileRes.headers.get('content-length');
    if (cl) headers.set('Content-Length', cl);

    return new Response(fileRes.body, { status: fileRes.status, headers });
  } catch (err) {
    return new Response('Failed to fetch file from KrakenFiles', { status: 502 });
  }
};
