import { useState } from 'react';
import { X, CheckCircle, Zap, Star, Sliders } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Confetti } from './Confetti';

interface Props {
  companyId: string;
  companyName: string;
  companyEmail: string;
  onClose: () => void;
}

const PRICE_PER_SEARCH = 6.99;
const MIN_CUSTOM = 3;

type PlanKey = 'starter' | 'pro' | 'custom';

interface Plan {
  key: PlanKey;
  name: string;
  price: number;
  searches: number;
  perSearch: string;
  savings: string | null;
  badge: string | null;
  icon: React.ReactNode;
  highlight: boolean;
}

const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    price: 99,
    searches: 20,
    perSearch: '$4.95',
    savings: 'Save $39.80 vs. pay-per-search',
    badge: null,
    icon: <Zap size={16} />,
    highlight: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 499,
    searches: 80,
    perSearch: '$6.24',
    savings: 'Save $60.20 vs. pay-per-search',
    badge: 'Best Value',
    icon: <Star size={16} />,
    highlight: true,
  },
  {
    key: 'custom',
    name: 'Custom',
    price: 0,
    searches: 0,
    perSearch: `$${PRICE_PER_SEARCH}`,
    savings: null,
    badge: null,
    icon: <Sliders size={16} />,
    highlight: false,
  },
];

export function PurchaseModal({ companyId, companyName, companyEmail, onClose }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('starter');
  const [customCount, setCustomCount] = useState(MIN_CUSTOM);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [sentPlan, setSentPlan] = useState<{ searches: number; total: string } | null>(null);
  const [error, setError] = useState('');

  const getOrderDetails = () => {
    if (selectedPlan === 'custom') {
      return { searches: customCount, total: (customCount * PRICE_PER_SEARCH).toFixed(2) };
    }
    const plan = PLANS.find(p => p.key === selectedPlan)!;
    return { searches: plan.searches, total: plan.price.toFixed(2) };
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    const { searches, total } = getOrderDetails();
    try {
      const { error: err } = await supabase.from('purchase_requests').insert({
        company_id: companyId,
        search_count: searches,
        total_cost: parseFloat(total),
      });
      if (err) throw err;

      const { data: { session } } = await supabase.auth.getSession();
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-purchase-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            companyName,
            companyEmail,
            searchCount: searches,
            totalCost: parseFloat(total),
            planName: selectedPlan === 'custom' ? 'Custom' : PLANS.find(p => p.key === selectedPlan)!.name,
          }),
        }
      ).catch(() => { /* non-critical */ });

      setSentPlan({ searches, total });
      setShowConfetti(true);
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit. Please try again.');
      setLoading(false);
    }
  };

  if (sent && sentPlan) {
    return (
      <>
        {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full px-8 py-8 text-center">
          <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={26} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Request Sent!</h2>
          <p className="text-sm text-gray-600 mb-1">
            Your request for <span className="font-semibold">{sentPlan.searches} searches</span> (${sentPlan.total}) has been submitted.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            An invoice will be sent to <span className="font-medium text-gray-700">{companyEmail}</span>
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
          >
            Done
          </button>
        </div>
      </div>
      </>
    );
  }

  const { searches, total } = getOrderDetails();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Buy More Searches</h2>
            <p className="text-xs text-gray-500 mt-0.5">{companyName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Plan cards */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Choose a plan</p>
            <div className="space-y-2.5">
              {PLANS.map(plan => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => setSelectedPlan(plan.key)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all ${
                    selectedPlan === plan.key
                      ? plan.highlight
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex-shrink-0 ${
                        selectedPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-500'
                      }`}>
                        {plan.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-bold ${
                            selectedPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-900'
                          }`}>
                            {plan.name}
                          </span>
                          {plan.badge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              selectedPlan === plan.key && plan.highlight
                                ? 'bg-white/20 text-white'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        {plan.key !== 'custom' ? (
                          <p className={`text-xs mt-0.5 ${
                            selectedPlan === plan.key && plan.highlight ? 'text-white/70' : 'text-gray-500'
                          }`}>
                            {plan.searches} searches · {plan.perSearch}/search
                          </p>
                        ) : (
                          <p className={`text-xs mt-0.5 ${
                            selectedPlan === plan.key ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            Pick your own quantity · ${PRICE_PER_SEARCH}/search
                          </p>
                        )}
                        {plan.savings && (
                          <p className={`text-xs mt-1 font-medium ${
                            selectedPlan === plan.key && plan.highlight ? 'text-emerald-300' : 'text-emerald-600'
                          }`}>
                            {plan.savings}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {plan.key !== 'custom' ? (
                        <span className={`text-lg font-bold ${
                          selectedPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-900'
                        }`}>
                          ${plan.price}
                        </span>
                      ) : (
                        <span className={`text-sm font-semibold ${
                          selectedPlan === plan.key ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                          Variable
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom quantity picker */}
          {selectedPlan === 'custom' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Number of searches</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCustomCount(c => Math.max(MIN_CUSTOM, c - 1))}
                  className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition text-lg font-bold text-gray-600"
                >
                  −
                </button>
                <input
                  type="number"
                  min={MIN_CUSTOM}
                  value={customCount}
                  onChange={e => setCustomCount(Math.max(MIN_CUSTOM, parseInt(e.target.value) || MIN_CUSTOM))}
                  className="flex-1 border border-gray-300 rounded-lg text-center py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setCustomCount(c => c + 1)}
                  className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition text-lg font-bold text-gray-600"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Minimum {MIN_CUSTOM} searches · ${PRICE_PER_SEARCH} per search</p>
            </div>
          )}

          {/* Order summary */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 flex justify-between text-sm text-gray-600">
              <span>{searches} searches</span>
              <span>${total}</span>
            </div>
            <div className="border-t border-gray-200 px-4 py-3 flex justify-between font-bold">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">${total}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Your request will be reviewed and an invoice sent to <span className="font-medium text-gray-700">{companyEmail}</span>. Searches are added once payment is confirmed.
          </p>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
