import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';

interface HijriInfo {
  day: string;
  month: string;
  year: string;
}

export default function HomePage() {
  const { user, loading, signOut } = useAuth();
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

  // Daily verse (rotating based on day of year)
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
        if (i === 0) continue; // Today might not have data yet
        break;
      }
    }
    setStreak(currentStreak);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-20">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">AmanahLife</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-gray-600 hover:text-gray-900">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome + Hijri Date */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Assalamu Alaikum! 👋</h2>
            <p className="text-gray-500 mt-1">Your Islamic life companion</p>
          </div>
          {hijriDate && (
            <div className="text-right bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium">{hijriDate.day} {hijriDate.month}</p>
              <p className="text-[10px] text-emerald-500">{hijriDate.year} AH</p>
            </div>
          )}
        </div>

        {/* Top Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Next Prayer Widget */}
          {nextPrayer && (
            <Card className="border-0 shadow-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/prayer-times')}>
              <CardContent className="p-4">
                <p className="text-blue-100 text-xs">Next Prayer</p>
                <p className="text-xl font-bold mt-0.5">{nextPrayer.name}</p>
                <p className="text-blue-200 text-sm">{nextPrayer.time}</p>
              </CardContent>
            </Card>
          )}

          {/* Streak Widget */}
          <Card className="border-0 shadow-md bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <CardContent className="p-4">
              <p className="text-amber-100 text-xs">Prayer Streak</p>
              <p className="text-xl font-bold mt-0.5">{streak} {streak === 1 ? 'day' : 'days'} 🔥</p>
              <p className="text-amber-200 text-sm">Keep it going!</p>
            </CardContent>
          </Card>

          {/* Daily Dhikr Progress */}
          <Card className="border-0 shadow-md bg-gradient-to-r from-teal-500 to-emerald-500 text-white cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/dhikr')}>
            <CardContent className="p-4">
              <p className="text-teal-100 text-xs">Today's Dhikr</p>
              <p className="text-xl font-bold mt-0.5">
                {localStorage.getItem(`dhikr_total_${new Date().toDateString()}`) || '0'}
              </p>
              <p className="text-teal-200 text-sm">Tap to continue</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Verse */}
        {dailyVerse && (
          <Card className="mb-6 border border-purple-100 bg-purple-50/50">
            <CardContent className="p-5 text-center">
              <p className="text-xs text-purple-500 font-medium mb-2">📖 Verse of the Day</p>
              <p className="text-xl font-arabic text-gray-800 leading-relaxed mb-2">{dailyVerse.arabic}</p>
              <p className="text-sm text-gray-600 italic">{dailyVerse.translation}</p>
              <p className="text-xs text-purple-500 mt-2">{dailyVerse.reference}</p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Grid */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction icon="🕌" title="Prayer Times" description="Track daily prayers" color="bg-blue-50 border-blue-200 hover:bg-blue-100" onClick={() => navigate('/prayer-times')} />
          <QuickAction icon="📖" title="Quran" description="Read & bookmark" color="bg-purple-50 border-purple-200 hover:bg-purple-100" onClick={() => navigate('/quran')} />
          <QuickAction icon="🤲" title="Duas" description="Supplications" color="bg-amber-50 border-amber-200 hover:bg-amber-100" onClick={() => navigate('/duas')} />
          <QuickAction icon="📿" title="Dhikr" description="Remembrance" color="bg-teal-50 border-teal-200 hover:bg-teal-100" onClick={() => navigate('/dhikr')} />
          <QuickAction icon="🧭" title="Qibla" description="Find direction" color="bg-orange-50 border-orange-200 hover:bg-orange-100" onClick={() => navigate('/qibla')} />
          <QuickAction icon="💰" title="Zakat" description="Calculator" color="bg-green-50 border-green-200 hover:bg-green-100" onClick={() => navigate('/zakat')} />
          <QuickAction icon="📅" title="Calendar" description="Hijri dates" color="bg-indigo-50 border-indigo-200 hover:bg-indigo-100" onClick={() => navigate('/calendar')} />
          <QuickAction icon="🌙" title="Ramadan" description="Coming soon" color="bg-pink-50 border-pink-200" comingSoon />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function QuickAction({ icon, title, description, color, onClick, comingSoon }: { icon: string; title: string; description: string; color: string; onClick?: () => void; comingSoon?: boolean }) {
  return (
    <div
      className={`p-4 rounded-xl border ${color} ${onClick ? 'cursor-pointer active:scale-95' : 'opacity-60'} transition-all relative`}
      onClick={onClick}
    >
      {comingSoon && (
        <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">
          Soon
        </span>
      )}
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}