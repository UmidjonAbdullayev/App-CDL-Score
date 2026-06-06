import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DriverSubmission, DriverSubmissionStatus } from '../lib/supabase';

interface Props {
  companyId: string | undefined;
  refreshTrigger?: number;
  defaultOpen?: boolean;
}

function statusLabel(s: DriverSubmissionStatus) {
  if (s === 'pending') return { text: 'Pending review', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (s === 'approved') return { text: 'Approved', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  return { text: 'Rejected', cls: 'bg-red-100 text-red-800 border-red-200' };
}

export function MySubmissionsPanel({ companyId, refreshTrigger = 0, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState<DriverSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('driver_submissions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setRows((data as DriverSubmission[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (open && companyId) load();
  }, [open, companyId, refreshTrigger]);

  const openAttachment = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from('driver-submission-docs').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (!companyId) return null;

  return (
    <div className="mb-5 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/80 transition"
      >
        <span className="text-sm font-semibold text-gray-900">My submitted records</span>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
          {loading && <p className="text-xs text-gray-500 py-4 text-center">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-xs text-gray-500 py-4 text-center">You have not submitted any driver records yet.</p>
          )}
          {!loading && rows.length > 0 && (
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rows.map(r => {
                const st = statusLabel(r.status);
                return (
                  <li key={r.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{r.full_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>{st.text}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Submitted {new Date(r.created_at).toLocaleString()}
                    </p>
                    {r.admin_response && (
                      <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">
                        <span className="font-semibold text-gray-700">Team note: </span>
                        {r.admin_response}
                      </p>
                    )}
                    {r.attachment_path && (
                      <button
                        type="button"
                        onClick={() => openAttachment(r.attachment_path)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 hover:text-gray-900"
                      >
                        <FileText size={12} /> View attachment <ExternalLink size={11} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
