import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Confetti } from './Confetti';

interface Props {
  companyId: string;
  companyName: string;
  companyEmail: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FirstPurchaseModal({ companyId, companyName, companyEmail, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      if (!companyId) {
        throw new Error('Company ID is missing. Please refresh and try again.');
      }

      const { error: err } = await supabase.from('purchase_requests').insert({
        company_id: companyId,
        search_count: 1,
        total_cost: 3.99,
      });
      if (err) {
        console.error('Purchase request error:', err);
        throw new Error(err.message || 'Failed to create purchase request');
      }

      // Mark first-time offer as used
      const { error: updateErr } = await supabase
        .from('companies')
        .update({ used_first_time_offer: true })
        .eq('id', companyId);
      if (updateErr) {
        console.error('Failed to mark first-time offer as used:', updateErr);
        // For now, don't throw - purchase was successful
        // throw new Error('Purchase successful but failed to update company status');
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
            searchCount: 1,
            totalCost: 3.99,
            planName: 'First Time Discount',
          }),
        }
      ).catch(() => { /* non-critical */ });

      setShowConfetti(true);
      setSent(true);

      // Redirect to payment
      window.location.href = 'https://whop.com/checkout/plan_13iufozLvNo8z';

      // Call success callback
      onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit. Please try again.');
      setLoading(false);
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
            <h2 className="text-lg font-bold text-gray-900 mb-2">Purchase Submitted!</h2>
            <p className="text-sm text-gray-600 mb-1">
              Your request for <span className="font-semibold">1 driver search</span> ($3.99) has been submitted.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Redirecting to payment&hellip;
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">First Time Discount</h2>
            <p className="text-xs text-gray-500 mt-0.5">{companyName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Special offer card */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 mb-1">1 Driver Search</div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-3xl font-bold text-green-600">$3.99</span>
                <span className="text-lg text-gray-500 line-through">$6.89</span>
              </div>
              <div className="text-sm text-gray-600">First time discount</div>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6 text-center">
            Get started with CDL driver verification. Pay securely and get instant access once approved.
          </p>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading ? 'Processing…' : 'Complete Purchase'}
          </button>

          <p className="text-xs text-gray-400 mt-4 text-center">
            Your request will be reviewed and payment processed securely.
          </p>
        </div>
      </div>
    </div>
  );
}