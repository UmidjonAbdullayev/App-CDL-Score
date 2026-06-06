import { Search, SlidersHorizontal, X, History, ExternalLink } from 'lucide-react';
import type { Driver } from '../lib/supabase';
import type { SearchHistoryEntry } from '../lib/searchHistory';
import type { FilterFlag } from './SearchBar';
import { DriverCard } from './DriverCard';
import { SearchLoadingSequence } from './SearchLoadingSequence';
import { SearchSuggestions } from './SearchSuggestions';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  searching: boolean;
  searchErr: string;
  noCredits: boolean;
  hasPendingPurchase: boolean;
  flagFilter: FilterFlag;
  onFlagFilterChange: (f: FilterFlag) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilter: boolean;
  onClearSearch: () => void;
  showSuggestions: boolean;
  onShowSuggestions: (v: boolean) => void;
  suggestionDrivers: Driver[];
  onSuggestionSelect: (name: string) => void;
  showResults: boolean;
  results: Driver[];
  searchHistory: SearchHistoryEntry[];
  onOpenHistory: (entry: SearchHistoryEntry) => void;
  companyNameMap: Record<string, string>;
  userId?: string;
  companyName?: string;
  onAddComment: (d: Driver) => void;
  onCommentUpdated: () => void;
  onNavigateAddDriver?: () => void;
}

function scoreColor(score: number | null) {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-600';
}

const FLAG_OPTIONS: { value: FilterFlag; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'green', label: 'Cleared' },
  { value: 'yellow', label: 'Check' },
  { value: 'red', label: 'High Risk' },
];

export function DriverSearchView({
  query, onQueryChange, onSearch, onKeyDown, searching, searchErr,
  noCredits, hasPendingPurchase, flagFilter, onFlagFilterChange,
  showFilters, onToggleFilters, hasActiveFilter, onClearSearch,
  showSuggestions, onShowSuggestions, suggestionDrivers, onSuggestionSelect,
  showResults, results, searchHistory, onOpenHistory,
  companyNameMap, userId, companyName,   onAddComment, onCommentUpdated, onNavigateAddDriver,
}: Props) {
  const hasSearchActive = !!(query || hasActiveFilter || showResults);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Driver Search</h1>
        <p className="text-sm text-gray-500 mt-1">Search the carrier network for driver records</p>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { onQueryChange(e.target.value); onShowSuggestions(true); }}
          onKeyDown={onKeyDown}
          disabled={noCredits || hasPendingPurchase}
          placeholder={hasPendingPurchase ? 'Payment processing...' : noCredits ? 'No searches remaining' : 'Enter driver full name...'}
          className="w-full pl-12 pr-28 py-4 bg-white border border-gray-200 rounded-2xl text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/15 focus:border-gray-300 shadow-sm transition disabled:opacity-50"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {hasSearchActive && (
            <button onClick={onClearSearch} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition">
              <X size={16} />
            </button>
          )}
          <button
            onClick={onToggleFilters}
            disabled={noCredits}
            className={`p-2 rounded-lg transition ${showFilters || hasActiveFilter ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <SlidersHorizontal size={16} />
          </button>
          <button
            onClick={onSearch}
            disabled={noCredits || searching || (!query.trim() && !hasActiveFilter)}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-40"
          >
            Search
          </button>
        </div>
        <SearchSuggestions
          query={query}
          drivers={suggestionDrivers}
          visible={showSuggestions && !searching}
          onSelect={onSuggestionSelect}
        />
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 justify-center mb-6 animate-fade-in">
          {FLAG_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => onFlagFilterChange(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                flagFilter === o.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {searchErr && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
          {searchErr}
        </div>
      )}

      {searchHistory.length > 0 && !showResults && !searching && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <History size={14} className="text-gray-400" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Searches</p>
          </div>
          <div className="space-y-2">
            {searchHistory.slice(0, 8).map(entry => (
              <button
                key={entry.id}
                onClick={() => onOpenHistory(entry)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{entry.driverName}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(entry.searchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {entry.score !== null && (
                  <span className={`text-lg font-bold ${scoreColor(entry.score)}`}>{entry.score}</span>
                )}
                <ExternalLink size={14} className="text-gray-300 group-hover:text-gray-600 transition flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {searching && <SearchLoadingSequence active={searching} />}

      {showResults && !searching && (
        <div className="space-y-4 animate-fade-in-up">
          {results.length > 0 ? (
            results.map(d => (
              <DriverCard
                key={d.id}
                driver={d}
                creatorName={d.company_id ? (companyNameMap[d.company_id] ?? 'Unknown') : 'CDL Score Network'}
                currentUserId={userId}
                currentCompanyName={companyName}
                onAddComment={() => onAddComment(d)}
                onCommentUpdated={onCommentUpdated}
              />
            ))
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl px-8 py-12 text-center card-shadow">
              <Search size={32} className="text-gray-300 mx-auto mb-4" />
              <p className="text-base font-bold text-gray-700">Driver not found</p>
              <p className="text-sm text-gray-400 mt-2">No records for &ldquo;{query.trim()}&rdquo; in our network.</p>
              {onNavigateAddDriver && (
                <button
                  onClick={onNavigateAddDriver}
                  className="mt-5 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition"
                >
                  Add Driver
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
