import { useState } from 'react';
import { Star, Trash2, ChevronDown, ChevronUp, Plus, MessageSquare, Flag, CornerDownRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Driver, Flag as FlagType, DriverComment } from '../lib/supabase';
import { FlagReportModal } from './FlagReportModal';

interface Props {
  driver: Driver;
  creatorName: string;
  currentUserId: string | undefined;
  currentCompanyName?: string;
  onAddComment: () => void;
  onCommentUpdated: () => void;
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function flagBadge(flag: FlagType) {
  if (flag === 'green') return { label: 'Cleared', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' };
  if (flag === 'yellow') return { label: 'Check', dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' };
  return { label: 'High Risk', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' };
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-600';
}

function barColor(val: number) {
  if (val >= 80) return 'bg-emerald-500';
  if (val >= 60) return 'bg-amber-400';
  return 'bg-red-500';
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-semibold text-gray-800">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor(value)} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

interface ReplyBoxProps {
  commentId: string;
  driverId: string;
  companyName: string;
  userId: string | undefined;
  companyId: string | undefined;
  onDone: () => void;
}

function ReplyBox({ commentId, driverId, companyName, userId, companyId, onDone }: ReplyBoxProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    await supabase.from('driver_comments').insert({
      driver_id: driverId,
      company_name: companyName || 'Unknown Company',
      comment: `↳ ${text.trim()}`,
      stars: 0,
      user_id: userId ?? null,
      company_id: companyId ?? null,
      reply_to: commentId,
    });
    setLoading(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write a reply…"
        className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition"
      >
        {loading ? '…' : 'Reply'}
      </button>
      <button type="button" onClick={onDone} className="px-2 py-1.5 text-gray-400 hover:text-gray-700 text-xs transition">
        Cancel
      </button>
    </form>
  );
}

function CommentRow({
  comment,
  isOwner,
  driverId,
  driverName,
  currentUserId,
  currentCompanyName,
  currentCompanyId,
  onDelete,
  onCommentUpdated,
}: {
  comment: DriverComment;
  isOwner: boolean;
  driverId: string;
  driverName: string;
  currentUserId: string | undefined;
  currentCompanyName: string | undefined;
  currentCompanyId: string | undefined;
  onDelete: () => void;
  onCommentUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);

  const del = async () => {
    setBusy(true);
    await supabase.from('driver_comments').delete().eq('id', comment.id);
    onDelete();
  };

  const isReply = comment.comment.startsWith('↳ ');

  return (
    <>
      <div className={`bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 ${isReply ? 'ml-4 border-l-2 border-l-gray-300' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isReply && <CornerDownRight size={11} className="text-gray-400 flex-shrink-0" />}
            <span className="text-xs font-semibold text-gray-900">{comment.company_name}</span>
            {comment.stars > 0 && (
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={10} className={i <= comment.stars ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isReply && (
              <button
                onClick={() => setShowReply(v => !v)}
                title="Reply"
                className="p-1 text-gray-300 hover:text-gray-600 transition rounded"
              >
                <MessageSquare size={11} />
              </button>
            )}
            <button
              onClick={() => setShowFlagModal(true)}
              title="Report this comment"
              className="p-1 text-gray-300 hover:text-amber-500 transition rounded"
            >
              <Flag size={11} />
            </button>
            {isOwner && (
              <button onClick={del} disabled={busy} className="p-1 text-gray-300 hover:text-red-500 transition rounded">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{isReply ? comment.comment.slice(2) : comment.comment}</p>

        {showReply && (
          <ReplyBox
            commentId={comment.id}
            driverId={driverId}
            companyName={currentCompanyName || 'Unknown Company'}
            userId={currentUserId}
            companyId={currentCompanyId}
            onDone={() => { setShowReply(false); onCommentUpdated(); }}
          />
        )}
      </div>

      {showFlagModal && (
        <FlagReportModal
          reportType="comment"
          driverId={driverId}
          commentId={comment.id}
          driverName={driverName}
          reporterUserId={currentUserId}
          reporterCompanyName={currentCompanyName || 'Unknown Company'}
          onClose={() => setShowFlagModal(false)}
        />
      )}
    </>
  );
}

export function DriverCard({ driver, creatorName, currentUserId, currentCompanyName, onAddComment, onCommentUpdated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showDriverFlagModal, setShowDriverFlagModal] = useState(false);
  const badge = flagBadge(driver.flag);
  const comments = driver.driver_comments ?? [];
  const visible = showAll ? comments : comments.slice(0, 3);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-shadow hover:shadow-sm">
        {/* Collapsed row */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition"
        >
          <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[11px] font-bold">{initials(driver.full_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{driver.full_name}</p>
            <p className="text-[11px] text-gray-400 truncate">{creatorName}</p>
          </div>
          <div className="text-right flex-shrink-0 mr-1">
            <span className={`text-lg font-bold leading-none ${scoreColor(driver.score)}`}>{driver.score}</span>
            <span className="text-xs text-gray-400">/100</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 ${badge.bg} ${badge.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </div>
          <div className="text-gray-400 flex-shrink-0">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </button>

        {/* Expanded panel */}
        {expanded && (
          <div className="border-t border-gray-100 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: metrics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Metrics</p>
                <button
                  onClick={() => setShowDriverFlagModal(true)}
                  title="Report this driver record"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-amber-600 border border-gray-200 hover:border-amber-300 rounded-lg transition"
                >
                  <Flag size={10} /> Report Record
                </button>
              </div>
              <StatBar label="Overall Reliability" value={driver.reliability_pct} />
              <StatBar label="On-Time Rate" value={driver.on_time_pct} />
              <StatBar label="Drug Test Compliance" value={driver.drug_test_pct} />
              <div className="flex items-center gap-1 mt-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={13} className={i <= Math.round(driver.stars) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                ))}
                <span className="text-xs text-gray-400 ml-1">{Number(driver.stars).toFixed(1)}</span>
              </div>
            </div>

            {/* Right: comments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MessageSquare size={11} /> Reviews ({comments.length})
                </p>
                <button
                  onClick={onAddComment}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white rounded-lg text-[11px] font-semibold hover:bg-gray-700 transition"
                >
                  <Plus size={11} /> Add
                </button>
              </div>

              {comments.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No reviews yet.</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {visible.map(c => (
                      <CommentRow
                        key={c.id}
                        comment={c}
                        isOwner={currentUserId === c.user_id}
                        driverId={driver.id}
                        driverName={driver.full_name}
                        currentUserId={currentUserId}
                        currentCompanyName={currentCompanyName}
                        currentCompanyId={driver.company_id ?? undefined}
                        onDelete={onCommentUpdated}
                        onCommentUpdated={onCommentUpdated}
                      />
                    ))}
                  </div>
                  {comments.length > 3 && (
                    <button
                      onClick={() => setShowAll(v => !v)}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
                    >
                      {showAll ? 'Show less' : `View all ${comments.length} reviews`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showDriverFlagModal && (
        <FlagReportModal
          reportType="driver"
          driverId={driver.id}
          commentId={null}
          driverName={driver.full_name}
          reporterUserId={currentUserId}
          reporterCompanyName={currentCompanyName || 'Unknown Company'}
          onClose={() => setShowDriverFlagModal(false)}
        />
      )}
    </>
  );
}
