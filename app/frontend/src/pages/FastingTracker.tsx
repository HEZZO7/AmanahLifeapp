import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

interface DayStatus {
  date: string;
  fasted: boolean;
}

export default function FastingTracker() {
  const { t, language, isRTL } = useLanguage();
  const today = new Date().toDateString();

  const [suhoor, setSuhoor] = useState(false);
  const [fasting, setFasting] = useState(false);
  const [iftar, setIftar] = useState(false);
  const [monthDays, setMonthDays] = useState<DayStatus[]>([]);

  useEffect(() => {
    const storedToday = localStorage.getItem(`fasting_today_${today}`);
    if (storedToday) {
      const data = JSON.parse(storedToday);
      setSuhoor(data.suhoor || false);
      setFasting(data.fasting || false);
      setIftar(data.iftar || false);
    }

    // Load 30-day grid
    const days: DayStatus[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayData = localStorage.getItem(`fasting_today_${dateStr}`);
      days.push({
        date: dateStr,
        fasted: dayData ? JSON.parse(dayData).fasting === true : false,
      });
    }
    setMonthDays(days);
  }, [today]);

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
  };

  const toggleIftar = () => {
    const v = !iftar;
    setIftar(v);
    saveToday(suhoor, fasting, v);
  };

  const fastedDays = monthDays.filter((d) => d.fasted).length;
  const missedDays = monthDays.length - fastedDays;

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
        <div className="bg-card rounded-2xl p-4 border border-border grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{fastedDays}</p>
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'أيام مكتملة' : 'Completed'}</p>
          </div>
          <div className="text-center border-l border-border">
            <p className="text-2xl font-bold text-[#E05D4E]">{missedDays}</p>
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'أيام فائتة (بحاجة للقضاء)' : 'Missed (need makeup)'}</p>
          </div>
        </div>

        {/* 30-Day Grid */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="text-foreground font-semibold mb-3">{language === 'ar' ? 'تقدم ٣٠ يوم' : '30-Day Progress'}</h2>
          <div className="grid grid-cols-10 gap-1.5">
            {monthDays.map((day, i) => (
              <div
                key={i}
                className={`w-full aspect-square rounded-md ${
                  day.fasted ? 'bg-primary' : 'bg-secondary'
                }`}
                title={day.date}
              />
            ))}
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}