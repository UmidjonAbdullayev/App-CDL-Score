import { TrendingUp, DollarSign, Users, CheckCircle } from 'lucide-react';

// 208,000 baseline on 2026-05-06, +100 per day automatically
const DRIVER_BASE = 208_000;
const DRIVER_BASELINE_DATE = new Date('2026-05-06T00:00:00.000Z');

function getDynamicDriverCount(): number {
  const daysSince = Math.floor(
    (Date.now() - DRIVER_BASELINE_DATE.getTime()) / (1000 * 60 * 60 * 24)
  );
  return DRIVER_BASE + Math.max(0, daysSince) * 100;
}

interface Props {
  searchesToday: number;
  moneySaved: number;
  totalDrivers: number;
  safeDrivers: number;
}

export function StatsBar({ searchesToday, moneySaved, safeDrivers }: Props) {
  const dynamicDriverCount = getDynamicDriverCount();

  const tiles = [
    {
      label: 'Searches Today',
      value: searchesToday.toLocaleString(),
      icon: TrendingUp,
      dark: true,
    },
    {
      label: 'Potential Savings',
      value: `$${Number(moneySaved).toLocaleString()}`,
      icon: DollarSign,
      dark: true,
    },
    {
      label: 'Drivers in System',
      value: dynamicDriverCount.toLocaleString(),
      icon: Users,
      dark: false,
    },
    {
      label: 'Cleared Drivers',
      value: safeDrivers.toLocaleString(),
      icon: CheckCircle,
      dark: false,
    },
  ];

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Platform Stats</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(({ label, value, icon: Icon, dark }) => (
          <div
            key={label}
            className={`rounded-xl p-4 flex items-start justify-between ${
              dark
                ? 'bg-gray-900 border border-gray-800'
                : 'bg-white border border-gray-200'
            }`}
          >
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-widest mb-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {label}
              </p>
              <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
            </div>
            <Icon size={20} className={dark ? 'text-gray-600' : 'text-gray-300'} />
          </div>
        ))}
      </div>
    </div>
  );
}
