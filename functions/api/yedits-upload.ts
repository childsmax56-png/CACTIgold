export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { YEDITS_BUCKET } = context.env;

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return json({ error: 'Invalid form data' }, 400);
  }

  const token = formData.get('token') as string | null;
  const creator = (formData.get('creator') as string | null)?.trim();
  const album = (formData.get('album') as string | null)?.trim();

  if (!token || !creator || !album) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const authRes = await fetch('https://vaultgold.net/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!authRes.ok) {
    return json({ error: 'Unauthorized — sign in to VaultGold first' }, 401);
  }

  const sanitize = (s: string) =>
    s.replace(/[/\\<>:"|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'untitled';

  const creatorDir = sanitize(creator);
  const albumDir = sanitize(album);

  const uploaded: string[] = [];

  const cover = formData.get('cover');
  if (cover instanceof File && cover.size > 0) {
    const key = `${creatorDir}/${albumDir}/${sanitize(cover.name)}`;
    await YEDITS_BUCKET.put(key, cover.stream(), {
      httpMetadata: { contentType: cover.type || 'image/jpeg' },
    });
    uploaded.push(key);
  }

  for (const track of formData.getAll('tracks')) {
    if (!(track instanceof File) || track.size === 0) continue;
    const key = `${creatorDir}/${albumDir}/${sanitize(track.name)}`;
    await YEDITS_BUCKET.put(key, track.stream(), {
      httpMetadata: { contentType: track.type || 'audio/mpeg' },
    });
    uploaded.push(key);
  }

  if (uploaded.length === 0) {
    return json({ error: 'No files were uploaded' }, 400);
  }

  return json({ uploaded });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
