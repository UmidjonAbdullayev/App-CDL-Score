import { useState } from 'react';
import { supabase, registrationGate } from '../lib/supabase';
import { Truck, ChevronRight, ChevronLeft, Shield, AlertTriangle } from 'lucide-react';

interface Props {
  onSwitchToLogin: () => void;
}

type Step = 1 | 2;

async function getClientIp(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return (data as { ip: string }).ip ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function SignupPage({ onSwitchToLogin }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState('');
  const [mcNumber, setMcNumber] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim() || !mcNumber.trim() || !companyEmail.trim()) {
      setError('All fields are required.');
      return;
    }
    // Pre-fill login email with company email — user can change it if they want
    if (!loginEmail.trim()) setLoginEmail(companyEmail.trim());
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);

    // Open the gate BEFORE signUp so onAuthStateChange holds the session
    registrationGate.begin();

    try {
      // 1. Create the auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: loginEmail.trim(),
        password,
      });
      if (authErr) {
        if (authErr.message.toLowerCase().includes('already registered')) {
          throw new Error('That email is already in use. Please sign in instead.');
        }
        throw new Error(authErr.message);
      }
      if (!authData.user) throw new Error('Account creation failed. Please try again.');

      // 2. Get IP (best-effort, non-blocking)
      const ip = await getClientIp();

      // 3. Register company via SECURITY DEFINER function
      const { data: result, error: rpcErr } = await supabase.rpc('register_company', {
        p_company_name:  companyName.trim(),
        p_mc_number:     mcNumber.trim(),
        p_company_email: companyEmail.trim(),
        p_user_id:       authData.user.id,
        p_ip_address:    ip,
      });

      if (rpcErr) throw new Error(rpcErr.message);

      const res = result as { success: boolean; error?: string };
      if (!res.success) {
        await supabase.auth.signOut();
        registrationGate.abort();
        const msg = res.error ?? 'Registration failed. Please try again.';
        throw new Error(msg);
      }

      // RPC succeeded — release the gate and hand the session to App.tsx
      registrationGate.commit(true);
    } catch (err: unknown) {
      registrationGate.abort();
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      setLoading(false);
    }
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

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-gray-900 transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>

          <div className="px-8 py-7">
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Step {step} of 2
              </p>
              <h1 className="text-xl font-bold text-gray-900">
                {step === 1 ? 'Company Information' : 'Create Your Account'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {step === 1 ? 'Enter your company details to get started.' : 'Set up your login credentials.'}
              </p>
            </div>

            {error && (
              error.startsWith('BREACH_WARNING:') ? (
                <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-700 mb-1">Registration Blocked</p>
                      <p className="text-xs text-red-600 leading-relaxed">
                        {error.replace('BREACH_WARNING:', '')}
                      </p>
                      <p className="text-xs text-red-700 font-semibold mt-2">
                        Attempting to register multiple accounts from the same network is a violation of our Private Information Code and may be reported to the relevant authorities.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )
            )}

            {step === 1 && (
              <form onSubmit={handleStep1} className="space-y-4">
                <Field label="Company Name" placeholder="e.g. Apex Logistics LLC" value={companyName} onChange={setCompanyName} />
                <Field label="MC Number" placeholder="e.g. 123456" value={mcNumber} onChange={setMcNumber} />
                <Field label="Company Email" type="email" placeholder="billing@company.com" value={companyEmail} onChange={setCompanyEmail} />
                <button type="submit" className="w-full mt-2 flex items-center justify-center gap-2 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition">
                  Continue <ChevronRight size={16} />
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleStep2} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Login Email</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                  />
                  {loginEmail === companyEmail && companyEmail && (
                    <p className="text-[11px] text-gray-400 mt-1">Carried over from company email — you can change this.</p>
                  )}
                </div>
                <Field label="Password" type="password" placeholder="Min. 6 characters" value={password} onChange={setPassword} />
                <Field label="Confirm Password" type="password" placeholder="Repeat password" value={confirmPassword} onChange={setConfirmPassword} />

                <div className="flex items-start gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                  <Shield size={15} className="text-gray-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-600">
                    You'll get <span className="font-semibold text-gray-900">3 free driver searches</span> as part of your trial.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(''); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                  >
                    <ChevronLeft size={15} /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {loading ? 'Creating account…' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}

            <p className="text-center text-xs text-gray-500 mt-6">
              Already registered?{' '}
              <button onClick={onSwitchToLogin} className="font-semibold text-gray-900 hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, placeholder, value, onChange, type = 'text',
}: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
      />
    </div>
  );
}
