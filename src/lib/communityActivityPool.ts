import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare, UserPlus, UserCheck, Building2, FileCheck,
  DollarSign, Plane, FlaskConical, Shield, TrendingUp, Star, Search,
} from 'lucide-react';

export interface ActivityTemplate {
  text: string;
  icon: LucideIcon;
  color: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CARRIERS = ['Swift Logistics', 'Prime Freight Co.', 'Midwest Haulers', 'Atlas Transport', 'BlueLine Carriers', 'Summit Trucking', 'Horizon Freight', 'Valley Express'];
const DRIVER_NAMES = ['Michael Turner', 'James Rivera', 'David Chen', 'Robert Hayes', 'Carlos Mendez', 'Anthony Brooks', 'Kevin Walsh', 'Marcus Lee'];

export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  { text: 'Carrier added a new driver report', icon: FileCheck, color: 'text-blue-600 bg-blue-50' },
  { text: 'New driver record approved in the network', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
  { text: 'New carrier joined CDL Score', icon: Building2, color: 'text-indigo-600 bg-indigo-50' },
  { text: 'New comment added to a driver profile', icon: MessageSquare, color: 'text-amber-600 bg-amber-50' },
  { text: `${pick(CARRIERS)} saved $842 on a flight ticket`, icon: Plane, color: 'text-sky-600 bg-sky-50' },
  { text: 'Carrier avoided $1,240 in drug test costs', icon: FlaskConical, color: 'text-violet-600 bg-violet-50' },
  { text: `${pick(DRIVER_NAMES)} added to the driver network`, icon: UserPlus, color: 'text-teal-600 bg-teal-50' },
  { text: 'Platform reached a new verification milestone', icon: Shield, color: 'text-gray-600 bg-gray-100' },
  { text: `${pick(CARRIERS)} posted a 5-star driver review`, icon: Star, color: 'text-amber-600 bg-amber-50' },
  { text: 'Network savings exceeded $50,000 today', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  { text: 'New reliability report submitted', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
  { text: `${pick(CARRIERS)} saved $615 on onboarding travel`, icon: Plane, color: 'text-sky-600 bg-sky-50' },
  { text: 'Driver history note verified by admin', icon: FileCheck, color: 'text-emerald-600 bg-emerald-50' },
  { text: `${pick(DRIVER_NAMES)} received a new carrier comment`, icon: MessageSquare, color: 'text-amber-600 bg-amber-50' },
  { text: 'Another carrier joined the CDL Score network', icon: Building2, color: 'text-indigo-600 bg-indigo-50' },
  { text: 'Fleet saved $390 on a cancelled hire flight', icon: Plane, color: 'text-sky-600 bg-sky-50' },
  { text: 'Drug screening costs reduced by $275 for a carrier', icon: FlaskConical, color: 'text-violet-600 bg-violet-50' },
  { text: 'New cleared driver profile published', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
  { text: `${pick(CARRIERS)} added feedback on a driver`, icon: MessageSquare, color: 'text-amber-600 bg-amber-50' },
  { text: 'Carrier report count increased network-wide', icon: FileCheck, color: 'text-blue-600 bg-blue-50' },
  { text: '$780 saved on flight rebooking', icon: Plane, color: 'text-sky-600 bg-sky-50' },
  { text: 'Pre-employment screening savings logged', icon: FlaskConical, color: 'text-violet-600 bg-violet-50' },
  { text: `${pick(DRIVER_NAMES)} profile updated with new metrics`, icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
  { text: 'Regional carrier completed first driver search', icon: Search, color: 'text-indigo-600 bg-indigo-50' },
  { text: 'Mutual review agreement confirmed via SMS', icon: Shield, color: 'text-gray-600 bg-gray-100' },
  { text: `${pick(CARRIERS)} flagged a high-risk pattern early`, icon: Shield, color: 'text-red-600 bg-red-50' },
  { text: 'New comment thread started on a driver record', icon: MessageSquare, color: 'text-amber-600 bg-amber-50' },
  { text: '$890 potential savings identified today', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  { text: `${pick(DRIVER_NAMES)} approved after admin review`, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
  { text: 'Another driver record added by a partner carrier', icon: UserPlus, color: 'text-teal-600 bg-teal-50' },
];

export function randomActivityDelayMs(): number {
  return (60 + Math.random() * 240) * 1000;
}

export function formatActivityTime(): string {
  return 'Just now';
}
