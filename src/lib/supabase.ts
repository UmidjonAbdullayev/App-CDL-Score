import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Registration gate ──────────────────────────────────────────────────────
// When SignupPage starts registering, it sets this to true.
// App.tsx checks this flag inside onAuthStateChange and holds the session
// in a pending slot instead of immediately routing to Dashboard.
// Once the RPC completes, SignupPage calls commitRegistration() which
// resolves the pending session and App.tsx routes normally.

let _pending = false;
let _pendingSession: Session | null = null;
let _onCommit: ((session: Session | null, isNew: boolean) => void) | null = null;

export const registrationGate = {
  begin() {
    _pending = true;
    _pendingSession = null;
  },
  // Called by onAuthStateChange when a session arrives mid-registration
  holdSession(session: Session | null) {
    _pendingSession = session;
  },
  isPending() {
    return _pending;
  },
  // App.tsx registers this callback once on mount
  onCommit(cb: (session: Session | null, isNew: boolean) => void) {
    _onCommit = cb;
  },
  // SignupPage calls this after RPC succeeds to release the gate
  commit(isNew: boolean) {
    _pending = false;
    const s = _pendingSession;
    _pendingSession = null;
    _onCommit?.(s, isNew);
  },
  // SignupPage calls this on RPC failure — clears gate without routing
  abort() {
    _pending = false;
    _pendingSession = null;
  },
};

export type Flag = 'green' | 'yellow' | 'red';

export interface Company {
  id: string;
  name: string;
  mc_number: string;
  email: string;
  created_at: string;
}

export interface DriverComment {
  id: string;
  driver_id: string;
  company_name: string;
  comment: string;
  stars: number;
  source_type?: string | null;
  tooltip_text?: string | null;
  user_id: string | null;
  company_id: string | null;
  created_at: string;
}

export interface Driver {
  id: string;
  full_name: string;
  score: number;
  reliability_pct: number;
  drug_test_pct: number;
  on_time_pct: number;
  flag: Flag;
  stars: number;
  company_id: string | null;
  created_at: string;
  driver_comments: DriverComment[];
}

export interface PurchaseRequest {
  id: string;
  company_id: string;
  search_count: number;
  total_cost: number;
  status: 'pending' | 'approved' | 'completed';
  created_at: string;
}

export interface FlagReport {
  id: string;
  report_type: 'driver' | 'comment';
  driver_id: string | null;
  comment_id: string | null;
  driver_name: string;
  reporter_company_name: string;
  reporter_user_id: string | null;
  reason: string;
  action_requested: 'deletion' | 'correction' | 'other';
  status: 'open' | 'resolved';
  created_at: string;
}
