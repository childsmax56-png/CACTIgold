import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { XCircle, ChevronUp, X } from 'lucide-react';
import axios from 'axios';
import { Navbar, Category } from './components/Navbar';
import { EraGrid } from './components/EraGrid';
import { EraDetail, findMvsForSong, findRemixesForSong, findSamplesForSong } from './components/EraDetail';
import { PlayerBar } from './components/PlayerBar';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { ArtGallery, ArtEntry } from './components/ArtGallery';
import { StemsView, StemEntry } from './components/StemsView';
import { MiscView, MiscEntry } from './components/MiscView';
import { TracklistsView, TracklistAlbum } from './components/TracklistsView';
import { QueueModal } from './components/QueueModal';
import { handleShareSilent } from './components/EraDetail';

import { TrackerData, Era, Song, SearchFilters } from './types';
import { matchesFilters, createSlug, getSongSlug, getCleanSongNameWithTags, isSongNotAvailable, formatTextForNotification, CUSTOM_IMAGES, HIDDEN_ALBUMS, ALBUM_RELEASE_DATES, getArtistName, buildArtistTag, handleDownloadFile } from './utils';
import { isLastfmLoggedIn, saveLastfmSession, clearLastfmSession, scrobbleTrack, updateNowPlaying, cleanTrackName, parseArtistFromSong, cleanAlbumName } from './lastfm';
import { isSpotifyLoggedIn, clearSpotifySession, startSpotifyAuth, handleSpotifyCallback } from './spotify';
import { useSpotify, SpotifyTrack } from './useSpotify';
import { useYoutube } from './useYoutube';
import { useSoundCloud } from './useSoundCloud';

const CUSTOM_ALBUM_INFO: Record<string, string[]> = {};

function parseCSVText(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { current.push(field); field = ''; }
      else if (ch === '\n') { current.push(field); field = ''; rows.push(current); current = []; }
      else if (ch !== '\r') { field += ch; }
    }
  }
  if (field || current.length > 0) { current.push(field); rows.push(current); }
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter(row => row.some(cell => cell.trim() !== ''))
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => { obj[header] = row[i] ?? ''; });
      return obj;
    });
}

export interface MvEntry {
  Era: string;
  Name: string;
  Notes: string;
  Length: string;
  Type: string;
  "Available Length": string;
  Quality: string;
  "Link(s)": string;
}

export interface RemixEntry {
  Era: string;
  Name: string;
  Notes: string;
  "Artist(s)": string;
  "Available Length": string;
  Quality: string;
  "Link(s)": string;
}

export interface SampleEntry {
  Era?: string;
  Name?: string;
  "Song Name\n(Special thanks to Isak & Jeen for their invaluable help on this page)"?: string;
  "Sample\n(Artist - Track)"?: string;
  Notes?: string;
  "Link(s)"?: string;
}

export interface FakesEntry {
  Era: string;
  Name: string;
  Notes?: string;
  "Made By"?: string;
  Type?: string;
  FeatureExtra?: string;
  "Available Length"?: string;
  "Link(s)"?: string;
}

import { SettingsView } from './components/SettingsView';
import { HistoryView } from './components/HistoryView';
import { FakesView } from './components/FakesView';
import { CompsView } from './components/CompsView';
import { YEditsView } from './components/YEditsView';
import { ReleasedView, ReleasedEntry } from './components/ReleasedView';
import { VideosView, VideoRawEntry } from './components/VideosView';
import { SubAlbumsView, SubAlbumEntry } from './components/SubAlbumsView';
import { ChatBubble } from './components/ChatBubble';
import { PlaylistsView } from './components/PlaylistsView';
import { ImportPlaylistModal } from './components/ImportPlaylistModal';
import { useSettings, LOADING_SCREENS, LoadingScreenId } from './SettingsContext';
import { PlaylistProvider } from './PlaylistContext';
import { recordListeningHistory } from './history';

const ERA_MAPPINGS: Record<string, string> = {
  "Turbo Grafix 16": "Turbo Grafx 16",
};

