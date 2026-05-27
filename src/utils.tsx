import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { saveAs } from 'file-saver';
import { useSettings } from './SettingsContext';
import { getArtistName, CUSTOM_IMAGES, ALBUM_RELEASE_DATES, HIDDEN_ALBUMS, TAG_MAP, TAG_TOOLTIP_MAP, ALBUM_DESCRIPTIONS } from './artist.config';
export { getArtistName, CUSTOM_IMAGES, ALBUM_RELEASE_DATES, HIDDEN_ALBUMS, TAG_MAP, TAG_TOOLTIP_MAP, ALBUM_DESCRIPTIONS };

export const FILTER_TOOLTIPS: Record<string, string> = {
  'Snippet': 'Less than a minute of the song is available.',
  'Partial': 'More than a minute of the song is available.',
  'Beat Only': 'Only the instrumental of the song is available.',
  'Tagged': 'Full song is available, but with added tags not from the song itself.',
  'Stem Bounce': 'Full song that has been exported by anyone else who was not the intended person.',
  'Full': 'The entire song is available, but not the original file.',
  'OG File': 'The original entire file of a song is available.',
  'Confirmed': 'The song is unavailable, but has been confirmed to exist by people who have worked with Travis Scott.',
  'Rumored': 'The song is unavailable, but has been said to exist by reputable people within the leak community. Please take with a grain of salt.',
  'Conflicting Sources': "There have been reputable people who say the song does exist and reputable people who say the song doesn't exist. As it is not our place to say who's right or wrong, songs with conflicting sources will be marked as such.",

  'Not Available': 'Placeholder for unavailable songs.',
  'Recording': 'A non-digital copy is available. Usually live performances or someone playing the song.',
  'Low Quality': 'Anything lower than 128kbps (YouTube quality). Noticeably worse than High Quality or CD Quality.',
  'High Quality': 'Anything greater than or equal to 128kbps (YouTube quality) and less than 320kbps.',
  'CD Quality': 'Anything around 320kbps. Not a noticeable difference to Lossless quality.',
  'Lossless': 'Raw audio data, usually from leaked stems or sessions. Useful for audio editing, but not noticeably different to CD Quality.'
};

export const createSlug = (name: string) => encodeURIComponent(
  name
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
);

export function getSongSlug(song: any, allSongsInCollection: any[]): string {
  if (!song || !song.name) return 'NoName1';
  
  if (song.name.includes('???') || createSlug(song.name) === '') {
    let index = 1;
    const targetUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
    for (const s of allSongsInCollection) {
      if ((s.name && s.name.includes('???')) || createSlug(s.name) === '') {
        const sUrl = s.url || (s.urls && s.urls.length > 0 ? s.urls[0] : '');
        if (s.name === song.name && sUrl === targetUrl && s.description === song.description) {
          return `NoName${index}`;
        }
        index++;
      }
    }
    return `NoName1`;
  }
  return createSlug(song.name) || 'NoName1';
}


export function buildArtistTag(songName: string, eraName: string | undefined): string {
  let primary: string;
  const dashIdx = songName.indexOf(' - ');
  if (dashIdx !== -1) {
    primary = songName.substring(0, dashIdx);
    Object.keys(TAG_MAP).forEach(emoji => { primary = primary.replaceAll(emoji, ''); });
    primary = primary.replace(/[️]/g, '').trim();
  } else {
    primary = getArtistName(eraName);
  }

  const featMatch = songName.match(/\(feat\.\s*([^)]+)\)/i);
  if (featMatch) {
    return `${primary} feat. ${featMatch[1].trim()}`;
  }
  return primary;
}


export function formatTextForNotification(text: string | undefined | null, tagsAsEmojis: boolean): string {
  if (!text) return '';
  let formattedText = text;
  const tags: string[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      if (!tagsAsEmojis) {
        tags.push(`[${tag.toUpperCase()}]`);
      }
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tagsAsEmojis) {
    return text;
  }

  if (tags.length === 0) {
    return formattedText;
  }

  return `${formattedText} ${tags.join(' ')}`.trim();
}

export function formatTextWithTags(text: string | undefined | null) {
  if (!text) return null;

  let formattedText = text;
  const tags: { emoji: string, tag: string }[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      tags.push({ emoji, tag });
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tags.length === 0) {
    return <>{formattedText}</>;
  }

  return <FormattedTextWithTags tags={tags} formattedText={formattedText} />;
}

