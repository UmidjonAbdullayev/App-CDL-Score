import { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  reportType: 'driver' | 'comment';
  driverId: string | null;
  commentId: string | null;
  driverName: string;
  reporterUserId: string | undefined;
  reporterCompanyName: string;
  onClose: () => void;
}

export function FlagReportModal({
  reportType,
  driverId,
  commentId,
  driverName,
  reporterUserId,
  reporterCompanyName,
  onClose,
}: Props) {
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'deletion' | 'correction' | 'other'>('correction');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Please describe the issue.'); return; }
    setLoading(true);
    setError('');

    const { error: err } = await supabase.from('flag_reports').insert({
      report_type: reportType,
      driver_id: driverId,
      comment_id: commentId,
      driver_name: driverName,
      reporter_company_name: reporterCompanyName,
      reporter_user_id: reporterUserId ?? null,
      reason: reason.trim(),
      action_requested: action,
    });

    setLoading(false);
    if (err) { setError('Failed to submit report. Please try again.'); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full px-8 py-8 text-center">
          <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Flag size={20} className="text-white" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Report submitted</h3>
          <p className="text-sm text-gray-500 mb-6">Our team will review this and take action as needed.</p>
          <button onClick={onClose} className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Report {reportType === 'driver' ? 'Driver Record' : 'Comment'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{driverName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What are you requesting?</label>
            <div className="flex gap-2">
              {([
                { v: 'correction', label: 'Correction' },
                { v: 'deletion', label: 'Deletion' },
                { v: 'other', label: 'Other' },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAction(v)}
                  className={`flex-1 py-2 text-xs font-semibold border rounded-lg transition ${
                    action === v
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Describe the issue *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="What is incorrect or problematic about this record?"
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
              {loading ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
