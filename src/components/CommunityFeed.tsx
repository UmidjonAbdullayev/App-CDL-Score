import { useState, useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import {
  ACTIVITY_TEMPLATES, randomActivityDelayMs, formatActivityTime, type ActivityTemplate,
} from '../lib/communityActivityPool';

const MAX_VISIBLE = 6;

interface FeedItem extends ActivityTemplate {
  id: string;
  time: string;
}

function buildActivityFromTemplate(template: ActivityTemplate, id: string): FeedItem {
  let text = template.text;
  if (text.includes('$')) {
    const amount = Math.floor(200 + Math.random() * 9800);
    text = text.replace(/\$[\d,]+/, `$${amount.toLocaleString()}`);
  }
  return { ...template, id, time: formatActivityTime(), text };
}

function buildInitialItems(): FeedItem[] {
  return ACTIVITY_TEMPLATES.slice(0, MAX_VISIBLE).map((t, i) => ({
    ...buildActivityFromTemplate(t, `init-${i}`),
    time: i === 0 ? 'Just now' : `${i + 1}m ago`,
  }));
}

export function CommunityFeed() {
  const [items, setItems] = useState<FeedItem[]>(buildInitialItems);
  const poolIndex = useRef(MAX_VISIBLE);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        const template = ACTIVITY_TEMPLATES[poolIndex.current % ACTIVITY_TEMPLATES.length];
        poolIndex.current += 1;

        const newItem = buildActivityFromTemplate(
          template,
          `live-${Date.now()}-${poolIndex.current}`,
        );

        setItems(prev => [newItem, ...prev].slice(0, MAX_VISIBLE));
        scheduleNext();
      }, randomActivityDelayMs());
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <aside className="hidden xl:block w-72 flex-shrink-0 border-l border-gray-200 bg-gray-50/50 overflow-y-auto">
      <div className="p-5 sticky top-0 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 z-10">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-emerald-500" />
          <h3 className="text-sm font-bold text-gray-900">Community Activity</h3>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">Live updates from the network</p>
      </div>

      <div className="p-4 space-y-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl p-3.5 border border-gray-200 card-shadow hover:card-shadow-hover transition-all duration-300 animate-fade-in-up"
              style={i === 0 ? undefined : { animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 leading-relaxed">{item.text}</p>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">{item.time}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
