import { Truck, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  email: string | undefined;
}

export function UnverifiedEmailBlock({ email }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center">
          <Truck size={18} className="text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">CDL Score</span>
      </div>
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl px-8 py-8 shadow-sm text-center">
        <p className="text-sm text-gray-800 font-medium leading-relaxed">
          Please verify your email before accessing your dashboard.
        </p>
        {email && (
          <p className="text-xs text-gray-500 mt-3 break-all">
            Signed in as <span className="font-semibold text-gray-700">{email}</span>
          </p>
        )}
        <p className="text-xs text-gray-500 mt-4 leading-relaxed">
          Check your inbox for the confirmation link from Supabase. After you confirm, refresh this page or sign in again.
        </p>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
