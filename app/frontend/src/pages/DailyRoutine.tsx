import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface Routine {
  id: string;
  nameAr: string;
  nameEn: string;
  duration: number;
  icon: string;
  streak: number;
  completed: boolean;
}

const DEFAULT_ROUTINES: Omit<Routine, 'streak' | 'completed'>[] = [
  { id: 'morning', nameAr: 'روتين الصباح', nameEn: 'Morning Routine', duration: 30, icon: '🌅' },
  { id: 'weekly', nameAr: 'مراجعة أسبوعية', nameEn: 'Weekly Review', duration: 45, icon: '📋' },
  { id: 'health', nameAr: 'يوم صحي', nameEn: 'Health Day', duration: 60, icon: '💪' },
  { id: 'focus', nameAr: 'تركيز عميق', nameEn: 'Deep Focus', duration: 90, icon: '🎯' },
  { id: 'learning', nameAr: 'جلسة تعلم', nameEn: 'Learning Session', duration: 45, icon: '📚' },
];

export default function DailyRoutine() {
  const { language, t } = useLanguage();
  const [routines, setRoutines] = useState<Routine[]>([]);

  useEffect(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(`routines_${today}`);
    if (stored) {
      setRoutines(JSON.parse(stored));
    } else {
      const initial = DEFAULT_ROUTINES.map((r) => {
        const streakKey = `routine_streak_${r.id}`;
        const streak = parseInt(localStorage.getItem(streakKey) || '0', 10);
        return { ...r, streak, completed: false };
      });
      setRoutines(initial);
    }
  }, []);

  const toggleRoutine = (id: string) => {
    const today = new Date().toDateString();
    const updated = routines.map((r) => {
      if (r.id === id) {
        const newCompleted = !r.completed;
        const streakKey = `routine_streak_${r.id}`;
        const newStreak = newCompleted ? r.streak + 1 : Math.max(0, r.streak - 1);
        localStorage.setItem(streakKey, String(newStreak));
        return { ...r, completed: newCompleted, streak: newStreak };
      }
      return r;
    });
    setRoutines(updated);
    localStorage.setItem(`routines_${today}`, JSON.stringify(updated));
  };

  const completedCount = routines.filter((r) => r.completed).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">{t('dailyRoutine')}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {completedCount}/{routines.length} {t('completed')}
        </p>
      </header>

      {/* Progress Bar */}
      <div className="px-4 py-4">
        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-[#d4a853] rounded-full transition-all duration-500"
            style={{ width: `${routines.length > 0 ? (completedCount / routines.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Routines List */}
      <div className="px-4 space-y-3">
        {routines.map((routine) => (
          <div
            key={routine.id}
            className={`p-4 rounded-2xl border transition-all ${
              routine.completed
                ? 'bg-primary/10 border-primary/30'
                : 'bg-card border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{routine.icon}</span>
                <div>
                  <h3 className={`font-semibold text-foreground ${routine.completed ? 'line-through opacity-60' : ''}`}>
                    {language === 'ar' ? routine.nameAr : routine.nameEn}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{routine.duration} {t('minutes')}</span>
                    <span className="text-xs text-[#d4a853]">🔥 {routine.streak} {t('days')}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleRoutine(routine.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  routine.completed
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-muted-foreground hover:bg-primary/20'
                }`}
              >
                {routine.completed ? '✓' : '○'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}