import { useState, useEffect, useRef } from 'react';
import { Truck, AlertTriangle, Lock, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserCredits, decrementCredits, getDailyStats } from '../lib/credits';
import { CARRIER_POOL, pickDistinctSeeded, COMMENTS_HIGH, COMMENTS_MID, COMMENTS_LOW } from '../lib/commentPool';
import {
  loadSearchHistory,
  addSearchHistoryEntry,
  saveSearchHistory,
  searchHistoryKey,
  isPaidSearchInHistory,
} from '../lib/searchHistory';
import type { SearchHistoryEntry } from '../lib/searchHistory';
import type { Driver, Flag, Company } from '../lib/supabase';
import { DriverCard } from './DriverCard';
import { AddCommentModal } from './AddCommentModal';
import { AdminPanel } from './AdminPanel';
import { StatsBar } from './StatsBar';
import { SearchSuggestions } from './SearchSuggestions';
import { PurchaseModal } from './PurchaseModal';
import { FirstPurchaseModal } from './FirstPurchaseModal';
import { MySubmissionsPanel } from './MySubmissionsPanel';
import { Sidebar, type NavView } from './Sidebar';
import { TopBar } from './TopBar';
import { CommunityFeed } from './CommunityFeed';
import { SearchHistoryPanel } from './SearchHistoryPanel';
import { AnnouncementsPanel } from './AnnouncementsPanel';
import { SettingsPanel } from './SettingsPanel';
import { DriverSearchView } from './DriverSearchView';
import { AddDriverPage } from './AddDriverPage';
import { ReferralsPanel } from './ReferralsPanel';
import { AdminChatWidget } from './AdminChatWidget';
import { useUnreadIndicators } from '../hooks/useUnreadIndicators';
import type { FilterFlag } from './SearchBar';

// Returns true if the string looks like a plausible name (2+ words, letters only)
function looksLikeName(q: string): boolean {
  const trimmed = q.trim();
  if (trimmed.length < 4) return false;
  // Must contain at least one space (first + last name)
  if (!trimmed.includes(' ')) return false;
  // Must be only letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z\s'\-]+$/.test(trimmed)) return false;
  // Each word must be at least 2 chars
  const words = trimmed.split(/\s+/);
  return words.every(w => w.length >= 2);
}

// Seeded pseudo-random from a string
function seededRand(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const norm = Math.abs(h) / 2147483648;
  return Math.floor(norm * (max - min + 1)) + min;
}

// Thin wrapper so local call-sites still work
function pickDistinct<T>(arr: T[], count: number, seed: string): T[] {
  return pickDistinctSeeded(arr, count, seed);
}

// Normalize a name to sorted lowercase words for flip-detection
function nameWords(n: string): string[] {
  return n.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

type SyntheticRpcComment = {
  company_name: string;
  comment: string;
  stars: number;
  source_type: string | null;
  tooltip_text: string | null;
};

function buildSyntheticDriverMetrics(name: string) {
  const nameSeed = name.toLowerCase();

  // Weighted flag targeting: 50% green, 25% yellow, 25% red
  const roll = seededRand(nameSeed + 'flagroll', 1, 100);
  const flag: Flag = roll <= 50 ? 'green' : roll <= 75 ? 'yellow' : 'red';

  // Keep metrics aligned with selected flag so the DB-recomputed score matches.
  const ranges =
    flag === 'green' ? { min: 80, max: 100, starMin: 42, starMax: 50 } :
    flag === 'yellow' ? { min: 50, max: 79, starMin: 30, starMax: 40 } :
    { min: 0, max: 49, starMin: 10, starMax: 28 };

  const reliability = seededRand(nameSeed + 'rel', ranges.min, ranges.max);
  const drugTest    = seededRand(nameSeed + 'drug', ranges.min, ranges.max);
  const onTime      = seededRand(nameSeed + 'ot', ranges.min, ranges.max);
  const score       = Math.round((reliability + drugTest + onTime) / 3);
  const starsRaw    = seededRand(nameSeed + 'stars', ranges.starMin, ranges.starMax) / 10;

  const displayName = name.trim().replace(/\b\w/g, l => l.toUpperCase());

  return { displayName, score, reliability, drugTest, onTime, flag, starsRaw };
}

function normalizeHeaderKey(k: string) {
  return k.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getCol(row: Record<string, unknown>, names: string[]): unknown {
  const byNorm = new Map<string, string>();
  for (const key of Object.keys(row)) {
    byNorm.set(normalizeHeaderKey(key), key);
  }
  for (const name of names) {
    const orig = byNorm.get(normalizeHeaderKey(name));
    if (orig === undefined) continue;
    const v = row[orig];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    return v;
  }
  return undefined;
}

function rowFlagMatchesDriver(row: Record<string, unknown>, flag: Flag): boolean {
  const raw = getCol(row, [
    'flag type', 'flag_type', 'flag', 'type', 'tier', 'risk', 'color', 'status',
  ]);
  if (raw === undefined || raw === null || String(raw).trim() === '') return false;
  const s = String(raw).toLowerCase().trim();

  if (flag === 'green') {
    return (
      s === 'green' || s === 'g' || s === '1'
      || s.includes('green') || s.includes('cleared') || s.includes('safe')
    );
  }
  if (flag === 'yellow') {
    return (
      s === 'yellow' || s === 'y' || s === '2'
      || s.includes('yellow') || s.includes('check') || s.includes('amber') || s.includes('caution')
    );
  }
  if (flag === 'red') {
    return (
      s === 'red' || s === 'r' || s === '3'
      || s.includes('red') || s.includes('high risk') || s.includes('risk')
    );
  }
  return false;
}

function parseStarsFromRow(value: unknown, score: number): number {
  const fallback = score >= 80 ? 5 : score >= 50 ? 4 : 3;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(5, Math.round(value)));
  }
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    const n = Number(String(value));
    if (Number.isFinite(n)) return Math.max(1, Math.min(5, Math.round(n)));
  }
  return fallback;
}

