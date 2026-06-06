import type { Flag } from '../lib/supabase';
import type { FilterFlag } from './SearchBar';

export interface SearchHistoryEntry {
  id: string;
  driverName: string;
  searchedAt: string;
  score: number | null;
  flag: Flag | null;
  query: string;
  flagFilter: FilterFlag;
}

const STORAGE_PREFIX = 'cdlscore_search_history_';

export function loadSearchHistory(userId: string): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(userId: string, entries: SearchHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(entries.slice(0, 50)));
  } catch { /* ignore quota errors */ }
}

export function searchHistoryKey(query: string, flagFilter: FilterFlag): string {
  return `${query.trim().toLowerCase()}|${flagFilter}`;
}

export function isPaidSearchInHistory(
  entries: SearchHistoryEntry[],
  query: string,
  flagFilter: FilterFlag
): boolean {
  const q = query.trim().toLowerCase();
  return entries.some(e => e.query.trim().toLowerCase() === q && e.flagFilter === flagFilter);
}

export function addSearchHistoryEntry(
  userId: string,
  entry: Omit<SearchHistoryEntry, 'id' | 'searchedAt'>
): SearchHistoryEntry[] {
  const existing = loadSearchHistory(userId);
  const newEntry: SearchHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    searchedAt: new Date().toISOString(),
  };
  const filtered = existing.filter(e => e.query !== entry.query || e.flagFilter !== entry.flagFilter);
  const updated = [newEntry, ...filtered].slice(0, 50);
  saveSearchHistory(userId, updated);
  return updated;
}
