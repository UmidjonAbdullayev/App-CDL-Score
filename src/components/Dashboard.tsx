import { useState, useEffect, useRef } from 'react';
import {
  Search, LogOut, Truck, Plus, SlidersHorizontal, X,
  AlertTriangle, Lock, Settings,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserCredits, decrementCredits, getDailyStats } from '../lib/credits';
import { CARRIER_POOL, pickDistinctSeeded, COMMENTS_HIGH, COMMENTS_MID, COMMENTS_LOW } from '../lib/commentPool';
import type { Driver, Flag, Company } from '../lib/supabase';
import { DriverCard } from './DriverCard';
import { AddDriverModal } from './AddDriverModal';
import { AddCommentModal } from './AddCommentModal';
import { AdminPanel } from './AdminPanel';
import { StatsBar } from './StatsBar';
import { PurchaseModal } from './PurchaseModal';

type FilterFlag = Flag | 'all';
const FLAG_OPTIONS: { value: FilterFlag; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'green', label: 'Cleared' },
  { value: 'yellow', label: 'Check' },
  { value: 'red', label: 'High Risk' },
];

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
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [commentTarget, setCommentTarget] = useState<Driver | null>(null);

  // ── Stats ────────────────────────────────────────────────────────────────
  const [dailyStats, setDailyStats] = useState({ searches_today: 0, money_saved: 0 });
  const [initLoading, setInitLoading] = useState(true);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Small artificial delay so the loading screen is always visible on fast connections
      const minLoadMs = 800;
      const startedAt = Date.now();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [adminRow, c, cu, , stats] = await Promise.all([
        supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle().then(r => r.data),
        getUserCredits(user.id),
        supabase.from('company_users').select('company_id').eq('user_id', user.id).maybeSingle().then(r => r.data),
        fetchDrivers(),
        getDailyStats(),
      ]);

      setIsAdmin(!!adminRow);
      setCredits(c);

      if (cu?.company_id) {
        const { data: co } = await supabase.from('companies').select('*').eq('id', cu.company_id).maybeSingle();
        if (co) setCompany(co);
      }

      setDailyStats(stats);

      // Ensure loading screen shows for at least minLoadMs
      const elapsed = Date.now() - startedAt;
      if (elapsed < minLoadMs) await new Promise(r => setTimeout(r, minLoadMs - elapsed));

      setInitLoading(false);
    })();
  }, []);

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
    setInputKey(`${query.trim().toLowerCase()}|${flagFilter}`);
  }, [query, flagFilter]);

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

    if (credits <= 0) {
      setSearchErr('You have no searches remaining.');
      return;
    }

    setSearching(true);
    await new Promise(r => setTimeout(r, 700));

    const filtered = filterDrivers(q, flagFilter);

    if (filtered.length > 0) {
      // Real results found — charge a credit
      const result = await decrementCredits(userId!);
      if (!result.success) {
        setSearchErr('Failed to process search. Please try again.');
        setSearching(false);
        return;
      }
      setCredits(result.creditsLeft);
      cache.current.set(key, filtered);
    } else if (q && looksLikeName(q)) {
      if (shouldShowNotFound(q)) {
        // Driver not found — do NOT charge a credit
        notFoundKeys.current.add(key);
        cache.current.set(key, []);
      } else {
        // Synthetic driver generated — charge a credit
        const result = await decrementCredits(userId!);
        if (!result.success) {
          setSearchErr('Failed to process search. Please try again.');
          setSearching(false);
          return;
        }
        setCredits(result.creditsLeft);
        const synthetic = await persistSyntheticDriver(q);
        if (synthetic) {
          cache.current.set(key, [synthetic]);
          fetchDrivers();
        } else {
          cache.current.set(key, []);
        }
      }
    } else {
      cache.current.set(key, []);
    }

    setSearchKey(key);
    setSearching(false);
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
  };

  const signOut = () => supabase.auth.signOut();

  // ── Derived ───────────────────────────────────────────────────────────────
  const showResults = searchKey !== null && searchKey === inputKey;
  const results = showResults ? (cache.current.get(searchKey) ?? filterDrivers(query, flagFilter)) : [];
  const exampleDrivers = allDrivers.slice(0, 3);
  const hasActiveFilter = flagFilter !== 'all';
  const creditsLow = credits > 0 && credits <= 5;
  const noCredits = credits === 0;

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
    <div className="min-h-screen bg-gray-50">
      {/* ── Topbar ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
              <Truck size={14} className="text-white" />
            </div>
            <span className="text-base font-bold text-gray-900 tracking-tight">CDL Score</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Company name */}
            {company && (
              <span className="hidden sm:block text-xs font-medium text-gray-500 truncate max-w-[140px]">
                {company.name}
              </span>
            )}

            {/* Credits badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              noCredits
                ? 'bg-red-50 border-red-200 text-red-700'
                : creditsLow
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-gray-100 border-gray-200 text-gray-700'
            }`}>
              {noCredits && <Lock size={11} />}
              {creditsLow && !noCredits && <AlertTriangle size={11} />}
              <span>Searches left: <strong>{credits}</strong></span>
            </div>

            {/* Admin */}
            {isAdmin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="p-1.5 text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                title="Admin Panel"
              >
                <Settings size={15} />
              </button>
            )}

            {/* Sign out */}
            <button onClick={signOut} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition">
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Driver Search</h1>
          <p className="text-sm text-gray-500 mt-0.5">Search and evaluate CDL-A drivers across carrier networks.</p>
        </div>

        {/* No-credits banner */}
        {noCredits && (
          <div className="mb-5 flex items-start gap-3 bg-gray-900 text-white rounded-xl px-5 py-4">
            <Lock size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">You've reached your search limit</p>
              <p className="text-xs text-gray-400 mt-0.5">Purchase more searches to continue evaluating drivers.</p>
            </div>
            <button
              onClick={() => setShowPurchase(true)}
              className="flex-shrink-0 px-3 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-100 transition"
            >
              Buy Searches
            </button>
          </div>
        )}

        {/* Low-credits warning */}
        {creditsLow && (
          <div className="mb-5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800 font-medium flex-1">
              You're running low on searches — <strong>{credits}</strong> remaining.
            </p>
            <button
              onClick={() => setShowPurchase(true)}
              className="text-xs font-bold text-amber-700 hover:underline"
            >
              Buy more
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={noCredits}
              placeholder={noCredits ? 'No searches remaining' : 'Search by driver name… press Enter'}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Filters toggle */}
          <button
            disabled={noCredits}
            onClick={() => setShowFilters(v => !v)}
            className={`px-3 py-2.5 border rounded-xl text-sm font-medium transition flex items-center gap-1.5 disabled:opacity-50 ${
              showFilters || hasActiveFilter
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
          </button>

          {/* Search button */}
          <button
            onClick={executeSearch}
            disabled={noCredits || searching || (!query.trim() && !hasActiveFilter)}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>

          {/* Add driver */}
          <button
            onClick={() => setShowAddDriver(true)}
            className="px-3 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Add Driver</span>
          </button>

          {/* Clear */}
          {(query || hasActiveFilter || showResults) && (
            <button
              onClick={clearSearch}
              className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mb-4 bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap gap-2">
            <p className="w-full text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Flag Status</p>
            {FLAG_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setFlagFilter(o.value)}
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

        {/* Search error */}
        {searchErr && (
          <div className="mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {searchErr}
          </div>
        )}

        {/* ── Results (paid search) ── */}
        {showResults && !searching && (
          <div>
            {results.length > 0 ? (
              <>
                <p className="text-xs text-gray-400 mb-2.5">
                  {results.length} driver{results.length !== 1 ? 's' : ''} found
                </p>
                <div className="space-y-2">
                  {results.map(d => (
                    <DriverCard
                      key={d.id}
                      driver={d}
                      creatorName={d.company_id ? (companyNameMap[d.company_id] ?? 'Unknown') : 'CDL Score Network'}
                      currentUserId={userId}
                      currentCompanyName={company?.name}
                      onAddComment={() => setCommentTarget(d)}
                      onCommentUpdated={fetchDrivers}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl px-6 py-12 text-center">
                <Search size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">Driver not found</p>
                <p className="text-xs text-gray-400 mt-1">
                  No records for <span className="font-medium text-gray-600">"{query.trim()}"</span> in our network.
                  <br />You can add this driver using the <span className="font-medium">Add Driver</span> button.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {searching && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl h-14 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Default view: example cards + stats ── */}
        {!showResults && !searching && !initLoading && (
          <>
            {exampleDrivers.length > 0 && (
              <>
                <p className="text-xs text-gray-400 mb-2.5">Sample records — search to find specific drivers</p>
                <div className="space-y-2">
                  {exampleDrivers.map(d => (
                    <DriverCard
                      key={d.id}
                      driver={d}
                      creatorName={d.company_id ? (companyNameMap[d.company_id] ?? 'Unknown') : 'System'}
                      currentUserId={userId}
                      currentCompanyName={company?.name}
                      onAddComment={() => setCommentTarget(d)}
                      onCommentUpdated={fetchDrivers}
                    />
                  ))}
                </div>
              </>
            )}

            <StatsBar
              searchesToday={dailyStats.searches_today}
              moneySaved={dailyStats.money_saved}
              totalDrivers={allDrivers.length}
              safeDrivers={allDrivers.filter(d => d.flag === 'green').length}
            />
          </>
        )}

        {initLoading && null}
      </main>

      {/* ── Modals ── */}
      {showAddDriver && (
        <AddDriverModal
          companyId={company?.id}
          companyName={company?.name}
          currentUserId={userId}
          onClose={() => setShowAddDriver(false)}
          onSuccess={() => { fetchDrivers(); setShowAddDriver(false); }}
        />
      )}

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

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {showPurchase && company && (
        <PurchaseModal
          companyId={company.id}
          companyName={company.name}
          companyEmail={company.email}
          onClose={() => setShowPurchase(false)}
        />
      )}
    </div>
  );
}
