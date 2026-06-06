import { supabase } from './supabase';

export async function getUserCredits(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_user_credits', { target_user_id: userId });
  if (error || !data) return 0;
  return (data as { search_credits: number }).search_credits ?? 0;
}

export async function decrementCredits(userId: string): Promise<{ success: boolean; creditsLeft: number }> {
  const { data, error } = await supabase.rpc('decrement_user_credits', { target_user_id: userId });
  if (error || !data?.success) return { success: false, creditsLeft: 0 };
  return { success: true, creditsLeft: data.search_credits };
}

export async function setCredits(userId: string, amount: number): Promise<boolean> {
  const { error } = await supabase.rpc('set_user_credits', {
    target_user_id: userId,
    new_credit_amount: amount,
  });
  return !error;
}

export async function addCredits(userId: string, amount: number): Promise<boolean> {
  const { error } = await supabase.rpc('add_user_credits', {
    target_user_id: userId,
    amount,
  });
  return !error;
}

export async function getDailyStats(): Promise<{ searches_today: number; money_saved: number }> {
  const { data, error } = await supabase.rpc('get_or_seed_daily_stats');
  if (error || !data) return { searches_today: 0, money_saved: 0 };
  return data as { searches_today: number; money_saved: number };
}
