import { Settings, Building2, Mail, Hash, Shield, Bell } from 'lucide-react';
import type { Company } from '../lib/supabase';

interface Props {
  company?: Company;
  credits: number;
  isAdmin: boolean;
}

export function SettingsPanel({ company, credits, isAdmin }: Props) {
  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings size={24} className="text-gray-400" />
          Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      <div className="space-y-4">
        <section className="bg-white border border-gray-200 rounded-2xl p-6 card-shadow">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Company Profile</h2>
          {company ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Building2 size={18} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                  <p className="text-xs text-gray-400">Registered carrier</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Mail size={14} className="text-gray-400" />
                  {company.email}
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Hash size={14} className="text-gray-400" />
                  MC# {company.mc_number}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No company profile linked.</p>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 card-shadow">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <Shield size={16} className="text-gray-400" />
                <span className="text-sm text-gray-700">Search credits remaining</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{credits}</span>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <Shield size={16} className="text-emerald-500" />
                  <span className="text-sm text-gray-700">Admin access</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">Active</span>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 card-shadow">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Notifications</h2>
          <div className="flex items-center gap-3 py-2">
            <Bell size={16} className="text-gray-400" />
            <div>
              <p className="text-sm text-gray-700">Platform notifications</p>
              <p className="text-xs text-gray-400">Receive updates about new features and announcements</p>
            </div>
            <div className="ml-auto w-10 h-6 bg-gray-900 rounded-full relative cursor-pointer">
              <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
