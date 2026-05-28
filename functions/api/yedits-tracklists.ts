export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { YEDITS_BUCKET } = context.env;

  let cursor: string | undefined;
  const tracklistKeys: string[] = [];

  do {
    const listing = await YEDITS_BUCKET.list({ cursor });
    for (const obj of listing.objects) {
      const filename = obj.key.split('/').pop() ?? '';
      if (/YZY[\s_-]*gold/i.test(filename)) {
        tracklistKeys.push(obj.key);
      }
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  const results = await Promise.all(
    tracklistKeys.map(async key => {
      const folderPath = key.substring(0, key.lastIndexOf('/'));
      const obj = await YEDITS_BUCKET.get(key);
      if (!obj) return null;
      const text = await obj.text();
      return [folderPath, text] as [string, string];
    })
  );

  const data: Record<string, string> = {};
  for (const r of results) {
    if (r) data[r[0]] = r[1];
  }

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
