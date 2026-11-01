import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'amanah-savings-challenges';

interface Challenge {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  savedAmount: number;
  completedMilestones: number[];
}

const CHALLENGE_META: Record<string, { nameEn: string; nameAr: string; icon: string; target: number }> = {
  '52-week': { nameEn: '52-Week Challenge', nameAr: 'تحدي 52 أسبوع', icon: '📅', target: 1378 },
  'no-spend': { nameEn: 'No-Spend Week', nameAr: 'أسبوع بدون إنفاق', icon: '🚫', target: 200 },
  'round-up': { nameEn: 'Round-Up Savings', nameAr: 'ادخار التقريب', icon: '🔄', target: 150 },
  'emergency-fund': { nameEn: 'Emergency Fund Sprint', nameAr: 'سباق صندوق الطوارئ', icon: '🏃', target: 3000 },
  'ramadan-savings': { nameEn: 'Ramadan Savings', nameAr: 'ادخار رمضان', icon: '🌙', target: 500 },
};

export default function EmailDigestToggle() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const actor = useRef(user?.id);
  actor.current = user?.id;
  const isAr = language === 'ar';
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEnabled(false);
    setInitialized(false);
    const load = async () => {
      try {
        if (!user) return;
        const { data, error } = await supabase.functions.invoke('app_11941c8fec_weekly_digest', { body: { action: 'get_preferences' } });
        if (error || typeof data?.enabled !== 'boolean') throw Error('Digest preferences unavailable');
        if (!cancelled && actor.current === user.id) setEnabled(data.enabled);
      } catch {
        if (!cancelled) toast.error(language === 'ar' ? 'تعذر تحميل إعدادات الملخص البريدي.' : 'Email digest preferences could not be loaded.');
      } finally { if (!cancelled) setInitialized(true); }
    };
    load();
    return () => { cancelled = true; };
  }, [user, language]);

  function getSavingsData(): { challenges: Challenge[] } {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { challenges: [] };
      const joined = JSON.parse(stored) as Array<{
        challengeId: string;
        savedAmount: number;
        completedMilestones: number[];
      }>;
      const challenges: Challenge[] = joined.map(j => {
        const meta = CHALLENGE_META[j.challengeId];
        if (!meta) return null;
        return {
          id: j.challengeId,
          name: isAr ? meta.nameAr : meta.nameEn,
          icon: meta.icon,
          targetAmount: meta.target,
          savedAmount: j.savedAmount,
          completedMilestones: j.completedMilestones,
        };
      }).filter(Boolean) as Challenge[];
      return { challenges };
    } catch {
      return { challenges: [] };
    }
  }

  async function toggleDigest() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !user || session.user.id !== user.id || actor.current !== user.id) throw Error('Account changed');

      const newEnabled = !enabled;
      const savingsData = newEnabled ? getSavingsData() : undefined;

      const { data, error } = await supabase.functions.invoke('app_11941c8fec_weekly_digest', {
        body: {
          action: 'subscribe',
          enabled: newEnabled,
          savings_data: savingsData,
        },
      });

      if (error || data?.success !== true) throw Error('Digest preference rejected');
      if (actor.current === user.id) setEnabled(newEnabled);
    } catch {
      toast.error(isAr ? 'لم تُحفظ إعدادات الملخص البريدي. حاول مجدداً.' : 'Email digest preferences were not saved. Please retry.');
    } finally {
      setLoading(false);
    }
  }

  if (!initialized) return null;

  return (
    <button
      onClick={toggleDigest}
      disabled={loading}
      className={`relative p-2 rounded-lg border transition-all ${
        enabled
          ? 'border-[#c9a96e]/50 bg-[#c9a96e]/10 text-[#c9a96e]'
          : 'border-border bg-background text-muted-foreground hover:border-[#c9a96e]/30'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={
        enabled
          ? (isAr ? 'إيقاف الملخص الأسبوعي' : 'Disable Weekly Digest')
          : (isAr ? 'تفعيل الملخص الأسبوعي' : 'Enable Weekly Digest')
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
      {enabled && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
      )}
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </span>
      )}
    </button>
  );
}