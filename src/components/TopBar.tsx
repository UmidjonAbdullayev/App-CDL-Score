import { useState, useRef, useEffect } from 'react';
import {
  Search, Bell, ChevronDown, LogOut, Menu, SlidersHorizontal,
  AlertTriangle, Lock, X, User, Sun, Moon, Check,
} from 'lucide-react';
import type { AppTheme } from '../lib/theme';
import { applyTheme, getStoredTheme, THEME_LABELS } from '../lib/theme';
import type { Company } from '../lib/supabase';
import type { FilterFlag } from './SearchBar';

const FLAG_OPTIONS: { value: FilterFlag; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'green', label: 'Cleared' },
  { value: 'yellow', label: 'Check' },
  { value: 'red', label: 'High Risk' },
];

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  searching: boolean;
  noCredits: boolean;
  hasPendingPurchase: boolean;
  credits: number;
  creditsLow: boolean;
  company?: Company;
  subscriptionMode: boolean;
  onTopUp: () => void;
  onSignOut: () => void;
  onMenuOpen: () => void;
  flagFilter: FilterFlag;
  onFlagFilterChange: (f: FilterFlag) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilter: boolean;
  onClearSearch: () => void;
  hasSearchActive: boolean;
  suggestions?: React.ReactNode;
  showSearch?: boolean;
}

export function TopBar({
  query, onQueryChange, onSearch, onKeyDown, searching,
  noCredits, hasPendingPurchase, credits, creditsLow,
  company, subscriptionMode, onTopUp, onSignOut, onMenuOpen,
  flagFilter, onFlagFilterChange, showFilters, onToggleFilters,
  hasActiveFilter, onClearSearch, hasSearchActive, suggestions, showSearch = true,
}: Props) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme());

  const selectTheme = (next: AppTheme) => {
    setTheme(next);
    applyTheme(next);
  };
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const notifications = [
    { id: '1', text: 'Platform updated with enhanced driver profiles', time: '2h ago' },
    { id: '2', text: creditsLow ? `Only ${credits} searches remaining` : 'Welcome to CDL Score', time: 'Today' },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuOpen}
          className="lg:hidden p-2 -ml-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
        >
          <Menu size={20} />
        </button>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {showSearch ? (
            <div className="relative flex-1 max-w-2xl">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={noCredits || hasPendingPurchase}
                placeholder={hasPendingPurchase ? 'Payment processing...' : noCredits ? 'No searches remaining' : 'Search driver by name...'}
                className="w-full pl-11 pr-24 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-300 focus:bg-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {hasSearchActive && (
                  <button onClick={onClearSearch} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition">
                    <X size={14} />
                  </button>
                )}
                <button
                  onClick={onToggleFilters}
                  disabled={noCredits}
                  className={`p-1.5 rounded-lg transition ${showFilters || hasActiveFilter ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  title="Filters"
                >
                  <SlidersHorizontal size={14} />
                </button>
                <button
                  onClick={onSearch}
                  disabled={noCredits || searching || (!query.trim() && !hasActiveFilter)}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {searching ? '...' : 'Search'}
                </button>
              </div>
              {suggestions}
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
            noCredits
              ? 'bg-red-50 border-red-200 text-red-700'
              : creditsLow
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}>
            {noCredits && <Lock size={12} />}
            {creditsLow && !noCredits && <AlertTriangle size={12} />}
            <span>{credits} <span className="text-gray-400 font-normal">credits</span></span>
          </div>

          {company && (
            <button
              onClick={onTopUp}
              className="hidden sm:block px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 transition shadow-sm hover:shadow-md"
            >
              {subscriptionMode ? 'Subscribe' : 'Top Up'}
            </button>
          )}

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(v => !v)}
              className="relative p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
            >
              <Bell size={18} />
              {creditsLow && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full border-2 border-white" />
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-xl z-50 py-2 animate-fade-in">
                <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Notifications</p>
                {notifications.map(n => (
                  <div key={n.id} className="px-4 py-2.5 hover:bg-gray-50 transition cursor-pointer">
                    <p className="text-sm text-gray-700">{n.text}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{n.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 p-1.5 pr-3 hover:bg-gray-100 rounded-xl transition"
            >
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <User size={14} className="text-white" />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                {company?.name ?? 'Account'}
              </span>
              <ChevronDown size={14} className="text-gray-400 hidden md:block" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-gray-200 shadow-xl z-50 py-1 animate-fade-in">
                {company && (
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{company.name}</p>
                    <p className="text-xs text-gray-400 truncate">{company.email}</p>
                  </div>
                )}
                <button
                  onClick={() => { onTopUp(); setUserMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition sm:hidden"
                >
                  {subscriptionMode ? 'Subscribe' : 'Top Up Credits'}
                </button>
                <div className="px-4 py-2 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Appearance</p>
                  <button
                    type="button"
                    onClick={() => { selectTheme('light'); setUserMenuOpen(false); }}
                    className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2 rounded-lg"
                  >
                    <Sun size={14} className="text-amber-500" />
                    <span className="flex-1">{THEME_LABELS.light}</span>
                    {theme === 'light' && <Check size={14} className="text-gray-900" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { selectTheme('dark'); setUserMenuOpen(false); }}
                    className="w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2 rounded-lg"
                  >
                    <Moon size={14} className="text-indigo-400" />
                    <span className="flex-1">{THEME_LABELS.dark}</span>
                    {theme === 'dark' && <Check size={14} className="text-gray-900" />}
                  </button>
                </div>
                <button
                  onClick={() => { onSignOut(); setUserMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2 border-t border-gray-100"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSearch && showFilters && (
        <div className="px-4 sm:px-6 pb-3 animate-fade-in">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Flag Status</span>
            {FLAG_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => onFlagFilterChange(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                  flagFilter === o.value
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:shadow-sm'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
