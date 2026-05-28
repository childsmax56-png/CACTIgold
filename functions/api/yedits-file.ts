export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { YEDITS_BUCKET } = context.env;
  const url = new URL(context.request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response('Missing key parameter', { status: 400 });
  }

  const obj = await YEDITS_BUCKET.get(key);
  if (!obj) {
    return new Response('File not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'audio/mpeg');
  headers.set('Content-Length', obj.size.toString());
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(obj.body, { headers });
};
