import { useState, useEffect, useRef } from 'react';
import { TrendingUp, DollarSign, Users, FileCheck } from 'lucide-react';
import { getCarrierReportsCount } from '../lib/carrierReportsCount';

const DRIVER_BASE = 208_000;
const DRIVER_BASELINE_DATE = new Date('2026-05-06T00:00:00.000Z');

function getDynamicDriverCount(): number {
  const daysSince = Math.floor(
    (Date.now() - DRIVER_BASELINE_DATE.getTime()) / (1000 * 60 * 60 * 24)
  );
  return DRIVER_BASE + Math.max(0, daysSince) * 100;
}

function useCountUp(target: number, duration = 1200, enabled = true): number {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    if (started.current) return;
    started.current = true;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, enabled]);

  return value;
}

interface Props {
  searchesToday: number;
  moneySaved: number;
  totalDrivers: number;
  safeDrivers: number;
}

export function StatsBar({ searchesToday, moneySaved }: Props) {
  const dynamicDriverCount = getDynamicDriverCount();
  const carrierReportsCount = getCarrierReportsCount();

  const animatedSearches = useCountUp(searchesToday);
  const animatedSavings = useCountUp(moneySaved);
  const animatedDrivers = useCountUp(dynamicDriverCount);
  const animatedReports = useCountUp(carrierReportsCount);

  const tiles = [
    {
      label: 'Searches Today',
      value: animatedSearches.toLocaleString(),
      icon: TrendingUp,
      accent: 'from-gray-900 to-gray-800',
      iconBg: 'bg-white/10',
      featured: true,
    },
    {
      label: 'Potential Savings',
      value: `$${animatedSavings.toLocaleString()}`,
      icon: DollarSign,
      accent: 'from-emerald-600 to-emerald-700',
      iconBg: 'bg-white/10',
      featured: true,
    },
    {
      label: 'Drivers in System',
      value: animatedDrivers.toLocaleString(),
      icon: Users,
      accent: 'from-white to-gray-50',
      iconBg: 'bg-gray-100',
      featured: false,
    },
    {
      label: 'Carrier Reports',
      value: animatedReports.toLocaleString(),
      icon: FileCheck,
      accent: 'from-white to-gray-50',
      iconBg: 'bg-gray-100',
      featured: false,
    },
  ];

  return (
    <div className="mt-10 pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Platform Stats</p>
          <p className="text-sm text-gray-500 mt-0.5">Real-time network intelligence</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(({ label, value, icon: Icon, accent, iconBg, featured }, i) => (
          <div
            key={label}
            className={`relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:scale-[1.02] animate-fade-in-up ${
              featured
                ? `bg-gradient-to-br ${accent} text-white card-shadow hover:card-shadow-hover`
                : 'bg-white border border-gray-200 card-shadow hover:card-shadow-hover'
            }`}
            style={{ animationDelay: `${i * 100}ms`, opacity: 0 }}
          >
            {featured && (
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
            )}
            <div className="relative flex items-start justify-between">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${
                  featured ? 'text-white/60' : 'text-gray-400'
                }`}>
                  {label}
                </p>
                <p className={`text-3xl font-black tracking-tight ${
                  featured ? 'text-white' : 'text-gray-900'
                }`}>
                  {value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon size={20} className={featured ? 'text-white/70' : 'text-gray-400'} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
