import { useState, useEffect } from 'react';
import { X, CheckCircle, Zap, Star, Sliders } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Confetti } from './Confetti';

interface Props {
  companyId: string;
  companyName: string;
  companyEmail: string;
  onClose: () => void;
  subscriptionMode: boolean;
  referralDiscountPct?: number;
  onPurchaseSubmitted?: () => void;
}

const PRICE_PER_SEARCH = 6.89;
const MIN_CUSTOM = 3;

type PlanKey = 'single' | 'five' | 'ten' | 'fifty' | 'hundred' | 'custom' | 'standard' | 'unlimited';

interface Plan {
  key: PlanKey;
  name: string;
  price: number;
  searches: number;
  summary: string;
  perSearch?: string;
  savings: string | null;
  badge: string | null;
  icon: React.ReactNode;
  highlight: boolean;
}

const PER_SEARCH_PLANS: Plan[] = [
  {
    key: 'single',
    name: '1 Driver Search',
    price: 6.89,
    searches: 1,
    summary: 'Pay-per-search',
    perSearch: '$6.89',
    savings: null,
    badge: null,
    icon: <Zap size={16} />,
    highlight: false,
  },
  {
    key: 'five',
    name: '5 Driver Searches',
    price: 33.3,
    searches: 5,
    summary: 'Bundle savings',
    perSearch: '$6.66',
    savings: 'Save $1.95 vs. individual',
    badge: null,
    icon: <Star size={16} />,
    highlight: false,
  },
  {
    key: 'ten',
    name: '10 Driver Searches',
    price: 59.90,
    searches: 10,
    summary: 'Popular bundle',
    perSearch: '$5.99',
    savings: 'Save $8.90 vs. individual',
    badge: 'Popular',
    icon: <Star size={16} />,
    highlight: true,
  },
  {
    key: 'fifty',
    name: '50 Driver Searches',
    price: 262.50,
    searches: 50,
    summary: 'Best value bundle',
    perSearch: '$5.25',
    savings: 'Save $81.50 vs. individual',
    badge: 'Best Value',
    icon: <Star size={16} />,
    highlight: false,
  },
  {
    key: 'hundred',
    name: '100 Driver Searches',
    price: 499.00,
    searches: 100,
    summary: 'Large bundle',
    perSearch: '$4.99',
    savings: 'Save $190.00 vs. individual',
    badge: null,
    icon: <Star size={16} />,
    highlight: false,
  },
  {
    key: 'custom',
    name: 'Custom',
    price: 0,
    searches: 0,
    summary: `Minimum ${MIN_CUSTOM} searches`,
    perSearch: `$${PRICE_PER_SEARCH}`,
    savings: null,
    badge: null,
    icon: <Sliders size={16} />,
    highlight: false,
  },
];

const SUBSCRIPTION_PLANS: Plan[] = [
  {
    key: 'standard',
    name: 'Standard Subscription',
    price: 199,
    searches: 70,
    summary: '70 searches per month with all qualities included',
    savings: null,
    badge: 'Monthly',
    icon: <Star size={16} />,
    highlight: true,
  },
  {
    key: 'unlimited',
    name: 'Unlimited Subscription',
    price: 499,
    searches: 999999,
    summary: 'Unlimited use plus custom agent support and driver data',
    savings: null,
    badge: 'Best Value',
    icon: <Zap size={16} />,
    highlight: false,
  },
];

