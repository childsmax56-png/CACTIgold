import { createLastfmSignature } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });

  const apiKey = context.env.LASTFM_API_KEY?.trim();
  const secret = context.env.LASTFM_SHARED_SECRET?.trim();
  const params = { api_key: apiKey, method: "auth.getSession", token };
  const api_sig = await createLastfmSignature(params, secret);

  const body = new URLSearchParams({ ...params, api_sig, format: "json" });
  const res = await fetch(`https://ws.audioscrobbler.com/2.0/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data: any = await res.json();

  if (data.session) {
    const { key, name } = data.session;
    const html = `<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'lastfm-auth', session: ${JSON.stringify(key)}, user: ${JSON.stringify(name)} }, '*');
        window.close();
      } else {
        window.location.href = '/?lastfm_session=${encodeURIComponent(key)}&lastfm_user=${encodeURIComponent(name)}';
      }
    </script></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }
  const html = `<!DOCTYPE html><html><body style="background:#111;color:#fff;font-family:monospace;padding:20px">
    <p>Last.fm auth failed</p>
    <pre>${JSON.stringify(data, null, 2)}</pre>
    <p>token: ${token}</p>
  </body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
};
