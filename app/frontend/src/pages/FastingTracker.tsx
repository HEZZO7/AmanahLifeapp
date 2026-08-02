import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import ExcusedPeriodsDialog from '@/components/ExcusedPeriodsDialog';
import { getExcusedPeriods, isDateExcusedForFasting, isoDate } from '@/lib/excusedPeriods';

interface DayStatus {
  date: string;
  fasted: boolean;
  excused: boolean;
}

export default function FastingTracker() {
  const { t, language, isRTL } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = new Date().toDateString();

  const [suhoor, setSuhoor] = useState(false);
  const [fasting, setFasting] = useState(false);
  const [iftar, setIftar] = useState(false);
  const [monthDays, setMonthDays] = useState<DayStatus[]>([]);
  const [excusedDialogOpen, setExcusedDialogOpen] = useState(false);

  useEffect(() => {
    const storedToday = localStorage.getItem(`fasting_today_${today}`);
    if (storedToday) {
      const data = JSON.parse(storedToday);
      setSuhoor(data.suhoor || false);
      setFasting(data.fasting || false);
      setIftar(data.iftar || false);
    }

    // Load 30-day grid
    const excusedPeriods = getExcusedPeriods(userId);
    const days: DayStatus[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayData = localStorage.getItem(`fasting_today_${dateStr}`);
      const fasted = dayData ? JSON.parse(dayData).fasting === true : false;
      // Phase C: excused days (any of the 4 reasons) never show as
      // "missed" - they feed the qada counter instead.
      const excused = !fasted && isDateExcusedForFasting(isoDate(d), excusedPeriods);
      days.push({ date: dateStr, fasted, excused });
    }
    setMonthDays(days);
  }, [today, userId]);

  const saveToday = (s: boolean, f: boolean, i: boolean) => {
    localStorage.setItem(`fasting_today_${today}`, JSON.stringify({ suhoor: s, fasting: f, iftar: i }));
  };

  const toggleSuhoor = () => {
    const v = !suhoor;
    setSuhoor(v);
    saveToday(v, fasting, iftar);
  };

  const toggleFasting = () => {
    const v = !fasting;
    setFasting(v);
    saveToday(suhoor, v, iftar);
    setMonthDays((prev) => prev.map((d) => d.date === today ? { ...d, fasted: v, excused: v ? false : d.excused } : d));
  };

  const toggleIftar = () => {
    const v = !iftar;
    setIftar(v);
    saveToday(suhoor, fasting, v);
  };

  const fastedDays = monthDays.filter((d) => d.fasted).length;
  const excusedDays = monthDays.filter((d) => d.excused).length;
  // Phase C: excused days feed the qada counter, not this "missed" count.
  const missedDays = monthDays.length - fastedDays - excusedDays;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="⏱️" title={t('fasting')} />
      <div className="px-4 pt-2">
        <p className="text-muted-foreground text-sm">{fastedDays}/30 {t('days')} {t('completed')}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Today's Status */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="text-foreground font-semibold mb-3">{t('today')}</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={toggleSuhoor}
              className={`p-3 rounded-xl text-center transition-all ${
                suhoor ? 'bg-primary/20 border border-primary' : 'bg-secondary border border-border'
              }`}
            >
              <span className="text-2xl block mb-1">🌙</span>
              <span className={`text-xs ${suhoor ? 'text-primary' : 'text-muted-foreground'}`}>{t('suhoor')}</span>
            </button>
            <button
              onClick={toggleFasting}
              className={`p-3 rounded-xl text-center transition-all ${
                fasting ? 'bg-[#D4A017]/20 border border-[#D4A017]' : 'bg-secondary border border-border'
              }`}
            >
              <span className="text-2xl block mb-1">☀️</span>
              <span className={`text-xs ${fasting ? 'text-[#D4A017]' : 'text-muted-foreground'}`}>{t('fasting')}</span>
            </button>
            <button
              onClick={toggleIftar}
              className={`p-3 rounded-xl text-center transition-all ${
                iftar ? 'bg-primary/20 border border-primary' : 'bg-secondary border border-border'
              }`}
            >
              <span className="text-2xl block mb-1">🌅</span>
              <span className={`text-xs ${iftar ? 'text-primary' : 'text-muted-foreground'}`}>{t('iftar')}</span>
            </button>
          </div>
        </div>

        {/* Missed vs Made-Up Summary */}
        <div className={`bg-card rounded-2xl p-4 border border-border grid ${excusedDays > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{fastedDays}</p>
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'أيام مكتملة' : 'Completed'}</p>
          </div>
          <div className="text-center border-l border-border">
            <p className="text-2xl font-bold text-[#E05D4E]">{missedDays}</p>
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'أيام فائتة (بحاجة للقضاء)' : 'Missed (need makeup)'}</p>
          </div>
          {excusedDays > 0 && (
            <div className="text-center border-l border-border">
              <p className="text-2xl font-bold text-[#D4A017]">{excusedDays}</p>
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'معذورة (بحاجة للقضاء)' : 'Excused (qada owed)'}</p>
            </div>
          )}
        </div>

        {/* 30-Day Grid - excused days get a distinct 3rd color, never the "missed" red */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="text-foreground font-semibold mb-3">{language === 'ar' ? 'تقدم ٣٠ يوم' : '30-Day Progress'}</h2>
          <div className="grid grid-cols-10 gap-1.5">
            {monthDays.map((day, i) => (
              <div
                key={i}
                className={`w-full aspect-square rounded-md ${
                  day.fasted ? 'bg-primary' : day.excused ? 'bg-[#D4A017]' : 'bg-secondary'
                }`}
                title={day.date}
              />
            ))}
          </div>
        </div>

        {/* Discreet entry point - no dashboard tile, no notification about it. */}
        <button
          onClick={() => setExcusedDialogOpen(true)}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground"
        >
          {language === 'ar' ? 'عذر شرعي' : 'Excused period'}
        </button>
        <ExcusedPeriodsDialog open={excusedDialogOpen} onOpenChange={setExcusedDialogOpen} />
      </div>

      <BottomNav />
    </div>
  );
}