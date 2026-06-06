import { useState, useEffect, useCallback } from 'react';
import { Gift, Copy, Check, Users, Percent, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReferralStats {
  referral_code: string;
  referral_count: number;
  rewarded_count: number;
  referral_discount_pct: number;
}

interface Props {
  companyId: string | undefined;
}

export function ReferralsPanel({ companyId }: Props) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    const { data, error: rpcErr } = await supabase.rpc('get_referral_stats', {
      p_company_id: companyId,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setLoading(false);
      return;
    }
    const res = data as { success: boolean; error?: string } & ReferralStats;
    if (!res.success) {
      setError(res.error ?? 'Could not load referral data.');
      setLoading(false);
      return;
    }
    setStats({
      referral_code: res.referral_code,
      referral_count: res.referral_count,
      rewarded_count: res.rewarded_count,
      referral_discount_pct: res.referral_discount_pct,
    });
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const copyCode = async () => {
    if (!stats?.referral_code) return;
    try {
      await navigator.clipboard.writeText(stats.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Gift size={24} className="text-emerald-600" />
          Referral Program
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Share your code with other carriers. When they subscribe, you get 10% off your next subscription month.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Referral count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users size={20} className="text-emerald-600" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Referrals</p>
          </div>
          <p className="text-4xl font-black text-gray-900 tabular-nums">
            {stats?.referral_count ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Companies that signed up with your code</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Sparkles size={20} className="text-indigo-600" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rewards Earned</p>
          </div>
          <p className="text-4xl font-black text-gray-900 tabular-nums">
            {stats?.rewarded_count ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Referrals who purchased a subscription</p>
        </div>
      </div>

      {/* Your code */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 card-shadow mb-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">Your referral code</p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="text-2xl sm:text-3xl font-black text-gray-900 tracking-[0.2em] font-mono">
            {stats?.referral_code ?? '—'}
          </code>
          <button
            type="button"
            onClick={copyCode}
            disabled={!stats?.referral_code}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition shadow-sm disabled:opacity-50"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-4 leading-relaxed">
          New companies enter this code during registration. When they buy a Standard or Unlimited subscription and it is approved, you receive a <strong>10% discount</strong> on your next subscription payment.
        </p>
      </div>

      {/* Active discount */}
      {(stats?.referral_discount_pct ?? 0) > 0 && (
        <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <Percent size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Referral discount active</p>
            <p className="text-xs text-amber-800 mt-0.5">
              You have {stats?.referral_discount_pct}% off your next subscription. It applies automatically when you choose a subscription plan under Billing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