function TagComponent({ t, tagsAsEmojis }: { t: { emoji: string, tag: string }, tagsAsEmojis: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const tooltipText = TAG_TOOLTIP_MAP[t.tag];

  const updateRect = () => {
    if (tagRef.current) {
      setRect(tagRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    if (isHovered) {
      updateRect();
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    }
  }, [isHovered]);

  useEffect(() => {
    if (isHovered) {
      const handleDocClick = (e: MouseEvent) => {
        if (tagRef.current && !tagRef.current.contains(e.target as Node)) {
          setIsHovered(false);
        }
      };
      const timer = setTimeout(() => {
        document.addEventListener('click', handleDocClick);
        document.addEventListener('touchstart', handleDocClick);
      }, 10);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleDocClick);
        document.removeEventListener('touchstart', handleDocClick);
      };
    }
  }, [isHovered]);

  return (
    <div 
      ref={tagRef}
      className="relative flex items-center shrink-0 cursor-help"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsHovered(!isHovered);
      }}
    >
      {tagsAsEmojis ? (
        <span className="shrink-0 flex items-center justify-center text-sm">{t.emoji}</span>
      ) : (
        <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 bg-[var(--theme-color)]/10 text-[var(--theme-color)] font-bold">
          {t.tag}
        </span>
      )}

      {tooltipText && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isHovered && rect && (
            <motion.div
              initial={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              animate={{ opacity: 1, x: "-50%", y: "-100%", filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{
                position: 'fixed',
                left: rect.left + rect.width / 2,
                top: rect.top - 8,
                zIndex: 99999,
                transformOrigin: 'bottom center'
              }}
              className="w-48 sm:w-64 p-3 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl pointer-events-none"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-base flex items-center justify-center text-[var(--theme-color)]">{t.emoji}</span>
                  <span className="font-bold text-white text-xs">{t.tag}</span>
                </div>
                <p className="text-white/70 text-[11px] leading-snug whitespace-normal line-clamp-3">
                  {tooltipText}
                </p>
              </div>
              <div className="absolute top-full left-1/2 -ml-1.5 -mt-[1px] border-solid border-t-neutral-900 border-x-transparent border-b-transparent border-[6px]" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function FormattedTextWithTags({ tags, formattedText }: { tags: { emoji: string, tag: string }[], formattedText: string }) {
  const { settings } = useSettings();
  
  return (
    <div className="flex items-center gap-1.5 truncate">
      <span className="truncate">{formattedText}</span>
      {tags.map((t, i) => (
        <TagComponent key={i} t={t} tagsAsEmojis={settings.tagsAsEmojis} />
      ))}
    </div>
  );
}

export function getCleanSongNameWithTags(text: string | undefined | null): string {
  if (!text) return '';
  let formattedText = text;
  const tags: string[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      tags.push(tag);
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tags.length > 0) {
    return `${formattedText} [${tags.join(', ')}]`;
  }
  return formattedText;
}

export interface SongMeta {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  artworkUrl?: string;
}

function checkMagicBytes(b: Uint8Array): '.mp3' | '.wav' | '.flac' | '.aiff' | '.zip' | '.ogg' | '.m4a' | null {
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return '.wav';
  if (b[0] === 0x66 && b[1] === 0x4C && b[2] === 0x61 && b[3] === 0x43) return '.flac';
  if (b[0] === 0x46 && b[1] === 0x4F && b[2] === 0x52 && b[3] === 0x4D) return '.aiff';
  if (b[0] === 0x50 && b[1] === 0x4B) return '.zip';
  if (b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return '.ogg';
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return '.m4a';
  return null;
}

export async function detectAudioExt(blob: Blob): Promise<'.mp3' | '.wav' | '.flac' | '.aiff' | '.zip' | '.ogg' | '.m4a'> {
  const header = await blob.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(header);

  // If the file starts with an ID3v2 header, skip past it and re-check.
  // Some encoders prepend ID3 tags to lossless formats (FLAC, WAV) which would
  // otherwise be misdetected as MP3.
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes[3] >= 2 && bytes[3] <= 4) {
    const sizeBuf = await blob.slice(6, 10).arrayBuffer();
    const sb = new Uint8Array(sizeBuf);
    const tagSize = ((sb[0] & 0x7F) << 21) | ((sb[1] & 0x7F) << 14) | ((sb[2] & 0x7F) << 7) | (sb[3] & 0x7F);
    const afterBuf = await blob.slice(10 + tagSize, 10 + tagSize + 12).arrayBuffer();
    const match = checkMagicBytes(new Uint8Array(afterBuf));
    return match ?? '.mp3';
  }

  return checkMagicBytes(bytes) ?? '.mp3';
}

function isImageBuffer(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf, 0, 12);
  // JPEG: FF D8
  if (b[0] === 0xFF && b[1] === 0xD8) return true;
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;
  // GIF: 47 49 46
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;
  // WebP: 52 49 46 46 .... 57 45 42 50
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;
  return false;
}

async function compressArtworkToJpeg(buf: ArrayBuffer, maxPx = 800, quality = 0.85): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const mime = detectMime(buf);
    const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width || maxPx, img.height || maxPx));
      const w = Math.max(1, Math.round((img.width || maxPx) * scale));
      const h = Math.max(1, Math.round((img.height || maxPx) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(buf); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(blobUrl);
        if (!b) { resolve(buf); return; }
        b.arrayBuffer().then(resolve).catch(() => resolve(buf));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(buf); };
    img.src = blobUrl;
  });
}

async function fetchArtworkBuffer(artworkUrl: string): Promise<ArrayBuffer | null> {
  const proxies = [
    artworkUrl,
    `https://corsproxy.io/?${encodeURIComponent(artworkUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(artworkUrl)}`,
  ];
  for (const url of proxies) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (isImageBuffer(buf)) return buf;
      }
    } catch {
      // try next proxy
    }
  }
  return null;
}

