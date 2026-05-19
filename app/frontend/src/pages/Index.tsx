import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface HijriInfo {
  day: string;
  month: string;
  year: string;
}

export default function HomePage() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [hijriDate, setHijriDate] = useState<HijriInfo | null>(null);
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string } | null>(null);
  const [dailyVerse, setDailyVerse] = useState<{ arabic: string; translation: string; reference: string } | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Fetch Hijri date
  useEffect(() => {
    const fetchHijri = async () => {
      try {
        const today = new Date();
        const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
        const res = await fetch(`https://api.aladhan.com/v1/gpiToH/${dateStr}`);
        const data = await res.json();
        setHijriDate({
          day: data.data.hijri.day,
          month: data.data.hijri.month.en,
          year: data.data.hijri.year,
        });
      } catch {
        // Silently fail
      }
    };
    fetchHijri();
  }, []);

  // Fetch next prayer time
  useEffect(() => {
    const fetchPrayer = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const today = new Date();
              const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
              const res = await fetch(
                `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=2`
              );
              const data = await res.json();
              const timings = data.data.timings;
              const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
              const now = new Date();

              for (const name of prayers) {
                const [h, m] = timings[name].split(':').map(Number);
                const prayerTime = new Date();
                prayerTime.setHours(h, m, 0, 0);
                if (prayerTime > now) {
                  setNextPrayer({ name, time: timings[name] });
                  return;
                }
              }
              setNextPrayer({ name: 'Fajr (tomorrow)', time: timings.Fajr });
            },
            () => {
              // Location denied
            }
          );
        }
      } catch {
        // Silently fail
      }
    };
    fetchPrayer();
  }, []);

  // Daily verse
  useEffect(() => {
    const verses = [
      { arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', translation: 'Indeed, with hardship comes ease.', reference: 'Quran 94:6' },
      { arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', translation: 'And whoever relies upon Allah - then He is sufficient for him.', reference: 'Quran 65:3' },
      { arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', translation: 'So remember Me; I will remember you.', reference: 'Quran 2:152' },
      { arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ', translation: 'And your Lord is going to give you, and you will be satisfied.', reference: 'Quran 93:5' },
      { arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي', translation: 'My Lord, expand for me my chest [with assurance].', reference: 'Quran 20:25' },
      { arabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', translation: 'And say, "My Lord, increase me in knowledge."', reference: 'Quran 20:114' },
      { arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', translation: 'Indeed, Allah is with the patient.', reference: 'Quran 2:153' },
    ];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setDailyVerse(verses[dayOfYear % verses.length]);
  }, []);

  // Calculate streak
  useEffect(() => {
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const prayerData = localStorage.getItem(`prayer_completed_${dateStr}`);
      if (prayerData) {
        const completed = JSON.parse(prayerData);
        if (completed.length >= 1) {
          currentStreak++;
        } else {
          break;
        }
      } else {
        if (i === 0) continue;
        break;
      }
    }
    setStreak(currentStreak);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a2e1f]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14b8a6]"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a2e1f] pb-20">
      {/* Header */}
      <header className="border-b border-[#1a4d35] bg-[#0a2e1f]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#14b8a6] to-[#0d9488] flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <h1 className="text-xl font-bold text-white">AmanahLife</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0f3d2a] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#14b8a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-gray-400 hover:text-white hover:bg-[#1a4d35]">
              {t('signOut')}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome + Hijri Date */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{t('assalamuAlaikum')}</h2>
            <p className="text-gray-400 mt-1">{t('islamicCompanion')}</p>
          </div>
          {hijriDate && (
            <div className="text-right bg-[#0f3d2a] px-3 py-2 rounded-xl border border-[#1a4d35]">
              <p className="text-xs text-[#d4a853] font-medium">{hijriDate.day} {hijriDate.month}</p>
              <p className="text-[10px] text-gray-400">{hijriDate.year} AH</p>
            </div>
          )}
        </div>

        {/* Top Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {nextPrayer && (
            <div
              className="bg-gradient-to-r from-[#14b8a6] to-[#0d9488] rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate('/prayer-times')}
            >
              <p className="text-teal-100 text-xs">{t('nextPrayer')}</p>
              <p className="text-xl font-bold text-white mt-0.5">{nextPrayer.name}</p>
              <p className="text-teal-200 text-sm">{nextPrayer.time}</p>
            </div>
          )}

          <div className="bg-gradient-to-r from-[#d4a853] to-[#c49a48] rounded-2xl p-4">
            <p className="text-amber-100 text-xs">{t('prayerStreak')}</p>
            <p className="text-xl font-bold text-white mt-0.5">{streak} {streak === 1 ? 'day' : t('days')} 🔥</p>
            <p className="text-amber-200 text-sm">{t('keepGoing')}</p>
          </div>

          <div
            className="bg-gradient-to-r from-[#0f3d2a] to-[#1a4d35] rounded-2xl p-4 border border-[#1a4d35] cursor-pointer hover:border-[#14b8a6] transition-all"
            onClick={() => navigate('/dhikr')}
          >
            <p className="text-gray-400 text-xs">{t('todaysDhikr')}</p>
            <p className="text-xl font-bold text-[#14b8a6] mt-0.5">
              {localStorage.getItem(`dhikr_total_${new Date().toDateString()}`) || '0'}
            </p>
            <p className="text-gray-500 text-sm">{t('tapToContinue')}</p>
          </div>
        </div>

        {/* Daily Verse */}
        {dailyVerse && (
          <div className="mb-6 bg-[#0f3d2a] rounded-2xl border border-[#1a4d35] p-5 text-center">
            <p className="text-xs text-[#d4a853] font-medium mb-2">📖 {t('verseOfDay')}</p>
            <p className="text-xl font-arabic text-white leading-relaxed mb-2">{dailyVerse.arabic}</p>
            <p className="text-sm text-gray-400 italic">{dailyVerse.translation}</p>
            <p className="text-xs text-[#d4a853] mt-2">{dailyVerse.reference}</p>
          </div>
        )}

        {/* Quick Actions Grid */}
        <h3 className="text-sm font-semibold text-gray-400 mb-3">{t('quickActions')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction icon="🕌" title={t('prayer')} description="Track daily prayers" onClick={() => navigate('/prayer-times')} />
          <QuickAction icon="📖" title={t('quran')} description="Read & bookmark" onClick={() => navigate('/quran')} />
          <QuickAction icon="🤲" title={t('duas')} description="Supplications" onClick={() => navigate('/duas')} />
          <QuickAction icon="📿" title={t('dhikr')} description="Remembrance" onClick={() => navigate('/dhikr')} />
          <QuickAction icon="🌅" title={t('dailyRoutine')} description="Daily habits" onClick={() => navigate('/daily-routine')} />
          <QuickAction icon="🌙" title={t('fasting')} description="Track fasting" onClick={() => navigate('/fasting')} />
          <QuickAction icon="✅" title={t('tasks')} description="Manage tasks" onClick={() => navigate('/tasks')} />
          <QuickAction icon="📿" title={t('adhkar')} description="Morning & Evening" onClick={() => navigate('/adhkar')} />
          <QuickAction icon="💰" title={t('finance')} description="Track finances" onClick={() => navigate('/finance')} />
          <QuickAction icon="🧭" title={t('qibla')} description="Find direction" onClick={() => navigate('/qibla')} />
          <QuickAction icon="💎" title={t('zakat')} description="Calculator" onClick={() => navigate('/zakat')} />
          <QuickAction icon="📅" title={t('calendar')} description="Hijri dates" onClick={() => navigate('/calendar')} />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function QuickAction({ icon, title, description, onClick }: { icon: string; title: string; description: string; onClick?: () => void }) {
  return (
    <div
      className="p-4 rounded-2xl bg-[#0f3d2a] border border-[#1a4d35] hover:border-[#14b8a6] cursor-pointer active:scale-95 transition-all"
      onClick={onClick}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-white text-sm">{title}</h3>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}