function commentFromRow(row: Record<string, unknown>): string {
  const v = getCol(row, ['comments', 'comment', 'carrier comment', 'carrier comments', 'review', 'text']);
  return v !== undefined ? String(v).trim() : '';
}

function sourceTextFromRow(row: Record<string, unknown>): string {
  const v = getCol(row, ['source type', 'source_type', 'source']);
  return v !== undefined ? String(v).trim() : '';
}

/** Matches CSV label "CDL Score — Driver History Note" (flexible dash/spacing). */
function isCdlDriverHistoryNoteSource(source: string): boolean {
  if (!source) return false;
  const n = source.toLowerCase().replace(/[—–\-]/g, ' ').replace(/\s+/g, ' ').trim();
  return n.includes('driver history note') && (n.includes('cdl') || n.includes('score'));
}

const SYNTHETIC_DATA_TABLES = ['synthetic driver data', 'synthetic_driver_data'] as const;

function normalizeRpcJsonArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const STATIC_DRIVER_SAMPLES: Driver[] = [
  {
    id: 'sample-green-driver',
    full_name: 'Michael Turner',
    score: 92,
    reliability_pct: 95,
    drug_test_pct: 100,
    on_time_pct: 91,
    flag: 'green',
    stars: 5,
    company_id: null,
    created_at: '2026-05-11T00:00:00Z',
    driver_comments: [
      {
        id: 'sample-green-comment-1',
        driver_id: 'sample-green-driver',
        company_name: 'CDL Score',
        comment: 'Driver arrived prepared, communicated professionally throughout onboarding, and completed orientation without issues. Strong reliability history and no known attendance concerns.',
        stars: 5,
        source_type: 'CDL Score — Driver History Note',
        tooltip_text: null,
        user_id: null,
        company_id: null,
        created_at: '2026-05-11T00:00:00Z',
      },
    ],
  },
  {
    id: 'sample-yellow-driver',
    full_name: 'Brandon Cole',
    score: 67,
    reliability_pct: 70,
    drug_test_pct: 88,
    on_time_pct: 64,
    flag: 'yellow',
    stars: 4,
    company_id: null,
    created_at: '2026-05-11T00:00:00Z',
    driver_comments: [
      {
        id: 'sample-yellow-comment-1',
        driver_id: 'sample-yellow-driver',
        company_name: 'CDL Score',
        comment: 'We booked travel after he confirmed, but he needed too many reminders for check calls. It was annoying more than anything.',
        stars: 3,
        source_type: 'Past Driver Comment',
        tooltip_text: null,
        user_id: null,
        company_id: null,
        created_at: '2026-05-11T00:00:00Z',
      },
    ],
  },
  {
    id: 'sample-red-driver',
    full_name: 'Travis Boone',
    score: 38,
    reliability_pct: 41,
    drug_test_pct: 52,
    on_time_pct: 33,
    flag: 'red',
    stars: 2,
    company_id: null,
    created_at: '2026-05-11T00:00:00Z',
    driver_comments: [
      {
        id: 'sample-red-comment-1',
        driver_id: 'sample-red-driver',
        company_name: 'CDL Score',
        comment: '🟡After all hiring process, company booked him a ticket and he confirmed. On the flight day when company texted him if he arrived he said his flight got delayed and he is sleeping. Company checked flight status however there wasnt any delays and flight departed on time. Then driver told he just wouldnt work for the company without giving a proper reason. Both money and time wasted..',
        stars: 2,
        source_type: 'Past Carrier Comment',
        tooltip_text: null,
        user_id: null,
        company_id: null,
        created_at: '2026-05-11T00:00:00Z',
      },
    ],
  },
];

