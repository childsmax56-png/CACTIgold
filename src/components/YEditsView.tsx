import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Play, Volume2, Download, Loader2, FlipHorizontal2, Upload, X } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Song, Era } from '../types';

interface VGUser { id: string; username: string; email: string; }

const AUDIO_EXTS = /\.(mp3|m4a|wav|ogg|flac|aac)$/i;
const IMAGE_EXTS = /\.(png|jpe?g|gif|webp)$/i;
const BACK_COVER_FILE = /back\s*cover/i;

interface YEditsGroup {
  folderPath: string;
  displayName: string;
  parentName: string;
  imageUrl?: string;
  backCoverUrl?: string;
  songs: Song[];
}

function parseGroups(keys: string[]): YEditsGroup[] {
  const folderMap = new Map<string, { imageKey?: string; backCoverKey?: string; audioKeys: string[] }>();

  for (const key of keys) {
    const lastSlash = key.lastIndexOf('/');
    if (lastSlash === -1) continue;
    const folderPath = key.substring(0, lastSlash);
    const filename = key.substring(lastSlash + 1);
    if (!filename) continue;

    if (!folderMap.has(folderPath)) {
      folderMap.set(folderPath, { audioKeys: [] });
    }
    const entry = folderMap.get(folderPath)!;
    if (AUDIO_EXTS.test(filename)) {
      entry.audioKeys.push(key);
    } else if (IMAGE_EXTS.test(filename)) {
      if (BACK_COVER_FILE.test(filename)) {
        entry.backCoverKey = key;
      } else {
        entry.imageKey = key;
      }
    }
  }

  return Array.from(folderMap.entries())
    .filter(([, { audioKeys }]) => audioKeys.length > 0)
    .map(([folderPath, { imageKey, backCoverKey, audioKeys }]) => {
      const parts = folderPath.split('/');
      const displayName = parts[parts.length - 1].trim() || folderPath;
      const parentName = parts.length > 1 ? parts[0].trim() : '';
      const imageUrl = imageKey
        ? `/api/yedits-file?key=${encodeURIComponent(imageKey)}`
        : undefined;
      const backCoverUrl = backCoverKey
        ? `/api/yedits-file?key=${encodeURIComponent(backCoverKey)}`
        : undefined;
      const songs: Song[] = audioKeys.map(key => ({
        name: key.split('/').pop()!.replace(/\.[^.]+$/, ''),
        url: `/api/yedits-file?key=${encodeURIComponent(key)}`,
      }));
      return { folderPath, displayName, parentName, imageUrl, backCoverUrl, songs };
    });
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(interlude\)/gi, 'int')
    .replace(/\(intro\)/gi, 'intro')
    .replace(/\(outro\)/gi, 'outro')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function applyTracklistOrder(songs: Song[], tracklistText: string): Song[] {
  const lines = tracklistText
    .split('\n')
    .map(l => l.replace(/^\s*\d+[\.\)]\s*/, '').trim())
    .filter(Boolean);

  const remaining = [...songs];
  const ordered: Song[] = [];
  for (const line of lines) {
    const normLine = normalizeTitle(line);
    const colLine = collapseTitle(line);

    // 1. exact normalized match
    let idx = remaining.findIndex(s => normalizeTitle(s.name) === normLine);
    // 2. normalized substring match
    if (idx === -1) idx = remaining.findIndex(s => {
      const n = normalizeTitle(s.name);
      return n.includes(normLine) || normLine.includes(n);
    });
    // 3. collapsed match — handles apostrophe→space differences like "you're" vs "you re"
    if (idx === -1) idx = remaining.findIndex(s => {
      const c = collapseTitle(s.name);
      return c === colLine || c.includes(colLine) || colLine.includes(c);
    });

    if (idx !== -1) {
      const song = remaining.splice(idx, 1)[0];
      ordered.push({ ...song, name: line });
    }
  }
  return [...ordered, ...remaining];
}

interface YEditsViewProps {
  searchQuery: string;
  onPlaySong: (song: Song, era: Era, contextTracks: Song[]) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}

