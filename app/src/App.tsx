import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import type { Session } from '@supabase/supabase-js';


function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch((error) => {
      console.error('Error checking session:', error);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  console.log('App rendering. Loading:', loading, 'Session:', session);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return <Dashboard />;
}

export default App;
