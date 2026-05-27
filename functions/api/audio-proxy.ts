const ALLOWED_HOSTS = ['api.pillows.su', 'temp.imgur.gg'];

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const target = url.searchParams.get('url');

  if (!target) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response('Invalid url parameter', { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
    return new Response('Host not allowed', { status: 403 });
  }

  const upstream = await fetch(targetUrl.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  const ct = upstream.headers.get('content-type');
  if (ct) headers.set('Content-Type', ct);
  const cd = upstream.headers.get('content-disposition');
  if (cd) headers.set('Content-Disposition', cd);
  const cl = upstream.headers.get('content-length');
  if (cl) headers.set('Content-Length', cl);

  return new Response(upstream.body, { status: upstream.status, headers });
};
