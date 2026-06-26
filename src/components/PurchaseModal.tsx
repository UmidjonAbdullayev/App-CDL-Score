import { useState } from 'react';
import { X, CheckCircle, Zap, Star, Building2, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Confetti } from './Confetti';

interface Props {
  companyId: string;
  companyName: string;
  companyEmail: string;
  onClose: () => void;
  referralDiscountPct?: number;
  onPurchaseSubmitted?: () => void;
}

const PRICE_PER_SEARCH = 6.89;

type BillingTab = 'subscription' | 'per-search';
type SubscriptionPlan = 'standard' | 'enterprise';
type PerSearchPlan = 'single' | 'ten' | 'fifty';

const STANDARD_SUBSCRIPTION = {
  price: 199,
  searches: 70,
  name: 'Standard Subscription',
  summary: '70 searches per month with all qualities included',
  whop: 'https://whop.com/checkout/plan_fQtlx5U6kxbl1',
};

const PER_SEARCH_PLANS: {
  key: PerSearchPlan;
  name: string;
  price: number;
  searches: number;
  summary: string;
  savings: string | null;
  badge: string | null;
  highlight: boolean;
  whop: string;
}[] = [
  {
    key: 'single',
    name: '1 Driver Search',
    price: 6.89,
    searches: 1,
    summary: 'Single search',
    savings: null,
    badge: null,
    highlight: false,
    whop: 'https://whop.com/checkout/plan_JRVwXRG5cQ65z',
  },
  {
    key: 'ten',
    name: '10 Driver Searches',
    price: 59.9,
    searches: 10,
    summary: 'Popular bundle',
    savings: 'Save $8.90 vs. individual',
    badge: 'Popular',
    highlight: true,
    whop: 'https://whop.com/checkout/plan_uVTfUpDgVftjo',
  },
  {
    key: 'fifty',
    name: '50 Driver Searches',
    price: 262.5,
    searches: 50,
    summary: 'Best value bundle',
    savings: 'Save $81.50 vs. individual',
    badge: 'Best Value',
    highlight: false,
    whop: 'https://whop.com/checkout/plan_3RImcsZ7qOASF',
  },
];