// Minimal ID3v2.3 writer using Latin-1 encoding so Windows Explorer can edit the Details tab.
// browser-id3-writer writes UTF-16 text frames (encoding 0x01) which Windows can read but not edit.
function latin1Bytes(text: string): Uint8Array {
  return new Uint8Array(Array.from(text).map(c => { const n = c.charCodeAt(0); return n <= 0xFF ? n : 63; }));
}

function id3TextFrame(id: string, text: string): Uint8Array {
  const textBytes = latin1Bytes(text);
  const content = new Uint8Array(1 + textBytes.length); // encoding byte + text
  content[0] = 0x00; // Latin-1
  content.set(textBytes, 1);
  return id3Frame(id, content);
}

function id3ApicFrame(imageData: ArrayBuffer, mimeType: string): Uint8Array {
  const mimeBytes = latin1Bytes(mimeType);
  // encoding(1) + mime + null(1) + picType(1) + description null(1) + imageData
  const content = new Uint8Array(1 + mimeBytes.length + 1 + 1 + 1 + imageData.byteLength);
  let i = 0;
  content[i++] = 0x00; // Latin-1
  content.set(mimeBytes, i); i += mimeBytes.length;
  content[i++] = 0x00; // null terminator for MIME
  content[i++] = 0x03; // picture type: Cover front
  content[i++] = 0x00; // empty description (null terminator)
  content.set(new Uint8Array(imageData), i);
  return id3Frame('APIC', content);
}

function id3Frame(id: string, content: Uint8Array): Uint8Array {
  const frame = new Uint8Array(10 + content.length);
  const view = new DataView(frame.buffer);
  for (let i = 0; i < 4; i++) frame[i] = id.charCodeAt(i);
  view.setUint32(4, content.length, false);
  // bytes 8-9 are flags, left as 0x00 0x00
  frame.set(content, 10);
  return frame;
}

function stripID3v2(buffer: ArrayBuffer): ArrayBuffer {
  const b = new Uint8Array(buffer);
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 && b[3] >= 2 && b[3] <= 4) {
    const size = ((b[6] & 0x7F) << 21) | ((b[7] & 0x7F) << 14) | ((b[8] & 0x7F) << 7) | (b[9] & 0x7F);
    return buffer.slice(10 + size);
  }
  return buffer;
}

function detectMime(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf, 0, 4);
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  return 'image/jpeg';
}

// ─── FLAC → WAV conversion ────────────────────────────────────────────────────
// Decodes FLAC via WebAudio and re-encodes as 16-bit PCM WAV so downstream
// tag embedding can use the simpler ID3 path and players don't choke on
// the FLAC Vorbis-comment block.
function wavWriteString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

export async function flacToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  let rawBuf = await blob.arrayBuffer();
  // Strip prepended ID3v2 header — browsers' FLAC decoders don't tolerate it.
  const hdr = new Uint8Array(rawBuf, 0, Math.min(10, rawBuf.byteLength));
  if (hdr[0] === 0x49 && hdr[1] === 0x44 && hdr[2] === 0x33 && hdr[3] >= 2 && hdr[3] <= 4) {
    const tagSize = ((hdr[6] & 0x7F) << 21) | ((hdr[7] & 0x7F) << 14) | ((hdr[8] & 0x7F) << 7) | (hdr[9] & 0x7F);
    rawBuf = rawBuf.slice(10 + tagSize);
  }
  const decoded = await ctx.decodeAudioData(rawBuf);
  ctx.close();

  const numCh = decoded.numberOfChannels;
  const sr = decoded.sampleRate;
  const numSamples = decoded.length;
  const dataSize = numSamples * numCh * 2; // 16-bit = 2 bytes
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  wavWriteString(view, 0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
  wavWriteString(view, 8, 'WAVE');
  wavWriteString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                          // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true);             // byte rate
  view.setUint16(32, numCh * 2, true);                  // block align
  view.setUint16(34, 16, true);                         // bits per sample
  wavWriteString(view, 36, 'data'); view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, decoded.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }

  return new Blob([buf], { type: 'audio/wav' });
}

