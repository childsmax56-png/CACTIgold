import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ALBUM_RELEASE_DATES, CUSTOM_IMAGES } from '../artist.config';
import { Era } from '../types';

function parseYear(date: string): string {
  const m = date.match(/(\d{4})$/);
  return m ? m[1] : 'Unknown';
}

function formatDate(date: string): string {
  if (date === '??/??/????') return 'Unknown';
  if (date.startsWith('??/??/')) return date.slice(6);
  const [mm, dd, yyyy] = date.split('/');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(mm) - 1]} ${parseInt(dd)}, ${yyyy}`;
}

// Extract years only from era timeline events (CSV important dates — prose descriptions
// reference years out of context and cause incorrect placement)
function resolveUnknownDate(timeline: string | undefined): { first: number; last: number; display: string } | null {
  if (!timeline) return null;
  const years = [...timeline.matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .map(m => parseInt(m[1]))
    .filter(y => y >= 1990 && y <= 2030);
  if (years.length === 0) return null;
  const first = Math.min(...years);
  const last = Math.max(...years);
  return { first, last, display: first === last ? `${first}` : `${first}–${last}` };
}

interface EraEvent {
  date: string;
  event: string;
}

function parseEraEvents(raw: string | undefined): EraEvent[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map(line => {
      const m = line.match(/\((\d{2}\/\d{2}\/\d{4})\)\s*\((.+)\)\s*$/);
      return m ? { date: m[1], event: m[2].trim() } : null;
    })
    .filter(Boolean) as EraEvent[];
}

interface TimelineViewProps {
  eras: Era[];
  searchQuery: string;
  onSelectEra: (era: Era) => void;
}

type TimelineItem =
  | { type: 'year'; year: string }
  | { type: 'era'; eraName: string; date: string; displayDate: string; era: Era | null; songCount: number; isReleased: boolean; events: EraEvent[] }
  | { type: 'event'; date: string; event: string };

export function TimelineView({ eras, searchQuery, onSelectEra }: TimelineViewProps) {
  const items = useMemo<TimelineItem[]>(() => {
    const entries = Object.entries(ALBUM_RELEASE_DATES);

    const filtered = searchQuery
      ? entries.filter(([name]) => name.toLowerCase().includes(searchQuery.toLowerCase()))
      : entries;

    // Build year groups — fully-unknown dates get their year from description + timeline events
    const groups: Record<string, Array<{ eraName: string; date: string; displayDate: string; era: Era | null }>> = {};
    const yearSet = new Set<string>();

    for (const [eraName, date] of filtered) {
      const era = eras.find(e => e.name === eraName) ?? null;
      let year: string;
      let displayDate: string;

      if (date === '??/??/????') {
        const range = resolveUnknownDate(era?.timeline);
        year = range ? String(range.last) : 'Unknown';
        displayDate = range ? range.display : 'Unknown';
      } else {
        year = parseYear(date);
        displayDate = formatDate(date);
      }

      if (!groups[year]) groups[year] = [];
      groups[year].push({ eraName, date, displayDate, era });
      yearSet.add(year);
    }

    // Sort years chronologically; 'Unknown' always goes last
    const yearOrder = [...yearSet].sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return parseInt(a) - parseInt(b);
    });

    const result: TimelineItem[] = [];
    for (const year of yearOrder) {
      result.push({ type: 'year', year });
      for (const { eraName, date, displayDate, era } of groups[year]) {
        const songCount = era ? Object.values(era.data).flat().length : 0;
        const events = parseEraEvents(era?.timeline);
        result.push({ type: 'era', eraName, date, displayDate, era, songCount, isReleased: !date.startsWith('??'), events });
        for (const ev of events) {
          result.push({ type: 'event', date: ev.date, event: ev.event });
        }
      }
    }
    return result;
  }, [eras, searchQuery]);

  return (
    <motion.div
      key="timeline"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="px-4 md:px-8 py-8 pb-32 max-w-2xl mx-auto"
    >
      <div className="relative">
        {/* Vertical line — centered in the w-6 dot column (24px / 2 = 12px = left-3) */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-white/10" />

        {items.map((item, i) => {
          if (item.type === 'year') {
            return (
              <motion.div
                key={`year-${item.year}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.006, 0.3) }}
                className={`flex items-center gap-4 ${i === 0 ? 'mb-3' : 'mt-10 mb-3'}`}
              >
                <div className="w-6 shrink-0 flex justify-center z-10">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--theme-color)', boxShadow: '0 0 10px var(--theme-color)55' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white/80" />
                  </div>
                </div>
                <span className="text-2xl font-black text-white tracking-tight">{item.year}</span>
              </motion.div>
            );
          }

          if (item.type === 'event') {
            return (
              <motion.div
                key={`event-${item.date}-${item.event}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.006, 0.4) }}
                className="flex items-start gap-3 mb-1.5 ml-3"
              >
                {/* Small diamond event dot */}
                <div className="w-3 shrink-0 flex justify-center pt-1.5 z-10">
                  <div className="w-1 h-1 rounded-sm bg-white/20 rotate-45" />
                </div>
                <div className="flex-1 min-w-0 flex items-baseline gap-2 py-0.5">
                  <span className="text-[11px] font-mono text-white/30 shrink-0 tabular-nums">
                    {formatDate(item.date)}
                  </span>
                  <span className="text-[11px] text-white/45 leading-snug">{item.event}</span>
                </div>
              </motion.div>
            );
          }

          // era item
          const image = CUSTOM_IMAGES[item.eraName] ?? item.era?.image;
          return (
            <motion.div
              key={item.eraName}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.006, 0.4) }}
              onClick={() => item.era && onSelectEra(item.era)}
              className={`flex items-center gap-3 mb-1.5 group ${item.era ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {/* Dot on line */}
              <div className="w-6 shrink-0 flex justify-center z-10">
                <div className="w-2 h-2 rounded-full bg-white/20 transition-colors duration-200" />
              </div>

              {/* Card */}
              <div
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] transition-all duration-200 ${
                  item.era
                    ? 'group-hover:bg-white/[0.06] group-hover:border-white/15'
                    : 'opacity-40'
                }`}
              >
                {/* Cover */}
                <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-white/5">
                  {image ? (
                    <img
                      src={image}
                      alt={item.eraName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/10" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{item.eraName}</div>
                  <div className="text-xs text-white/40 mt-0.5">{item.displayDate}</div>
                </div>

                {/* Right side metadata */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.songCount > 0 && (
                    <span className="text-xs text-white/25 font-mono hidden sm:inline">
                      {item.songCount}
                    </span>
                  )}
                  {item.isReleased ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-green-500/20 text-green-400 bg-green-500/10 font-semibold uppercase tracking-wider hidden sm:inline">
                      Out
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/30 bg-white/5 font-semibold uppercase tracking-wider hidden sm:inline">
                      Unreleased
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
