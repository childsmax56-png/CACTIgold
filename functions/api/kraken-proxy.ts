// Resolves a KrakenFiles hash to a direct audio URL, then proxies it.
// Usage: GET /api/kraken-proxy?hash={hash}

const VERSION = 'v6-no-fetch';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const hash = url.searchParams.get('hash');

    if (!hash) {
      return new Response(JSON.stringify({ version: VERSION, error: 'Missing hash parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Diagnostic: return immediately without fetching anything
    return new Response(
      JSON.stringify({ version: VERSION, hash, status: 'fetch-disabled-for-testing' }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ version: VERSION, error: 'Unhandled exception', detail: err?.message ?? String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
