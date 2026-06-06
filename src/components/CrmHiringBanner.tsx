import { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { fetchCrmHiringStatus, CRM_STAGE_COLORS, type CrmHiringStatus } from '../lib/crmStatus';

interface Props {
  driverId: string;
  expanded: boolean;
}

export function CrmHiringBanner({ driverId, expanded }: Props) {
  const [status, setStatus] = useState<CrmHiringStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLoading(true);
    fetchCrmHiringStatus(driverId).then(s => {
      if (!cancelled) {
        setStatus(s);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [driverId, expanded]);

  if (!expanded || loading || !status) return null;

  const color = CRM_STAGE_COLORS[status.stage] ?? '#6366f1';

  return (
    <div
      className="mx-5 mt-4 mb-0 rounded-xl border px-4 py-3 flex items-start gap-3"
      style={{ background: `${color}12`, borderColor: `${color}40` }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}22`, color }}
      >
        <Briefcase size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">
          From your CRM · Current hiring stage
        </p>
        <p className="text-sm font-bold text-gray-900">{status.stage_label}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          This status is synced from your company&apos;s CDLScore CRM pipeline.
        </p>
      </div>
    </div>
  );
}