export function PurchaseModal({
  companyId, companyName, companyEmail, onClose,
  referralDiscountPct = 0, onPurchaseSubmitted,
}: Props) {
  const [billingTab, setBillingTab] = useState<BillingTab>('subscription');
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>('standard');
  const [perSearchPlan, setPerSearchPlan] = useState<PerSearchPlan>('ten');
  const [contactEmail, setContactEmail] = useState(companyEmail);
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [sentMessage, setSentMessage] = useState('');
  const [error, setError] = useState('');

  const subscriptionDiscountActive = billingTab === 'subscription' && referralDiscountPct > 0;

  const applyDiscount = (price: number) => {
    if (!subscriptionDiscountActive || subscriptionPlan !== 'standard') return price;
    return Math.round(price * (1 - referralDiscountPct / 100) * 100) / 100;
  };

  const getPurchaseDetails = () => {
    if (billingTab === 'subscription' && subscriptionPlan === 'standard') {
      const base = STANDARD_SUBSCRIPTION.price;
      const discounted = applyDiscount(base);
      return {
        searches: STANDARD_SUBSCRIPTION.searches,
        total: discounted.toFixed(2),
        baseTotal: base.toFixed(2),
        discountApplied: subscriptionDiscountActive && discounted < base,
        planName: STANDARD_SUBSCRIPTION.name,
        whop: STANDARD_SUBSCRIPTION.whop,
        isSubscription: true,
      };
    }
    const plan = PER_SEARCH_PLANS.find(p => p.key === perSearchPlan)!;
    return {
      searches: plan.searches,
      total: plan.price.toFixed(2),
      baseTotal: plan.price.toFixed(2),
      discountApplied: false,
      planName: plan.name,
      whop: plan.whop,
      isSubscription: false,
    };
  };

  const submitPurchase = async () => {
    setError('');
    setLoading(true);
    const { searches, total, discountApplied, planName, whop, isSubscription } = getPurchaseDetails();
    try {
      const { error: err } = await supabase.from('purchase_requests').insert({
        company_id: companyId,
        search_count: searches,
        total_cost: parseFloat(total),
        is_subscription: isSubscription,
        referral_discount_applied: discountApplied,
      });
      if (err) throw new Error(err.message || 'Failed to create purchase request');

      const { data: { session } } = await supabase.auth.getSession();
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-purchase-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            companyName,
            companyEmail,
            searchCount: searches,
            totalCost: parseFloat(total),
            planName,
          }),
        }
      ).catch(() => { /* non-critical */ });

      setSentMessage(`Your ${planName} request ($${total}) has been submitted.`);
      setShowConfetti(true);
      setSent(true);
      onPurchaseSubmitted?.();
      window.location.href = whop;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit. Please try again.');
      setLoading(false);
    }
  };

  const submitEnterpriseContact = async () => {
    setError('');
    const email = contactEmail.trim();
    const phone = contactPhone.trim();
    if (!email || !phone) {
      setError('Please enter your email and phone number.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.from('enterprise_contact_requests').insert({
        company_id: companyId,
        contact_email: email,
        contact_phone: phone,
      });
      if (err) throw new Error(err.message || 'Failed to submit contact request.');
      setSentMessage('Your Enterprise request was sent. Our team will contact you shortly.');
      setShowConfetti(true);
      setSent(true);
      onPurchaseSubmitted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (billingTab === 'subscription' && subscriptionPlan === 'enterprise') {
      submitEnterpriseContact();
    } else {
      submitPurchase();
    }
  };

  if (sent) {
    return (
      <>
        {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full px-8 py-8 text-center">
            <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={26} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Request Submitted!</h2>
            <p className="text-sm text-gray-600">{sentMessage}</p>
            <button
              onClick={onClose}
              className="mt-6 w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      </>
    );
  }

  const purchaseDetails = billingTab === 'subscription' && subscriptionPlan === 'standard'
    ? getPurchaseDetails()
    : billingTab === 'per-search'
      ? getPurchaseDetails()
      : null;

  const isEnterprise = billingTab === 'subscription' && subscriptionPlan === 'enterprise';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Billing</h2>
            <p className="text-xs text-gray-500 mt-0.5">{companyName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setBillingTab('subscription')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                billingTab === 'subscription' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Subscription
            </button>
            <button
              type="button"
              onClick={() => setBillingTab('per-search')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                billingTab === 'per-search' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pay Per Search
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {subscriptionDiscountActive && billingTab === 'subscription' && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
              <span className="font-bold">{referralDiscountPct}% referral discount</span> applied to Standard subscription.
            </div>
          )}

          {billingTab === 'subscription' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSubscriptionPlan('standard')}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  subscriptionPlan === 'standard'
                    ? 'border-gray-900 bg-gray-900 text-white shadow-lg'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className={`absolute -top-2 left-3 px-2 py-0.5 rounded-full text-xs font-bold ${
                  subscriptionPlan === 'standard' ? 'bg-white text-gray-900' : 'bg-amber-500 text-white'
                }`}>
                  Monthly
                </span>
                <Star size={18} className={subscriptionPlan === 'standard' ? 'text-white' : 'text-gray-400'} />
                <h3 className={`text-base font-bold mt-2 ${subscriptionPlan === 'standard' ? 'text-white' : 'text-gray-900'}`}>
                  Standard
                </h3>
                <p className={`text-xs mt-1 ${subscriptionPlan === 'standard' ? 'text-white/70' : 'text-gray-600'}`}>
                  {STANDARD_SUBSCRIPTION.summary}
                </p>
                <div className={`text-xl font-bold mt-3 ${subscriptionPlan === 'standard' ? 'text-white' : 'text-gray-900'}`}>
                  {subscriptionDiscountActive ? (
                    <>
                      ${applyDiscount(STANDARD_SUBSCRIPTION.price).toFixed(0)}
                      <span className="text-sm line-through opacity-60 ml-1">${STANDARD_SUBSCRIPTION.price}</span>
                    </>
                  ) : (
                    <>${STANDARD_SUBSCRIPTION.price}/mo</>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSubscriptionPlan('enterprise')}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  subscriptionPlan === 'enterprise'
                    ? 'border-indigo-600 bg-indigo-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="absolute -top-2 left-3 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
                  Enterprise
                </span>
                <Building2 size={18} className={subscriptionPlan === 'enterprise' ? 'text-indigo-600' : 'text-gray-400'} />
                <h3 className="text-base font-bold mt-2 text-gray-900">Unlimited</h3>
                <p className="text-xs mt-1 text-gray-600">
                  Custom volume, dedicated support, and enterprise features. Contact us for pricing.
                </p>
                <p className="text-sm font-semibold text-indigo-700 mt-3">Contact for pricing</p>
              </button>
            </div>
          )}

          {billingTab === 'per-search' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PER_SEARCH_PLANS.map(plan => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => setPerSearchPlan(plan.key)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    perSearchPlan === plan.key
                      ? plan.highlight
                        ? 'border-gray-900 bg-gray-900 text-white shadow-lg'
                        : 'border-gray-900 bg-gray-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {plan.badge && (
                    <span className={`absolute -top-2 left-3 px-2 py-0.5 rounded-full text-xs font-bold ${
                      perSearchPlan === plan.key && plan.highlight ? 'bg-white text-gray-900' : 'bg-amber-500 text-white'
                    }`}>
                      {plan.badge}
                    </span>
                  )}
                  <Zap size={16} className={perSearchPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-400'} />
                  <h3 className={`text-sm font-bold mt-2 ${perSearchPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-xs mt-1 ${perSearchPlan === plan.key && plan.highlight ? 'text-white/70' : 'text-gray-600'}`}>
                    {plan.summary}
                  </p>
                  <div className={`text-lg font-bold mt-2 ${perSearchPlan === plan.key && plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                    ${plan.price}
                  </div>
                  {plan.savings && (
                    <p className={`text-[10px] mt-1 ${perSearchPlan === plan.key && plan.highlight ? 'text-emerald-300' : 'text-emerald-600'}`}>
                      {plan.savings}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {isEnterprise && (
            <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Phone size={16} className="text-indigo-600" />
                  Request Enterprise contact
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Share your details and our team will reach out about unlimited access.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
          )}

          {purchaseDetails && (
            <div className="bg-gray-900 text-white rounded-xl p-5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">Order Summary</h3>
                  <p className="text-gray-300 text-sm">
                    {purchaseDetails.isSubscription
                      ? `${purchaseDetails.searches} searches per month`
                      : `${purchaseDetails.searches} driver search${purchaseDetails.searches > 1 ? 'es' : ''}`}
                  </p>
                </div>
                <div className="text-right">
                  {purchaseDetails.discountApplied && (
                    <div className="text-sm text-gray-400 line-through">${purchaseDetails.baseTotal}</div>
                  )}
                  <div className="text-2xl font-bold">${purchaseDetails.total}</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (isEnterprise && (!contactEmail.trim() || !contactPhone.trim()))}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading
              ? 'Submitting…'
              : isEnterprise
                ? 'Request Contact'
                : 'Complete Purchase'}
          </button>
        </div>
      </div>
    </div>
  );
}
