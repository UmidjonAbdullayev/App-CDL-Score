import {
  LayoutDashboard, Search, FileText, UserPlus, Megaphone,
  History, CreditCard, MessageSquare, Settings, Truck, X, Gift,
} from 'lucide-react';

export type NavView =
  | 'dashboard' | 'search' | 'submissions' | 'announcements'
  | 'history' | 'referrals' | 'settings' | 'add-driver';

interface NavItem {
  id: NavView | 'billing' | 'admin-chat' | 'support-chat';
  label: string;
  icon: typeof LayoutDashboard;
  action?: 'navigate' | 'modal' | 'support-chat';
  variant?: 'default' | 'referral';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: 'navigate' },
  { id: 'search', label: 'Driver Search', icon: Search, action: 'navigate' },
  { id: 'submissions', label: 'My Submitted Records', icon: FileText, action: 'navigate' },
  { id: 'add-driver', label: 'Add Driver', icon: UserPlus, action: 'navigate' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, action: 'navigate' },
  { id: 'history', label: 'Search History', icon: History, action: 'navigate' },
  { id: 'referrals', label: 'Referrals', icon: Gift, action: 'navigate', variant: 'referral' },
  { id: 'billing', label: 'Billing / Top Up', icon: CreditCard, action: 'modal' },
  { id: 'support-chat', label: 'Support Chat', icon: MessageSquare, action: 'support-chat' },
  { id: 'admin-chat', label: 'Admin Chat', icon: MessageSquare, action: 'modal' },
  { id: 'settings', label: 'Settings', icon: Settings, action: 'navigate' },
];

export interface UnreadBadges {
  announcements?: boolean;
  chat?: boolean;
}

interface Props {
  activeView: NavView;
  onNavigate: (view: NavView) => void;
  onBilling: () => void;
  onAdminChat: () => void;
  onSupportChat: () => void;
  isAdmin: boolean;
  unread?: UnreadBadges;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function NavIconWithBadge({
  icon: Icon,
  showBadge,
  className,
}: {
  icon: typeof LayoutDashboard;
  showBadge: boolean;
  className: string;
}) {
  return (
    <span className="relative flex-shrink-0">
      <Icon size={18} className={className} />
      {showBadge && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#111827] animate-pulse-soft"
          aria-hidden
        />
      )}
    </span>
  );
}

export function Sidebar({
  activeView, onNavigate, onBilling, onAdminChat, onSupportChat,
  isAdmin, unread, mobileOpen, onMobileClose,
}: Props) {
  const handleClick = (item: NavItem) => {
    if (item.id === 'billing') { onBilling(); onMobileClose(); return; }
    if (item.id === 'admin-chat') { onAdminChat(); onMobileClose(); return; }
    if (item.id === 'support-chat') { onSupportChat(); onMobileClose(); return; }
    onNavigate(item.id as NavView);
    onMobileClose();
  };

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.id === 'admin-chat') return isAdmin;
    if (item.id === 'support-chat') return !isAdmin;
    return true;
  });

  const itemHasUnread = (id: NavItem['id']) => {
    if (id === 'announcements') return !!unread?.announcements;
    if (id === 'admin-chat' || id === 'support-chat') return !!unread?.chat;
    return false;
  };

  const content = (
    <>
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg">
          <Truck size={18} className="text-gray-900" />
        </div>
        <div>
          <span className="text-base font-bold text-white tracking-tight block">CDL Score</span>
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Driver Intelligence</span>
        </div>
        <button
          onClick={onMobileClose}
          className="ml-auto lg:hidden p-1.5 text-gray-400 hover:text-white rounded-lg transition"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isReferral = item.variant === 'referral';
          const isActive = item.action === 'navigate' && activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isReferral
                  ? isActive
                    ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/15 text-white border border-emerald-400/40 shadow-sm'
                    : 'text-emerald-200/90 hover:text-white border border-emerald-500/25 hover:border-emerald-400/40 hover:bg-emerald-500/10 bg-emerald-950/20'
                  : isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/8'
              }`}
            >
              <NavIconWithBadge
                icon={Icon}
                showBadge={itemHasUnread(item.id)}
                className={`transition-colors ${
                  isReferral
                    ? isActive ? 'text-emerald-300' : 'text-emerald-400/80 group-hover:text-emerald-300'
                    : isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                }`}
              />
              <span className="truncate">{item.label}</span>
              {isReferral && !isActive && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-emerald-400/70">
                  10% off
                </span>
              )}
              {isActive && !isReferral && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              )}
              {isActive && isReferral && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse-soft" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Trusted by carriers nationwide for driver verification and risk assessment.
        </p>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 sidebar-gradient flex flex-col
        transform transition-transform duration-300 ease-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {content}
      </aside>
    </>
  );
}
