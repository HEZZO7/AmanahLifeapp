import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface WellnessEntry {
  date: string;
  mood: number;
  sleep: number;
  hydration: number;
  stress: number;
}

const MOOD_EMOJIS = ['😢', '😟', '😐', '🙂', '😊'];

export default function Wellness() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<WellnessEntry[]>(() => {
    const stored = localStorage.getItem('amanah-wellness');
    return stored ? JSON.parse(stored) : [];
  });
  const [mood, setMood] = useState(3);
  const [sleepHours, setSleepHours] = useState(7);
  const [hydration, setHydration] = useState(6);
  const [stress, setStress] = useState(2);
  const [showForm, setShowForm] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find(e => e.date === todayStr);

  useEffect(() => {
    localStorage.setItem('amanah-wellness', JSON.stringify(entries));
  }, [entries]);

  const logToday = () => {
    const entry: WellnessEntry = { date: todayStr, mood, sleep: sleepHours, hydration, stress };
    const updated = entries.filter(e => e.date !== todayStr);
    setEntries([entry, ...updated]);
    setShowForm(false);
  };

  const getWellnessScore = (entry: WellnessEntry): number => {
    const moodScore = (entry.mood / 5) * 25;
    const sleepScore = (Math.min(entry.sleep, 9) / 9) * 25;
    const hydrationScore = (entry.hydration / 12) * 25;
    const stressScore = ((6 - entry.stress) / 5) * 25;
    return Math.round(moodScore + sleepScore + hydrationScore + stressScore);
  };

  const getLast7Days = (): WellnessEntry[] => {
    const days: WellnessEntry[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = entries.find(e => e.date === dateStr);
      days.push(entry || { date: dateStr, mood: 0, sleep: 0, hydration: 0, stress: 0 });
    }
    return days;
  };

  const last7 = getLast7Days();

  return (
    <div className="min-h-screen bg-[#0a2e1f] dark:bg-[#0a2e1f] pb-20">
      <header className="border-b border-[#1a4d35] bg-[#0a2e1f]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
          <h1 className="text-xl font-bold text-white">💚 {t('wellness')}</h1>
          {!todayEntry && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-[#14b8a6] text-white px-3 py-1.5 rounded-lg text-sm font-medium"
            >
              + {t('logToday')}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Log Form */}
        {showForm && (
          <div className="bg-[#0f3d2a] rounded-2xl p-4 mb-4 border border-[#1a4d35]">
            {/* Mood */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">{t('mood')}</label>
              <div className="flex justify-between">
                {MOOD_EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => setMood(i + 1)}
                    className={`text-2xl p-2 rounded-xl transition-all ${mood === i + 1 ? 'bg-[#14b8a6]/20 scale-125' : 'opacity-50'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Sleep */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-1 block">{t('sleep')}: {sleepHours} {t('hours')}</label>
              <input
                type="range"
                min="0"
                max="12"
                value={sleepHours}
                onChange={(e) => setSleepHours(Number(e.target.value))}
                className="w-full accent-[#14b8a6]"
              />
            </div>

            {/* Hydration */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-1 block">{t('hydration')}: {hydration} {t('cups')}</label>
              <input
                type="range"
                min="0"
                max="12"
                value={hydration}
                onChange={(e) => setHydration(Number(e.target.value))}
                className="w-full accent-[#14b8a6]"
              />
            </div>

            {/* Stress */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-1 block">{t('stress')}: {stress}/5</label>
              <input
                type="range"
                min="1"
                max="5"
                value={stress}
                onChange={(e) => setStress(Number(e.target.value))}
                className="w-full accent-[#d4a853]"
              />
            </div>

            <button onClick={logToday} className="w-full bg-[#14b8a6] text-white py-2.5 rounded-lg text-sm font-medium">
              {t('save')}
            </button>
          </div>
        )}

        {/* Today's Score */}
        {todayEntry && (
          <div className="bg-[#0f3d2a] rounded-2xl p-4 mb-4 border border-[#1a4d35]">
            <h3 className="text-sm text-gray-400 mb-3">{t('wellnessScore')} — {t('today')}</h3>
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-[#d4a853]">{getWellnessScore(todayEntry)}</span>
              <span className="text-gray-400 text-sm">/100</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <MetricCircle label={t('mood')} value={todayEntry.mood} max={5} emoji={MOOD_EMOJIS[todayEntry.mood - 1]} />
              <MetricCircle label={t('sleep')} value={todayEntry.sleep} max={12} emoji="😴" />
              <MetricCircle label={t('hydration')} value={todayEntry.hydration} max={12} emoji="💧" />
              <MetricCircle label={t('stress')} value={todayEntry.stress} max={5} emoji="😰" inverted />
            </div>
          </div>
        )}

        {/* 7-Day Trend */}
        <div className="bg-[#0f3d2a] rounded-2xl p-4 border border-[#1a4d35]">
          <h3 className="text-sm text-gray-400 mb-3">{t('weeklyTrend')}</h3>
          <div className="flex items-end justify-between gap-1 h-32">
            {last7.map((entry, i) => {
              const score = entry.mood > 0 ? getWellnessScore(entry) : 0;
              const height = score > 0 ? Math.max(10, score) : 5;
              const dayLabel = new Date(entry.date).toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <span className="text-[10px] text-gray-500 mb-1">{score > 0 ? score : ''}</span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${score > 0 ? 'bg-gradient-to-t from-[#14b8a6] to-[#d4a853]' : 'bg-[#1a4d35]'}`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-gray-500 mt-1">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function MetricCircle({ label, value, max, emoji, inverted }: { label: string; value: number; max: number; emoji: string; inverted?: boolean }) {
  const percentage = inverted ? ((max - value + 1) / max) * 100 : (value / max) * 100;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-12 h-12 mb-1">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#1a4d35"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="3"
            strokeDasharray={`${percentage}, 100`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm">{emoji}</span>
      </div>
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className="text-xs text-white font-medium">{value}/{max}</span>
    </div>
  );
}