// Embeds ID3v2 tags into a WAV file as an 'id3 ' RIFF chunk.
// This keeps the file starting with "RIFF" (valid WAV) while carrying full
// ID3 metadata (title, artist, album, year, artwork) readable by macOS Music,
// foobar2000, VLC, and all other modern players.
export async function embedWAVTags(blob: Blob, meta: SongMeta, cleanTitle: string): Promise<Blob> {
  let src = new Uint8Array(await blob.arrayBuffer());
  // Strip a prepended ID3v2 header so we can reach the RIFF signature below.
  if (src[0] === 0x49 && src[1] === 0x44 && src[2] === 0x33 && src[3] >= 2 && src[3] <= 4) {
    const tagSize = ((src[6] & 0x7F) << 21) | ((src[7] & 0x7F) << 14) | ((src[8] & 0x7F) << 7) | (src[9] & 0x7F);
    src = src.slice(10 + tagSize);
  }
  if (src[0] !== 0x52 || src[1] !== 0x49 || src[2] !== 0x46 || src[3] !== 0x46) return blob;

  // Build ID3v2.3 tag
  const frames: Uint8Array[] = [];
  const title = meta.title || cleanTitle;
  if (title)       frames.push(id3TextFrame('TIT2', title));
  if (meta.artist) frames.push(id3TextFrame('TPE1', meta.artist));
  if (meta.album)  frames.push(id3TextFrame('TALB', meta.album));
  if (meta.year) {
    const y = parseInt(meta.year, 10);
    if (!isNaN(y)) frames.push(id3TextFrame('TYER', String(y)));
  }
  if (meta.artworkUrl) {
    const artBuf = await fetchArtworkBuffer(meta.artworkUrl);
    if (artBuf) frames.push(id3ApicFrame(artBuf, detectMime(artBuf)));
  }
  if (frames.length === 0) return blob;

  const framesSize = frames.reduce((s, f) => s + f.length, 0);
  const id3 = new Uint8Array(10 + framesSize);
  const id3v = new DataView(id3.buffer);
  id3[0] = 0x49; id3[1] = 0x44; id3[2] = 0x33; // "ID3"
  id3[3] = 0x03; id3[4] = 0x00; id3[5] = 0x00;  // v2.3, no flags
  id3v.setUint8(6, (framesSize >> 21) & 0x7F);
  id3v.setUint8(7, (framesSize >> 14) & 0x7F);
  id3v.setUint8(8, (framesSize >>  7) & 0x7F);
  id3v.setUint8(9,  framesSize        & 0x7F);
  let off = 10;
  for (const f of frames) { id3.set(f, off); off += f.length; }

  // Wrap in 'id3 ' RIFF chunk (pad to even length)
  const padded = id3.length + (id3.length % 2);
  const chunk = new Uint8Array(8 + padded);
  const cv = new DataView(chunk.buffer);
  wavWriteString(cv, 0, 'id3 '); cv.setUint32(4, id3.length, true);
  chunk.set(id3, 8);

  const out = new Uint8Array(src.length + chunk.length);
  out.set(src); out.set(chunk, src.length);
  new DataView(out.buffer).setUint32(4, out.length - 8, true); // update RIFF size
  return new Blob([out], { type: 'audio/wav' });
}

export async function embedID3Tags(blob: Blob, meta: SongMeta, cleanTitle: string, mimeType = 'audio/mpeg'): Promise<Blob> {
  const audioBuffer = await blob.arrayBuffer();
  const audio = stripID3v2(audioBuffer);

  const frames: Uint8Array[] = [];
  const title = meta.title || cleanTitle;
  if (title) frames.push(id3TextFrame('TIT2', title));
  if (meta.artist) frames.push(id3TextFrame('TPE1', meta.artist));
  if (meta.album) frames.push(id3TextFrame('TALB', meta.album));
  if (meta.year) {
    const y = parseInt(meta.year, 10);
    if (!isNaN(y)) frames.push(id3TextFrame('TYER', String(y)));
  }

  if (meta.artworkUrl) {
    const artBuffer = await fetchArtworkBuffer(meta.artworkUrl);
    if (artBuffer) {
      frames.push(id3ApicFrame(artBuffer, detectMime(artBuffer)));
    }
  }

  const framesSize = frames.reduce((s, f) => s + f.length, 0);
  const tag = new Uint8Array(10 + framesSize);
  const view = new DataView(tag.buffer);
  tag[0] = 0x49; tag[1] = 0x44; tag[2] = 0x33; // "ID3"
  tag[3] = 0x03; tag[4] = 0x00; // version 2.3.0
  tag[5] = 0x00; // no flags
  // synchsafe tag body size
  view.setUint8(6, (framesSize >> 21) & 0x7F);
  view.setUint8(7, (framesSize >> 14) & 0x7F);
  view.setUint8(8, (framesSize >> 7) & 0x7F);
  view.setUint8(9, framesSize & 0x7F);
  let offset = 10;
  for (const f of frames) { tag.set(f, offset); offset += f.length; }

  const out = new Uint8Array(tag.length + audio.byteLength);
  out.set(tag, 0);
  out.set(new Uint8Array(audio), tag.length);
  return new Blob([out], { type: mimeType });
}

// ─── FLAC tag embedding ────────────────────────────────────────────────────
// FLAC uses Vorbis comments (type 4) and PICTURE blocks (type 6), not ID3.

