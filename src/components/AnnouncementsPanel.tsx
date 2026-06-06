import { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CarrierAnnouncement } from '../lib/supabase';

interface Props {
  onViewed?: () => void;
}

export function AnnouncementsPanel({ onViewed }: Props) {
  const [items, setItems] = useState<CarrierAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('carrier_announcements')
        .select('id, title, body, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(20);
      setItems((data as CarrierAnnouncement[]) ?? []);
      setLoading(false);
      if (data && data.length > 0) onViewed?.();
    })();
  }, [onViewed]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Megaphone size={24} className="text-gray-400" />
          Announcements
        </h1>
        <p className="text-sm text-gray-500 mt-1">Latest updates and news from CDL Score</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl px-8 py-16 text-center card-shadow">
          <Megaphone size={32} className="text-gray-300 mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-700">No announcements</p>
          <p className="text-xs text-gray-400 mt-1">Check back later for platform updates.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((a, i) => (
          <article
            key={a.id}
            className="bg-white border border-gray-200 rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: `${i * 80}ms`, opacity: 0 }}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="text-base font-bold text-gray-900">{a.title}</h2>
              <time className="text-xs text-gray-400 font-medium flex-shrink-0">
                {new Date(a.published_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </time>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