export default function App() {
  const { settings } = useSettings();
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFading, setLoadingFading] = useState(false);
  const [gifReady, setGifReady] = useState(false);
  const [resolvedShuffleScreenId] = useState<LoadingScreenId | null>(() => {
    if (settings.loadingScreen === 'shuffle') {
      const eligible = LOADING_SCREENS.filter(s => s.type !== 'none');
      if (eligible.length > 0) return eligible[Math.floor(Math.random() * eligible.length)].id;
    }
    return null;
  });
  const [showChangelog, setShowChangelog] = useState(false);
  const [showSafariWarning, setShowSafariWarning] = useState(false);
  const [mvData, setMvData] = useState<MvEntry[]>([]);
  const [remixData, setRemixData] = useState<RemixEntry[]>([]);
  const [samplesData, setSamplesData] = useState<SampleEntry[]>([]);
  const [artData, setArtData] = useState<ArtEntry[]>([]);
  const [recentData, setRecentData] = useState<Song[]>([]);
  const [stemsData, setStemsData] = useState<StemEntry[]>([]);
  const [miscData, setMiscData] = useState<MiscEntry[]>([]);
  const [fakesData, setFakesData] = useState<FakesEntry[]>([]);
  const [tracklistsData, setTracklistsData] = useState<TracklistAlbum[]>([]);
  const [releasedData, setReleasedData] = useState<ReleasedEntry[]>([]);
  const [videosData, setVideosData] = useState<VideoRawEntry[]>([]);
  const [subAlbumsData, setSubAlbumsData] = useState<SubAlbumEntry[]>([]);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [popupUrl, setPopupUrl] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [pendingImport, setPendingImport] = useState<{ name: string; cover?: string; songs: { songName: string; eraName: string; url: string }[] } | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('playlist');
      if (!raw) return null;
      return JSON.parse(decodeURIComponent(atob(raw)));
    } catch {
      return null;
    }
  });

  const [activeCategory, setActiveCategory] = useState<Category>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/art')) return 'art';
    if (path.startsWith('/stems')) return 'stems';
    if (path.startsWith('/misc')) return 'misc';
    if (path.startsWith('/fakes')) return 'fakes';
    if (path.startsWith('/released')) return 'released';
    if (path.startsWith('/related')) return 'related';
    if (path.startsWith('/recent')) return 'recent';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/history')) return 'history';
    if (path.startsWith('/tracklists')) return 'tracklists';
    if (path.startsWith('/videos')) return 'videos';
    if (path.startsWith('/comps')) return 'comps';
    if (path.startsWith('/yedits')) return 'yedits';
    if (path.startsWith('/subalbums')) return 'subalbums';
    return 'music';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    tags: [],
    excludedTags: [],
    qualities: [],
    excludedQualities: [],
    availableLengths: [],
    excludedAvailableLengths: [],
    durationOp: '>',
    durationValue: '',
    playableOnly: false,
    hasClips: null,
    hasRemixes: null,
    hasSamples: null
  });

  useEffect(() => {
    if (!loading) {
      const effectiveId = settings.loadingScreen === 'shuffle' ? (resolvedShuffleScreenId ?? 'none') : settings.loadingScreen;
      const screen = LOADING_SCREENS.find(s => s.id === effectiveId);
      if (screen?.type === 'gif' && !gifReady) {
        const t = setTimeout(() => {
          setLoadingFading(true);
          setTimeout(() => setLoadingFading(false), 700);
        }, 6000);
        return () => clearTimeout(t);
      }
      setLoadingFading(true);
      const t = setTimeout(() => setLoadingFading(false), 700);
      return () => clearTimeout(t);
    }
  }, [loading, gifReady, settings.loadingScreen]);

  useEffect(() => {
    setFilters({
      tags: [],
      excludedTags: [],
      qualities: [],
      excludedQualities: [],
      availableLengths: [],
      excludedAvailableLengths: [],
      durationOp: '>',
      durationValue: '',
      playableOnly: false,
      hasClips: null,
      hasRemixes: null,
      hasSamples: null
    });
  }, [activeCategory]);

  const [selectedAlbum, setSelectedAlbum] = useState<Era | null>(null);

  const [currentEra, setCurrentEra] = useState<Era | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPlayerClosed, setIsPlayerClosed] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLastfmErrorModal, setShowLastfmErrorModal] = useState(false);

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [isShuffle, setIsShuffle] = useState(settings.startupShuffle);
  const [shuffledQueue, setShuffledQueue] = useState<number[]>([]);
  const [loopMode, setLoopMode] = useState(settings.startupLoop || 0);
  const [hasLoopedOnce, setHasLoopedOnce] = useState(false);

  const [favoriteKeys, setFavoriteKeys] = useState<{ songName: string, eraName: string, url: string, song?: Song }[]>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('yzygold_favorite_keys');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('yzygold_favorite_keys', JSON.stringify(favoriteKeys));
    }
  }, [favoriteKeys]);

  const [showDiscordModal, setShowDiscordModal] = useState(false);

  useEffect(() => {
    const handleShowDiscord = () => setShowDiscordModal(true);
    window.addEventListener('show-discord-rpc-modal', handleShowDiscord);
    return () => window.removeEventListener('show-discord-rpc-modal', handleShowDiscord);
  }, []);

  const toggleFavorite = (song: Song, eraName: string) => {
    const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
    const cleanSong = { ...song };
    delete cleanSong.realEra;
    
    setFavoriteKeys(prev => {
      const exists = prev.some(k => k.songName === song.name && k.url === rawUrl);
      if (exists) {
        return prev.filter(k => !(k.songName === song.name && k.url === rawUrl));
      } else {
        return [...prev, { songName: song.name, eraName: eraName, url: rawUrl, song: cleanSong }];
      }
    });
  };

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (settings.startVolume !== null && settings.startVolume !== undefined) {
      return settings.startVolume / 100;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('yzygold_playback_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1) {
            return parsed.volume;
          }
        }
      } catch (e) {}
    }
    return 1;
  });

  const timeToRestoreRef = useRef<number | null>(null);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (settings.globalFontSize === 'small') {
      document.documentElement.style.fontSize = '14px';
    } else if (settings.globalFontSize === 'large') {
      document.documentElement.style.fontSize = '18px';
    } else {
      document.documentElement.style.fontSize = '16px';
    }
  }, [settings.globalFontSize]);

  useEffect(() => {
    document.documentElement.style.setProperty('--theme-color', settings.themeColor);
  }, [settings.themeColor]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined' && currentSong && currentEra) {
      const stateToSave = {
        song: { name: currentSong.name, url: currentSong.url || (currentSong.urls && currentSong.urls[0]) || '' },
        eraName: currentEra.name,
        volume: volume,
        currentTime: currentTime
      };
      localStorage.setItem('yzygold_playback_state', JSON.stringify(stateToSave));
    }
  }, [currentSong, currentEra, volume, currentTime]);

  useEffect(() => {
    if (data && recentData.length > 0 && !initialLoadRef.current) {
      initialLoadRef.current = true;
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('yzygold_playback_state');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const savedSong = parsed.song;
            const savedEraName = parsed.eraName;

            if (savedSong && savedEraName) {
              const erasValues = Object.values(data.eras || {}) as Era[];
              let eraToRestore: Era | null = erasValues.find(e => e.name === savedEraName) || null;

              if (!eraToRestore && savedEraName === 'Recent Leaks') {
                eraToRestore = {
                  name: "Recent Leaks",
                  image: "https://i.ibb.co/7xRv4H2r/sdffsdsdf.png",
                  data: {
                    "Latest Additions": recentData.map(song => {
                      const eraName = song.extra2 || song.extra;
                      const realEra = erasValues.find(e => e.name === eraName);
                      return {
                        ...song,
                        image: CUSTOM_IMAGES[realEra?.name || ''] || realEra?.image,
                        realEra
                      };
                    })
                  }
                };
              }

              if (eraToRestore) {
                const allSongs = Object.values(eraToRestore.data || {}).flat();
                const songToRestore = allSongs.find((s: any) => s.name === savedSong.name && (s.url || (s.urls && s.urls[0]) || '') === savedSong.url);
                if (songToRestore) {
                  timeToRestoreRef.current = parsed.currentTime || 0;
                  handlePlaySong(songToRestore as Song, eraToRestore as Era, undefined, false, false);
                }
              } else if (savedEraName === 'Favorites') {
                const savedFavs = localStorage.getItem('yzygold_favorite_keys');
                if (savedFavs) {
                   const favKeys = JSON.parse(savedFavs);
                   const favEra = {
                      name: "Favorites",
                      image: "https://i.ibb.co/JFnmJ8rX/image.png",
                      data: {
                        "Favorite Tracks": favKeys.map((k: any) => {
                          let realEra = erasValues.find(e => e.name === k.eraName);
                          if (!realEra && k.eraName === 'Recent Leaks') {
                              realEra = { name: "Recent Leaks", image: "https://i.ibb.co/7xRv4H2r/sdffsdsdf.png", data: { "Latest Additions": recentData } };
                          }
                          let foundSong: Song | null = null;
                          if (realEra && realEra.data) {
                             const allC = Object.values(realEra.data).flat();
                             foundSong = allC.find((s: any) => s.name === k.songName && (s.url || (s.urls && s.urls[0] || '')) === k.url) as Song;
                          }
                          if (!foundSong && k.eraName === 'Recent Leaks') {
                             foundSong = recentData.find(s => s.name === k.songName && (s.url || (s.urls && s.urls[0] || '')) === k.url) as Song;
                          }
                          if (foundSong && realEra) {
                             const actualRealEra = (realEra.name === 'Recent Leaks' ? Object.values(data?.eras || {}).find((e: any) => e.name === foundSong!.extra) : realEra) as Era;
                             const rawEraName = foundSong.extra2 || foundSong.extra;
                             const cleanEraName = rawEraName ? getCleanSongNameWithTags(rawEraName) : '';
                             const actualRealEraNameSearch = actualRealEra?.name || '';
                             return { ...foundSong, realEra: actualRealEra, image: CUSTOM_IMAGES[rawEraName || ''] || CUSTOM_IMAGES[cleanEraName || ''] || CUSTOM_IMAGES[actualRealEraNameSearch || ''] || actualRealEra?.image || foundSong.image };
                          }
                          return null;
                        }).filter((s: any) => s !== null)
                      }
                   };
                   const s = Object.values(favEra.data)[0].find((s: any) => s.name === savedSong.name && (s.url || (s.urls && s.urls[0]) || '') === savedSong.url);
                   if (s) {
                     timeToRestoreRef.current = parsed.currentTime || 0;
                     handlePlaySong(s as Song, favEra as Era, undefined, false, false);
                   }
                }
              }
            }
          } catch(e) {}
        }
      }
    }
  }, [data, recentData]);

  const [lastfmLoggedIn, setLastfmLoggedIn] = useState(isLastfmLoggedIn());
  const [yeiOpen, setYeiOpen] = useState(false);
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState(isSpotifyLoggedIn());
  const [activePlayer, setActivePlayer] = useState<'audio' | 'spotify' | 'youtube' | 'soundcloud'>('audio');
  const { state: spotifyState, controls: spotifyControls } = useSpotify(spotifyLoggedIn);
  const { state: youtubeState, controls: youtubeControls } = useYoutube();
  const { state: soundcloudState, controls: soundcloudControls } = useSoundCloud();
  const scrobbledRef = useRef(false);
  const songStartTimeRef = useRef<number>(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (window.location.search.includes('code=')) {
      handleSpotifyCallback().then(ok => {
        if (ok) setSpotifyLoggedIn(true);
      });
    }
  }, []);

  // Re-read auth state when VaultGold syncs credentials into localStorage
  // Force useSpotify to fully reinitialize by toggling enabled false→true
  useEffect(() => {
    const handleVgSync = () => {
      setLastfmLoggedIn(isLastfmLoggedIn());
      // Toggle Spotify off then on so useSpotify disconnects old player and reinits with new token
      setSpotifyLoggedIn(false);
      setTimeout(() => setSpotifyLoggedIn(isSpotifyLoggedIn()), 100);
    };
    window.addEventListener('vg-synced', handleVgSync);
    return () => window.removeEventListener('vg-synced', handleVgSync);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vgToken = params.get('vg_token');
    const vgUserRaw = params.get('vg_user');
    if (!vgToken || !vgUserRaw) return;
    window.history.replaceState({}, '', window.location.pathname);
    try {
      const vgUser = JSON.parse(decodeURIComponent(vgUserRaw));
      if (window.opener) {
        window.opener.postMessage({ vaultgold: 'signed_in', token: vgToken, user: vgUser }, '*');
        window.close();
      } else {
        localStorage.setItem('vg_token', vgToken);
        localStorage.setItem('vg_user', JSON.stringify(vgUser));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vgToken = params.get('vg_token');
    const vgUserRaw = params.get('vg_user');
    if (!vgToken || !vgUserRaw) return;
    window.history.replaceState({}, '', window.location.pathname);
    try {
      const vgUser = JSON.parse(decodeURIComponent(vgUserRaw));
      if (window.opener) {
        window.opener.postMessage({ vaultgold: 'signed_in', token: vgToken, user: vgUser }, '*');
        window.close();
      } else {
        localStorage.setItem('vg_token', vgToken);
        localStorage.setItem('vg_user', JSON.stringify(vgUser));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (spotifyState.error) showToast(spotifyState.error);
  }, [spotifyState.error]);

  useEffect(() => {
    const initAudio = () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (!audioContextRef.current && audioRef.current && !isIOS) {
        const windowAny = window as any;
        const AudioContext = window.AudioContext || windowAny.webkitAudioContext;
        if (!AudioContext) return;

        try {
          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;

          const source = ctx.createMediaElementSource(audioRef.current);
          source.connect(analyser);
          analyser.connect(ctx.destination);

          audioContextRef.current = ctx;
          analyserRef.current = analyser;
        } catch (e) {
          console.error("Failed to initialize AudioContext", e);
        }
      }
    };

    document.addEventListener('click', initAudio, { once: true });

    return () => {
      document.removeEventListener('click', initAudio);
    };
  }, []);

  function getSheetCsvExportUrl(sheetUrl: string): string | null {
    const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) return null;
    const sheetId = idMatch[1];
    const gidMatch = sheetUrl.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : null;
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  }

  function applyLocalSongs(targetJson: any, localData: any) {
    if (!Array.isArray(localData)) return;
    localData.forEach((item: any) => {
      const originalEraName = item.Era;
      if (!originalEraName) return;
      const matchedMapKey = Object.keys(ERA_MAPPINGS).find(k => k.toLowerCase() === originalEraName.toLowerCase());
      const eraName = matchedMapKey ? ERA_MAPPINGS[matchedMapKey] : originalEraName;
      if (!targetJson.eras?.[eraName]) {
        if (!HIDDEN_ALBUMS.includes(eraName)) return;
        if (!targetJson.eras) targetJson.eras = {};
        targetJson.eras[eraName] = { name: eraName, data: {} };
      }

      let rawUrl = item['Link(s)'] || '';
      const linkMatch = rawUrl.match(/\]\((.*?)\)/);
      if (linkMatch?.[1]) rawUrl = linkMatch[1];

      const newSong: Song = {
        name: item.Name,
        extra: item.extra || item.Extra || undefined,
        description: item.Notes || '',
        track_length: item['Track Length'] || '',
        leak_date: item['Leak Date'] || '',
        file_date: item['File Date'] || '',
        available_length: item['Available Length'] || '',
        quality: item.Quality || '',
        url: rawUrl,
        urls: [rawUrl]
      };

      const categories = targetJson.eras[eraName].data || {};
      const belowName = (item.Below || '').trim();
      const targetCategory = item.Category;

      // Try to insert below a specific song
      if (belowName) {
        for (const cat of Object.keys(categories)) {
          const list = categories[cat] as Song[];
          const idx = list.findIndex(s => s.name?.trim() === belowName || s.name?.includes(belowName));
          if (idx !== -1) {
            list.splice(idx + 1, 0, newSong);
            return;
          }
        }
      }

      // No Below match — append to target category or first available category
      const catKey = targetCategory || Object.keys(categories)[0];
      if (catKey) {
        if (!categories[catKey]) categories[catKey] = [];
        (categories[catKey] as Song[]).push(newSong);
      }
    });
  }

  function applyTrackerSheetSongs(targetJson: any, sheetData: any) {
    if (!Array.isArray(sheetData)) return;

    // Find the actual name key (header is "Name\n(Join The Discord!)")
    const nameKey = sheetData.length > 0
      ? Object.keys(sheetData[0]).find(k => k.startsWith('Name')) || 'Name'
      : 'Name';

    const avLenToCategory = (avLen: string, categories: Record<string, Song[]>): string => {
      const al = avLen.toLowerCase().trim();
      const keys = Object.keys(categories);
      const find = (term: string) => keys.find(k => k.toLowerCase().includes(term));
      if (al === 'og file' || al === 'og files') return find('og') || find('full') || keys[0];
      if (al === 'full') return find('full') || keys[0];
      if (al === 'tagged') return find('tagged') || keys[0];
      if (al === 'partial') return find('partial') || keys[0];
      if (al.includes('snippet')) return find('snippet') || keys[0];
      if (al.includes('stem') || al.includes('bounce')) return find('stem') || find('bounce') || keys[0];
      if (al === 'beat only') return find('beat') || find('full') || keys[0];
      if (al === 'confirmed' || al === 'unavailable' || al === '') return find('unavailable') || find('confirmed') || keys[keys.length - 1];
      return keys[0];
    };

    sheetData.forEach((item: any) => {
      const rawEra = (item.Era || '').trim();
      // Skip era header rows (file count summaries) — their Era cell is multiline
      if (!rawEra || rawEra.includes('\n')) return;

      const matchedMapKey = Object.keys(ERA_MAPPINGS).find(k => k.toLowerCase() === rawEra.toLowerCase());
      const eraName = matchedMapKey ? ERA_MAPPINGS[matchedMapKey] : rawEra;
      if (!targetJson.eras?.[eraName]) return;

      const rawName = (item[nameKey] || '').trim();
      const nameLines = rawName.split('\n');
      const songName = nameLines[0].trim();
      const extra = nameLines.slice(1).join('\n').trim() || undefined;
      if (!songName) return;

      let rawUrl = (item['Link(s)'] || '').trim();
      const linkMatch = rawUrl.match(/\]\((.*?)\)/);
      if (linkMatch?.[1]) rawUrl = linkMatch[1];

      const newSong: Song = {
        name: songName,
        extra,
        description: item.Notes || '',
        track_length: item['Track Length'] || '',
        leak_date: item['Leak\nDate'] || item['Leak Date'] || '',
        file_date: item['File\nDate'] || item['File Date'] || '',
        available_length: item['Available Length'] || '',
        quality: item.Quality || '',
        url: rawUrl,
        urls: rawUrl ? [rawUrl] : [],
      };

      const categories = targetJson.eras[eraName].data || {};

      // Skip if a song with the same name and credits already exists in the era
      const nameNorm = songName.toLowerCase().trim();
      const extraNorm = (extra || '').toLowerCase().trim();
      const alreadyExists = Object.values(categories).some((list: any) =>
        (list as Song[]).some(s =>
          s.name?.toLowerCase().trim() === nameNorm &&
          (s.extra || '').toLowerCase().trim() === extraNorm
        )
      );
      if (alreadyExists) return;

      const catKey = avLenToCategory(item['Available Length'] || '', categories);
      if (catKey) {
        if (!categories[catKey]) categories[catKey] = [];
        (categories[catKey] as Song[]).push(newSong);
      }
    });
  }

  const HARDCODED_SHEET_ID = '12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM';
  const HARDCODED_SHEET_GID = '1385926980'; // Recent tab

  useEffect(() => {
    const sheetCsvUrl = getSheetCsvExportUrl(
      settings.googleSheetsUrl || `https://docs.google.com/spreadsheets/d/${HARDCODED_SHEET_ID}/edit#gid=${HARDCODED_SHEET_GID}`
    );
    const recentTabCsvUrl = `https://docs.google.com/spreadsheets/d/${HARDCODED_SHEET_ID}/export?format=csv&gid=${HARDCODED_SHEET_GID}`;

    const FETCH_TIMEOUT = 20000;
    Promise.all([
      axios.get('/api/a', { timeout: FETCH_TIMEOUT }),
      Promise.resolve({ data: [] }),
      axios.get('/local-songs.json', { timeout: FETCH_TIMEOUT }).catch(err => {
        console.error("Failed to fetch local songs", err);
        return { data: [] };
      }),
      axios.get(`/api/sheets-proxy?url=${encodeURIComponent(sheetCsvUrl!)}`, { timeout: FETCH_TIMEOUT }).catch(err => {
        console.error("Failed to fetch Google Sheets data", err);
        return { data: [] };
      }),
      axios.get('/api/recent', { timeout: FETCH_TIMEOUT }).catch(err => {
        console.error("Failed to fetch Recent data:", err);
        return { data: [] };
      }),
      axios.get(`/api/sheets-proxy?url=${encodeURIComponent(recentTabCsvUrl)}`, { timeout: FETCH_TIMEOUT }).catch(err => {
        console.error("Failed to fetch Recent tab data", err);
        return { data: [] };
      }),
    ])
      .then(([mainRes, mykRes, localRes, sheetsRes, recentRes, recentTabRes]) => {
        const rawJson = mainRes.data;
        const json = JSON.parse(JSON.stringify(rawJson));

        // Rebuild each category object in the same key-insertion order so that
        // renaming an era (e.g. "TurboGrafx 16" → "Turbo Grafx 16") does NOT
        // move it to the end of the object and break the display order.
        const categoriesToNormalize = ['eras', 'art', 'misc', 'stems', 'fakes', 'reference_track'];
        categoriesToNormalize.forEach(category => {
          if (!json[category]) return;
          const rebuilt: Record<string, any> = {};
          Object.keys(json[category]).forEach(key => {
            const matchedMapKey = Object.keys(ERA_MAPPINGS).find(k => k.toLowerCase() === key.toLowerCase());
            const mappedKey = matchedMapKey ? ERA_MAPPINGS[matchedMapKey] : key;
            const isRename = mappedKey !== key;
            const value = json[category][key];

            if (!rebuilt[mappedKey]) {
              rebuilt[mappedKey] = (isRename && category === 'eras')
                ? { ...value, name: mappedKey }
                : value;
            } else {
              if (Array.isArray(rebuilt[mappedKey])) {
                rebuilt[mappedKey] = rebuilt[mappedKey].concat(value);
              } else {
                const existing = rebuilt[mappedKey];
                rebuilt[mappedKey] = {
                  ...existing,
                  ...value,
                  image: existing.image || value.image,
                  extra: existing.extra || value.extra,
                  data: { ...existing.data, ...value.data }
                };
                if (isRename && category === 'eras') {
                  rebuilt[mappedKey].name = mappedKey;
                }
              }
            }
          });
          json[category] = rebuilt;
        });

        const mykData = mykRes.data;

        if (Array.isArray(mykData)) {
          const nextJson = JSON.parse(JSON.stringify(json));
          
          mykData.forEach((mykItem: any) => {
            const originalEraName = mykItem.Era;
            const matchedMapKey = Object.keys(ERA_MAPPINGS).find(k => k.toLowerCase() === originalEraName?.toLowerCase());
            const eraName = matchedMapKey ? ERA_MAPPINGS[matchedMapKey] : originalEraName;
            
            if (nextJson.eras && nextJson.eras[eraName]) {
              const belowName = (mykItem.Below || "").trim();
              const categories = nextJson.eras[eraName].data || {};
              let matched = false;

              let rawUrl = mykItem['Link(s)'] || '';
              const linkMatch = rawUrl.match(/\]\((.*?)\)/);
              if (linkMatch && linkMatch[1]) {
                rawUrl = linkMatch[1];
              } else if (rawUrl.startsWith('[') && rawUrl.endsWith(')')) {
                 const parts = rawUrl.split('](');
                 if (parts.length === 2) {
                    rawUrl = parts[1].replace(')', '');
                 }
              }

              const newSong: Song = {
                name: mykItem.Name,
                extra: mykItem.extra || mykItem.Extra || undefined,
                description: mykItem.Notes || '',
                track_length: mykItem['Track Length'] || '',
                leak_date: mykItem['Leak Date'] || '',
                file_date: mykItem['File Date'] || '',
                available_length: mykItem['Available Length'] || '',
                quality: mykItem.Quality || '',
                url: rawUrl,
                urls: [rawUrl]
              };

              for (const category of Object.keys(categories)) {
                const songList = categories[category] as Song[];
                const belowIndex = songList.findIndex(s => 
                  s.name?.trim() === belowName || s.name?.includes(belowName)
                );
                
                if (belowIndex !== -1) {
                  if (mykItem.Change) {
                    if (belowIndex + 1 < songList.length) {
                      songList[belowIndex + 1] = newSong;
                    } else {
                      songList.push(newSong);
                    }
                  } else {
                    songList.splice(belowIndex + 1, 0, newSong);
                  }
                  matched = true;
                  break;
                }
              }

            }
          });
          applyLocalSongs(nextJson, localRes.data);
          applyTrackerSheetSongs(nextJson, sheetsRes.data);
          applyTrackerSheetSongs(nextJson, recentTabRes.data);
          applyTrackerSheetSongs(nextJson, recentRes.data);
          setData(nextJson);
        } else {
          const baseJson = JSON.parse(JSON.stringify(json));
          applyLocalSongs(baseJson, localRes.data);
          applyTrackerSheetSongs(baseJson, sheetsRes.data);
          applyTrackerSheetSongs(baseJson, recentTabRes.data);
          applyTrackerSheetSongs(baseJson, recentRes.data);
          setData(baseJson);
        }
        // Map recent.csv rows
        const mapRecentItem = (item: any): Song => {
          let name = item.Name || '';
          let extra: string | undefined = undefined;
          let extra2: string | undefined = item.Era || undefined;
          if (extra2) {
            const m = extra2.match(/\s*\(/);
            if (m) {
              extra = extra2.substring(m.index!).trim();
              extra2 = extra2.substring(0, m.index).trim();
            }
          }
          if (name) {
            const m = name.match(/\s*\(/);
            if (m) {
              const lastIdx = name.lastIndexOf(')');
              if (lastIdx > m.index!) {
                const extracted = name.substring(m.index!, lastIdx + 1).trim();
                const remainder = name.substring(lastIdx + 1).trim();
                name = name.substring(0, m.index).trim() + (remainder ? ' ' + remainder : '');
                extra = extracted + (extra ? ' ' + extra : '');
              } else {
                extra = name.substring(m.index!).trim() + (extra ? ' ' + extra : '');
                name = name.substring(0, m.index).trim();
              }
            }
          }
          return {
            name, extra, extra2,
            description: item.Notes,
            track_length: item['Track Length'],
            leak_date: item['Leak\nDate'] || item['Leak Date'],
            file_date: item['File\nDate'] || item['File Date'],
            available_length: item['Available Length'],
            quality: item.Quality,
            url: item['Link(s)'] ? item['Link(s)'].split('\n')[0] : '',
            urls: item['Link(s)'] ? item['Link(s)'].split('\n') : [],
          };
        };
        const recentMapped: Song[] = (recentRes.data as any[]).map(mapRecentItem);

        // Build sheet songs in recent format from the dedicated Recent tab fetch
        const sheetNameKey = Array.isArray(recentTabRes.data) && recentTabRes.data.length > 0
          ? (Object.keys(recentTabRes.data[0]).find((k: string) => k.startsWith('Name')) || 'Name')
          : 'Name';
        const sheetRecentSongs: Song[] = Array.isArray(recentTabRes.data)
          ? (recentTabRes.data as any[])
              .filter((item: any) => {
                const rawEra = (item.Era || '').trim();
                return rawEra && !rawEra.includes('\n');
              })
              .map((item: any) => {
                const rawName = (item[sheetNameKey] || '').trim();
                const nameLines = rawName.split('\n');
                const songName = nameLines[0].trim();
                const songExtra = nameLines.slice(1).join('\n').trim() || undefined;
                const rawEra = (item.Era || '').trim();
                const mk = Object.keys(ERA_MAPPINGS).find(k => k.toLowerCase() === rawEra.toLowerCase());
                const eraName = mk ? ERA_MAPPINGS[mk] : rawEra;
                let rawUrl = (item['Link(s)'] || '').trim();
                const lm = rawUrl.match(/\]\((.*?)\)/);
                if (lm?.[1]) rawUrl = lm[1];
                return {
                  name: songName,
                  extra: songExtra,
                  extra2: eraName,
                  description: item.Notes || '',
                  track_length: item['Track Length'] || '',
                  leak_date: item['Leak\nDate'] || item['Leak Date'] || '',
                  file_date: item['File\nDate'] || item['File Date'] || '',
                  available_length: item['Available Length'] || '',
                  quality: item.Quality || '',
                  url: rawUrl,
                  urls: rawUrl ? [rawUrl] : [],
                } as Song;
              })
              .filter((s: Song) => !!s.name)
          : [];

        // Use the Google Sheet as the source of truth for Recent; fall back to
        // recent.csv only if the sheet fetch returned nothing.
        setRecentData(sheetRecentSongs.length > 0 ? sheetRecentSongs : recentMapped);
        setLoading(false);

        const path = window.location.pathname;
        const hash = window.location.hash;
        if (path.startsWith('/art') || hash.startsWith('#art')) {
          setActiveCategory('art');
        } else if (path.startsWith('/stems')) {
          setActiveCategory('stems');
        } else if (path.startsWith('/misc')) {
          setActiveCategory('misc');
        } else if (path.startsWith('/fakes')) {
          setActiveCategory('fakes');
        } else if (path.startsWith('/released')) {
          setActiveCategory('released');
        } else if (path.startsWith('/recent')) {
          setActiveCategory('recent');
        } else if (path.startsWith('/settings')) {
          setActiveCategory('settings');
        } else if (path.startsWith('/history')) {
          setActiveCategory('history');
        } else if (path.startsWith('/tracklists/')) {
          setActiveCategory('tracklists');
          const slug = path.split('/tracklists/')[1];
          const erasValues = Object.values(json.eras || {}) as Era[];
          const match = erasValues.find(e => createSlug(e.name) === slug);
          if (match) {
            setSelectedAlbum({ ...match, fileInfo: CUSTOM_ALBUM_INFO[match.name] || match.fileInfo, image: CUSTOM_IMAGES[match.name] || match.image });
          } else {
            window.history.replaceState({ category: 'tracklists' }, '', '/tracklists');
          }
        } else if (path.startsWith('/tracklists')) {
          setActiveCategory('tracklists');
        } else if (path.startsWith('/yedits')) {
          setActiveCategory('yedits');
        } else if (path.startsWith('/subalbums')) {
          setActiveCategory('subalbums');
        } else if (path.startsWith('/related/')) {
          setActiveCategory('related');
          const slug = path.split('/related/')[1];
          const erasValues = Object.values(json.eras || {}) as Era[];
          const match = erasValues.find(e => createSlug(e.name) === slug);
          if (match) {
            setSelectedAlbum({ ...match, fileInfo: CUSTOM_ALBUM_INFO[match.name] || match.fileInfo, image: CUSTOM_IMAGES[match.name] || match.image });
          } else {
            window.history.replaceState({ category: 'related' }, '', '/related');
          }
        } else if (path.startsWith('/album/')) {
          const slug = path.split('/album/')[1];
          if (slug === 'nasir' || slug === 'ktse' || slug === 'never stop' || slug === 'daytona' || slug === 'the elementary school dropout') {
            window.history.replaceState({ album: null }, '', '/');
            return;
          }
          const erasValues = Object.values(json.eras || {}) as Era[];
          const match = erasValues.find(e => createSlug(e.name) === slug);
          if (match) {
            setSelectedAlbum({ ...match, fileInfo: CUSTOM_ALBUM_INFO[match.name] || match.fileInfo, image: CUSTOM_IMAGES[match.name] || match.image });
          }
        }
      })
      .catch(err => {
        console.error("Failed to fetch tracker data:", err);
        setLoading(false);
      });

    const normalizeEraField = (dataArray: any[]) => {
      return dataArray.map(item => {
        if (item.Era) {
          const matchedMapKey = Object.keys(ERA_MAPPINGS).find(k => k.toLowerCase() === item.Era.toLowerCase());
          if (matchedMapKey) {
            return { ...item, Era: ERA_MAPPINGS[matchedMapKey] };
          }
        }
        return item;
      });
    };

    axios.get('/api/music-videos')
      .then(res => {
        setMvData(normalizeEraField(res.data) as MvEntry[]);
      })
      .catch(err => {
        console.error("Failed to fetch MV data:", err);
      });

    axios.get('/api/music-videos')
      .then(res => {
        setVideosData(res.data as VideoRawEntry[]);
      })
      .catch(err => {
        console.error("Failed to fetch music videos data:", err);
      });

    Promise.resolve({ data: [] })
      .then(res => {
        setRemixData(normalizeEraField(res.data) as RemixEntry[]);
      })
      .catch(err => {
        console.error("Failed to fetch Remix data:", err);
      });

    axios.get('/api/art')
      .then(res => {
        const data = normalizeEraField(res.data) as ArtEntry[];
        const filteredData = data.filter(item => {
          const l = (item['Link(s)'] || '').toLowerCase();
          return !l.includes('link needed') && !l.includes('link%20needed') && !l.includes('source needed') && !l.includes('source%20needed');
        });
        setArtData(filteredData);
      })
      .catch(err => {
        console.error("Failed to fetch Art data:", err);
      });

    fetch('/data/stems.csv')
      .then(res => res.text())
      .then(text => {
        try {
          const rows = parseCSVText(text);
          setStemsData(normalizeEraField(rows) as StemEntry[]);
        } catch (err) {
          console.error("Failed to process Stems data:", err);
        }
      })
      .catch(err => {
        console.error("Failed to fetch Stems data:", err);
      });

    axios.get('/api/misc')
      .then(res => {
        setMiscData(normalizeEraField(res.data) as MiscEntry[]);
      })
      .catch(err => {
        console.error("Failed to fetch Misc data:", err);
      });

    axios.get('/api/released')
      .then(res => {
        setReleasedData(res.data as ReleasedEntry[]);
      })
      .catch(err => {
        console.error("Failed to fetch Released data:", err);
      });

    fetch('/data/fakes.csv')
      .then(res => res.text())
      .then(text => {
        try {
        const rawFakes = normalizeEraField(parseCSVText(text)) as any[];
        const mappedFakes = rawFakes.map(item => {
          let name = item.Name || '';
          let featureExtra = undefined;

          if (name) {
            const match = name.match(/\s*\(/);
            if (match) {
                const idx = match.index;
                const lastIdx = name.lastIndexOf(')');
                if (lastIdx > idx) {
                    featureExtra = name.substring(idx, lastIdx + 1).trim();
                    const remainder = name.substring(lastIdx + 1).trim();
                    name = name.substring(0, idx).trim() + (remainder ? " " + remainder : "");
                } else {
                    featureExtra = name.substring(idx).trim();
                    name = name.substring(0, idx).trim();
                }
            }
          }

          const newItem = { ...item, Name: name, FeatureExtra: featureExtra };
          const notesKey = Object.keys(item).find(k => k.startsWith('Notes'));
          if (notesKey && notesKey !== 'Notes') {
            newItem.Notes = item[notesKey];
          }
          return newItem;
        });
        setFakesData(mappedFakes as FakesEntry[]);
        } catch (err) {
          console.error("Failed to process Fakes data:", err);
        }
      })
      .catch(err => {
        console.error("Failed to fetch Fakes data:", err);
      });

    Promise.resolve({ data: [] })
      .then(res => {
        setSamplesData(res.data as SampleEntry[]);
      })
      .catch(err => {
        console.error("Failed to fetch Samples data:", err);
      });

    axios.get('/Tracklists.json')
      .then(res => {
        setTracklistsData(res.data as TracklistAlbum[]);
      })
      .catch(err => {
        console.error("Failed to fetch Tracklists data:", err);
      });

    axios.get('/data/subalbums.json')
      .then(res => {
        setSubAlbumsData(res.data as SubAlbumEntry[]);
      })
      .catch(err => {
        console.error("Failed to fetch Sub Albums data:", err);
      });

    const userAgent = navigator.userAgent.toLowerCase();
    const isBrowserSafari = userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('crios') && !userAgent.includes('android');

    if (!localStorage.getItem('v2_0_seen')) {
      setShowChangelog(true);
    } else if (isBrowserSafari) {
      setShowSafariWarning(true);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const lastfmSession = urlParams.get('lastfm_session');
    const lastfmUser = urlParams.get('lastfm_user');
    if (lastfmSession && lastfmUser) {
      saveLastfmSession(lastfmSession, lastfmUser);
      setLastfmLoggedIn(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const handleLastfmMessage = (e: MessageEvent) => {
      if (e.data?.type === 'lastfm-auth' && e.data.session && e.data.user) {
        saveLastfmSession(e.data.session, e.data.user);
        setLastfmLoggedIn(true);
      }
    };
    window.addEventListener('message', handleLastfmMessage);

    const handleLastfmApiError = () => {
      setShowLastfmErrorModal(true);
      clearLastfmSession();
      setLastfmLoggedIn(false);
    };

    window.addEventListener('lastfm-api-error', handleLastfmApiError);
    return () => {
      window.removeEventListener('message', handleLastfmMessage);
      window.removeEventListener('lastfm-api-error', handleLastfmApiError);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const currentPath = window.location.pathname;

    if (activeCategory === 'art') {
      if (!currentPath.startsWith('/art')) {
        window.history.pushState({ category: 'art' }, '', '/art');
      }
    } else if (activeCategory === 'stems') {
      if (!currentPath.startsWith('/stems')) {
        window.history.pushState({ category: 'stems' }, '', '/stems');
      }
    } else if (activeCategory === 'misc') {
      if (!currentPath.startsWith('/misc')) {
        window.history.pushState({ category: 'misc' }, '', '/misc');
      }
    } else if (activeCategory === 'fakes') {
      if (!currentPath.startsWith('/fakes')) {
        window.history.pushState({ category: 'fakes' }, '', '/fakes');
      }
    } else if (activeCategory === 'released') {
      if (!currentPath.startsWith('/released')) {
        window.history.pushState({ category: 'released' }, '', '/released');
      }
    } else if (activeCategory === 'recent') {
      if (!currentPath.startsWith('/recent')) {
        window.history.pushState({ category: 'recent' }, '', '/recent');
      }
    } else if (activeCategory === 'settings') {
      if (!currentPath.startsWith('/settings')) {
        window.history.pushState({ category: 'settings' }, '', '/settings');
      }
    } else if (activeCategory === 'history') {
      if (!currentPath.startsWith('/history')) {
        window.history.pushState({ category: 'history' }, '', '/history');
      }
    } else if (activeCategory === 'related') {
      if (selectedAlbum) {
        const newPath = `/related/${createSlug(selectedAlbum.name)}`;
        if (currentPath !== newPath && !currentPath.includes('?song=')) {
          window.history.pushState({ album: selectedAlbum.name, category: 'related' }, '', newPath);
        }
      } else {
        if (currentPath !== '/related') {
          window.history.pushState({ category: 'related' }, '', '/related');
        }
      }
    } else if (activeCategory === 'tracklists') {
      if (selectedAlbum) {
        const newPath = `/tracklists/${createSlug(selectedAlbum.name)}`;
        if (currentPath !== newPath && !currentPath.includes('?song=')) {
          window.history.pushState({ album: selectedAlbum.name, category: 'tracklists' }, '', newPath);
        }
      } else {
        if (currentPath !== '/tracklists') {
          window.history.pushState({ category: 'tracklists' }, '', '/tracklists');
        }
      }
    } else if (activeCategory === 'videos') {
      if (!currentPath.startsWith('/videos')) {
        window.history.pushState({ category: 'videos' }, '', '/videos');
      }
    } else if (activeCategory === 'comps') {
      if (!currentPath.startsWith('/comps')) {
        window.history.pushState({ category: 'comps' }, '', '/comps');
      }
    } else if (activeCategory === 'yedits') {
      if (!currentPath.startsWith('/yedits')) {
        window.history.pushState({ category: 'yedits' }, '', '/yedits');
      }
    } else if (activeCategory === 'subalbums') {
      if (!currentPath.startsWith('/subalbums')) {
        window.history.pushState({ category: 'subalbums' }, '', '/subalbums');
      }
    } else {
      if (selectedAlbum) {
        const newPath = `/album/${createSlug(selectedAlbum.name)}`;
        if (currentPath !== newPath && !currentPath.includes('?song=')) {
          window.history.pushState({ album: selectedAlbum.name }, '', newPath);
        }
      } else {
        if (currentPath !== '/') {
          window.history.pushState({ album: null }, '', '/');
        }
      }
    }
  }, [selectedAlbum, loading, activeCategory]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/') {
        setSelectedAlbum(null);
        setActiveCategory('music');
      } else if (path.startsWith('/album/') && data) {
        const slug = path.split('/album/')[1];
        const erasValues = Object.values(data.eras || {}) as Era[];
        const match = erasValues.find(e => createSlug(e.name) === slug);
        if (match) {
          setSelectedAlbum({ ...match, fileInfo: CUSTOM_ALBUM_INFO[match.name] || match.fileInfo, image: CUSTOM_IMAGES[match.name] || match.image });
          setActiveCategory('music');
        } else {
          setSelectedAlbum(null);
          setActiveCategory('music');
        }
      } else if (path.startsWith('/related/') && data) {
        const slug = path.split('/related/')[1];
        const erasValues = Object.values(data.eras || {}) as Era[];
        const match = erasValues.find(e => createSlug(e.name) === slug);
        if (match) {
          setSelectedAlbum({ ...match, fileInfo: CUSTOM_ALBUM_INFO[match.name] || match.fileInfo, image: CUSTOM_IMAGES[match.name] || match.image });
          setActiveCategory('related');
        } else {
          setSelectedAlbum(null);
          setActiveCategory('related');
        }
      } else if (path.startsWith('/related')) {
        setSelectedAlbum(null);
        setActiveCategory('related');
      } else if (path.startsWith('/tracklists/') && data) {
        const slug = path.split('/tracklists/')[1];
        const erasValues = Object.values(data.eras || {}) as Era[];
        const match = erasValues.find(e => createSlug(e.name) === slug);
        if (match) {
          setSelectedAlbum({ ...match, fileInfo: CUSTOM_ALBUM_INFO[match.name] || match.fileInfo, image: CUSTOM_IMAGES[match.name] || match.image });
          setActiveCategory('tracklists');
        } else {
          setSelectedAlbum(null);
          setActiveCategory('tracklists');
        }
      } else if (path.startsWith('/tracklists')) {
        setSelectedAlbum(null);
        setActiveCategory('tracklists');
      } else if (path.startsWith('/art')) {
        setActiveCategory('art');
      } else if (path.startsWith('/stems')) {
        setActiveCategory('stems');
      } else if (path.startsWith('/misc')) {
        setActiveCategory('misc');
      } else if (path.startsWith('/released')) {
        setActiveCategory('released');
      } else if (path.startsWith('/recent')) {
        setActiveCategory('recent');
      } else if (path.startsWith('/settings')) {
        setActiveCategory('settings');
      } else if (path.startsWith('/history')) {
        setActiveCategory('history');
      } else if (path.startsWith('/yedits')) {
        setActiveCategory('yedits');
      } else if (path.startsWith('/subalbums')) {
        setActiveCategory('subalbums');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [data]);

  const generateShuffledQueue = (length: number, firstIndex: number) => {
    if (length <= 0) return [];
    const queue = Array.from({ length }, (_, i) => i);
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (firstIndex >= 0 && firstIndex < length) {
      const startIdxPos = queue.indexOf(firstIndex);
      if (startIdxPos > -1) {
        queue.splice(startIdxPos, 1);
        queue.unshift(firstIndex);
      }
    }
    return queue;
  };

  const getPlayableSongs = (era: Era) => {
    return Object.values(era.data || {}).flat().filter(s => {
      const rawUrl = s.url || (s.urls && s.urls.length > 0 ? s.urls[0] : '');
      const isNotAvailable = isSongNotAvailable(s, rawUrl);
      return rawUrl && (rawUrl.includes('pillows.su/f/') || rawUrl.includes('pillowcase.su/f/') || rawUrl.includes('temp.imgur.gg/f/') || rawUrl.includes('krakenfiles.com/view/')) && !isNotAvailable;
    });
  };

  const handlePlaySong = async (song: Song, era: Era, contextTracks?: Song[], resetShuffleHistory = true, autoPlay = true, isRandomSelection = false) => {
    if (activePlayer === 'spotify') spotifyControls.pause();
    const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
    const isNotAvailable = isSongNotAvailable(song, rawUrl);
    
    const lowerUrl = (rawUrl || '').toLowerCase();
    const isTrulyEmptyLink = !rawUrl || lowerUrl === 'n/a' || lowerUrl.includes('link needed') || lowerUrl.includes('source needed');

    if (isTrulyEmptyLink) return;

    if (isNotAvailable) {
       if (settings.notOpenInNewTab) {
           setPopupUrl(rawUrl);
       } else {
           window.open(rawUrl, '_blank');
       }
       return;
    }

    if (rawUrl.includes('pillows.su/f/') || rawUrl.includes('pillowcase.su/f/') || rawUrl.includes('temp.imgur.gg/f/') || rawUrl.includes('krakenfiles.com/view/')) {
      let streamUrl = '';
      let isPlayable = true;

      try {
        if (rawUrl.includes('temp.imgur.gg/f/')) {
          const id = rawUrl.split('/f/')[1];
          const res = await axios.get(`https://temp.imgur.gg/api/file/${id}`);

          if (res.data && res.data.cdnUrl) {
            streamUrl = res.data.cdnUrl;
            const type = res.data.type || '';
            const isZip = type.includes('zip') || res.data.name.toLowerCase().endsWith('.zip');
            const isImg = type.includes('image') || res.data.name.toLowerCase().endsWith('.jpg') || res.data.name.toLowerCase().endsWith('.jpeg') || res.data.name.toLowerCase().endsWith('.png');
            if (isZip || isImg) {
              isPlayable = false;
            }
          }
        } else if (rawUrl.includes('pillows.su/f/') || rawUrl.includes('pillowcase.su/f/')) {
          const id = rawUrl.split('/f/')[1];
          const apiBase = rawUrl.includes('pillowcase.su') ? 'https://api.pillowcase.su' : 'https://api.pillows.su';
          streamUrl = `${apiBase}/api/get/${id}`;
        } else if (rawUrl.includes('krakenfiles.com/view/')) {
          const hash = rawUrl.split('/view/')[1]?.replace('/file.html', '').replace(/\/$/, '');
          if (hash) streamUrl = `/api/kraken-proxy?hash=${hash}`;
        }

      } catch (err) {
        console.error("Failed to fetch file info:", err);
      }

      if (!isPlayable) {
        setIsPlaying(false);
        setIsPlayerClosed(true);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        showToast("Song cannot be played because it's not an audio file");
        return;
      }

      const playableSongs = contextTracks && contextTracks.length > 0 ? contextTracks : getPlayableSongs(era);
      setPlaylist(playableSongs);
      const newIndex = playableSongs.findIndex(s => s.name === song.name && (s.url || (s.urls && s.urls[0]) || '') === (song.url || (song.urls && song.urls[0]) || ''));
      setCurrentSongIndex(newIndex);
      if (resetShuffleHistory) {
         setShuffledQueue(generateShuffledQueue(playableSongs.length, newIndex));
         setIsRandomMode(isRandomSelection);
      }
      setHasLoopedOnce(false);

      setActivePlayer('audio');
      setCurrentSong(song);
      setCurrentEra(era);
      setIsPlaying(autoPlay);
      setIsPlayerClosed(false);
      scrobbledRef.current = false;
      songStartTimeRef.current = Math.floor(Date.now() / 1000);

      if (audioRef.current) {
        audioRef.current.src = streamUrl;
        audioRef.current.volume = volume;
        if (autoPlay) {
          audioRef.current.play().catch(e => { if (e.name !== 'AbortError') console.error("Audio play failed", e) });
        }
      }

      const actualEraName = (song as any).realEra?.name || era.name;
      
    } else if (rawUrl.includes('youtube.com/watch') || rawUrl.includes('youtu.be/')) {
      const ytMatch = rawUrl.match(/[?&]v=([A-Za-z0-9_-]+)/) ?? rawUrl.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
      const videoId = ytMatch?.[1];
      if (videoId && youtubeState.isReady) {
        handlePlayYoutubeTrack(videoId, song.name);
      } else {
        window.open(rawUrl, '_blank');
      }
    } else if (rawUrl.includes('soundcloud.com') || rawUrl.includes('on.soundcloud.com')) {
      if (soundcloudState.isReady) {
        handlePlaySoundCloudTrack(rawUrl);
      } else {
        window.open(rawUrl, '_blank');
      }
    } else if (rawUrl.includes('archive.org/details/')) {
      const archiveId = rawUrl.split('archive.org/details/')[1].split('?')[0];
      handlePlayArchiveTrack(archiveId, song.name, era.name);
    } else if (rawUrl.startsWith('/') || /\.(mp3|m4a|wav|ogg|flac|aac)(\?|$)/i.test(rawUrl)) {
      const playableSongs = contextTracks && contextTracks.length > 0 ? contextTracks : [song];
      setPlaylist(playableSongs);
      const newIndex = playableSongs.findIndex(s =>
        (s.url || (s.urls && s.urls[0]) || '') === (song.url || (song.urls && song.urls[0]) || '')
      );
      const safeIndex = newIndex >= 0 ? newIndex : 0;
      setCurrentSongIndex(safeIndex);
      if (resetShuffleHistory) {
        setShuffledQueue(generateShuffledQueue(playableSongs.length, safeIndex));
        setIsRandomMode(isRandomSelection);
      }
      setHasLoopedOnce(false);
      setActivePlayer('audio');
      setCurrentSong(song);
      setCurrentEra(era);
      setIsPlaying(autoPlay);
      setIsPlayerClosed(false);
      scrobbledRef.current = false;
      songStartTimeRef.current = Math.floor(Date.now() / 1000);
      if (audioRef.current) {
        audioRef.current.src = rawUrl;
        audioRef.current.volume = volume;
        if (autoPlay) {
          audioRef.current.play().catch(e => { if (e.name !== 'AbortError') console.error("Audio play failed", e); });
        }
      }
    } else {
      if (settings.notOpenInNewTab) {
          setPopupUrl(rawUrl);
      } else {
          window.open(rawUrl, '_blank');
      }
    }
  };

  const lastRecordedSongRef = useRef<string>('');

  useEffect(() => {
    if (isPlaying && currentSong && currentEra && settings.saveListeningHistory) {
      const actualEraName = (currentSong as any).realEra?.name || currentEra.name;
      const cleanActualEraName = cleanAlbumName(actualEraName).replace(/ \[Fake\]$/i, '');
      const cleanRealTrackName = currentSong.name.replace(/ \[Fake\]$/i, '');
      const lfmArtist = parseArtistFromSong(cleanRealTrackName, currentSong.extra, actualEraName);
      const albumArt = (currentSong as any).realEra?.image || currentEra.image || '';
      
      const songKey = `${cleanRealTrackName}-${actualEraName}`;
      if (lastRecordedSongRef.current !== songKey) {
        lastRecordedSongRef.current = songKey;
        recordListeningHistory({...currentSong, name: cleanRealTrackName}, { ...currentEra, name: actualEraName }, lfmArtist, albumArt);
      }
    }
  }, [isPlaying, currentSong, currentEra, settings.saveListeningHistory]);

  useEffect(() => {
    if (lastfmLoggedIn && isPlaying && currentSong && currentEra) {
      const actualEraName = (currentSong as any).realEra?.name || currentEra.name;
      const cleanActualEraName = settings.lastfmEraOverrides[actualEraName] ?? cleanAlbumName(actualEraName).replace(/ \[Fake\]$/i, '');
      const cleanRealTrackName = currentSong.name.replace(/ \[Fake\]$/i, '');
      const lfmArtist = parseArtistFromSong(cleanRealTrackName, currentSong.extra, actualEraName);

      const lfmTrack = cleanTrackName(cleanRealTrackName, currentSong.extra, settings.lastfmShowVersion, settings.lastfmShowTags, settings.lastfmShowFeats);
      updateNowPlaying(lfmTrack, lfmArtist, cleanActualEraName);
    }
  }, [isPlaying, currentSong, currentEra, lastfmLoggedIn, settings.lastfmShowVersion, settings.lastfmShowTags, settings.lastfmShowFeats, settings.lastfmEraOverrides]);

  useEffect(() => {
    if (selectedAlbum) {
      const searchParams = new URLSearchParams(window.location.search);
      const songName = searchParams.get('song');

      if (songName) {
        const allSongs = Object.values(selectedAlbum.data || {}).flat();
        const songToPlay = allSongs.find(s => getSongSlug(s, allSongs) === songName);

        if (songToPlay) {
          setTimeout(() => {
            handlePlaySong(songToPlay, selectedAlbum);
            window.history.replaceState({ album: selectedAlbum.name }, '', window.location.pathname);
          }, 0);
        }
      }
    }
  }, [selectedAlbum, currentSong]);

  const playNext = () => {
    if (playlist.length === 0 || !currentEra) return;
    let nextIndex = currentSongIndex + 1;
    if (isShuffle && shuffledQueue.length > 0) {
      const idx = shuffledQueue.indexOf(currentSongIndex);
      if (idx !== -1 && idx < shuffledQueue.length - 1) {
        nextIndex = shuffledQueue[idx + 1];
      } else {
        nextIndex = shuffledQueue[0];
      }
    } else if (nextIndex >= playlist.length) {
      nextIndex = 0;
    }

    const nextSong = playlist[nextIndex];
    if (nextSong) {
      const eraToPass = (nextSong as any).realEra || currentEra;
      handlePlaySong(nextSong, eraToPass, playlist, false, true, isRandomMode);
    }
  };

  const playPrev = () => {
    if (playlist.length === 0 || !currentEra) return;
    let prevIndex = currentSongIndex - 1;
    if (isShuffle && shuffledQueue.length > 0) {
      const idx = shuffledQueue.indexOf(currentSongIndex);
      if (idx > 0) {
        prevIndex = shuffledQueue[idx - 1];
      } else {
        prevIndex = shuffledQueue[shuffledQueue.length - 1];
      }
    } else if (prevIndex < 0) {
      prevIndex = playlist.length - 1;
    }

    const prevSong = playlist[prevIndex];
    if (prevSong) {
      const eraToPass = (prevSong as any).realEra || currentEra;
      handlePlaySong(prevSong, eraToPass, playlist, false, true, isRandomMode);
    }
  };

  const handleEnded = () => {

    if (loopMode === 2) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => { if (e.name !== 'AbortError') console.error("Audio play failed", e); });
        }
      }
    } else if (loopMode === 1) {
      if (!hasLoopedOnce) {
        setHasLoopedOnce(true);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => { if (e.name !== 'AbortError') console.error("Audio play failed", e); });
          }
        }
      } else {
        setHasLoopedOnce(false);
        playNext();
      }
    } else {
      playNext();
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.volume = volume;
      audioRef.current.play().catch(e => { if (e.name !== 'AbortError') console.error("Audio play failed", e) });
      setIsPlaying(true);
    }
  };

  const handlersRef = useRef({ playNext, playPrev, togglePlay });
  useEffect(() => {
    handlersRef.current = { playNext, playPrev, togglePlay };
  }, [playNext, playPrev, togglePlay]);

  useEffect(() => {
    if ('mediaSession' in navigator && currentSong && currentEra) {
      const actualEraName = (currentSong as any).realEra?.name || currentEra.name;
      const cleanActualEraName = cleanAlbumName(actualEraName);
      const lfmTrack = cleanTrackName(currentSong.name, currentSong.extra);
      const coverImage = currentSong.image || CUSTOM_IMAGES[actualEraName] || currentEra.image || 'https://i.ibb.co/mrK8W4rL/image-2026-03-22-142639537.png';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: lfmTrack,
        artist: parseArtistFromSong(currentSong.name, currentSong.extra, actualEraName),
        album: cleanActualEraName,
        artwork: [
          { src: coverImage, sizes: '512x512', type: 'image/png' },
          { src: coverImage, sizes: '256x256', type: 'image/png' }
        ]
      });

      if (settings.discordRPC) {
        const rawSongUrl = currentSong.url || (currentSong.urls && currentSong.urls.length > 0 ? currentSong.urls[0] : '');
        const directLink = rawSongUrl.includes('pillows.su/f/') 
          ? `https://api.pillows.su/api/download/${rawSongUrl.split('/f/')[1]}`
          : rawSongUrl;
          
        let catForDiscord = 'Music';
        if (currentSong.name.endsWith('[Misc]') || actualEraName.includes('Misc')) {
          catForDiscord = 'Misc';
        } else if (currentSong.name.endsWith('[Stems]') || actualEraName.includes('Stems')) {
          catForDiscord = 'Stems';
        } else if (currentSong.name.endsWith('[Fake Leak]') || actualEraName.includes('Fake')) {
          catForDiscord = 'Fakes';
        } else if (activeCategory === 'recent') {
          catForDiscord = 'Recent';
        }

        console.log(`Song Name: ${lfmTrack}\nAlbum Name: ${cleanActualEraName}\nArtist Name: ${parseArtistFromSong(currentSong.name, currentSong.extra, actualEraName)}\nSong/Album Pic: ${coverImage}\nCategory: ${catForDiscord}`);
      }

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          if (audioRef.current) {
            audioRef.current.play().catch(e => { if (e.name !== 'AbortError') console.error(e) });
            setIsPlaying(true);
          }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          handlersRef.current.playNext();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          handlersRef.current.playPrev();
        });
      } catch (error) {
        console.error("MediaSession error:", error);
      }
    }
  }, [currentSong, currentEra]);

  const toggleShuffleState = () => {
    setIsShuffle(prev => {
      const next = !prev;
      if (next && playlist.length > 0) {
        setShuffledQueue(generateShuffledQueue(playlist.length, currentSongIndex));
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!settings.keyboardShortcuts || e.repeat) return;
      
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.code === 'Space' || e.code === 'KeyK') && currentSong && !isPlayerClosed) {
        e.preventDefault();
        if (audioRef.current) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch(err => { if (err.name !== 'AbortError') console.error("Audio play failed", err) });
            setIsPlaying(true);
          } else {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        }
      } else if (e.code === 'KeyF' && currentSong && !isPlayerClosed) {
        e.preventDefault();
        setIsFullScreen(prev => !prev);
      } else if (e.code === 'KeyL' && currentSong && !isPlayerClosed) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-lyrics'));
      } else if (e.code === 'KeyS' && currentSong && !isPlayerClosed) {
        e.preventDefault();
        toggleShuffleState();
      } else if (e.code === 'KeyO' && currentSong && !isPlayerClosed) {
        e.preventDefault();
        setLoopMode(prev => (prev + 1) % 3);
      } else if (e.code === 'ArrowRight' && currentSong && !isPlayerClosed) {
        e.preventDefault();
        handlersRef.current.playNext();
      } else if (e.code === 'ArrowLeft' && currentSong && !isPlayerClosed) {
        e.preventDefault();
        handlersRef.current.playPrev();
      } else if (e.code === 'KeyG' && currentSong && !isPlayerClosed) {
        e.preventDefault();
        const isFake = currentSong.name.endsWith('[Fake Leak]') || (currentEra?.name || '').includes('Fake');
        const isStems = currentSong.name.endsWith('[Stems]') || (currentEra?.name || '').includes('Stems');
        const isMisc = currentSong.name.endsWith('[Misc]') || (currentEra?.name || '').includes('Misc');
        if (currentSong.name !== "Kanye West/Kendrick Lamar/QoQinox - Alright but the beat is Father Stretch My Hands Pt. 1" && !isFake && !isStems && !isMisc) {
          toggleFavorite(currentSong, currentEra?.name || '');
        }
      } else if (e.code === 'KeyD' && currentSong && !isPlayerClosed) {
        e.preventDefault();
        const rawUrl = currentSong.url || (currentSong.urls && currentSong.urls.length > 0 ? currentSong.urls[0] : '');
        const kbEraName = (currentSong as any).realEra?.name || currentEra?.name || '';
        const kbArtUrl = currentSong.image || CUSTOM_IMAGES[kbEraName] || (currentSong as any).realEra?.image || currentEra?.image;
        const kbTitle = currentSong.name.includes(' - ') ? currentSong.name.substring(currentSong.name.indexOf(' - ') + 3) : currentSong.name;
        handleDownloadFile(rawUrl, currentSong.name, settings.tagsAsEmojis, settings.embedMetadata ? {
          title: kbTitle,
          artist: buildArtistTag(currentSong.name, kbEraName),
          album: kbEraName,
          year: ALBUM_RELEASE_DATES[kbEraName]?.split('/').pop(),
          artworkUrl: kbArtUrl,
        } : undefined, settings.downloadAsOgFilename ? currentSong.description : undefined);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, isPlayerClosed, settings.keyboardShortcuts, currentEra]);

  useEffect(() => {
    const handleEasterEgg = () => {
      const easterEggSong: Song = {
        name: "Kanye West/Kendrick Lamar/QoQinox - Alright but the beat is Father Stretch My Hands Pt. 1",
        url: "https://pillows.su/f/995251ad1569bf2e298af3e8c6a3bed8",
        extra: "Easter Egg",
        description: "Fire Song",
        quality: "Lossless"
      };
      const easterEggEra: Era = {
        name: "Easter egg",
        image: "https://i.imagesup.co/images2/36f0a02c25b5e237dc6ca3762a3453d4b6ff36f7.jpg",
        data: {},
      };
      handlePlaySong(easterEggSong, easterEggEra, [easterEggSong], true);
    };

    window.addEventListener('play-easter-egg', handleEasterEgg);
    return () => window.removeEventListener('play-easter-egg', handleEasterEgg);
  }, []);

  useEffect(() => {
    if (settings.notificationWhenPlaying && currentSong && document.hidden) {
      if (Notification.permission === 'granted') {
        const actualEraName = (currentSong as any).realEra?.name || currentEra?.name;
        const artist = parseArtistFromSong(currentSong.name, currentSong.extra, actualEraName);
        const coverImage = currentSong.image || (currentSong as any).realEra?.image || currentEra?.image || 'https://i.ibb.co/mrK8W4rL/image-2026-03-22-142639537.png';
        
        const notificationTitle = formatTextForNotification(currentSong.name, settings.tagsAsEmojis);
        const notificationBody = formatTextForNotification(artist, settings.tagsAsEmojis);

        try {
          new Notification(notificationTitle, {
            body: notificationBody,
            icon: coverImage,
            silent: true
          });
        } catch (e) {
          console.error("Notification failed", e);
        }
      }
    }
  }, [currentSong, settings.notificationWhenPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);

      if (lastfmLoggedIn && currentSong && currentEra && !scrobbledRef.current) {
        const dur = audioRef.current.duration;
        const cur = audioRef.current.currentTime;
        if (dur > 30 && (cur > dur / 2 || cur > 240)) {
          scrobbledRef.current = true;
          const actualEraName = (currentSong as any).realEra?.name || currentEra.name;
          const cleanActualEraName = settings.lastfmEraOverrides[actualEraName] ?? cleanAlbumName(actualEraName).replace(/ \[Fake\]$/i, '');
          const cleanRealTrackName = currentSong.name.replace(/ \[Fake\]$/i, '');
          const lfmTrack = cleanTrackName(cleanRealTrackName, currentSong.extra, settings.lastfmShowVersion, settings.lastfmShowTags, settings.lastfmShowFeats);
          const lfmArtist = parseArtistFromSong(cleanRealTrackName, currentSong.extra, actualEraName);
          scrobbleTrack(
            lfmTrack,
            lfmArtist,
            cleanActualEraName,
            songStartTimeRef.current,
            Math.floor(dur)
          );
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.volume = volume;
      if (timeToRestoreRef.current !== null) {
        audioRef.current.currentTime = timeToRestoreRef.current;
        setCurrentTime(timeToRestoreRef.current);
        timeToRestoreRef.current = null;
      }
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handlePlaySpotifyTrack = async (uri: string) => {
    if (!spotifyState.isReady) { showToast('Spotify player is still connecting — try again in a moment'); return; }
    const ok = await spotifyControls.playUri(uri);
    if (!ok) { showToast('Spotify playback failed. Make sure you have Spotify Premium.'); return; }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setActivePlayer('spotify');
    setIsPlayerClosed(false);
  };

  const handlePlayReleasedAudio = (url: string, name: string, eraName: string, length?: string) => {
    const era = erasArray.find(e => e.name === eraName) ?? { name: eraName, image: undefined, data: {} };
    const song: Song = { name, url, track_length: length };
    handlePlaySong(song, era as Era, [song]);
  };

  const handlePlayYoutubeTrack = (videoId: string, title?: string) => {
    if (!youtubeState.isReady) return;
    if (activePlayer === 'spotify') spotifyControls.pause();
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setActivePlayer('youtube');
    setIsPlayerClosed(false);
    youtubeControls.playVideoId(videoId, title);
  };

  const handlePlaySoundCloudTrack = (url: string) => {
    if (!soundcloudState.isReady) return;
    if (activePlayer === 'spotify') spotifyControls.pause();
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setActivePlayer('soundcloud');
    setIsPlayerClosed(false);
    soundcloudControls.playUrl(url);
  };

  const handlePlayArchiveTrack = async (archiveId: string, title: string, eraName: string) => {
    try {
      const res = await fetch(`https://archive.org/metadata/${archiveId}`);
      const meta = await res.json();
      const audioFile = (meta.files as any[])?.find(
        (f: any) => f.format && (f.format.toLowerCase().includes('mp3') || f.format.toLowerCase().includes('vbr')) && f.name
      );
      if (!audioFile) { window.open(`https://archive.org/details/${archiveId}`, '_blank'); return; }
      const directUrl = `https://archive.org/download/${archiveId}/${audioFile.name}`;
      const era = erasArray.find(e => e.name === eraName) ?? { name: eraName, image: undefined, data: {} };
      const song: Song = { name: title, url: directUrl, track_length: audioFile.length ? Math.floor(Number(audioFile.length) / 60) + ':' + String(Math.floor(Number(audioFile.length) % 60)).padStart(2, '0') : undefined };
      handlePlaySong(song, era as Era, [song]);
    } catch {
      window.open(`https://archive.org/details/${archiveId}`, '_blank');
    }
  };

  function spotifyTrackToSong(track: SpotifyTrack): Song {
    return {
      name: track.artists.join(', ') + ' - ' + track.name,
      extra: track.artists[0] ?? '',
      url: '',
      image: track.albumArt,
      track_length: formatTime(track.duration / 1000),
    };
  }

  function spotifyTrackToEra(track: SpotifyTrack): Era {
    return { name: track.albumName, image: track.albumArt, data: {} };
  }

  function formatTime(seconds: number) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const handleCategoryChange = (cat: Category) => {
    if (cat === 'music' && selectedAlbum) {
      if (!finalErasArray.find(e => e.name === selectedAlbum.name)) {
        setSelectedAlbum(null);
      }
    } else if (cat === 'related' && selectedAlbum) {
      if (!relatedErasArray.find(e => e.name === selectedAlbum.name)) {
        setSelectedAlbum(null);
      }
    } else if (cat === 'tracklists' && selectedAlbum) {
      if (!finalErasArray.find(e => e.name === selectedAlbum.name)) {
        setSelectedAlbum(null);
      }
    } else {
      setSelectedAlbum(null);
    }
    setActiveCategory(cat);
  };

  const handleHomeClick = () => {
    setSelectedAlbum(null);
    if (!settings.rememberSearch) {
      setSearchQuery('');
    }
    setActiveCategory('music');
  };

  if (loading || loadingFading) {
    const effectiveId = settings.loadingScreen === 'shuffle' ? (resolvedShuffleScreenId ?? 'none') : settings.loadingScreen;
    const screen = LOADING_SCREENS.find(s => s.id === effectiveId);
    return (
      <div
        className="h-screen w-full relative bg-black overflow-hidden transition-opacity duration-700"
        style={{ opacity: loadingFading ? 0 : 1 }}
      >
        <div className="w-full h-full flex items-center justify-center">
          {screen?.type === 'gif' && screen.url && (
            <img src={screen.url} alt={screen.label} className="w-[200px] h-[200px] sm:w-[400px] sm:h-[400px] object-contain" onLoad={() => setGifReady(true)} />
          )}
          {screen?.type === 'video' && screen.url && (
            <video src={screen.url} autoPlay loop playsInline className="w-[400px] h-[400px] object-contain" ref={(el) => { if (el) el.muted = true; }} />
          )}
          {(!screen || screen.type === 'none') && (
            <div className="animate-pulse text-sm font-bold tracking-widest uppercase text-white/50">Loading Songs...</div>
          )}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-yzy-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm text-red-500">Failed to load data.</div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-4 py-2 border border-white/20 rounded hover:bg-white/10 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

let erasArray = (Object.values(data.eras || {}) as Era[])
  .filter(era => !HIDDEN_ALBUMS.includes(era.name))
  .map(era => ({
    ...era,
    fileInfo: CUSTOM_ALBUM_INFO[era.name] || era.fileInfo
  })) as Era[];

const RELATED_ERA_ORDER = [
  'DAYTONA',
  'NASIR',
  'K.T.S.E.',
  'Jesus Is Born',
  'Sunday Service Choir',
  'The Elementary School Dropout',
  'NEVER STOP',
  'YE-I',
];

let relatedErasArray = (Object.values(data.eras || {}) as Era[])
  .filter(era => HIDDEN_ALBUMS.includes(era.name))
  .map(era => ({
    ...era,
    fileInfo: CUSTOM_ALBUM_INFO[era.name] || era.fileInfo
  }))
  .sort((a, b) => {
    const ai = RELATED_ERA_ORDER.indexOf(a.name);
    const bi = RELATED_ERA_ORDER.indexOf(b.name);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }) as Era[];

// Turbo Grafx 16 and Wolves can end up out of position (Turbo gets renamed from
// "TurboGrafx 16" via ERA_MAPPINGS, Wolves may be appended after myk merge).
// Reinsert both right after Cruel Winter [V2]: CW[V2] → Turbo Grafx 16 → Wolves.
{
  const cwV2Idx = erasArray.findIndex(e => e.name === "Cruel Winter [V2]");
  const turboIdx = erasArray.findIndex(e => e.name === "Turbo Grafx 16");
  const wolvesIdx = erasArray.findIndex(e => e.name === "Wolves");

  if (cwV2Idx !== -1 && turboIdx !== -1 && wolvesIdx !== -1) {
    const turboEra = erasArray[turboIdx];
    const wolvesEra = erasArray[wolvesIdx];
    [turboIdx, wolvesIdx].sort((a, b) => b - a).forEach(i => erasArray.splice(i, 1));
    const newCwV2Idx = erasArray.findIndex(e => e.name === "Cruel Winter [V2]");
    erasArray.splice(newCwV2Idx + 1, 0, turboEra, wolvesEra);
  }
}

// KIDS SEE GHOSTS can land at the end of the array when the API returns the old
// "KIDSSEEGHOSTS" name and ERA_MAPPINGS renames it (new JS key goes to the end).
// Always move it to sit directly after "ye".
{
  const yeIdx = erasArray.findIndex(e => e.name === "ye");
  const ksgIdx = erasArray.findIndex(e => e.name === "KIDS SEE GHOSTS");

  if (yeIdx !== -1 && ksgIdx !== -1 && ksgIdx !== yeIdx + 1) {
    const ksgEra = erasArray[ksgIdx];
    erasArray.splice(ksgIdx, 1);
    const newYeIdx = erasArray.findIndex(e => e.name === "ye");
    erasArray.splice(newYeIdx + 1, 0, ksgEra);
  }
}



  const favoritesEra: Era | null = favoriteKeys.length > 0 ? {
    fileInfo: [],
    name: "Favorites",
    image: "https://i.ibb.co/JFnmJ8rX/image.png",
    data: {
      "Favorite Tracks": favoriteKeys.map(k => {
        let realEra = erasArray.find(e => e.name === k.eraName) || relatedErasArray.find(e => e.name === k.eraName);
        if (!realEra && k.eraName === 'Recent Leaks') {
            realEra = { fileInfo: [], name: "Recent Leaks", image: "https://i.ibb.co/7xRv4H2r/sdffsdsdf.png", data: { "Latest Additions": recentData } };
        }
        
        let foundSong: Song | null = null;
        if (realEra && realEra.data) {
           const allSongs = Object.values(realEra.data).flat();
           foundSong = allSongs.find(s => s.name === k.songName && (s.url || (s.urls && s.urls.length > 0 ? s.urls[0] : '')) === k.url) as Song;
        }
        if (!foundSong && k.eraName === 'Recent Leaks') {
           foundSong = recentData.find(s => s.name === k.songName && (s.url || (s.urls && s.urls.length > 0 ? s.urls[0] : '')) === k.url) as Song;
        }
        if (!foundSong && k.song) {
           foundSong = k.song;
        }

        if (foundSong) {
           const actualRealEra = (realEra?.name === 'Recent Leaks' ? Object.values(data?.eras || {}).find((e: any) => e.name === foundSong!.extra) : realEra) as Era;
           const rawEraName = foundSong.extra2 || foundSong.extra;
           const cleanEraName = rawEraName ? getCleanSongNameWithTags(rawEraName) : '';
           const actualRealEraNameSearch = actualRealEra?.name || '';
           return { ...foundSong, realEra: actualRealEra, image: CUSTOM_IMAGES[rawEraName || ''] || CUSTOM_IMAGES[cleanEraName || ''] || CUSTOM_IMAGES[actualRealEraNameSearch || ''] || actualRealEra?.image || foundSong.image || "https://i.ibb.co/JFnmJ8rX/image.png" };
        }
        return null;
      }).filter(s => s !== null) as Song[]
    }
  } : null;

  const finalErasArray = [...erasArray];
  if (favoritesEra) {
    const beforeIndex = finalErasArray.findIndex(e => e.name === "Before The College Dropout");
    if (beforeIndex !== -1) {
      finalErasArray.splice(beforeIndex, 0, favoritesEra);
    } else {
      finalErasArray.unshift(favoritesEra);
    }
  }

  const filteredEras = finalErasArray.filter(era => {
    const hasActiveFilters = filters.tags.length > 0 || filters.qualities.length > 0 || filters.availableLengths?.length > 0 || filters.durationValue !== '' || filters.playableOnly || filters.hasClips !== null || filters.hasRemixes !== null || filters.hasSamples !== null;

    if (!searchQuery && !hasActiveFilters) return true;

    const allSongs = Object.values(era.data || {}).flat();

    const matchingSongs = allSongs.filter(song => {
      if (!matchesFilters(song, searchQuery, filters)) return false;

      if (filters.hasClips) {
        const has = findMvsForSong(song.name, era.name, mvData).length > 0;
        if (filters.hasClips === 'include' && !has) return false;
        if (filters.hasClips === 'exclude' && has) return false;
      }

      if (filters.hasRemixes) {
        const has = findRemixesForSong(song.name, era.name, remixData).length > 0;
        if (filters.hasRemixes === 'include' && !has) return false;
        if (filters.hasRemixes === 'exclude' && has) return false;
      }

      if (filters.hasSamples) {
        const has = findSamplesForSong(song.name, era.name, samplesData).length > 0;
        if (filters.hasSamples === 'include' && !has) return false;
        if (filters.hasSamples === 'exclude' && has) return false;
      }

      return true;
    });

    if (hasActiveFilters) {
      return matchingSongs.length > 0;
    }

    return era.name.toLowerCase().includes(searchQuery.toLowerCase()) || matchingSongs.length > 0;
  });

  const filteredRelatedEras = relatedErasArray.filter(era => {
    const hasActiveFilters = filters.tags.length > 0 || filters.qualities.length > 0 || filters.availableLengths?.length > 0 || filters.durationValue !== '' || filters.playableOnly || filters.hasClips !== null || filters.hasRemixes !== null || filters.hasSamples !== null;

    if (!searchQuery && !hasActiveFilters) return true;

    const allSongs = Object.values(era.data || {}).flat();

    const matchingSongs = allSongs.filter(song => {
      if (!matchesFilters(song, searchQuery, filters)) return false;

      if (filters.hasClips) {
        const has = findMvsForSong(song.name, era.name, mvData).length > 0;
        if (filters.hasClips === 'include' && !has) return false;
        if (filters.hasClips === 'exclude' && has) return false;
      }

      if (filters.hasRemixes) {
        const has = findRemixesForSong(song.name, era.name, remixData).length > 0;
        if (filters.hasRemixes === 'include' && !has) return false;
        if (filters.hasRemixes === 'exclude' && has) return false;
      }

      if (filters.hasSamples) {
        const has = findSamplesForSong(song.name, era.name, samplesData).length > 0;
        if (filters.hasSamples === 'include' && !has) return false;
        if (filters.hasSamples === 'exclude' && has) return false;
      }

      return true;
    });

    if (hasActiveFilters) {
      return matchingSongs.length > 0;
    }

    return era.name.toLowerCase().includes(searchQuery.toLowerCase()) || matchingSongs.length > 0;
  });

  const recentEra: Era = {
    name: "Recent Leaks",
    image: "https://i.ibb.co/7xRv4H2r/sdffsdsdf.png",
    data: {
      "Latest Additions": recentData
        .filter(song => {
           const eName = song.extra2 || song.extra;
           return eName !== 'NASIR' && eName !== 'K.T.S.E.' && eName !== 'NEVER STOP' && eName !== 'DAYTONA' && eName !== 'The Elementary School Dropout';
        })
        .map(song => {
          const rawEraName = song.extra2 || song.extra;
          const cleanEraName = rawEraName ? getCleanSongNameWithTags(rawEraName) : '';
          const realEra = Object.values(data?.eras || {}).find((e: any) => e.name === rawEraName || e.name === cleanEraName) as Era;
          return {
            ...song,
            image: CUSTOM_IMAGES[rawEraName || ''] || CUSTOM_IMAGES[cleanEraName || ''] || CUSTOM_IMAGES[realEra?.name || ''] || realEra?.image || song.image,
            realEra
          };
        })
    }
  };

  const handleRandomSongClick = () => {
    if (!data?.eras) return;
    
    const allMusicSongs: (Song & { realEra: Era })[] = [];
    Object.keys(data.eras).forEach(eraKey => {
      const era = data.eras[eraKey];
      
      if (era.name === 'NASIR' || era.name === 'K.T.S.E.' || era.name === 'NEVER STOP' || era.name === 'DAYTONA') return;

      if (era.data) {
        Object.values(era.data).flat().forEach(song => {
          const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
          const isNotAvailable = isSongNotAvailable(song, rawUrl);
          const isPlayable = rawUrl && (rawUrl.includes('pillows.su/f/') || rawUrl.includes('pillowcase.su/f/') || rawUrl.includes('temp.imgur.gg/f/') || rawUrl.includes('krakenfiles.com/view/')) && !isNotAvailable;

          if (isPlayable) {
             allMusicSongs.push({ ...song, realEra: era });
          }
        });
      }
    });

    if (allMusicSongs.length === 0) return;

    const randomIdx = Math.floor(Math.random() * allMusicSongs.length);
    const randomSong = allMusicSongs[randomIdx];

    let contextPlaylist: Song[] = [];
    if (isShuffle) {
      const others = allMusicSongs.filter((_, idx) => idx !== randomIdx);
      const shuffledOthers = others.sort(() => 0.5 - Math.random()).slice(0, 50);
      contextPlaylist = [randomSong, ...shuffledOthers];
    } else {
      contextPlaylist = [randomSong];
    }

    handlePlaySong(randomSong, randomSong.realEra, contextPlaylist, true, true, true);
  };

  const isSpotifyActive = activePlayer === 'spotify';
  const isYoutubeActive = activePlayer === 'youtube';
  const isSoundCloudActive = activePlayer === 'soundcloud';

  const youtubeSong: Song | null = isYoutubeActive && youtubeState.currentVideo
    ? { name: youtubeState.currentVideo.title || 'YouTube', extra: 'YouTube', url: '', image: youtubeState.currentVideo.thumbnail, track_length: formatTime(youtubeState.duration) }
    : null;

  const soundcloudSong: Song | null = isSoundCloudActive && soundcloudState.currentTrack
    ? { name: soundcloudState.currentTrack.title, extra: soundcloudState.currentTrack.artist, url: '', image: soundcloudState.currentTrack.thumbnail, track_length: formatTime(soundcloudState.currentTrack.duration / 1000) }
    : null;

  const effectiveSong = isSpotifyActive && spotifyState.currentTrack
    ? spotifyTrackToSong(spotifyState.currentTrack)
    : isYoutubeActive && youtubeSong ? youtubeSong
    : isSoundCloudActive && soundcloudSong ? soundcloudSong
    : currentSong;
  const effectiveEra = isSpotifyActive && spotifyState.currentTrack
    ? spotifyTrackToEra(spotifyState.currentTrack)
    : isYoutubeActive && youtubeState.currentVideo
    ? { name: 'YouTube', image: youtubeState.currentVideo.thumbnail, data: {} }
    : isSoundCloudActive && soundcloudState.currentTrack
    ? { name: 'SoundCloud', image: soundcloudState.currentTrack.thumbnail, data: {} }
    : currentEra;
  const effectiveIsPlaying = isSpotifyActive
    ? spotifyState.isPlaying
    : isYoutubeActive ? youtubeState.isPlaying
    : isSoundCloudActive ? soundcloudState.isPlaying
    : isPlaying;
  const effectiveCurrentTime = isSpotifyActive
    ? spotifyState.position / 1000
    : isYoutubeActive ? youtubeState.position
    : isSoundCloudActive ? soundcloudState.position
    : currentTime;
  const effectiveDuration = isSpotifyActive && spotifyState.currentTrack
    ? spotifyState.currentTrack.duration / 1000
    : isYoutubeActive ? youtubeState.duration
    : isSoundCloudActive ? soundcloudState.duration
    : duration;
  const effectiveTogglePlay = isSpotifyActive
    ? () => { spotifyControls.togglePlay(); }
    : isYoutubeActive ? () => { youtubeControls.togglePlay(); }
    : isSoundCloudActive ? () => { soundcloudControls.togglePlay(); }
    : togglePlay;
  const effectiveSeek = isSpotifyActive
    ? (t: number) => spotifyControls.seek(t * 1000)
    : isYoutubeActive ? (t: number) => youtubeControls.seek(t)
    : isSoundCloudActive ? (t: number) => soundcloudControls.seek(t)
    : handleSeek;
  const effectiveVolumeChange = isSpotifyActive
    ? (v: number) => spotifyControls.setVolume(v)
    : isYoutubeActive ? (v: number) => youtubeControls.setVolume(v)
    : isSoundCloudActive ? (v: number) => soundcloudControls.setVolume(v)
    : setVolume;
  const effectiveNext = isSpotifyActive ? () => spotifyControls.next() : playNext;
  const effectivePrev = isSpotifyActive ? () => spotifyControls.prev() : playPrev;
  const showPlayer = !!effectiveSong && !isFullScreen && !isPlayerClosed;

  return (
    <PlaylistProvider>
    <div className="h-dvh w-full flex overflow-hidden relative bg-yzy-black">
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        crossOrigin="anonymous"
        playsInline
      />

      <AnimatePresence>
        {popupUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111] border border-white/10 rounded-xl w-full h-full max-h-[90vh] flex flex-col overflow-hidden relative shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50">
                <div className="flex items-center gap-2 max-w-[80%]">
                  <span className="text-white/50 text-sm">External Link:</span>
                  <span className="text-white font-medium truncate text-sm">{popupUrl}</span>
                </div>
                <button
                  onClick={() => setPopupUrl(null)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 bg-white w-full h-full relative">
                <iframe 
                  src={popupUrl} 
                  className="w-full h-full border-0 absolute inset-0"
                  allow="fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        <Navbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filters={filters}
          setFilters={setFilters}
          onHomeClick={handleHomeClick}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          onRandomSongClick={handleRandomSongClick}
          isRandomMode={isRandomMode}
          yeiOpen={yeiOpen}
          onYEIClick={() => setYeiOpen(o => !o)}
        />

        <main className={`flex-1 overflow-y-auto relative scroll-smooth bg-[#0a0a0a] flex flex-col ${showPlayer ? 'pb-44 md:pb-28' : ''}`}>
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {activeCategory === 'settings' ? (
                <SettingsView key="settings" onCategoryChange={setActiveCategory} searchQuery={searchQuery} eras={erasArray} artData={artData} stemsData={stemsData} miscData={miscData} />
              ) : activeCategory === 'history' ? (
                <HistoryView key="history" searchQuery={searchQuery} filters={filters} eras={erasArray} historyData={recentData} />
              ) : activeCategory === 'art' ? (
                <ArtGallery key="art" eras={erasArray} artData={artData} searchQuery={searchQuery} filters={filters} />
              ) : activeCategory === 'stems' ? (
                <StemsView
                  key="stems"
                  eras={erasArray}
                  stemsData={stemsData}
                  searchQuery={searchQuery}
                  filters={filters}
                  onPlaySong={handlePlaySong}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  mvData={mvData}
                  remixData={remixData}
                  samplesData={samplesData}
                  toggleFavorite={toggleFavorite}
                  favoriteKeys={favoriteKeys}
                />
              ) : activeCategory === 'misc' ? (
                <MiscView
                  key="misc"
                  eras={erasArray}
                  miscData={miscData}
                  searchQuery={searchQuery}
                  filters={filters}
                  onPlaySong={handlePlaySong}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  mvData={mvData}
                  remixData={remixData}
                  samplesData={samplesData}
                  toggleFavorite={toggleFavorite}
                  favoriteKeys={favoriteKeys}
                />

              ) : activeCategory === 'tracklists' && selectedAlbum ? (
                <TracklistsView
                  key={`tracklists-${selectedAlbum.name}`}
                  data={tracklistsData.filter(t => t.era.toLowerCase() === selectedAlbum.name.toLowerCase())}
                  searchQuery={searchQuery}
                  eras={[...erasArray, ...relatedErasArray]}
                  onPlaySong={handlePlaySong}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  era={selectedAlbum}
                  onBack={() => setSelectedAlbum(null)}
                />
              ) : activeCategory === 'tracklists' ? (
                <EraGrid key="tracklists-grid" eras={filteredEras.filter(e => e.name !== 'Favorites')} onSelectEra={setSelectedAlbum} />
              ) : activeCategory === 'fakes' ? (
                <FakesView
                  key="fakes"
                  eras={erasArray}
                  fakesData={fakesData}
                  searchQuery={searchQuery}
                  filters={filters}
                  onPlaySong={handlePlaySong}
                  currentSong={currentSong || null}
                  isPlaying={isPlaying}
                  toggleFavorite={toggleFavorite}
                  favoriteKeys={favoriteKeys}
                />
              ) : activeCategory === 'videos' ? (
                <VideosView
                  key="videos"
                  eras={erasArray}
                  videosData={videosData}
                  searchQuery={searchQuery}
                />
              ) : activeCategory === 'subalbums' ? (
                <SubAlbumsView
                  key="subalbums"
                  data={subAlbumsData}
                  searchQuery={searchQuery}
                  eras={[...erasArray, ...relatedErasArray]}
                  releasedData={releasedData}
                  onPlaySong={handlePlaySong}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                />
              ) : activeCategory === 'released' ? (
                <ReleasedView
                  key="released"
                  eras={erasArray}
                  releasedData={releasedData}
                  searchQuery={searchQuery}
                  spotifyLoggedIn={spotifyLoggedIn}
                  spotifyReady={spotifyState.isReady}
                  onPlaySpotify={handlePlaySpotifyTrack}
                  youtubeReady={youtubeState.isReady}
                  onPlayYoutube={handlePlayYoutubeTrack}
                  onPlayAudio={handlePlayReleasedAudio}
                  soundcloudReady={soundcloudState.isReady}
                  onPlaySoundCloud={handlePlaySoundCloudTrack}
                  onPlayArchive={handlePlayArchiveTrack}
                  onEmbed={() => { audioRef.current?.pause(); setIsPlaying(false); }}
                />
              ) : activeCategory === 'recent' ? (
                <EraDetail
                  key="recent"
                  era={recentEra}
                  onPlaySong={handlePlaySong}
                  searchQuery={searchQuery}
                  filters={filters}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  mvData={mvData}
                  remixData={remixData}
                  samplesData={samplesData}
                  favoriteKeys={favoriteKeys}
                  toggleFavorite={toggleFavorite}
                  onNavigateToEra={(targetEra) => {
                    const isHidden = HIDDEN_ALBUMS.includes(targetEra.name);
                    const fullEra = [...erasArray, ...relatedErasArray].find(e => e.name === targetEra.name) || targetEra;
                    setSelectedAlbum(fullEra);
                    setActiveCategory(isHidden ? 'related' : 'music');
                  }}
                />
              ) : selectedAlbum ? (
                <EraDetail
                  key={selectedAlbum.name}
                  era={selectedAlbum}
                  onBack={() => {
                    setSelectedAlbum(null);
                    if (!settings.rememberSearch) {
                      setSearchQuery('');
                    }
                  }}
                  onPlaySong={handlePlaySong}
                  searchQuery={searchQuery}
                  filters={filters}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  mvData={mvData}
                  remixData={remixData}
                  samplesData={samplesData}
                  favoriteKeys={favoriteKeys}
                  toggleFavorite={toggleFavorite}
                  onNavigateToEra={(targetEra) => {
                    const isHidden = HIDDEN_ALBUMS.includes(targetEra.name);
                    const fullEra = [...erasArray, ...relatedErasArray].find(e => e.name === targetEra.name) || targetEra;
                    setSelectedAlbum(fullEra);
                    setActiveCategory(isHidden ? 'related' : 'music');
                  }}
                />
              ) : activeCategory === 'playlists' ? (
                <PlaylistsView
                  key="playlists"
                  eras={[...erasArray, ...relatedErasArray]}
                  artData={artData}
                  searchQuery={searchQuery}
                  onPlaySong={handlePlaySong}
                  onToast={showToast}
                />
              ) : activeCategory === 'comps' ? (
                <CompsView
                  key="comps"
                  eras={erasArray}
                  searchQuery={searchQuery}
                />
              ) : activeCategory === 'yedits' ? (
                <YEditsView
                  key="yedits"
                  searchQuery={searchQuery}
                  onPlaySong={handlePlaySong}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                />
              ) : activeCategory === 'related' ? (
                <EraGrid key="related-grid" eras={filteredRelatedEras} onSelectEra={setSelectedAlbum} />
              ) : (
                <EraGrid key="grid" eras={filteredEras} onSelectEra={setSelectedAlbum} />
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto px-6 py-8 text-center border-t border-white/5">
            <p className="text-[10px] text-white/30 leading-relaxed">
              YZYGOLD does not host or hold any illegal files. All links are external and provided as-is for educational and archival purposes only.
            </p>
            <p className="text-[10px] text-white/30 leading-relaxed">
              YZYGOLD 2026 © · v2.0
            </p>
            <p className="text-[10px] text-white/30 leading-relaxed mt-1">
              Logo created by Nr7th on discord
            </p>
            <p className="text-[10px] text-white/30 leading-relaxed mt-1 space-x-3">
              <a href="https://discord.gg/TYqdey3B" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-color)]/50 hover:text-[var(--theme-color)] transition-colors underline">Discord</a>
              <span>·</span>
              <a href="https://docs.google.com/document/d/1b8aidNuSLLHfzgzrJ0uGdWHPuo-uNk6wI21Vscwzid4/edit?tab=t.0#heading=h.coxp3mvb86xr" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-color)]/50 hover:text-[var(--theme-color)] transition-colors underline">Changelog</a>
              <span>·</span>
              <a href="https://docs.google.com/spreadsheets/d/12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM/" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-color)]/50 hover:text-[var(--theme-color)] transition-colors underline">Link For The Sheet</a>
            </p>
          </div>
        </main>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showPlayer && effectiveSong && (
            <PlayerBar
              currentSong={effectiveSong}
              isPlaying={effectiveIsPlaying}
              togglePlay={effectiveTogglePlay}
              onFullScreen={() => {
                setIsFullScreen(true);
                setShowQueue(false);
              }}
              onClose={() => setIsPlayerClosed(true)}
              era={effectiveEra}
              currentTime={effectiveCurrentTime}
              duration={effectiveDuration}
              onSeek={effectiveSeek}
              volume={volume}
              onVolumeChange={effectiveVolumeChange}
              onNext={effectiveNext}
              onPrev={effectivePrev}
              isShuffle={isShuffle}
              toggleShuffle={toggleShuffleState}
              loopMode={loopMode}
              toggleLoop={() => setLoopMode((prev) => (prev + 1) % 3)}
              isFavorite={!isSpotifyActive && !isYoutubeActive && !isSoundCloudActive && currentSong ? favoriteKeys.some(k => k.songName === currentSong.name && k.url === (currentSong.url || (currentSong.urls && currentSong.urls[0]) || '')) : false}
              toggleFavorite={!isSpotifyActive && !isYoutubeActive && !isSoundCloudActive && currentSong ? () => toggleFavorite(currentSong, currentEra?.name || '') : undefined}
              onShowQueue={() => setShowQueue(true)}
              showQueue={showQueue}
              setShowQueue={setShowQueue}
              allowDownload={activeCategory !== 'released'}
              allowFullScreen={!isSpotifyActive && !isSoundCloudActive}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isPlayerClosed && effectiveSong && !isFullScreen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.8, ease: [0.2, 0, 0, 1] } }}
              transition={{ duration: 1.5, ease: [0.2, 0, 0, 1] }}
              className="fixed right-6 z-50 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform drop-shadow-2xl"
              style={{ bottom: 'calc(100vh - 100dvh + 1.5rem)' }}
              onClick={() => setIsPlayerClosed(false)}
              title="Restore Player"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 2000 2000">
                <circle fill="#222" stroke="rgba(255,255,255,0.15)" strokeWidth="80" cx="1000.5" cy="1000.5" r="890.5"/>
                <g transform="translate(1000.5, 1020)">
                  <path stroke="white" strokeWidth="80" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M -250 125 L 0 -125 L 250 125" />
                </g>
              </svg>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {isFullScreen && isYoutubeActive && youtubeState.currentVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
          >
            <button
              onClick={() => setIsFullScreen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${youtubeState.currentVideo.id}?autoplay=1&controls=1&modestbranding=1&rel=0`}
              className="w-full h-full max-w-6xl max-h-[80vh]"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </motion.div>
        )}
        {isFullScreen && effectiveSong && !isSpotifyActive && !isYoutubeActive && !isSoundCloudActive && (
          <FullScreenPlayer
            currentSong={currentSong!}
            nextSong={playlist.length > 0 ? playlist[(currentSongIndex + 1) % playlist.length] : null}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            onClose={() => setIsFullScreen(false)}
            era={currentEra}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            audioRef={audioRef}
            analyserRef={analyserRef}
            onNext={playNext}
            onPrev={playPrev}
            isShuffle={isShuffle}
            toggleShuffle={toggleShuffleState}
            loopMode={loopMode}
            toggleLoop={() => setLoopMode((prev) => (prev + 1) % 3)}
            playlist={playlist}
            currentSongIndex={currentSongIndex}
            shuffledQueue={shuffledQueue}
            volume={volume}
            onVolumeChange={setVolume}
            onPlaySong={(idx) => {
              setCurrentSongIndex(idx);
              const targetSong = playlist[idx];
              if (targetSong && currentEra) {
                const eraToPass = (targetSong as any).realEra || currentEra;
                handlePlaySong(targetSong, eraToPass, playlist, true, true, isRandomMode);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQueue && (
          <QueueModal
            onClose={() => setShowQueue(false)}
            playlist={playlist}
            currentSongIndex={currentSongIndex}
            shuffledQueue={shuffledQueue}
            isShuffle={isShuffle}
            loopMode={loopMode}
            currentEra={currentEra}
            onPlaySong={(idx) => {
              setCurrentSongIndex(idx);
              const targetSong = playlist[idx];
              if (targetSong && currentEra) {
                const eraToPass = (targetSong as any).realEra || currentEra;
                handlePlaySong(targetSong, eraToPass, playlist, true, true, isRandomMode);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLastfmErrorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111] border border-white/10 rounded-xl max-w-lg w-full p-6 md:p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight font-display">
                Please log off & log in back to your Last.fm account from the site!
              </h2>
              
              <div className="space-y-4 mb-8 text-sm text-white/70 leading-relaxed font-medium">
                <p>
                  Vercel (The Hosting of yzygold) had a data breach, including my last.fm api keys! I needed to reset the keys, and now the old last.fm api key that you are using is not working!
                </p>
                <p>
                  dont worry, you are not infected, and the site is not infected. Passwords from last.fm are protected.
                </p>
              </div>

              <button
                onClick={() => setShowLastfmErrorModal(false)}
                className="w-full bg-[var(--theme-color)] text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-[var(--theme-color)]/90 transition-colors"
              >
                I Understand
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChangelog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111] border border-white/10 rounded-xl max-w-lg w-full p-6 md:p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-1 tracking-tight font-display">
                Version 2.0
              </h2>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-6">What's New</p>

              <div className="space-y-4 mb-8 text-sm text-white/70 leading-relaxed">
                <ul className="space-y-4">
                  <li>
                    <strong className="text-white">Playlists</strong>
                    <p className="mt-1">You can now create playlists of released and unreleased leaks and share and download them</p>
                  </li>
                  <li>
                    <strong className="text-white">Sub Albums</strong>
                    <p className="mt-1">This tab was created for albums that don't really have that many songs or are apart of different eras</p>
                  </li>
                  <li>
                    <strong className="text-white">VAULTgold Accounts</strong>
                    <p className="mt-1">This was made so to link your Spotify and Last.fm accounts easier, just make an account in settings</p>
                  </li>
                  <li className="text-white/50">And more general stability and bug fixes</li>
                </ul>

                <div className="border-t border-white/10 pt-4 space-y-2">
                  <p className="text-white font-semibold">TUNE IN TOMORROW FOR THE NEW VAULT GOLD TRACKERS</p>
                  <p className="text-xs space-x-3">
                    <a href="https://discord.gg/TYqdey3B" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-color)]/70 hover:text-[var(--theme-color)] transition-colors underline">Discord</a>
                    <span>·</span>
                    <a href="https://www.reddit.com/r/2YZY2GOLD/" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-color)]/70 hover:text-[var(--theme-color)] transition-colors underline">Reddit</a>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowChangelog(false);
                  localStorage.setItem('v2_0_seen', 'true');

                  const userAgent = navigator.userAgent.toLowerCase();
                  const isBrowserSafari = userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('crios') && !userAgent.includes('android');
                  if (isBrowserSafari) {
                    setTimeout(() => setShowSafariWarning(true), 400);
                  }
                }}
                className="w-full bg-[var(--theme-color)] text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-[var(--theme-color)]/90 transition-colors"
              >
                Got It
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSafariWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111] border border-white/10 rounded-xl max-w-lg w-full p-6 md:p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight font-display text-center">
                Safari Not Recommended
              </h2>
              <div className="space-y-4 mb-8 text-sm text-white/70 leading-relaxed font-medium text-center">
                <p>
                  It looks like you are using Safari. This site does not working well on Safari and it is highly recommended to use Google Chrome or any other browser for the best experience.
                </p>
              </div>
              <button
                onClick={() => setShowSafariWarning(false)}
                className="w-full bg-[var(--theme-color)] text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-[var(--theme-color)]/90 transition-colors"
              >
                I Understand
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDiscordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111] border border-white/10 rounded-xl max-w-lg w-full p-6 md:p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight font-display text-center">
                Discord Rich Presence
              </h2>
              <div className="space-y-4 text-sm text-white/70 leading-relaxed font-medium text-center">
                <p>To use this feature, you must install the requested browser extension.</p>
                <div className="py-4">
                  <a 
                    href="https://chromewebstore.google.com/detail/premid/pnapphbjbnhnnaoaamigfghfkefojekp" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-2 bg-[var(--theme-color)] text-black font-bold uppercase px-6 py-2 rounded-lg hover:bg-[var(--theme-color)]/90 transition-colors"
                  >
                    Install Extension
                  </a>
                </div>
                <p className="text-xs text-white/40">Once installed, your current song will appear on your Discord profile.</p>
              </div>
              <div className="mt-8">
                <button
                  onClick={() => setShowDiscordModal(false)}
                  className="w-full bg-white/10 text-white font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full shadow-[0_8px_30px_rgb(255,255,255,0.2)] text-[15px] font-bold tracking-wide z-[10100] flex items-center gap-3"
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <ChatBubble
        data={data}
        screenContext={{
          activeCategory,
          selectedAlbumName: selectedAlbum?.name,
          currentSongName: currentSong?.name,
          currentEraName: currentEra?.name,
        }}
        showPlayer={showPlayer}
        open={yeiOpen}
        onOpenChange={setYeiOpen}
      />
    </div>
    {pendingImport && (
      <ImportPlaylistModal
        pending={pendingImport}
        onDone={() => {
          setPendingImport(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('playlist');
          window.history.replaceState({}, '', url.toString());
        }}
        onNavigatePlaylists={() => setActiveCategory('playlists')}
      />
    )}
    </PlaylistProvider>
  );
}

