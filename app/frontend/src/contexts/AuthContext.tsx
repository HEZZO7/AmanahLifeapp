import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { releaseDevicePush } from '@/lib/devicePush';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const previousActor = useRef<string | null>(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      previousActor.current = session?.user.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextActor = session?.user.id ?? null;
        if (previousActor.current && previousActor.current !== nextActor) {
          void releaseDevicePush().catch(() => toast.warning('تعذر إيقاف إشعارات الحساب السابق؛ عطّل الإشعارات من إعدادات المتصفح. / Previous account notifications could not be disabled; disable them in browser settings.'));
        }
        previousActor.current = nextActor;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Revoke delivery on a shared browser before ending the authenticated session.
    // Report failed revocation without preventing the user from signing out.
    try { await releaseDevicePush(); }
    catch { toast.warning('تعذر إيقاف إشعارات الجهاز. عطّلها من إعدادات المتصفح قبل مشاركة الجهاز. / Device notifications could not be disabled. Disable them in browser settings before sharing this device.'); }
    // Only clear per-account caches that would otherwise leak into the next
    // signed-in session on this device. Do NOT blanket-clear localStorage —
    // nearly all user content (goals, tasks, finance, wellness, fasting,
    // dhikr, quran progress, family budget, etc.) lives only here with no
    // server copy, so a full clear() here permanently destroys it.
    localStorage.removeItem('amanahlife_subscription');
    localStorage.removeItem('amanah-email-digest-status');
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore errors - user is already logged out locally
    }
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuth: AuthContextType = {
  user: null,
  session: null,
  loading: false,
  signUp: async () => ({ error: new Error('AuthProvider not available') }),
  signIn: async () => ({ error: new Error('AuthProvider not available') }),
  signInWithGoogle: async () => ({ error: new Error('AuthProvider not available') }),
  signOut: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return safe defaults instead of throwing - prevents blank page crashes
    return defaultAuth;
  }
  return context;
}
