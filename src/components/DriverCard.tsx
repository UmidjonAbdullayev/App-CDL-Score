import { useState } from 'react';
import {
  Star, Trash2, ChevronDown, ChevronUp, MessageSquare, Flag,
  CornerDownRight, Info, FileText, AlertTriangle, PenLine, Shield,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Driver, Flag as FlagType, DriverComment } from '../lib/supabase';
import { FlagReportModal } from './FlagReportModal';
import { CrmHiringBanner } from './CrmHiringBanner';

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
  if (flag === 'green') return { label: 'Cleared', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' };
  if (flag === 'yellow') return { label: 'Check', dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' };
  return { label: 'High Risk', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' };
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

function isHistoryNote(source: string | null | undefined) {
  if (!source) return false;
  const n = source.toLowerCase().replace(/[—–\-]/g, ' ').replace(/\s+/g, ' ').trim();
  return n.includes('driver history note');
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-xs font-bold text-gray-800">{value}%</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor(value)} transition-all duration-700 ease-out`}
          style={{ width: `${value}%` }}
        />
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
    <form onSubmit={submit} className="mt-3 flex gap-2">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write a reply…"
        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-300 transition"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition hover:bg-gray-800"
      >
        {loading ? '…' : 'Reply'}
      </button>
      <button type="button" onClick={onDone} className="px-3 py-2 text-gray-400 hover:text-gray-700 text-xs transition">
        Cancel
      </button>
    </form>
  );
}

function CommentCard({
  comment,
  isOwner,
  driverId,
  driverName,
  currentUserId,
  currentCompanyName,
  currentCompanyId,
  onDelete,
  onCommentUpdated,
  infoOpen,
  onInfoToggle,
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
  infoOpen: boolean;
  onInfoToggle: () => void;
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
      <div className={`group bg-white border border-gray-200 rounded-xl p-4 card-shadow hover:card-shadow-hover transition-all duration-300 ${isReply ? 'ml-6 border-l-[3px] border-l-gray-300' : ''}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            {isReply && <CornerDownRight size={12} className="text-gray-400 flex-shrink-0" />}
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-gray-600">
                {comment.company_name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-gray-900 block">{comment.company_name}</span>
              {comment.stars > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={10} className={i <= comment.stars ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {!isReply && (
              <button
                onClick={() => setShowReply(v => !v)}
                title="Reply"
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <MessageSquare size={12} />
              </button>
            )}
            <button
              onClick={() => setShowFlagModal(true)}
              title="Report this comment"
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
            >
              <Flag size={12} />
            </button>
            {isOwner && (
              <button onClick={del} disabled={busy} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {(comment.source_type || comment.tooltip_text) && !isReply && (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {comment.source_type && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-600">
                <Shield size={9} /> {comment.source_type}
              </span>
            )}
            {comment.tooltip_text && (
              <span className="relative inline-flex">
                <button
                  type="button"
                  className="p-0.5 rounded text-gray-400 hover:text-gray-700 focus:outline-none"
                  title={comment.tooltip_text ?? undefined}
                  aria-expanded={infoOpen}
                  onClick={onInfoToggle}
                >
                  <Info size={12} />
                </button>
                {infoOpen && (
                  <span className="absolute left-0 top-full z-20 mt-1 w-60 rounded-xl border border-gray-200 bg-white p-3 text-[11px] leading-snug text-gray-700 shadow-lg animate-fade-in">
                    {comment.tooltip_text}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        <p className="text-sm text-gray-700 leading-relaxed">{isReply ? comment.comment.slice(2) : comment.comment}</p>

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
  const [openInfoCommentId, setOpenInfoCommentId] = useState<string | null>(null);
  const badge = flagBadge(driver.flag);
  const scoreClass = scoreColor(driver.score);
  const comments = driver.driver_comments ?? [];
  const visible = showAll ? comments : comments.slice(0, 3);

  const historyNotes = comments.filter(c => isHistoryNote(c.source_type) && !c.comment.startsWith('↳ '));
  const carrierComments = comments.filter(c => !isHistoryNote(c.source_type));

  return (
    <>
      <div className={`bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all duration-400 card-shadow hover:card-shadow-hover ${expanded ? 'ring-2 ring-gray-900/5' : ''}`}>
        {/* Collapsed header — fixed grid keeps score aligned across cards */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full text-left grid items-center gap-3 px-5 py-4 hover:bg-gray-50/50 transition-all duration-200"
          style={{ gridTemplateColumns: '44px minmax(0, 1fr) 40px 96px 20px' }}
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white text-xs font-bold">{initials(driver.full_name)}</span>
          </div>

          <div className="min-w-0 overflow-hidden">
            <p className="text-sm font-bold text-gray-900 truncate">{driver.full_name}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{creatorName}</p>
          </div>

          <div className="flex items-center justify-center flex-shrink-0 tabular-nums">
            <span className={`text-lg font-black leading-none ${scoreClass}`}>{driver.score}</span>
          </div>

          <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 ${badge.bg} ${badge.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${badge.dot}`} />
            <span className="truncate">{badge.label}</span>
          </div>

          <div className="text-gray-400 flex-shrink-0 flex justify-end transition-transform duration-300" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
            <ChevronDown size={18} />
          </div>
        </button>

        {/* Expanded panel */}
        {expanded && (
          <div className="border-t border-gray-100 animate-fade-in">
            <CrmHiringBanner driverId={driver.id} expanded={expanded} />
            <div className="px-5 py-6 space-y-6 bg-gradient-to-b from-gray-50/50 to-white">
            {/* Leave Comment CTA */}
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-900 rounded-2xl text-white">
              <div>
                <p className="text-sm font-bold">Share your experience with this driver</p>
                <p className="text-xs text-gray-400 mt-0.5">Help other carriers make informed decisions</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onAddComment(); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-100 transition shadow-sm flex-shrink-0"
              >
                <PenLine size={15} /> Leave a Comment
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Metrics */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Performance Metrics</h4>
                <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-4">
                  <StatBar label="Overall Reliability" value={driver.reliability_pct} />
                  <StatBar label="On-Time Rate" value={driver.on_time_pct} />
                  <StatBar label="Drug Test Compliance" value={driver.drug_test_pct} />
                  <div className="flex items-center gap-1.5 pt-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={16} className={i <= Math.round(driver.stars) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                    ))}
                    <span className="text-sm font-semibold text-gray-600 ml-1">{Number(driver.stars).toFixed(1)}</span>
                    <span className="text-xs text-gray-400">avg rating</span>
                  </div>
                </div>

                <button
                  onClick={e => { e.stopPropagation(); setShowDriverFlagModal(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-amber-700 border border-gray-200 hover:border-amber-300 rounded-xl transition hover:bg-amber-50 w-full justify-center"
                >
                  <AlertTriangle size={13} /> Report an Issue with This Record
                </button>
              </div>

              {/* Comments sections */}
              <div className="space-y-5">
                {/* Driver history notes */}
                {historyNotes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                      <FileText size={12} /> Driver History Notes
                    </h4>
                    <div className="space-y-2">
                      {historyNotes.map(c => (
                        <CommentCard
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
                          infoOpen={openInfoCommentId === c.id}
                          onInfoToggle={() => setOpenInfoCommentId(prev => (prev === c.id ? null : c.id))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Carrier comments */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare size={12} /> Carrier Comments ({carrierComments.length})
                    </h4>
                    <button
                      onClick={e => { e.stopPropagation(); onAddComment(); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[11px] font-bold hover:bg-gray-800 transition"
                    >
                      <PenLine size={11} /> Add
                    </button>
                  </div>

                  {carrierComments.length === 0 ? (
                    <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
                      <MessageSquare size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 font-medium">No carrier comments yet</p>
                      <button
                        onClick={e => { e.stopPropagation(); onAddComment(); }}
                        className="mt-3 text-xs font-bold text-gray-900 hover:underline"
                      >
                        Be the first to comment
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2.5">
                        {(showAll ? carrierComments : carrierComments.slice(0, 3)).map(c => (
                          <CommentCard
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
                            infoOpen={openInfoCommentId === c.id}
                            onInfoToggle={() => setOpenInfoCommentId(prev => (prev === c.id ? null : c.id))}
                          />
                        ))}
                      </div>
                      {carrierComments.length > 3 && (
                        <button
                          onClick={e => { e.stopPropagation(); setShowAll(v => !v); }}
                          className="mt-3 text-xs font-bold text-gray-500 hover:text-gray-900 transition flex items-center gap-1"
                        >
                          {showAll ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> View all {carrierComments.length} comments</>}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
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
