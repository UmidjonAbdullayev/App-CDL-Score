import { supabase } from './supabase';

export interface CrmHiringStatus {
  stage: string;
  stage_label: string;
  candidate_id: string;
  updated_at: string;
}

export async function fetchCrmHiringStatus(driverId: string): Promise<CrmHiringStatus | null> {
  const { data, error } = await supabase.rpc('get_crm_hiring_status', { p_driver_id: driverId });
  if (error || !data?.length) return null;
  return data[0] as CrmHiringStatus;
}

export const CRM_STAGE_COLORS: Record<string, string> = {
  lead: '#8fa3c0',
  application: '#3b82f6',
  mvr: '#6366f1',
  background: '#8b5cf6',
  drug_ordered: '#a855f7',
  drug_ongoing: '#d946ef',
  drug_passed: '#14b8a6',
  drug_failed: '#ef4444',
  flight_booked: '#f59e0b',
  orientation: '#f97316',
  orientation_pass: '#22c55e',
  road_test: '#06b6d4',
  road_pass: '#0ea5e9',
  docs_pending: '#64748b',
  pre_hire: '#20b2aa',
  hired: '#22c55e',
  inactive: '#6b7280',
  disqualified: '#ef4444',
};
