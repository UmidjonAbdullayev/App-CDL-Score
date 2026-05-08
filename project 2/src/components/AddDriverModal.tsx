import { useState } from 'react';
import { X, Star, ChevronRight, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  companyId: string | undefined;
  companyName?: string;
  currentUserId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDriverModal({ companyId, companyName, currentUserId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — driver fields
  const [fullName, setFullName] = useState('');
  const [score, setScore] = useState('75');
  const [reliability, setReliability] = useState('80');
  const [onTime, setOnTime] = useState('85');
  const [stars, setStars] = useState(4);
  const [flag, setFlag] = useState<'green' | 'yellow' | 'red'>('green');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2 — optional comment
  const [comment, setComment] = useState('');
  const [commentStars, setCommentStars] = useState(4);
  const [commentLoading, setCommentLoading] = useState(false);
  const [createdDriverId, setCreatedDriverId] = useState<string | null>(null);

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError('Driver name is required.'); return; }
    setLoading(true);

    const { data, error: err } = await supabase.from('drivers').insert({
      full_name: fullName.trim(),
      score: Math.min(100, Math.max(0, parseInt(score) || 0)),
      reliability_pct: Math.min(100, Math.max(0, parseInt(reliability) || 0)),
      drug_test_pct: 100,
      on_time_pct: Math.min(100, Math.max(0, parseInt(onTime) || 0)),
      stars,
      flag,
      company_id: companyId ?? null,
    }).select('id').single();

    setLoading(false);
    if (err || !data) { setError('Failed to add driver. Please try again.'); return; }

    setCreatedDriverId(data.id);
    setStep(2);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !createdDriverId) { finishAndClose(); return; }
    setCommentLoading(true);

    await supabase.from('driver_comments').insert({
      driver_id: createdDriverId,
      company_name: companyName || 'Unknown Company',
      comment: comment.trim(),
      stars: commentStars,
      user_id: currentUserId ?? null,
      company_id: companyId ?? null,
    });

    setCommentLoading(false);
    finishAndClose();
  };

  const finishAndClose = () => { onSuccess(); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {step === 1 ? 'Add Driver Record' : 'Add a Comment'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={18} /></button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-gray-100">
          <div className="h-full bg-gray-900 transition-all duration-300" style={{ width: step === 1 ? '50%' : '100%' }} />
        </div>

        {/* ── Step 1: Driver info ── */}
        {step === 1 && (
          <form onSubmit={handleDriverSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Score', value: score, set: setScore },
                { label: 'Reliability %', value: reliability, set: setReliability },
                { label: 'On-Time %', value: onTime, set: setOnTime },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="number" min={0} max={100} value={value}
                    onChange={e => set(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <button key={i} type="button" onClick={() => setStars(i)}>
                    <Star size={22} className={i <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Flag Status</label>
              <div className="flex gap-2">
                {([
                  { v: 'green', label: 'Cleared', cls: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
                  { v: 'yellow', label: 'Check', cls: 'bg-amber-50 border-amber-300 text-amber-700' },
                  { v: 'red', label: 'High Risk', cls: 'bg-red-50 border-red-300 text-red-700' },
                ] as const).map(({ v, label, cls }) => (
                  <button
                    key={v} type="button" onClick={() => setFlag(v)}
                    className={`flex-1 py-2 text-xs font-semibold border rounded-lg transition ${
                      flag === v ? cls : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                {loading ? 'Adding…' : <><span>Next</span><ChevronRight size={14} /></>}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Optional comment ── */}
        {step === 2 && (
          <form onSubmit={handleCommentSubmit} className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">✓</span>
              </div>
              <p className="text-xs text-emerald-700 font-medium">Driver record created for <span className="font-bold">{fullName}</span>.</p>
            </div>

            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <MessageSquare size={14} />
              <p className="text-sm font-semibold text-gray-700">Add a comment? <span className="text-gray-400 font-normal">(optional)</span></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Company</label>
              <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                {companyName || 'Unknown Company'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <button key={i} type="button" onClick={() => setCommentStars(i)}>
                    <Star size={22} className={i <= commentStars ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Share your experience with this driver…"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={finishAndClose}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={commentLoading || !comment.trim()}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
              >
                {commentLoading ? 'Saving…' : 'Save & Close'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