function u32LE(n: number): Uint8Array {
  return new Uint8Array([n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]);
}
function u32BE(n: number): Uint8Array {
  return new Uint8Array([(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]);
}
function flacBlockHdr(type: number, isLast: boolean, length: number): Uint8Array {
  return new Uint8Array([
    (isLast ? 0x80 : 0x00) | (type & 0x7F),
    (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF,
  ]);
}
function utf8B(s: string): Uint8Array { return new TextEncoder().encode(s); }

function buildVorbisComment(comments: string[]): Uint8Array {
  const vendor = utf8B('reference libFLAC 1.3.4 20220220');
  const parts: Uint8Array[] = [u32LE(vendor.length), vendor, u32LE(comments.length)];
  for (const c of comments) { const cb = utf8B(c); parts.push(u32LE(cb.length), cb); }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function buildFLACPicture(imgData: ArrayBuffer, mime: string): Uint8Array {
  const mimeB = utf8B(mime); const imgB = new Uint8Array(imgData);
  const parts: Uint8Array[] = [
    u32BE(3), u32BE(mimeB.length), mimeB,
    u32BE(0), u32BE(0), u32BE(0), u32BE(0), u32BE(0),
    u32BE(imgB.length), imgB,
  ];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export async function embedFLACTags(blob: Blob, meta: SongMeta, cleanTitle: string): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  let src = new Uint8Array(buf);
  // Strip a prepended ID3v2 header so we can reach the fLaC signature below.
  if (src[0] === 0x49 && src[1] === 0x44 && src[2] === 0x33 && src[3] >= 2 && src[3] <= 4) {
    const tagSize = ((src[6] & 0x7F) << 21) | ((src[7] & 0x7F) << 14) | ((src[8] & 0x7F) << 7) | (src[9] & 0x7F);
    src = src.slice(10 + tagSize);
  }
  // Must start with fLaC
  if (src[0] !== 0x66 || src[1] !== 0x4C || src[2] !== 0x61 || src[3] !== 0x43) return blob;

  // Walk existing metadata blocks; strip any existing VORBIS_COMMENT (4) / PICTURE (6)
  const kept: { type: number; body: Uint8Array }[] = [];
  let pos = 4; let audioStart = 4;
  while (pos + 4 <= src.length) {
    const hdr = src[pos]; const isLast = (hdr & 0x80) !== 0; const type = hdr & 0x7F;
    if (type === 0x7F) break;
    const len = (src[pos + 1] << 16) | (src[pos + 2] << 8) | src[pos + 3];
    if (pos + 4 + len > src.length) break;
    if (type !== 4 && type !== 6) kept.push({ type, body: src.slice(pos + 4, pos + 4 + len) });
    audioStart = pos + 4 + len; pos = audioStart;
    if (isLast) break;
  }

  // Build Vorbis comment fields
  // Field names follow the Vorbis comment spec and Apple Music's expected keys.
  const comments: string[] = [];
  const title = meta.title || cleanTitle;
  if (title) comments.push(`TITLE=${title}`);
  if (meta.artist) {
    comments.push(`ARTIST=${meta.artist}`);
    // Apple Music uses ALBUMARTIST to group tracks into albums; without it,
    // songs often appear under "Unknown Album Artist."
    comments.push(`ALBUMARTIST=${meta.artist}`);
  }
  if (meta.album) comments.push(`ALBUM=${meta.album}`);
  if (meta.year) { const y = parseInt(meta.year, 10); if (!isNaN(y)) { comments.push(`DATE=${y}`); comments.push(`YEAR=${y}`); } }

  const vcBody = buildVorbisComment(comments);
  const rawArtBuf = meta.artworkUrl ? await fetchArtworkBuffer(meta.artworkUrl) : null;
  const artBuf = rawArtBuf ? await compressArtworkToJpeg(rawArtBuf) : null;
  const picBody = artBuf ? buildFLACPicture(artBuf, 'image/jpeg') : null;

  // Reassemble: fLaC + existing blocks + VORBIS_COMMENT + optional PICTURE + audio
  const blocks: { type: number; body: Uint8Array }[] = [...kept, { type: 4, body: vcBody }];
  if (picBody) blocks.push({ type: 6, body: picBody });

  const parts: Uint8Array[] = [new Uint8Array([0x66, 0x4C, 0x61, 0x43])];
  for (let i = 0; i < blocks.length; i++) {
    const { type, body } = blocks[i];
    parts.push(flacBlockHdr(type, i === blocks.length - 1, body.length), body);
  }
  parts.push(src.slice(audioStart));

  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }

  // Verify output block structure so we can diagnose tag visibility issues
  try {
    let vp = 4; let bi = 0;
    while (vp + 4 <= out.length) {
      const vh = out[vp]; const vl = (out[vp+1] << 16) | (out[vp+2] << 8) | out[vp+3];
      const vtype = vh & 0x7F; const vlast = (vh & 0x80) !== 0;
      if (vtype === 4) {
        // Log VORBIS_COMMENT body preview
        const bodyStart = vp + 4;
        const vendorLen = out[bodyStart] | (out[bodyStart+1]<<8) | (out[bodyStart+2]<<16) | (out[bodyStart+3]<<24);
        const commentCountOff = bodyStart + 4 + vendorLen;
        const commentCount = out[commentCountOff] | (out[commentCountOff+1]<<8) | (out[commentCountOff+2]<<16) | (out[commentCountOff+3]<<24);
        console.log(`[flac verify] block[${bi}] VORBIS_COMMENT len=${vl} last=${vlast} vendorLen=${vendorLen} commentCount=${commentCount}`);
        // Log first comment
        let cp = commentCountOff + 4;
        for (let ci = 0; ci < Math.min(commentCount, 4); ci++) {
          const cl = out[cp] | (out[cp+1]<<8) | (out[cp+2]<<16) | (out[cp+3]<<24);
          const cs = new TextDecoder().decode(out.slice(cp+4, cp+4+cl));
          console.log(`  comment[${ci}]: ${cs}`);
          cp += 4 + cl;
        }
      } else {
        console.log(`[flac verify] block[${bi}] type=${vtype} len=${vl} last=${vlast}`);
      }
      bi++; vp += 4 + vl;
      if (vlast) { console.log(`[flac verify] audio starts at byte ${vp} of ${out.length}`); break; }
    }
  } catch {}

  return new Blob([out], { type: 'audio/flac' });
}

function openFallback(url: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = url;
  // For same-origin URLs (e.g. /api/audio-proxy?...) the download attribute is
  // respected by the browser and overrides the server's Content-Disposition
  // filename.  Cross-origin URLs ignore the attribute, but we still set it so
  // same-origin fallbacks (which are the common case) get the right name.
  if (fileName) a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  // Google app (GSA), Facebook, Instagram, and similar WebViews don't support saveAs
  return /GSA\/|FBAN|FBAV|Instagram\//.test(ua);
}

function parseOgFilename(description: string | undefined): string | null {
  if (!description) return null;
  const match = description.match(/^OG Filename:\s*(.+)$/im);
  if (!match) return null;
  const raw = match[1].trim().replace(/^["']|["']$/g, '');
  // Strip known audio extensions so extension logic below can normalize them
  return raw.replace(/\.(mp3|wav|flac|aif|aiff|m4a|ogg)$/i, '');
}

export async function resolveUrl(url: string): Promise<{ fetchUrl: string; isImage: boolean; imageExt?: string; headers?: Record<string, string> }> {
  if (url.includes('temp.imgur.gg/f/')) {
    const id = url.split('/f/')[1];
    if (id) {
      const res = await fetch(`https://temp.imgur.gg/api/file/${id}`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.cdnUrl) return { fetchUrl: data.cdnUrl, isImage: false };
      }
    }
    return { fetchUrl: url, isImage: false };
  }
  if (url.includes('krakenfiles.com/view/')) {
    const hash = url.split('/view/')[1]?.replace('/file.html', '').replace(/\/$/, '');
    return { fetchUrl: hash ? `/api/kraken-proxy?hash=${hash}` : url, isImage: false };
  }
  if (url.includes('pillows.su/f/')) {
    const pathPart = url.split('/f/')[1];
    return { fetchUrl: pathPart ? `https://api.pillows.su/api/download/${pathPart}` : url, isImage: false };
  }
  if (url.includes('ibb.co')) {
    const apiRes = await fetch(`https://imgbb-file-get-api.vercel.app/api?url=${url}`).catch(() => null);
    if (apiRes && apiRes.ok) {
      const apiData = await apiRes.json().catch(() => null);
      if (apiData?.direct_link) return { fetchUrl: apiData.direct_link, isImage: true };
    }
    return { fetchUrl: url, isImage: true };
  }
  if (url.match(/\.(png|jpg|jpeg)$/i) || url.startsWith('https://i.scdn.co/')) {
    const match = url.match(/\.(png|jpg|jpeg)$/i);
    return { fetchUrl: url, isImage: true, imageExt: match ? match[0] : '.png' };
  }
  return { fetchUrl: url, isImage: false };
}

async function compressImageBlob(blob: Blob, maxDim = 2048, quality = 0.85): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(out => resolve(out ?? blob), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(blob); };
    img.src = objUrl;
  });
}

