import { createLastfmSignature } from "../_utils";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { track, artist, album, timestamp, sk } = await context.request.json<any>();
  const apiKey = context.env.LASTFM_API_KEY;

  const params: any = {
    method: "track.scrobble",
    api_key: apiKey,
    sk, artist, track,
    timestamp: String(timestamp),
  };
  if (album) params.album = album;

  const api_sig = await createLastfmSignature(params, context.env.LASTFM_SHARED_SECRET);
  const res = await fetch("https://ws.audioscrobbler.com/2.0/", {
    method: "POST",
    body: new URLSearchParams({ ...params, api_sig, format: "json" }),
  });

  return new Response(await res.text(), {
    headers: { "Content-Type": "application/json" },
  });
};
