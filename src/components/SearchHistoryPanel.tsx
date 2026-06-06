import { History, ExternalLink, Trash2, Search } from 'lucide-react';
import type { SearchHistoryEntry } from '../lib/searchHistory';
import type { Flag } from '../lib/supabase';

interface Props {
  entries: SearchHistoryEntry[];
  onOpen: (entry: SearchHistoryEntry) => void;
  onClear: () => void;
}

function flagLabel(flag: Flag | null) {
  if (flag === 'green') return { text: 'Cleared', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (flag === 'yellow') return { text: 'Check', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (flag === 'red') return { text: 'High Risk', cls: 'bg-red-50 text-red-700 border-red-200' };
  return { text: 'Not found', cls: 'bg-gray-50 text-gray-500 border-gray-200' };
}

function scoreColor(score: number | null) {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-600';
}

export function SearchHistoryPanel({ entries, onOpen, onClear }: Props) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History size={24} className="text-gray-400" />
            Search History
          </h1>
          <p className="text-sm text-gray-500 mt-1">Revisit your previous driver searches</p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <Trash2 size={13} /> Clear all
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-8 py-16 text-center card-shadow">
          <Search size={32} className="text-gray-300 mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-700">No search history yet</p>
          <p className="text-xs text-gray-400 mt-1">Your driver searches will appear here for quick access.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const flag = flagLabel(entry.flag);
            return (
              <div
                key={entry.id}
                className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 card-shadow hover:card-shadow-hover transition-all duration-300 animate-fade-in-up group"
                style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{entry.driverName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(entry.searchedAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>

                {entry.score !== null ? (
                  <div className="text-center flex-shrink-0">
                    <p className={`text-xl font-bold ${scoreColor(entry.score)}`}>{entry.score}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Score</p>
                  </div>
                ) : (
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${flag.cls}`}>
                    {flag.text}
                  </span>
                )}

                {entry.flag && entry.score !== null && (
                  <span className={`hidden sm:inline px-2.5 py-1 rounded-lg text-[10px] font-bold border ${flag.cls}`}>
                    {flag.text}
                  </span>
                )}

                <button
                  onClick={() => onOpen(entry)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition shadow-sm group-hover:shadow-md flex-shrink-0"
                >
                  <ExternalLink size={13} /> Open
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
