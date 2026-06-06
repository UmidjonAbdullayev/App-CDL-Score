const ANN_READ_PREFIX = 'cdlscore_ann_read_';
const CHAT_READ_PREFIX = 'cdlscore_chat_read_';
const ADMIN_CHAT_READ_PREFIX = 'cdlscore_admin_chat_read_';

function chatKey(userId: string, companyId: string) {
  return `${CHAT_READ_PREFIX}${userId}_${companyId}`;
}

function adminChatKey(userId: string, companyId: string) {
  return `${ADMIN_CHAT_READ_PREFIX}${userId}_${companyId}`;
}

export function getAnnouncementsReadAt(userId: string): string | null {
  try {
    return localStorage.getItem(ANN_READ_PREFIX + userId);
  } catch {
    return null;
  }
}

export function markAnnouncementsRead(userId: string, at?: string) {
  try {
    localStorage.setItem(ANN_READ_PREFIX + userId, at ?? new Date().toISOString());
  } catch { /* ignore */ }
}

export function hasUnreadAnnouncements(
  userId: string,
  latestPublishedAt: string | undefined | null
): boolean {
  if (!latestPublishedAt) return false;
  const readAt = getAnnouncementsReadAt(userId);
  if (!readAt) return true;
  return new Date(latestPublishedAt).getTime() > new Date(readAt).getTime();
}

export function getChatReadAt(userId: string, companyId: string): string | null {
  try {
    return localStorage.getItem(chatKey(userId, companyId));
  } catch {
    return null;
  }
}

export function markChatRead(userId: string, companyId: string, at?: string) {
  try {
    localStorage.setItem(chatKey(userId, companyId), at ?? new Date().toISOString());
  } catch { /* ignore */ }
}

export function hasUnreadCarrierChat(
  userId: string,
  companyId: string,
  messages: { sender_role: string; created_at: string }[]
): boolean {
  const readAt = getChatReadAt(userId, companyId);
  return messages.some(
    m =>
      m.sender_role === 'admin' &&
      (!readAt || new Date(m.created_at).getTime() > new Date(readAt).getTime())
  );
}

export function getAdminChatReadAt(userId: string, companyId: string): string | null {
  try {
    return localStorage.getItem(adminChatKey(userId, companyId));
  } catch {
    return null;
  }
}

export function markAdminChatRead(userId: string, companyId: string, at?: string) {
  try {
    localStorage.setItem(adminChatKey(userId, companyId), at ?? new Date().toISOString());
  } catch { /* ignore */ }
}

export function isAdminChatCompanyUnread(
  userId: string,
  companyId: string,
  latestCarrierMessageAt: string | null | undefined
): boolean {
  if (!latestCarrierMessageAt) return false;
  const readAt = getAdminChatReadAt(userId, companyId);
  if (!readAt) return true;
  return new Date(latestCarrierMessageAt).getTime() > new Date(readAt).getTime();
}

export function hasAnyUnreadAdminChat(
  userId: string,
  messages: { company_id: string; sender_role: string; created_at: string }[]
): boolean {
  const carrierMessages = messages.filter(m => m.sender_role === 'carrier');
  if (carrierMessages.length === 0) return false;

  const byCompany = new Map<string, string>();
  for (const m of carrierMessages) {
    const prev = byCompany.get(m.company_id);
    if (!prev || new Date(m.created_at) > new Date(prev)) {
      byCompany.set(m.company_id, m.created_at);
    }
  }

  for (const [companyId, latestAt] of byCompany) {
    const readAt = getAdminChatReadAt(userId, companyId);
    if (!readAt || new Date(latestAt).getTime() > new Date(readAt).getTime()) {
      return true;
    }
  }
  return false;
}
