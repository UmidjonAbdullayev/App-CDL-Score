import { Search, User } from 'lucide-react';
import type { Driver } from '../lib/supabase';

interface Props {
  query: string;
  drivers: Driver[];
  onSelect: (name: string) => void;
  visible: boolean;
}

export function SearchSuggestions({ query, drivers, onSelect, visible }: Props) {
  if (!visible || query.trim().length < 2) return null;

  const q = query.toLowerCase().trim();
  const matches = drivers
    .filter(d => d.full_name.toLowerCase().includes(q))
    .slice(0, 6);

  if (matches.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-fade-in">
      <div className="px-4 py-2 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Search size={10} /> Suggested drivers
        </p>
      </div>
      {matches.map(d => (
        <button
          key={d.id}
          onMouseDown={e => { e.preventDefault(); onSelect(d.full_name); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition flex-shrink-0">
            <User size={14} className="text-gray-500" />
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate">{d.full_name}</p>
        </button>
      ))}
    </div>
  );
}