async function fetchSyntheticDriverCsvRows(): Promise<{ rows: Record<string, unknown>[]; error: Error | null; tableUsed: string | null }> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_synthetic_driver_data_rows');

  if (!rpcError) {
    const fromRpc = normalizeRpcJsonArray(rpcData);
    if (fromRpc.length > 0) {
      return { rows: fromRpc, error: null, tableUsed: 'get_synthetic_driver_data_rows (RPC)' };
    }
  }

  let lastErr: Error | null = rpcError ? new Error(rpcError.message) : null;
  for (const table of SYNTHETIC_DATA_TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      lastErr = new Error(error.message);
      continue;
    }
    return { rows: (data ?? []) as Record<string, unknown>[], error: null, tableUsed: table };
  }
  return { rows: [], error: lastErr, tableUsed: null };
}

function fallbackPoolComments(name: string, score: number): SyntheticRpcComment[] {
  const nameSeed = name.toLowerCase();
  const commentCount = seededRand(nameSeed + 'cnt', 2, 4);

  const pool         = score >= 80 ? COMMENTS_HIGH : score >= 50 ? COMMENTS_MID : COMMENTS_LOW;
  const carriers     = pickDistinct(CARRIER_POOL, commentCount, nameSeed + 'co');
  const commentTexts = pickDistinct(pool, commentCount, nameSeed + 'cm');

  const starMin = score >= 80 ? 4 : score >= 50 ? 3 : 1;
  const starMax = score >= 80 ? 5 : score >= 50 ? 4 : 2;

  return carriers.map((carrier, i) => ({
    company_name: carrier,
    comment: commentTexts[i] ?? pool[i % pool.length],
    stars: seededRand(nameSeed + 'cs' + i, starMin, starMax),
    source_type: null,
    tooltip_text: null,
  }));
}

async function buildCommentsFromSyntheticDriverDataTable(
  rawName: string,
  flag: Flag,
  score: number
): Promise<SyntheticRpcComment[]> {
  const { rows: allRows, error: fetchErr, tableUsed } = await fetchSyntheticDriverCsvRows();

  if (import.meta.env.DEV) {
    if (fetchErr) {
      // eslint-disable-next-line no-console
      console.warn(
        '[CDL Score] Could not read synthetic driver CSV table (check name, RLS, and that migration ran).',
        fetchErr.message
      );
    } else if (tableUsed) {
      // eslint-disable-next-line no-console
      console.info(`[CDL Score] Using CSV table "${tableUsed}" (${allRows.length} rows).`);
    }
  }

  if (!allRows.length) return [];

  const withComments = (allRows as Record<string, unknown>[])
    .filter(r => commentFromRow(r).length > 0)
    .sort((a, b) => {
      const idA = String(getCol(a, ['id']) ?? '');
      const idB = String(getCol(b, ['id']) ?? '');
      return idA.localeCompare(idB, undefined, { numeric: true });
    });

  const flagMatched = withComments.filter(r => rowFlagMatchesDriver(r, flag));
  const pool = flagMatched.length ? flagMatched : withComments;

  if (import.meta.env.DEV && !flagMatched.length && withComments.length) {
    // eslint-disable-next-line no-console
    console.warn(
      '[CDL Score] No CSV rows matched flag',
      flag,
      '— using all rows with comments. Align your "flag type" column with green / yellow / red.'
    );
  }

  if (!pool.length) return [];

  const nameSeed = rawName.toLowerCase();

  const cdlHistoryRows = pool.filter(r => isCdlDriverHistoryNoteSource(sourceTextFromRow(r)));
  const pastCarrierRows = pool.filter(r => !isCdlDriverHistoryNoteSource(sourceTextFromRow(r)));

  const rowToPayload = (row: Record<string, unknown>): SyntheticRpcComment => {
    const sourceRaw = getCol(row, ['source type', 'source_type', 'source']);
    const tooltipRaw = getCol(row, ['tooltip text', 'tooltip_text', 'tooltip']);
    const starsRaw = getCol(row, ['stars', 'star', 'rating']);
    return {
      company_name: 'CDL Score Network',
      comment: commentFromRow(row),
      stars: parseStarsFromRow(starsRaw, score),
      source_type: sourceRaw !== undefined ? String(sourceRaw).trim() || null : null,
      tooltip_text: tooltipRaw !== undefined ? String(tooltipRaw).trim() || null : null,
    };
  };

  const pickedRows: Record<string, unknown>[] = [];

  if (cdlHistoryRows.length > 0) {
    const one = pickDistinct(cdlHistoryRows, 1, nameSeed + 'cdlhist')[0];
    if (one) pickedRows.push(one);
  }

  const carrierPickCount = seededRand(nameSeed + 'cnt', 2, 4);
  if (pastCarrierRows.length > 0) {
    const n = Math.min(carrierPickCount, pastCarrierRows.length);
    pickedRows.push(...pickDistinct(pastCarrierRows, n, nameSeed + 'pastcarr'));
  }

  if (!pickedRows.length) return [];

  return pickedRows.map(rowToPayload);
}

