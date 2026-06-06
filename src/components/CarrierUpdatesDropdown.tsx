import { useState, useEffect, useRef } from 'react';
import { Megaphone, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CarrierAnnouncement } from '../lib/supabase';

export function CarrierUpdatesDropdown() {
  const [items, setItems] = useState<CarrierAnnouncement[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('carrier_announcements')
        .select('id, title, body, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(12);
      setItems((data as CarrierAnnouncement[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 py-1 px-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition"
      >
        <Megaphone size={14} className="text-gray-500" />
        Updates
        <ChevronDown size={14} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-[min(70vh,420px)] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg z-50 py-2">
          {items.map(a => (
            <div key={a.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
              <p className="text-xs font-bold text-gray-900">{a.title}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 mb-1.5">
                {new Date(a.published_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