export async function handleDownloadFile(url: string, suggestedName: string, tagsAsEmojis: boolean, meta?: SongMeta, description?: string) {
  if (!url) return;
  let finalUrl = url;
  try {
    const ogName = parseOgFilename(description);
    let fileName = ogName ?? suggestedName;
    if (!tagsAsEmojis && !ogName) {
      fileName = formatTextForNotification(suggestedName, false);
    }

    let isImage = false;
    let ext = '.mp3';

    if (url.includes('temp.imgur.gg/f/')) {
        const id = url.split('/f/')[1];
        if (id) {
            const res = await fetch(`https://temp.imgur.gg/api/file/${id}`).catch(() => null);
            if (res && res.ok) {
                const data = await res.json().catch(() => null);
                if (data?.cdnUrl) finalUrl = data.cdnUrl;
            }
        }
    } else if (url.includes('krakenfiles.com/view/')) {
        const hash = url.split('/view/')[1]?.replace('/file.html', '').replace(/\/$/, '');
        if (hash) finalUrl = `/api/kraken-proxy?hash=${hash}`;
    } else if (url.includes('pillows.su/f/')) {
        const pathPart = url.split('/f/')[1];
        if (pathPart) {
            // Route through Pages Function proxy to avoid CORS block on api.pillows.su
            finalUrl = `/api/audio-proxy?url=${encodeURIComponent(`https://api.pillows.su/api/download/${pathPart}`)}`;
        }
    } else if (url.includes('ibb.co')) {
       isImage = true;
       ext = '';
       const apiRes = await fetch(`https://imgbb-file-get-api.vercel.app/api?url=${url}`).catch(() => null);
       if (apiRes && apiRes.ok) {
           const apiData = await apiRes.json().catch(() => null);
           if (apiData && apiData.direct_link) {
               finalUrl = apiData.direct_link;
           }
       }
    } else if (url.match(/\.(png|jpg|jpeg)$/i) || url.startsWith('https://i.scdn.co/')) {
        isImage = true;
        const match = url.match(/\.(png|jpg|jpeg)$/i);
        ext = match ? match[0] : '.png';
    } 

    if (!fileName.endsWith('.mp3') && !isImage) {
        fileName += ext;
    } else if (isImage && !fileName.match(/\.(png|jpg|jpeg)$/i)) {
        fileName += ext;
    }

    // In-app browsers (Google app, Facebook, Instagram) don't support saveAs via
    // the download attribute. Navigate directly to the download URL so the OS
    // download manager or system browser can handle it. Use the /api/download/
    // path (which includes the filename) so the server sends Content-Disposition:
    // attachment, triggering a real download instead of inline playback.
    if (isInAppBrowser()) {
      let directUrl = finalUrl;
      if (url.includes('pillows.su/f/')) {
        const pathPart = url.split('/f/')[1];
        if (pathPart) directUrl = `https://api.pillows.su/api/download/${pathPart}`;
      }
      window.location.href = directUrl;
      return;
    }

    let blob: Blob;
    try {
      const getWithTimeout = async (requestUrl: string, timeoutMs: number, extraHeaders?: Record<string, string>) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(requestUrl, {
            signal: controller.signal,
            ...(extraHeaders ? { headers: extraHeaders } : {}),
          });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          return null;
        }
      };

      // Use plain fetch (no timeout) for audio — mirrors the zip download path.
      // The 3-second getWithTimeout was aborting before pillows.su responded.
      // Images still get the short timeout + proxy fallback chain.
      let response: Response | null = isImage
        ? await getWithTimeout(finalUrl, 3000)
        : await fetch(finalUrl).catch(() => null);

      if (!response || !response.ok) {
        if (isImage) {
          const proxies = [
            `https://corsproxy.io/?${encodeURIComponent(finalUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(finalUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`
          ];

          for (const proxy of proxies) {
            response = await getWithTimeout(proxy, 4000);
            if (response && response.ok) break;
          }

          if (!response || !response.ok) {
             throw new Error("All proxies failed");
          }
        } else {
          throw new Error("Network error");
        }
      }

      // Guard: reject clearly non-audio/non-binary responses (HTML error pages, JSON, etc.)
      const responseCt = response.headers.get('content-type') ?? '';
      if (responseCt.startsWith('text/html') || responseCt.startsWith('application/json')) {
        throw new Error('Server returned non-audio content');
      }

      // For pillows.su, detect image vs audio from Content-Type since the URL alone doesn't distinguish them
      if (url.includes('pillows.su/f/') && response) {
        if (responseCt.startsWith('image/')) {
          isImage = true;
          // Strip any .mp3 suffix that was pre-assigned, then use image extension
          fileName = fileName.replace(/\.mp3$/i, '');
        }
      }

      blob = await response.blob();
      if (isImage) {
        blob = await compressImageBlob(blob);
        fileName = fileName.replace(/\.(png|jpeg|jpg)$/i, '') + '.jpg';
      } else {
        let actualExt = await detectAudioExt(blob);

        // If magic-byte detection fell back to .mp3, cross-check the Content-Type
        // so that FLAC/WAV/OGG files that evade byte detection still get the right ext.
        if (actualExt === '.mp3') {
          if (responseCt.includes('flac'))                                   actualExt = '.flac';
          else if (responseCt.includes('wav') || responseCt.includes('wave')) actualExt = '.wav';
          else if (responseCt.includes('aiff'))                               actualExt = '.aiff';
          else if (responseCt.includes('ogg') || responseCt.includes('opus')) actualExt = '.ogg';
          else if (responseCt.includes('m4a') || (responseCt.includes('mp4') && !responseCt.includes('video'))) actualExt = '.m4a';
        }

        // Also honour Content-Disposition filename extension when present
        const disposition = response.headers.get('content-disposition') ?? '';
        const dispExt = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/i)?.[2]
          ?.trim().match(/\.(flac|wav|aiff?|ogg|opus|m4a|zip)$/i)?.[0].toLowerCase();
        if (dispExt) actualExt = dispExt as typeof actualExt;

        if (actualExt !== '.mp3' && fileName.endsWith('.mp3')) {
          fileName = fileName.slice(0, -4) + actualExt;
        }

        if (meta) {
          const cleanTitle = meta.title || formatTextForNotification(suggestedName, false);
          if (actualExt === '.mp3') {
            try {
              blob = await embedID3Tags(blob, meta, cleanTitle);
            } catch (e) {
              console.warn('ID3 tagging failed, saving without tags:', e);
            }
          } else if (actualExt === '.wav') {
            try {
              blob = await embedWAVTags(blob, meta, cleanTitle);
            } catch (e) {
              console.warn('WAV tagging failed, saving without tags:', e);
            }
          } else if (actualExt === '.flac') {
            try {
              blob = await flacToWav(blob);
              actualExt = '.wav';
              fileName = fileName.replace(/\.flac$/i, '.wav');
              blob = await embedWAVTags(blob, meta, cleanTitle);
            } catch (e) {
              // decodeAudioData unsupported or failed — fall back to FLAC with embedded tags
              console.warn('[flac→wav] conversion failed, falling back to tagged FLAC:', e);
              try {
                blob = await embedFLACTags(blob, meta, cleanTitle);
              } catch (e2) {
                console.warn('[flac tags] fallback tagging also failed, saving without tags:', e2);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Download failed:', e);
      openFallback(finalUrl, fileName);
      return;
    }

    saveAs(blob, fileName);
  } catch (e) {
    console.error('Download failed:', e);
    openFallback(finalUrl, formatTextForNotification(suggestedName, false));
  }
}

export function isSongNotAvailable(song: any, rawUrl: string): boolean {
  if (song.quality?.toLowerCase() === 'not available') return true;
  if (!rawUrl) return false;
  const lowerUrl = rawUrl.toLowerCase().trim();
  return lowerUrl.includes('link needed') || lowerUrl.includes('link%20needed') || lowerUrl.includes('source needed') || lowerUrl.includes('source%20needed') || lowerUrl === 'n/a';
}

export function parseDurationToSeconds(duration: string | undefined): number {
  if (!duration) return 0;

  if (!duration.includes(':')) {
    const num = Number(duration);
    return isNaN(num) ? 0 : num;
  }

  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 0;
}

export function matchesFilters(song: any, searchQuery: string, filters: any): boolean {
  const lowerQuery = searchQuery.toLowerCase();
  const searchMatch = !searchQuery ||
    song.name.toLowerCase().includes(lowerQuery) ||
    (song.extra && song.extra.toLowerCase().includes(lowerQuery)) ||
    (song.description && song.description.toLowerCase().includes(lowerQuery));

  if (!searchMatch) return false;

  if (filters.tags && filters.tags.length > 0) {
    const hasAllTags = filters.tags.every((tagEmoji: string) => {
      return (song.name && song.name.includes(tagEmoji)) ||
        (song.extra && song.extra.includes(tagEmoji)) ||
        (song.fakesType && song.fakesType.toLowerCase().includes(tagEmoji.toLowerCase()));
    });

    if (!hasAllTags) {
      return false;
    }
  }

  if (filters.excludedTags && filters.excludedTags.length > 0) {
    const hasExcludedTag = filters.excludedTags.some((tagEmoji: string) => {
      return (song.name && song.name.includes(tagEmoji)) ||
        (song.extra && song.extra.includes(tagEmoji)) ||
        (song.fakesType && song.fakesType.toLowerCase().includes(tagEmoji.toLowerCase()));
    });
    if (hasExcludedTag) {
      return false;
    }
  }

  if (filters.qualities && filters.qualities.length > 0) {
    const hasAnyQuality = filters.qualities.some((quality: string) => {
      return (song.quality && song.quality.toLowerCase().includes(quality.toLowerCase())) ||
             (song.fakesLength && song.fakesLength.toLowerCase().includes(quality.toLowerCase()));
    });
    if (!hasAnyQuality) {
      return false;
    }
  }

  if (filters.excludedQualities && filters.excludedQualities.length > 0) {
    const hasExcludedQuality = filters.excludedQualities.some((quality: string) => {
      return (song.quality && song.quality.toLowerCase().includes(quality.toLowerCase())) ||
             (song.fakesLength && song.fakesLength.toLowerCase().includes(quality.toLowerCase()));
    });
    if (hasExcludedQuality) {
      return false;
    }
  }

  if (filters.availableLengths && filters.availableLengths.length > 0) {
    const hasAnyLength = filters.availableLengths.some((len: string) => {
      return song.available_length && song.available_length.toLowerCase().includes(len.toLowerCase());
    });
    if (!hasAnyLength) {
      return false;
    }
  }

  if (filters.excludedAvailableLengths && filters.excludedAvailableLengths.length > 0) {
    const hasExcludedLength = filters.excludedAvailableLengths.some((len: string) => {
      return song.available_length && song.available_length.toLowerCase().includes(len.toLowerCase());
    });
    if (hasExcludedLength) {
      return false;
    }
  }

  if (filters.durationValue && filters.durationValue.trim() !== '') {
    const songSeconds = parseDurationToSeconds(song.track_length);
    if (!songSeconds) return false;

    let targetSeconds = 0;
    if (!filters.durationValue.includes(':')) {
      const raw = Number(filters.durationValue);
      targetSeconds = !isNaN(raw) ? raw * 60 : 0;
    } else {
      targetSeconds = parseDurationToSeconds(filters.durationValue);
    }

    if (filters.durationOp === '>') {
      if (songSeconds <= targetSeconds) return false;
    } else if (filters.durationOp === '<') {
      if (songSeconds >= targetSeconds) return false;
    } else if (filters.durationOp === '=') {
      if (songSeconds !== targetSeconds) return false;
    }
  }

  if (filters.playableOnly) {
    const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
    const isNotAvailable = song.quality?.toLowerCase() === 'not available';
    if (!rawUrl || !(rawUrl.includes('pillows.su/f/') || rawUrl.includes('temp.imgur.gg/f/') || rawUrl.includes('krakenfiles.com/view/')) || isNotAvailable) {
      return false;
    }
  }

  if (filters.albums && filters.albums.length > 0) {
    const hasAnyAlbum = filters.albums.some((album: string) => {
      const songAlbum = song.extra2 || song.realEra?.name || song.extra;
      return songAlbum && songAlbum.toLowerCase() === album.toLowerCase();
    });
    if (!hasAnyAlbum) {
      return false;
    }
  }


  return true;
}