async function persistSyntheticDriver(name: string): Promise<Driver | null> {
  const { displayName, score, reliability, drugTest, onTime, flag, starsRaw } =
    buildSyntheticDriverMetrics(name);

  const fromTable = await buildCommentsFromSyntheticDriverDataTable(name, flag, score);
  const comments: SyntheticRpcComment[] = fromTable.length ? fromTable : fallbackPoolComments(name, score);

  const { data, error } = await supabase.rpc('create_synthetic_driver', {
    p_full_name:   displayName,
    p_score:       score,
    p_reliability: reliability,
    p_drug_test:   drugTest,
    p_on_time:     onTime,
    p_flag:        flag,
    p_stars:       starsRaw,
    p_comments:    comments,
  });

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[CDL Score] create_synthetic_driver failed (apply latest Supabase migrations?).', error);
    }
    return null;
  }
  if (!data) return null;

  // Fetch the newly created driver with its comments
  const { data: driver } = await supabase
    .from('drivers')
    .select('*, driver_comments(*)')
    .eq('id', data)
    .maybeSingle();

  return driver as Driver | null;
}

// ~10% chance of "not found" using a seeded value so it's stable per name
function shouldShowNotFound(name: string): boolean {
  return seededRand(name.toLowerCase() + 'notfound', 1, 10) === 1;
}

