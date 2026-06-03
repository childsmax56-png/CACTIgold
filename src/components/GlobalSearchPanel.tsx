import { motion } from 'motion/react';
import { Era, Song } from '../types';

export type GlobalSearchTab = 'music' | 'related' | 'recent' | 'stems' | 'misc' | 'fakes' | 'released';

export interface GlobalSearchResult {
  name: string;
  extra?: string;
  eraName: string;
  tab: GlobalSearchTab;
  era?: Era;
  song?: Song;
}

const TAB_LABELS: Record<GlobalSearchTab, string> = {
  music: 'Music',
  related: 'Related',
  recent: 'Recent',
  stems: 'Stems',
  misc: 'Misc',
  fakes: 'Fakes',
  released: 'Released',
};

const TAB_ORDER: GlobalSearchTab[] = ['music', 'related', 'recent', 'stems', 'misc', 'fakes', 'released'];

interface Props {
  results: GlobalSearchResult[];
  onSelect: (result: GlobalSearchResult) => void;
  query: string;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--theme-color)' }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  );
}

export function GlobalSearchPanel({ results, onSelect, query }: Props) {
  if (results.length === 0) return null;

  const groups = results.reduce<Partial<Record<GlobalSearchTab, GlobalSearchResult[]>>>((acc, r) => {
    if (!acc[r.tab]) acc[r.tab] = [];
    acc[r.tab]!.push(r);
    return acc;
  }, {});

  const activeGroups = TAB_ORDER.filter(tab => groups[tab]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-y-auto"
      style={{ maxHeight: '380px' }}
      onMouseDown={e => e.preventDefault()}
    >
      {activeGroups.map((tab, tabIdx) => (
        <div key={tab}>
          {tabIdx > 0 && <div className="border-t border-white/5" />}
          <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
            {TAB_LABELS[tab]}
          </div>
          {groups[tab]!.map((result, i) => (
            <button
              key={`${result.tab}-${result.eraName}-${result.name}-${i}`}
              onClick={() => onSelect(result)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/90 truncate leading-tight">
                  <HighlightMatch text={result.name} query={query} />
                </div>
                {result.extra && (
                  <div className="text-xs text-white/40 truncate mt-0.5">{result.extra}</div>
                )}
              </div>
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 max-w-[120px] truncate">
                {result.eraName}
              </span>
            </button>
          ))}
        </div>
      ))}
      <div className="px-3 py-2 border-t border-white/5 text-[10px] text-white/25 text-center">
        {results.length} result{results.length !== 1 ? 's' : ''} across all tabs
      </div>
    </motion.div>
  );
}