export function PurchaseModal({
  companyId, companyName, companyEmail, onClose, subscriptionMode,
  referralDiscountPct = 0, onPurchaseSubmitted,
}: Props) {
  const plans = subscriptionMode ? SUBSCRIPTION_PLANS : PER_SEARCH_PLANS;
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(subscriptionMode ? 'standard' : 'ten');
  const [customCount, setCustomCount] = useState(MIN_CUSTOM);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [sentPlan, setSentPlan] = useState<{ searches: number; total: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedPlan(subscriptionMode ? 'standard' : 'ten');
  }, [subscriptionMode]);

  const subscriptionDiscountActive =
    subscriptionMode && referralDiscountPct > 0;

  const applyDiscount = (price: number) => {
    if (!subscriptionDiscountActive) return price;
    return Math.round(price * (1 - referralDiscountPct / 100) * 100) / 100;
  };

  const getOrderDetails = () => {
    if (!subscriptionMode && selectedPlan === 'custom') {
      return {
        searches: customCount,
        total: (customCount * PRICE_PER_SEARCH).toFixed(2),
        baseTotal: (customCount * PRICE_PER_SEARCH).toFixed(2),
        discountApplied: false,
      };
    }
    const plan = plans.find(p => p.key === selectedPlan)!;
    const base = plan.price;
    const discounted = applyDiscount(base);
    return {
      searches: plan.searches,
      total: discounted.toFixed(2),
      baseTotal: base.toFixed(2),
      discountApplied: subscriptionDiscountActive && discounted < base,
    };
  };

  const getPaymentLink = () => {
    const links: Record<PlanKey, string> = {
      single: 'https://whop.com/checkout/plan_JRVwXRG5cQ65z',
      five: 'https://whop.com/checkout/plan_IsqAc1ITex9DC',
      ten: 'https://whop.com/checkout/plan_uVTfUpDgVftjo',
      fifty: 'https://whop.com/checkout/plan_3RImcsZ7qOASF',
      hundred: 'https://whop.com/checkout/plan_rVeQhrQj5liAI',
      custom: 'https://whop.com/checkout/plan_JRVwXRG5cQ65z',
      standard: 'https://whop.com/checkout/plan_fQtlx5U6kxbl1',
      unlimited: 'https://whop.com/checkout/plan_bsijJIMOWQcTg',
    };
    return links[selectedPlan] || links.single;
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    const { searches, total } = getOrderDetails();
    try {
      if (!companyId) {
        throw new Error('Company ID is missing. Please refresh and try again.');
      }

      const isSubscription = subscriptionMode && (selectedPlan === 'standard' || selectedPlan === 'unlimited');
      const { discountApplied } = getOrderDetails();

      const { error: err } = await supabase.from('purchase_requests').insert({
        company_id: companyId,
        search_count: searches,
        total_cost: parseFloat(total),
        is_subscription: isSubscription,
        referral_discount_applied: discountApplied,
      });
      if (err) {
        console.error('Purchase request error:', err);
        throw new Error(err.message || 'Failed to create purchase request');
      }

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
            planName: plans.find(p => p.key === selectedPlan)!.name,
          }),
        }
      ).catch(() => { /* non-critical */ });

      setSentPlan({ searches, total });
      setShowConfetti(true);
      setSent(true);
      onPurchaseSubmitted?.();

      // Redirect to payment
      const paymentLink = getPaymentLink();
      window.location.href = paymentLink;
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
          <h2 className="text-lg font-bold text-gray-900 mb-2">Purchase Submitted!</h2>
          <p className="text-sm text-gray-600 mb-1">
            Your request for <span className="font-semibold">{sentPlan.searches} searches</span> (${sentPlan.total}) has been submitted.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Redirecting to payment&hellip;
          </p>
        </div>
      </div>
      </>
    );
  }

  const { searches, total, baseTotal, discountApplied } = getOrderDetails();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {subscriptionMode ? 'Choose a Subscription' : 'Choose a Plan'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{companyName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {subscriptionDiscountActive && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
              <span className="font-bold">{referralDiscountPct}% referral discount</span> applied to subscription plans.
            </div>
          )}

          {/* Plan cards */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {subscriptionMode ? 'Subscription plans' : 'Choose a plan'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {plans.map(plan => (
                <div
                  key={plan.key}
                  className={`relative rounded-xl border-2 p-4 transition-all cursor-pointer ${
                    selectedPlan === plan.key
                      ? plan.highlight
                        ? 'border-gray-900 bg-gray-900 text-white shadow-lg'
                        : 'border-gray-900 bg-gray-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedPlan(plan.key)}
                >
                  {plan.badge && (
                    <div className={`absolute -top-2 left-3 px-2 py-0.5 rounded-full text-xs font-bold ${
                      selectedPlan === plan.key && plan.highlight
                        ? 'bg-white text-gray-900'
                        : 'bg-amber-500 text-white'
                    }`}>
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-3">
                    <h3 className={`text-base font-bold ${
                      selectedPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-900'
                    }`}>
                      {plan.name}
                    </h3>
                    <p className={`text-xs ${
                      selectedPlan === plan.key && plan.highlight ? 'text-white/70' : 'text-gray-600'
                    }`}>
                      {plan.summary}
                    </p>
                  </div>
                  <div className={`text-right ${
                    selectedPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-900'
                  }`}>
                    <div className="text-xl font-bold">
                      {subscriptionDiscountActive ? (
                        <>
                          <span className={selectedPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-900'}>
                            ${applyDiscount(plan.price).toFixed(0)}
                          </span>
                          <span className={`text-sm line-through ml-1 opacity-60 ${
                            selectedPlan === plan.key && plan.highlight ? 'text-white/60' : 'text-gray-400'
                          }`}>
                            ${plan.price}
                          </span>
                        </>
                      ) : (
                        <>${plan.price}</>
                      )}
                    </div>
                    {plan.savings && (
                      <div className={`text-xs ${
                        selectedPlan === plan.key && plan.highlight ? 'text-emerald-300' : 'text-emerald-600'
                      }`}>
                        {plan.savings}
                      </div>
                    )}
                  </div>
                  {selectedPlan === plan.key && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
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
          <div className="bg-gray-900 text-white rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold">Order Summary</h3>
                <p className="text-gray-300 text-sm">
                  {subscriptionMode
                    ? selectedPlan === 'unlimited'
                      ? 'Unlimited system access'
                      : `${searches} searches per month`
                    : `${searches} driver searches`}
                </p>
              </div>
              <div className="text-right">
                {discountApplied && (
                  <div className="text-sm text-gray-400 line-through">${baseTotal}</div>
                )}
                <div className="text-2xl font-bold">${total}</div>
                {discountApplied && (
                  <div className="text-xs text-emerald-300 font-semibold">{referralDiscountPct}% referral discount</div>
                )}
                {!subscriptionMode && (
                  <div className="text-sm text-gray-300">${(parseFloat(total) / searches).toFixed(2)} per search</div>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            {subscriptionMode
              ? 'Subscription plans are charged monthly and replace per-search top-ups.'
              : 'Complete your purchase securely. You will be redirected to payment.'}
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
            {loading ? 'Processing…' : 'Complete Purchase'}
          </button>
        </div>
      </div>
    </div>
  );
}