export function YEditsView({ searchQuery, onPlaySong, currentSong, isPlaying }: YEditsViewProps) {
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<YEditsGroup | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState(false);
  const [showBackCover, setShowBackCover] = useState(false);
  const [tracklistOverrides, setTracklistOverrides] = useState<Map<string, Song[]>>(new Map());

  const [vgUser, setVgUser] = useState<VGUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('vg_user') || 'null'); } catch { return null; }
  });
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCreator, setUploadCreator] = useState('');
  const [uploadAlbum, setUploadAlbum] = useState('');
  const [uploadCover, setUploadCover] = useState<File | null>(null);
  const [uploadTracks, setUploadTracks] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const tracksInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/yedits')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<string[]>; })
      .then(data => { setKeys(data); setLoading(false); })
      .catch(err => { setError(err.message ?? 'Failed to load'); setLoading(false); });
  }, []);

  useEffect(() => {
    const sync = () => {
      try { setVgUser(JSON.parse(localStorage.getItem('vg_user') || 'null')); } catch { setVgUser(null); }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('vg-synced', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('vg-synced', sync); };
  }, []);

  const openUpload = () => {
    setUploadCreator(vgUser?.username ?? '');
    setUploadAlbum('');
    setUploadCover(null);
    setUploadTracks([]);
    setUploadResult(null);
    setShowUpload(true);
  };

  const doUpload = async () => {
    const token = localStorage.getItem('vg_token');
    if (!token || !uploadCreator.trim() || !uploadAlbum.trim() || uploadTracks.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    const fd = new FormData();
    fd.append('token', token);
    fd.append('creator', uploadCreator.trim());
    fd.append('album', uploadAlbum.trim());
    if (uploadCover) fd.append('cover', uploadCover);
    for (const t of uploadTracks) fd.append('tracks', t);
    try {
      const res = await fetch('/api/yedits-upload', { method: 'POST', body: fd });
      const data = await res.json() as { uploaded?: string[]; error?: string };
      if (!res.ok) {
        setUploadResult({ ok: false, msg: data.error ?? 'Upload failed' });
      } else {
        setUploadResult({ ok: true, msg: `Uploaded ${data.uploaded?.length ?? 0} file(s)!` });
        fetch('/api/yedits', { cache: 'no-store' })
          .then(r => r.json() as Promise<string[]>)
          .then(d => setKeys(d))
          .catch(() => {});
      }
    } catch {
      setUploadResult({ ok: false, msg: 'Network error' });
    } finally {
      setUploading(false);
    }
  };

  const groups = useMemo(() => parseGroups(keys), [keys]);

  useEffect(() => {
    fetch('/api/yedits-tracklists')
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Record<string, string>>; })
      .then(data => {
        const groupsBySongKey = new Map(groups.map(g => [g.folderPath, g.songs]));
        const map = new Map<string, Song[]>();
        for (const [folderPath, text] of Object.entries(data)) {
          const songs = groupsBySongKey.get(folderPath);
          if (songs) map.set(folderPath, applyTracklistOrder(songs, text));
        }
        setTracklistOverrides(map);
      })
      .catch(() => {});
  }, [groups]);

  const creators = useMemo(() => {
    const map = new Map<string, { albumCount: number; previewImage?: string }>();
    for (const g of groups) {
      if (!g.parentName) continue;
      const existing = map.get(g.parentName);
      map.set(g.parentName, {
        albumCount: (existing?.albumCount ?? 0) + 1,
        previewImage: existing?.previewImage ?? g.imageUrl,
      });
    }
    return Array.from(map.entries()).map(([name, info]) => ({ name, ...info }));
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const byCreator = selectedCreator
      ? groups.filter(g => g.parentName === selectedCreator)
      : groups;
    if (!searchQuery.trim()) return byCreator;
    const q = searchQuery.toLowerCase();
    return byCreator.filter(g =>
      g.displayName.toLowerCase().includes(q) || g.parentName.toLowerCase().includes(q)
    );
  }, [groups, selectedCreator, searchQuery]);

  const filteredSongs = useMemo(() => {
    if (!selectedGroup) return [];
    const songs = tracklistOverrides.get(selectedGroup.folderPath) ?? selectedGroup.songs;
    if (!searchQuery.trim()) return songs;
    const q = searchQuery.toLowerCase();
    return songs.filter(s => s.name.toLowerCase().includes(q));
  }, [selectedGroup, searchQuery, tracklistOverrides]);

  if (loading) {
    return (
      <motion.div key="yedits-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex items-center justify-center h-64 text-white/40">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        <span className="text-sm">Loading yedits…</span>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div key="yedits-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex items-center justify-center h-64 text-white/40 text-sm">
        Failed to load: {error}
      </motion.div>
    );
  }

  // DETAIL VIEW
  if (selectedGroup) {
    const orderedSongs = tracklistOverrides.get(selectedGroup.folderPath) ?? selectedGroup.songs;
    const era: Era = {
      name: selectedGroup.displayName,
      image: selectedGroup.imageUrl,
      data: { Yedits: orderedSongs },
    };
    const activeCoverUrl = showBackCover ? selectedGroup.backCoverUrl : selectedGroup.imageUrl;
    const hasBackCover = !!selectedGroup.backCoverUrl;

    return (
      <>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {zoomedImage && activeCoverUrl && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setZoomedImage(false)}
                className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
              >
                <img src={activeCoverUrl} alt={selectedGroup.displayName}
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-md" />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        <motion.div
          key={`yedits-detail-${selectedGroup.folderPath}`}
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-0 z-10 bg-[#0a0a0a] overflow-y-auto pb-64"
        >
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5 bg-white/5">
            <button
              onClick={() => { setSelectedGroup(null); setZoomedImage(false); setShowBackCover(false); }}
              className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="relative shrink-0">
              <div
                className={`w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shadow-xl ${activeCoverUrl ? 'cursor-pointer' : ''}`}
                onClick={() => { if (activeCoverUrl) setZoomedImage(true); }}
                title={activeCoverUrl ? 'Click to zoom' : undefined}
              >
                {activeCoverUrl ? (
                  <img src={activeCoverUrl} alt={selectedGroup.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/20 text-center p-4">
                    {selectedGroup.displayName}
                  </div>
                )}
              </div>
              {hasBackCover && (
                <button
                  onClick={() => setShowBackCover(v => !v)}
                  className="absolute bottom-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white/70 hover:text-white transition-colors backdrop-blur-sm"
                  title={showBackCover ? 'Show front cover' : 'Show back cover'}
                >
                  <FlipHorizontal2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-col justify-end h-full py-2">
              {selectedGroup.parentName && (
                <p className="text-[var(--theme-color)] text-sm font-semibold uppercase tracking-widest mb-2">
                  {selectedGroup.parentName}
                </p>
              )}
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                {selectedGroup.displayName}
              </h1>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[var(--theme-color)]/10 text-[var(--theme-color)] border border-[var(--theme-color)]/20">
                  Yedit Affiliates
                </span>
                <p className="text-white/40 text-sm">
                  {selectedGroup.songs.length} track{selectedGroup.songs.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 md:px-8 mt-8 max-w-6xl mx-auto">
            <div className="flex flex-col">
              <div className="hidden sm:flex items-center px-4 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/5 mb-2">
                <div className="w-8">#</div>
                <div className="flex-1">Title</div>
                <div className="w-10"></div>
              </div>

              {filteredSongs.map((song, i) => {
                const isCurrentSong = currentSong?.url === song.url;
                const isCurrentPlaying = isCurrentSong && isPlaying;
                return (
                  <div
                    key={song.url}
                    onClick={() => onPlaySong(song, era, filteredSongs)}
                    className={`group flex items-center px-4 py-2.5 rounded-md transition-colors cursor-pointer hover:bg-white/5 ${isCurrentSong ? 'bg-white/5' : ''}`}
                  >
                    <div className={`w-8 text-sm font-mono flex items-center ${isCurrentSong ? 'text-[var(--theme-color)]' : 'text-white/40 group-hover:text-white'}`}>
                      <span className="group-hover:hidden">
                        {isCurrentSong
                          ? <Volume2 className={`w-4 h-4 ${isCurrentPlaying ? 'animate-pulse' : ''}`} />
                          : (i + 1)}
                      </span>
                      <Play className="w-4 h-4 hidden group-hover:block" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className={`font-medium truncate ${isCurrentSong ? 'text-[var(--theme-color)]' : 'text-white'}`}>
                        {song.name}
                      </div>
                    </div>

                    <a
                      href={song.url}
                      download
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white/80"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  // GRID VIEW
  return (
    <motion.div
      key="yedits-grid"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="p-6 md:p-8 pb-32 space-y-8"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold">Yedit Affiliates</h2>
        {vgUser && (
          <button
            onClick={openUpload}
            className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg bg-[var(--theme-color)]/10 hover:bg-[var(--theme-color)]/20 text-[var(--theme-color)] border border-[var(--theme-color)]/20 transition-colors cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            Upload
          </button>
        )}
      </div>

      {/* Creators section */}
      {creators.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-4">Creators</h2>
          <div className="flex flex-wrap gap-3">
            {creators.map((creator, i) => {
              const isActive = selectedCreator === creator.name;
              return (
                <motion.button
                  key={creator.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedCreator(isActive ? null : creator.name)}
                  className={`flex items-center gap-3 pl-1 pr-4 py-1 rounded-full border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--theme-color)]/15 border-[var(--theme-color)]/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {creator.previewImage ? (
                      <img src={creator.previewImage} alt={creator.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/30">
                        {creator.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <div className={`text-sm font-semibold leading-tight ${isActive ? 'text-[var(--theme-color)]' : ''}`}>
                      {creator.name}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {creator.albumCount} album{creator.albumCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Albums grid */}
      <div>
        {selectedCreator && (
          <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-4">{selectedCreator}</h2>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {filteredGroups.length === 0 ? (
        <div className="col-span-full text-center text-white/30 text-sm py-20">
          {groups.length === 0 ? 'No content in bucket yet.' : 'No results for that search.'}
        </div>
      ) : (
        filteredGroups.map((group, i) => (
          <motion.div
            key={group.folderPath}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
            onClick={() => setSelectedGroup(group)}
            className="group flex flex-col gap-3 cursor-pointer"
          >
            <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
              {group.imageUrl ? (
                <img
                  src={group.imageUrl}
                  alt={group.displayName}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 font-bold text-xl text-center p-4">
                  {group.displayName}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:underline truncate">
                {group.displayName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {group.parentName && (
                  <p className="text-white/50 text-xs truncate">{group.parentName}</p>
                )}
                <p className="text-white/30 text-xs shrink-0">{group.songs.length} tracks</p>
              </div>
            </div>
          </motion.div>
        ))
      )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => { if (!uploading) setShowUpload(false); }}
        >
          <div
            className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Upload to Yedit Affiliates</h3>
              <button
                onClick={() => { if (!uploading) setShowUpload(false); }}
                className="text-white/40 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Creator Name</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="Your name / handle"
                  value={uploadCreator}
                  onChange={e => setUploadCreator(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">Project / Album Name</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="Name of your yedit project"
                  value={uploadAlbum}
                  onChange={e => setUploadAlbum(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">Cover Art <span className="text-white/20">(optional)</span></label>
                <div
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-white/8 transition-colors flex items-center gap-2"
                  onClick={() => !uploading && coverInputRef.current?.click()}
                >
                  {uploadCover
                    ? <span className="text-white/80 truncate">{uploadCover.name}</span>
                    : <span className="text-white/40">Choose image…</span>}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setUploadCover(e.target.files?.[0] ?? null)}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  Tracks <span className="text-white/20">(audio files, multiple allowed)</span>
                </label>
                <div
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-white/8 transition-colors"
                  onClick={() => !uploading && tracksInputRef.current?.click()}
                >
                  {uploadTracks.length > 0
                    ? <span className="text-white/80">{uploadTracks.length} file{uploadTracks.length !== 1 ? 's' : ''} selected</span>
                    : <span className="text-white/40">Choose audio files…</span>}
                </div>
                <input
                  ref={tracksInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={e => setUploadTracks(e.target.files ? Array.from(e.target.files) : [])}
                />
              </div>

              {uploadResult && (
                <p className={`text-xs text-center ${uploadResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {uploadResult.msg}
                </p>
              )}

              <button
                onClick={doUpload}
                disabled={uploading || !uploadCreator.trim() || !uploadAlbum.trim() || uploadTracks.length === 0}
                className="w-full py-2.5 rounded-lg bg-[var(--theme-color)] text-black text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              >
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                  : <><Upload className="w-3.5 h-3.5" /> Upload</>}
              </button>

              <p className="text-[10px] text-white/20 text-center">
                Uploads are public and visible to all users. Only share content you have permission to upload.
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}
