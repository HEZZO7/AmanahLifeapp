import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface DayStatus {
  date: string;
  fasted: boolean;
}

export default function FastingTracker() {
  const { t } = useLanguage();
  const today = new Date().toDateString();

  const [suhoor, setSuhoor] = useState(false);
  const [fasting, setFasting] = useState(false);
  const [iftar, setIftar] = useState(false);
  const [quranPages, setQuranPages] = useState(0);
  const [monthDays, setMonthDays] = useState<DayStatus[]>([]);

  useEffect(() => {
    const storedToday = localStorage.getItem(`fasting_today_${today}`);
    if (storedToday) {
      const data = JSON.parse(storedToday);
      setSuhoor(data.suhoor || false);
      setFasting(data.fasting || false);
      setIftar(data.iftar || false);
    }

    const storedPages = localStorage.getItem(`quran_pages_${today}`);
    if (storedPages) setQuranPages(parseInt(storedPages, 10));

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

  const addPages = (n: number) => {
    const newVal = Math.max(0, quranPages + n);
    setQuranPages(newVal);
    localStorage.setItem(`quran_pages_${today}`, String(newVal));
  };

  const fastedDays = monthDays.filter((d) => d.fasted).length;

  return (
    <div className="min-h-screen bg-[#0a2e1f] pb-20">
      <header className="sticky top-0 z-50 bg-[#0a2e1f]/95 backdrop-blur-sm border-b border-[#1a4d35] px-4 py-4">
        <h1 className="text-xl font-bold text-white">{t('fasting')}</h1>
        <p className="text-gray-400 text-sm mt-0.5">{fastedDays}/30 {t('days')} {t('completed')}</p>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Today's Status */}
        <div className="bg-[#0f3d2a] rounded-2xl p-4 border border-[#1a4d35]">
          <h2 className="text-white font-semibold mb-3">{t('today')}</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={toggleSuhoor}
              className={`p-3 rounded-xl text-center transition-all ${
                suhoor ? 'bg-[#14b8a6]/20 border border-[#14b8a6]' : 'bg-[#1a4d35] border border-[#1a4d35]'
              }`}
            >
              <span className="text-2xl block mb-1">🌙</span>
              <span className={`text-xs ${suhoor ? 'text-[#14b8a6]' : 'text-gray-400'}`}>{t('suhoor')}</span>
            </button>
            <button
              onClick={toggleFasting}
              className={`p-3 rounded-xl text-center transition-all ${
                fasting ? 'bg-[#d4a853]/20 border border-[#d4a853]' : 'bg-[#1a4d35] border border-[#1a4d35]'
              }`}
            >
              <span className="text-2xl block mb-1">☀️</span>
              <span className={`text-xs ${fasting ? 'text-[#d4a853]' : 'text-gray-400'}`}>{t('fasting')}</span>
            </button>
            <button
              onClick={toggleIftar}
              className={`p-3 rounded-xl text-center transition-all ${
                iftar ? 'bg-[#14b8a6]/20 border border-[#14b8a6]' : 'bg-[#1a4d35] border border-[#1a4d35]'
              }`}
            >
              <span className="text-2xl block mb-1">🌅</span>
              <span className={`text-xs ${iftar ? 'text-[#14b8a6]' : 'text-gray-400'}`}>{t('iftar')}</span>
            </button>
          </div>
        </div>

        {/* 30-Day Grid */}
        <div className="bg-[#0f3d2a] rounded-2xl p-4 border border-[#1a4d35]">
          <h2 className="text-white font-semibold mb-3">30-Day Progress</h2>
          <div className="grid grid-cols-10 gap-1.5">
            {monthDays.map((day, i) => (
              <div
                key={i}
                className={`w-full aspect-square rounded-md ${
                  day.fasted ? 'bg-[#14b8a6]' : 'bg-[#1a4d35]'
                }`}
                title={day.date}
              />
            ))}
          </div>
        </div>

        {/* Quran Pages */}
        <div className="bg-[#0f3d2a] rounded-2xl p-4 border border-[#1a4d35]">
          <h2 className="text-white font-semibold mb-3">{t('quranPages')}</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-[#d4a853]">{quranPages}</p>
              <p className="text-xs text-gray-400">{t('goal')}: 20 {t('pages')}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => addPages(-1)}
                className="w-10 h-10 rounded-full bg-[#1a4d35] text-white flex items-center justify-center hover:bg-[#14b8a6]/20"
              >
                -
              </button>
              <button
                onClick={() => addPages(1)}
                className="w-10 h-10 rounded-full bg-[#14b8a6] text-white flex items-center justify-center hover:bg-[#0d9488]"
              >
                +
              </button>
              <button
                onClick={() => addPages(5)}
                className="w-10 h-10 rounded-full bg-[#d4a853] text-white flex items-center justify-center hover:bg-[#c49a48]"
              >
                +5
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full h-2 bg-[#1a4d35] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#d4a853] rounded-full transition-all"
              style={{ width: `${Math.min(100, (quranPages / 20) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}