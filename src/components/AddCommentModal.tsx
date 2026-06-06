import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Driver } from '../lib/supabase';
import { InfoTooltip } from './InfoTooltip';

interface Props {
  driver: Driver;
  currentUserId: string | undefined;
  companyId: string | undefined;
  companyName: string;
  isSynthetic?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCommentModal({ driver, currentUserId, companyId, companyName, isSynthetic, onClose, onSuccess }: Props) {
  const [comment, setComment] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [stars, setStars] = useState(5);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!comment.trim()) { setError('Comment cannot be empty.'); return; }
    setLoading(true);

    const phone = driverPhone.trim() || null;

    if (isSynthetic) {
      const slug = driver.full_name.toLowerCase().replace(/\s+/g, '-');
      const row: Record<string, unknown> = {
        driver_slug: slug,
        driver_name: driver.full_name,
        company_name: companyName || 'Unknown Company',
        comment: comment.trim(),
        stars,
        user_id: currentUserId ?? null,
        company_id: companyId ?? null,
      };
      if (phone) row.driver_phone = phone;
      const { error: err } = await supabase.from('synthetic_driver_comments').insert(row);
      if (err) { setError('Failed to add review. Please try again.'); setLoading(false); return; }
    } else {
      const row: Record<string, unknown> = {
        driver_id: driver.id,
        company_name: companyName || 'Unknown Company',
        comment: comment.trim(),
        stars,
        user_id: currentUserId ?? null,
        company_id: companyId ?? null,
      };
      if (phone) row.driver_phone = phone;
      const { error: err } = await supabase.from('driver_comments').insert(row);
      if (err) { setError('Failed to add review. Please try again.'); setLoading(false); return; }
    }

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Add Review</h2>
            <p className="text-xs text-gray-500 mt-0.5">{driver.full_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Company</label>
            <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
              {companyName || 'Unknown Company'}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              Driver Phone Number
              <InfoTooltip />
            </label>
            <input
              type="tel"
              value={driverPhone}
              onChange={e => setDriverPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} type="button" onClick={() => setStars(i)}>
                  <Star size={24} className={i <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comment *</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Share your experience with this driver…"
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50">
              {loading ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