export function Dashboard() {
  // ── User / company state ────────────────────────────────────────────────
  const [userId, setUserId] = useState<string>();
  const [company, setCompany] = useState<Company>();
  const [credits, setCredits] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionMode, setSubscriptionMode] = useState(false);
  const [hasPendingPurchase, setHasPendingPurchase] = useState(false);
  const [companyRefresh, setCompanyRefresh] = useState(0);
  const [adminPanelInitialTab, setAdminPanelInitialTab] = useState<'requests' | 'companies' | 'drivers' | 'credits' | 'reports' | 'submissions' | 'announcements' | 'chat'>('requests');

  // ── Drivers ──────────────────────────────────────────────────────────────
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [companyNameMap, setCompanyNameMap] = useState<Record<string, string>>({});

  // ── Search state ─────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [flagFilter, setFlagFilter] = useState<FilterFlag>('all');
  const [showFilters, setShowFilters] = useState(false);

  // searchKey = the "committed" search (query + flag) the user last paid for
  // results are only shown when inputKey === searchKey
  const [searchKey, setSearchKey] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState<string>('');

  // Cache: searchKey → filtered Driver[] (may include synthetic)
  const cache = useRef<Map<string, Driver[]>>(new Map());
  // Track which keys returned "not found" so result stays stable
  const notFoundKeys = useRef<Set<string>>(new Set());

  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');


  // ── Modals ───────────────────────────────────────────────────────────────
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showFirstPurchase, setShowFirstPurchase] = useState(false);
  const [commentTarget, setCommentTarget] = useState<Driver | null>(null);

  // ── Stats ────────────────────────────────────────────────────────────────
  const [dailyStats, setDailyStats] = useState({ searches_today: 0, money_saved: 0 });
  const [initLoading, setInitLoading] = useState(true);
  const [submissionsRefresh, setSubmissionsRefresh] = useState(0);

  // ── Layout / navigation ───────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [supportChatOpen, setSupportChatOpen] = useState(false);

  const {
    unreadAnnouncements,
    unreadChat,
    refreshUnread,
    markAnnouncementsViewed,
    clearUnreadChat,
  } = useUnreadIndicators(userId, company?.id, isAdmin);

  useEffect(() => {
    if (activeView === 'announcements') {
      markAnnouncementsViewed();
    }
  }, [activeView, markAnnouncementsViewed]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Small artificial delay so the loading screen is always visible on fast connections
      const minLoadMs = 800;
      const startedAt = Date.now();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [adminRow, c, cu, appSettingResult, stats] = await Promise.all([
        supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle().then(r => r.data),
        getUserCredits(user.id),
        supabase.from('company_users').select('company_id').eq('user_id', user.id).maybeSingle().then(r => r.data),
        supabase.from('app_settings').select('value').eq('key', 'subscription_mode').maybeSingle(),
        getDailyStats(),
      ]);

      setIsAdmin(!!adminRow);
      setCredits(c);
      setSubscriptionMode(appSettingResult?.data?.value === 'true');

      if (cu?.company_id) {
        const { data: co } = await supabase.from('companies').select('*').eq('id', cu.company_id).maybeSingle();
        if (co) setCompany(co);

        // Check for pending purchases
        const { data: pending } = await supabase
          .from('purchase_requests')
          .select('id')
          .eq('company_id', cu.company_id)
          .eq('status', 'pending')
          .limit(1);
        setHasPendingPurchase(!!pending && pending.length > 0);
      }

      setDailyStats(stats);
      setSearchHistory(loadSearchHistory(user.id));

      // Ensure loading screen shows for at least minLoadMs
      const elapsed = Date.now() - startedAt;
      if (elapsed < minLoadMs) await new Promise(r => setTimeout(r, minLoadMs - elapsed));

      setInitLoading(false);
      fetchDrivers();
    })();
  }, [companyRefresh]);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*, driver_comments(*)')
      .order('created_at', { ascending: false });
    if (error || !data) return;

    setAllDrivers(data as Driver[]);
    cache.current.clear(); // invalidate cache on refresh

    // Build company name map
    const ids = [...new Set((data as Driver[]).map(d => d.company_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', ids);
      if (companies) {
        const map: Record<string, string> = {};
        companies.forEach((c: { id: string; name: string }) => { map[c.id] = c.name; });
        setCompanyNameMap(map);
      }
    }
  };

  // ── Compute inputKey whenever query or flag changes ───────────────────────
  useEffect(() => {
    setInputKey(searchHistoryKey(query, flagFilter));
  }, [query, flagFilter]);

  /** Restore a search the user already paid for (cache, history, or current drivers). */
  const restorePaidSearch = (
    q: string,
    flag: FilterFlag,
    historyEntry?: SearchHistoryEntry
  ): boolean => {
    const key = searchHistoryKey(q, flag);

    if (cache.current.has(key) || notFoundKeys.current.has(key)) {
      setSearchKey(key);
      return true;
    }

    const filtered = filterDrivers(q, flag);
    if (filtered.length > 0) {
      cache.current.set(key, filtered);
      setSearchKey(key);
      return true;
    }

    if (historyEntry) {
      const byName = allDrivers.filter(d =>
        d.full_name.toLowerCase() === historyEntry.driverName.toLowerCase() &&
        (flag === 'all' || d.flag === flag)
      );
      if (byName.length > 0) {
        cache.current.set(key, byName);
        setSearchKey(key);
        return true;
      }
    }

    if (isPaidSearchInHistory(searchHistory, q, flag)) {
      notFoundKeys.current.add(key);
      cache.current.set(key, []);
      setSearchKey(key);
      return true;
    }

    return false;
  };

  // ── Filter function (pure, no side-effects) ───────────────────────────────
  const filterDrivers = (q: string, flag: FilterFlag): Driver[] => {
    return allDrivers.filter(d => {
      const matchName = d.full_name.toLowerCase().includes(q.toLowerCase().trim());
      const matchFlag = flag === 'all' || d.flag === flag;
      return matchName && matchFlag;
    });
  };

  // ── Execute search ────────────────────────────────────────────────────────
  const executeSearch = async () => {
    setSearchErr('');
    const q = query.trim();
    const key = inputKey;

    // Validate: must look like a real name
    if (q && !looksLikeName(q)) {
      setSearchErr('Please enter a valid driver name (first and last name).');
      return;
    }

    // Name-flip detection: check if searched words match any existing driver (order-independent)
    if (q && looksLikeName(q)) {
      const qWords = nameWords(q).sort().join(' ');
      const qLower = q.toLowerCase().trim();
      const flipped = allDrivers.find(d => {
        const dLower = d.full_name.toLowerCase().trim();
        if (dLower === qLower) return false; // exact match, not a flip
        return nameWords(d.full_name).sort().join(' ') === qWords;
      });
      if (flipped) {
        setSearchErr(`Did you mean "${flipped.full_name}"? We found a record that may match — try searching that name.`);
        return;
      }
    }

    // If we already have a paid result for this exact key, show it instantly
    if (cache.current.has(key) || notFoundKeys.current.has(key)) {
      setSearchKey(key);
      return;
    }

    // Same query was paid for before (e.g. from search history after cache refresh)
    if (restorePaidSearch(q, flagFilter)) {
      return;
    }

    if (credits <= 0) {
      setSearchErr('You have no searches remaining.');
      return;
    }

    setSearching(true);
    setActiveView('search');

    const runSearch = async () => {
      const filtered = filterDrivers(q, flagFilter);

      if (filtered.length > 0) {
        const result = await decrementCredits(userId!);
        if (!result.success) {
          setSearchErr('Failed to process search. Please try again.');
          return null;
        }
        setCredits(result.creditsLeft);
        cache.current.set(key, filtered);
        return filtered;
      } else if (q && looksLikeName(q)) {
        if (shouldShowNotFound(q)) {
          notFoundKeys.current.add(key);
          cache.current.set(key, []);
          return [] as Driver[];
        } else {
          const result = await decrementCredits(userId!);
          if (!result.success) {
            setSearchErr('Failed to process search. Please try again.');
            return null;
          }
          setCredits(result.creditsLeft);
          const synthetic = await persistSyntheticDriver(q);
          if (synthetic) {
            cache.current.set(key, [synthetic]);
            fetchDrivers();
            return [synthetic];
          }
          cache.current.set(key, []);
          return [] as Driver[];
        }
      } else {
        cache.current.set(key, []);
        return [] as Driver[];
      }
    };

    const [searchResults] = await Promise.all([
      runSearch(),
      new Promise(r => setTimeout(r, 2500)),
    ]);

    if (searchResults === null) {
      setSearching(false);
      return;
    }

    if (userId && q) {
      const top = searchResults[0];
      const updated = addSearchHistoryEntry(userId, {
        driverName: top?.full_name ?? q,
        score: top?.score ?? null,
        flag: top?.flag ?? (searchResults.length === 0 ? null : null),
        query: q,
        flagFilter,
      });
      setSearchHistory(updated);
    }

    setSearchKey(key);
    setSearching(false);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') executeSearch();
  };

  const clearSearch = () => {
    setQuery('');
    setFlagFilter('all');
    setSearchKey(null);
    setSearchErr('');
    setShowFilters(false);
    setShowSuggestions(false);
  };

  const signOut = () => supabase.auth.signOut();

  const openFromHistory = (entry: SearchHistoryEntry) => {
    setQuery(entry.query);
    setFlagFilter(entry.flagFilter);
    setActiveView('search');
    setSearchErr('');
    setShowSuggestions(false);
    restorePaidSearch(entry.query, entry.flagFilter, entry);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const showResults = searchKey !== null && searchKey === inputKey;
  const results = showResults ? (cache.current.get(searchKey) ?? filterDrivers(query, flagFilter)) : [];
  const exampleDrivers = STATIC_DRIVER_SAMPLES;
  const hasActiveFilter = flagFilter !== 'all';
  const creditsLow = credits > 0 && credits <= 5;
  const noCredits = credits === 0;
  const suggestionDrivers = [...allDrivers, ...STATIC_DRIVER_SAMPLES];
  const hasSearchActive = !!(query || hasActiveFilter || showResults);
  const showTopBarSearch = activeView !== 'search' && activeView !== 'add-driver';
  const showCommunityFeed = activeView === 'dashboard';

  if (initLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-5">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center">
            <Truck size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">CDL Score</span>
        </div>
        <div className="w-10 h-10 border-[3px] border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading your dashboard&hellip;</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        onBilling={() => setShowPurchase(true)}
        onAdminChat={() => { setAdminPanelInitialTab('chat'); setShowAdmin(true); }}
        onSupportChat={() => setSupportChatOpen(true)}
        isAdmin={isAdmin}
        unread={{ announcements: unreadAnnouncements, chat: unreadChat }}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          query={query}
          onQueryChange={v => { setQuery(v); setShowSuggestions(true); }}
          onSearch={() => { setActiveView('search'); executeSearch(); }}
          onKeyDown={handleKeyDown}
          searching={searching}
          noCredits={noCredits}
          hasPendingPurchase={hasPendingPurchase}
          credits={credits}
          creditsLow={creditsLow}
          company={company}
          subscriptionMode={subscriptionMode}
          onTopUp={() => setShowPurchase(true)}
          onSignOut={signOut}
          onMenuOpen={() => setSidebarOpen(true)}
          flagFilter={flagFilter}
          onFlagFilterChange={setFlagFilter}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(v => !v)}
          hasActiveFilter={hasActiveFilter}
          onClearSearch={clearSearch}
          hasSearchActive={hasSearchActive}
          showSearch={showTopBarSearch}
          suggestions={
            <SearchSuggestions
              query={query}
              drivers={suggestionDrivers}
              visible={showSuggestions && !searching}
              onSelect={name => { setQuery(name); setShowSuggestions(false); setActiveView('search'); executeSearch(); }}
            />
          }
        />

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 lg:py-8">
            {activeView === 'history' && (
              <SearchHistoryPanel
                entries={searchHistory}
                onOpen={openFromHistory}
                onClear={() => { if (userId) { saveSearchHistory(userId, []); setSearchHistory([]); } }}
              />
            )}

            {activeView === 'referrals' && (
              <ReferralsPanel companyId={company?.id} />
            )}

            {activeView === 'announcements' && <AnnouncementsPanel />}

            {activeView === 'settings' && (
              <SettingsPanel company={company} credits={credits} isAdmin={isAdmin} />
            )}

            {activeView === 'submissions' && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">My Submitted Records</h1>
                  <p className="text-sm text-gray-500 mt-1">Track your driver submission requests</p>
                </div>
                <MySubmissionsPanel companyId={company?.id} refreshTrigger={submissionsRefresh} defaultOpen />
              </div>
            )}

            {activeView === 'search' && (
              <DriverSearchView
                query={query}
                onQueryChange={setQuery}
                onSearch={executeSearch}
                onKeyDown={handleKeyDown}
                searching={searching}
                searchErr={searchErr}
                noCredits={noCredits}
                hasPendingPurchase={hasPendingPurchase}
                flagFilter={flagFilter}
                onFlagFilterChange={setFlagFilter}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(v => !v)}
                hasActiveFilter={hasActiveFilter}
                onClearSearch={clearSearch}
                showSuggestions={showSuggestions}
                onShowSuggestions={setShowSuggestions}
                suggestionDrivers={suggestionDrivers}
                onSuggestionSelect={name => { setQuery(name); setShowSuggestions(false); executeSearch(); }}
                showResults={showResults}
                results={results}
                searchHistory={searchHistory}
                onOpenHistory={openFromHistory}
                companyNameMap={companyNameMap}
                userId={userId}
                companyName={company?.name}
                onAddComment={setCommentTarget}
                onCommentUpdated={fetchDrivers}
                onNavigateAddDriver={() => setActiveView('add-driver')}
              />
            )}

            {activeView === 'add-driver' && (
              <AddDriverPage
                companyId={company?.id}
                companyName={company?.name}
                currentUserId={userId}
                onSuccess={() => { setSubmissionsRefresh(v => v + 1); setActiveView('submissions'); }}
              />
            )}

            {activeView === 'dashboard' && (
              <>
                <div className="mb-6 animate-fade-in">
                  <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                  <p className="text-sm text-gray-500 mt-1">Overview of your driver evaluation activity</p>
                </div>

                <MySubmissionsPanel companyId={company?.id} refreshTrigger={submissionsRefresh} />

                {credits === 0 && company && !company.used_first_time_offer && !subscriptionMode && (
                  <div className="mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl px-5 py-4 card-shadow animate-fade-in">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">
                          Get your first tryout CDL driver search for just{' '}
                          <span className="text-green-600 font-bold">$3.99</span>
                          <span className="text-gray-500 line-through ml-1">$6.89</span>
                        </h3>
                        <p className="text-xs text-gray-600">Start evaluating drivers with our comprehensive verification system.</p>
                      </div>
                      <button onClick={() => setShowFirstPurchase(true)} className="flex-shrink-0 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition">
                        Buy Now
                      </button>
                    </div>
                  </div>
                )}

                {credits === 0 && company && subscriptionMode && (
                  <div className="mb-5 flex items-start gap-3 bg-indigo-900 text-white rounded-2xl px-5 py-4 card-shadow animate-fade-in">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={18} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Subscription mode is enabled</p>
                      <p className="text-xs text-indigo-100 mt-0.5">Choose one of the subscription plans to continue.</p>
                    </div>
                    <button onClick={() => setShowPurchase(true)} className="flex-shrink-0 px-3 py-1.5 bg-white text-indigo-900 text-xs font-bold rounded-xl hover:bg-indigo-50 transition">
                      Choose Subscription
                    </button>
                  </div>
                )}

                {credits === 0 && company && company.used_first_time_offer && !subscriptionMode && (
                  <div className="mb-5 flex items-start gap-3 bg-gray-900 text-white rounded-2xl px-5 py-4 card-shadow animate-fade-in">
                    <Lock size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">You&apos;ve reached your search limit</p>
                      <p className="text-xs text-gray-400 mt-0.5">Purchase more searches to continue evaluating drivers.</p>
                    </div>
                    <button onClick={() => setShowPurchase(true)} className="flex-shrink-0 px-3 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-xl hover:bg-gray-100 transition">
                      Buy Searches
                    </button>
                  </div>
                )}

                {hasPendingPurchase && (
                  <div className="mb-5 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 animate-fade-in">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">Payment Processing</p>
                      <p className="text-xs text-blue-700 mt-0.5">Access is usually activated within a few minutes after payment verification.</p>
                    </div>
                  </div>
                )}

                {creditsLow && company && company.used_first_time_offer && (
                  <div className="mb-5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 animate-fade-in">
                    <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800 font-medium flex-1">
                      You&apos;re running low on searches — <strong>{credits}</strong> remaining.
                    </p>
                    <button onClick={() => setShowPurchase(true)} className="text-xs font-bold text-amber-700 hover:underline">
                      Buy more
                    </button>
                  </div>
                )}

                {exampleDrivers.length > 0 && (
                  <div className="mb-8 animate-fade-in">
                    <p className="text-sm text-gray-500 mb-4 font-medium">Sample records — search to find specific drivers</p>
                    <div className="space-y-4">
                      {exampleDrivers.map((d, i) => (
                        <div key={d.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 100}ms`, opacity: 0 }}>
                          <DriverCard
                            driver={d}
                            creatorName={d.company_id ? (companyNameMap[d.company_id] ?? 'Unknown') : 'CDL Score Network'}
                            currentUserId={userId}
                            currentCompanyName={company?.name}
                            onAddComment={() => setCommentTarget(d)}
                            onCommentUpdated={fetchDrivers}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <StatsBar
                  searchesToday={dailyStats.searches_today}
                  moneySaved={dailyStats.money_saved}
                  totalDrivers={allDrivers.length}
                  safeDrivers={allDrivers.filter(d => d.flag === 'green').length}
                />
              </>
            )}
          </main>

          {showCommunityFeed && <CommunityFeed />}
        </div>
      </div>

      {commentTarget && (
        <AddCommentModal
          driver={commentTarget}
          currentUserId={userId}
          companyId={company?.id}
          companyName={company?.name ?? 'Unknown Company'}
          isSynthetic={false}
          onClose={() => setCommentTarget(null)}
          onSuccess={() => { fetchDrivers(); setCommentTarget(null); }}
        />
      )}

      {showAdmin && (
        <AdminPanel
          onClose={() => { setShowAdmin(false); refreshUnread(); }}
          initialTab={adminPanelInitialTab}
          onChatRead={refreshUnread}
        />
      )}

      {showFirstPurchase && company && !subscriptionMode && (
        <FirstPurchaseModal
          companyId={company.id}
          companyName={company.name}
          companyEmail={company.email}
          onClose={() => setShowFirstPurchase(false)}
          onSuccess={() => setCompanyRefresh(r => r + 1)}
        />
      )}

      {showPurchase && company && (
        <PurchaseModal
          companyId={company.id}
          companyName={company.name}
          companyEmail={company.email}
          subscriptionMode={subscriptionMode}
          referralDiscountPct={company.referral_discount_pct ?? 0}
          onClose={() => setShowPurchase(false)}
          onPurchaseSubmitted={() => setCompanyRefresh(r => r + 1)}
        />
      )}

      {company && !isAdmin && (
        <AdminChatWidget
          companyId={company.id}
          companyName={company.name}
          userId={userId}
          open={supportChatOpen}
          onOpenChange={setSupportChatOpen}
          hasUnread={unreadChat}
          onMarkedRead={() => { clearUnreadChat(); refreshUnread(); }}
        />
      )}
    </div>
  );
}
