export const onRequestGet: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.LASTFM_API_KEY?.trim();
  if (!apiKey) return new Response("API key not configured", { status: 500 });

  const url = new URL(context.request.url);

  const callbackUrl = `${url.origin}/api/lastfm/callback`;
  const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${encodeURIComponent(callbackUrl)}`;

  return Response.redirect(authUrl, 302);
};
