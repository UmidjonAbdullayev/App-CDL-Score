import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, registrationGate } from './lib/supabase';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { WelcomeModal } from './components/WelcomeModal';
import { CheckYourEmail } from './components/CheckYourEmail';
import { UnverifiedEmailBlock } from './components/UnverifiedEmailBlock';

const WELCOME_KEY = 'cdlscore_welcomed';

/** True when Supabase confirms the address (native email confirmation flow). */
function isEmailConfirmed(user: { email_confirmed_at?: string | null } | null): boolean {
  return !!user?.email_confirmed_at;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingUser, setCheckingUser] = useState(false);
  const [verifiedForDashboard, setVerifiedForDashboard] = useState<boolean | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [awaitingSignupEmailNotice, setAwaitingSignupEmailNotice] = useState<string | null>(null);

  const activateSession = (session: Session | null, isNew: boolean) => {
    setSession(session);
    if (!session?.user || !isEmailConfirmed(session.user)) {
      setShowWelcome(false);
      return;
    }
    if (isNew) {
      const key = WELCOME_KEY + '_' + session.user.id;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setShowWelcome(true);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    registrationGate.onCommit((session, isNew) => {
      activateSession(session, isNew);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (registrationGate.isPending()) {
        registrationGate.holdSession(session);
        return;
      }
      const isNew = event === 'SIGNED_IN' && !!session &&
        Date.now() - new Date(session.user.created_at).getTime() < 30_000;
      activateSession(session, isNew);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setVerifiedForDashboard(null);
      setCheckingUser(false);
      return;
    }

    let cancelled = false;
    setCheckingUser(true);
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (cancelled) return;
      setCheckingUser(false);
      if (error || !user) {
        setVerifiedForDashboard(false);
        return;
      }
      setVerifiedForDashboard(isEmailConfirmed(user));
    });

    return () => { cancelled = true; };
  }, [session?.user?.id, session?.access_token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (awaitingSignupEmailNotice) {
    return (
      <CheckYourEmail
        email={awaitingSignupEmailNotice}
        onBackToSignIn={() => setAwaitingSignupEmailNotice(null)}
      />
    );
  }

  if (session && (checkingUser || verifiedForDashboard === null)) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (session && verifiedForDashboard === false) {
    return <UnverifiedEmailBlock email={session.user.email} />;
  }

  if (session && verifiedForDashboard) {
    return (
      <>
        <Dashboard />
        {showWelcome && (
          <WelcomeModal onClose={() => setShowWelcome(false)} />
        )}
      </>
    );
  }

  return (
    <AuthPage
      onAwaitingEmailVerification={(email) => setAwaitingSignupEmailNotice(email)}
    />
  );
}
