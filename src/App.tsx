import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, registrationGate } from './lib/supabase';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { WelcomeModal } from './components/WelcomeModal';

const WELCOME_KEY = 'cdlscore_welcomed';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  const activateSession = (session: Session | null, isNew: boolean) => {
    setSession(session);
    if (isNew && session) {
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

    // When SignupPage finishes the RPC, it calls registrationGate.commit()
    // which triggers this callback to finally set the session and route.
    registrationGate.onCommit((session, isNew) => {
      activateSession(session, isNew);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (registrationGate.isPending()) {
        // Registration in progress — hold the session, don't route yet
        registrationGate.holdSession(session);
        return;
      }
      const isNew = event === 'SIGNED_IN' && !!session &&
        Date.now() - new Date(session.user.created_at).getTime() < 30_000;
      activateSession(session, isNew);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {session ? <Dashboard /> : <AuthPage />}
      {showWelcome && session && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}
    </>
  );
}

export default App;
