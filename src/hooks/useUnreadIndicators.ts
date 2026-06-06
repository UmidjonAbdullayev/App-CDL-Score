import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  hasUnreadAnnouncements,
  hasUnreadCarrierChat,
  hasAnyUnreadAdminChat,
  markAnnouncementsRead,
} from '../lib/readState';

export function useUnreadIndicators(
  userId: string | undefined,
  companyId: string | undefined,
  isAdmin: boolean
) {
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;

    const { data: anns } = await supabase
      .from('carrier_announcements')
      .select('published_at')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(1);

    const latestAnn = anns?.[0]?.published_at as string | undefined;
    setUnreadAnnouncements(hasUnreadAnnouncements(userId, latestAnn));

    if (isAdmin) {
      const { data: msgs } = await supabase
        .from('admin_chat_messages')
        .select('company_id, sender_role, created_at')
        .eq('sender_role', 'carrier')
        .order('created_at', { ascending: false })
        .limit(200);
      setUnreadChat(hasAnyUnreadAdminChat(userId, (msgs ?? []) as { company_id: string; sender_role: string; created_at: string }[]));
    } else if (companyId) {
      const { data: msgs } = await supabase
        .from('admin_chat_messages')
        .select('sender_role, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);
      setUnreadChat(hasUnreadCarrierChat(userId, companyId, (msgs ?? []) as { sender_role: string; created_at: string }[]));
    } else {
      setUnreadChat(false);
    }
  }, [userId, companyId, isAdmin]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 12000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markAnnouncementsViewed = useCallback(async () => {
    if (!userId) return;
    const { data: anns } = await supabase
      .from('carrier_announcements')
      .select('published_at')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(1);
    const latest = anns?.[0]?.published_at as string | undefined;
    markAnnouncementsRead(userId, latest ?? new Date().toISOString());
    setUnreadAnnouncements(false);
  }, [userId]);

  return {
    unreadAnnouncements,
    unreadChat,
    refreshUnread: refresh,
    markAnnouncementsViewed,
    clearUnreadChat: () => setUnreadChat(false),
  };
}
