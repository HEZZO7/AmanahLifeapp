import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface CachedTip {
  tip: string;
  date: string;
  language: string;
}

interface ChallengeInfo {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  daysRemaining: number;
  progress: number;
}

const CACHE_KEY = 'amanah-daily-savings-tip';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function useDailySavingsTip(challenges: ChallengeInfo[], language: string) {
  const [tip, setTip] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTip = useCallback(async (force = false) => {
    if (challenges.length === 0) {
      setTip(null);
      return;
    }

    const today = getTodayDate();

    // Check cache
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed: CachedTip = JSON.parse(cached);
          if (parsed.date === today && parsed.language === language && parsed.tip) {
            setTip(parsed.tip);
            return;
          }
        }
      } catch { /* ignore cache errors */ }
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('app_11941c8fec_savings_tips', {
        body: { challenges, language },
      });

      if (error) {
        console.error('Failed to fetch savings tip:', error);
        setIsLoading(false);
        return;
      }

      if (data?.tip) {
        setTip(data.tip);
        const cacheEntry: CachedTip = {
          tip: data.tip,
          date: today,
          language,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
      }
    } catch (err) {
      console.error('Error fetching savings tip:', err);
    } finally {
      setIsLoading(false);
    }
  }, [challenges, language]);

  useEffect(() => {
    fetchTip();
  }, [fetchTip]);

  const refreshTip = useCallback(() => {
    fetchTip(true);
  }, [fetchTip]);

  return { tip, isLoading, refreshTip };
}