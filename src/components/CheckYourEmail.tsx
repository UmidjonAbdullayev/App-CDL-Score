import { useState } from 'react';
import { Truck, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  email: string;
  onBackToSignIn: () => void;
}

export function CheckYourEmail({ email, onBackToSignIn }: Props) {
  const [resending, setResending] = useState(false);
  const [resentOk, setResentOk] = useState<string | null>(null);
  const [resentErr, setResentErr] = useState<string | null>(null);

  const handleResend = async () => {
    setResentOk(null);
    setResentErr(null);
    setResending(true);
    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setResending(false);
    if (error) {
      setResentErr(error.message);
      return;
    }
    setResentOk('If this address is eligible, another confirmation email will arrive shortly.');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
            <Truck size={18} className="text-gray-950" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">CDL Score</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl px-8 py-8 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={26} className="text-gray-700" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-1">
            We sent a confirmation link to
          </p>
          <p className="text-sm font-semibold text-gray-900 break-all mb-4">{email}</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            Open the message and tap the link to verify your account. After that, sign in with your email and password.
          </p>

          {resentOk && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
              {resentOk}
            </p>
          )}
          {resentErr && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {resentErr}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-800 hover:bg-gray-50 transition disabled:opacity-50"
            >
              {resending ? 'Sending…' : 'Resend confirmation email'}
            </button>
            <button
              type="button"
              onClick={onBackToSignIn}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:text-gray-900 transition"
            >
              <ArrowLeft size={16} /> Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
