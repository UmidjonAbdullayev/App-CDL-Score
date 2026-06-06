import { useState, useRef } from 'react';
import { Star, ChevronRight, MessageSquare, FileText, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { InfoTooltip } from './InfoTooltip';

interface Props {
  companyId: string | undefined;
  companyName?: string;
  currentUserId?: string;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3;

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
}

export function AddDriverPage({ companyId, companyName, currentUserId, onSuccess }: Props) {
  const [step, setStep] = useState<Step>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [score, setScore] = useState('75');
  const [reliability, setReliability] = useState('80');
  const [onTime, setOnTime] = useState('85');
  const [stars, setStars] = useState(4);
  const [flag, setFlag] = useState<'green' | 'yellow' | 'red'>('green');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [comment, setComment] = useState('');
  const [commentStars, setCommentStars] = useState(4);
  const [commentLoading, setCommentLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyId) {
      setError('You must be linked to a company to submit a driver record.');
      return;
    }
    if (!fullName.trim()) {
      setError('Driver name is required.');
      return;
    }

    setLoading(true);

    const insertRow: Record<string, unknown> = {
      company_id: companyId,
      submitted_by_user_id: currentUserId ?? null,
      full_name: fullName.trim(),
      score: Math.min(100, Math.max(0, parseInt(score) || 0)),
      reliability_pct: Math.min(100, Math.max(0, parseInt(reliability) || 0)),
      drug_test_pct: 100,
      on_time_pct: Math.min(100, Math.max(0, parseInt(onTime) || 0)),
      stars,
      flag,
      status: 'pending' as const,
    };

    if (driverPhone.trim()) insertRow.driver_phone = driverPhone.trim();
    if (yearsExperience.trim()) insertRow.years_experience = parseInt(yearsExperience) || 0;

    const { data: row, error: insErr } = await supabase
      .from('driver_submissions')
      .insert(insertRow)
      .select('id')
      .single();

    if (insErr || !row) {
      setLoading(false);
      setError(insErr?.message ?? 'Failed to submit driver record. Please try again.');
      return;
    }

    const sid = row.id as string;

    if (attachmentFile) {
      const safe = sanitizeFileName(attachmentFile.name);
      const path = `${companyId}/${sid}/${safe}`;
      const { error: upErr } = await supabase.storage
        .from('driver-submission-docs')
        .upload(path, attachmentFile, { upsert: false });

      if (upErr) {
        await supabase.from('driver_submissions').delete().eq('id', sid);
        setLoading(false);
        setError(upErr.message || 'Could not upload attachment.');
        return;
      }

      await supabase.from('driver_submissions').update({ attachment_path: path }).eq('id', sid);
    }

    setSubmissionId(sid);
    setLoading(false);
    setStep(2);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionId) { setStep(3); return; }

    if (comment.trim()) {
      setCommentLoading(true);
      const { error: upErr } = await supabase
        .from('driver_submissions')
        .update({ pending_comment: comment.trim(), pending_comment_stars: commentStars })
        .eq('id', submissionId);

      setCommentLoading(false);
      if (upErr) {
        setError(upErr.message || 'Could not save comment.');
        return;
      }
    }

    setStep(3);
  };

  const finish = () => {
    onSuccess();
    setStep(1);
    setFullName('');
    setDriverPhone('');
    setYearsExperience('');
    setComment('');
    setSubmissionId(null);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Add Driver</h1>
        <p className="text-sm text-gray-500 mt-1">Submit a new driver record for admin review</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {step === 1 && 'Driver details'}
              {step === 2 && 'Add a comment'}
              {step === 3 && 'Submission received'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{step === 3 ? 'Complete' : `Step ${step} of 3`}</p>
          </div>
        </div>

        <div className="h-1 bg-gray-100">
          <div className="h-full bg-gray-900 transition-all duration-300" style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }} />
        </div>

        {step === 1 && (
          <form onSubmit={handleDriverSubmit} className="px-6 py-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
              <input
                type="number"
                min={0}
                max={50}
                value={yearsExperience}
                onChange={e => setYearsExperience(e.target.value)}
                placeholder="e.g. 5"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
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
                    className="w-full px-2 py-2 border border-gray-300 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
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
                    className={`flex-1 py-2 text-xs font-semibold border rounded-xl transition ${flag === v ? cls : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supporting document <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                className="hidden"
                onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <FileText size={14} /> Choose file
                </button>
                {attachmentFile && <span className="text-xs text-gray-600 truncate max-w-[200px]">{attachmentFile.name}</span>}
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? 'Submitting…' : <><span>Continue</span><ChevronRight size={14} /></>}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleCommentSubmit} className="px-6 py-6 space-y-5">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <ClipboardList size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Record for <span className="font-semibold">{fullName}</span> will be reviewed before going live.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Company</label>
              <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">{companyName || 'Unknown Company'}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
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
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(3)} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Skip</button>
              <button type="submit" disabled={commentLoading || !comment.trim()} className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50">
                {commentLoading ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="px-6 py-10 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <ClipboardList size={28} className="text-amber-800" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Report pending</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your driver record is being reviewed. Check <span className="font-semibold">My Submitted Records</span> for updates.
            </p>
            <button type="button" onClick={finish} className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
