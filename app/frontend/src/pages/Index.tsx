import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import AppLogo from '@/components/AppLogo';

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
  const [searchQuery, setSearchQuery] = useState('');

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
            () => { /* Location denied */ }
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

  // Daily summary data
  const dailySummary = useMemo(() => {
    const tasks = JSON.parse(localStorage.getItem('amanah-tasks') || '[]');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter((t: { date?: string }) => !t.date || t.date === todayStr);
    const doneTasks = todayTasks.filter((t: { completed?: boolean }) => t.completed);

    const prayerData = localStorage.getItem(`prayer_completed_${new Date().toDateString()}`);
    const prayersDone = prayerData ? JSON.parse(prayerData).length : 0;

    const goals = JSON.parse(localStorage.getItem('amanah-goals') || '[]');
    const activeGoals = goals.filter((g: { status?: string }) => g.status === 'Active').length;

    const transactions = JSON.parse(localStorage.getItem('amanah-transactions') || '[]');
    const balance = transactions.reduce((acc: number, t: { type?: string; amount?: number }) => {
      return acc + (t.type === 'income' ? (t.amount || 0) : -(t.amount || 0));
    }, 0);

    // Overdue tasks
    const overdueTasks = tasks.filter((t: { date?: string; completed?: boolean }) => {
      if (!t.date || t.completed) return false;
      return t.date < todayStr;
    });

    return {
      tasksDone: doneTasks.length,
      tasksTotal: todayTasks.length,
      prayersDone,
      activeGoals,
      balance,
      overdueCount: overdueTasks.length,
    };
  }, []);

  // Navigation items for search
  const navItems = [
    { icon: '🕌', title: t('prayer'), description: 'Track daily prayers', path: '/prayer-times' },
    { icon: '📖', title: t('quran'), description: 'Read & bookmark', path: '/quran' },
    { icon: '🤲', title: t('duas'), description: 'Supplications', path: '/duas' },
    { icon: '📿', title: t('dhikr'), description: 'Remembrance', path: '/dhikr' },
    { icon: '🌅', title: t('dailyRoutine'), description: 'Daily habits', path: '/daily-routine' },
    { icon: '🌙', title: t('fasting'), description: 'Track fasting', path: '/fasting' },
    { icon: '✅', title: t('tasks'), description: 'Manage tasks', path: '/tasks' },
    { icon: '📿', title: t('adhkar'), description: 'Morning & Evening', path: '/adhkar' },
    { icon: '💰', title: t('finance'), description: 'Track finances', path: '/finance' },
    { icon: '🧭', title: t('qibla'), description: 'Find direction', path: '/qibla' },
    { icon: '💎', title: t('zakat'), description: 'Calculator', path: '/zakat' },
    { icon: '📅', title: t('calendar'), description: 'Hijri dates', path: '/calendar' },
    { icon: '🎯', title: t('goals'), description: 'Track goals', path: '/goals' },
    { icon: '💚', title: t('wellness'), description: 'Health tracking', path: '/wellness' },
    { icon: '📋', title: t('planner'), description: 'Plan your day', path: '/planner' },
  ];

  const filteredNavItems = navItems.filter(item =>
    !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10" />
            <h1 className="text-xl font-bold text-foreground">AmanahLife</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/settings')} className="w-9 h-9 rounded-full bg-card flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
              {t('signOut')}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome + Hijri Date */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t('assalamuAlaikum')}</h2>
            <p className="text-muted-foreground mt-1">{t('islamicCompanion')}</p>
          </div>
          {hijriDate && (
            <div className="text-right bg-card px-3 py-2 rounded-xl border border-border">
              <p className="text-xs text-[#d4a853] font-medium">{hijriDate.day} {hijriDate.month}</p>
              <p className="text-[10px] text-muted-foreground">{hijriDate.year} AH</p>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder={`🔍 ${t('search')}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* Overdue Alert */}
        {dailySummary.overdueCount > 0 && (
          <div
            className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/tasks')}
          >
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {dailySummary.overdueCount}
            </span>
            <p className="text-red-300 text-sm">{t('overdue')} {t('tasks').toLowerCase()}</p>
          </div>
        )}

        {/* Daily Summary */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-card rounded-xl p-2.5 text-center border border-border">
            <p className="text-[10px] text-muted-foreground">{t('tasks')}</p>
            <p className="text-sm font-bold text-foreground">{dailySummary.tasksDone}/{dailySummary.tasksTotal}</p>
          </div>
          <div className="bg-card rounded-xl p-2.5 text-center border border-border">
            <p className="text-[10px] text-muted-foreground">{t('prayer')}</p>
            <p className="text-sm font-bold text-foreground">{dailySummary.prayersDone}/5</p>
          </div>
          <div className="bg-card rounded-xl p-2.5 text-center border border-border">
            <p className="text-[10px] text-muted-foreground">{t('goals')}</p>
            <p className="text-sm font-bold text-[#d4a853]">{dailySummary.activeGoals}</p>
          </div>
          <div className="bg-card rounded-xl p-2.5 text-center border border-border">
            <p className="text-[10px] text-muted-foreground">{t('savings')}</p>
            <p className="text-sm font-bold text-primary">{dailySummary.balance >= 0 ? '+' : ''}{dailySummary.balance}</p>
          </div>
        </div>

        {/* Quick Shortcuts */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          <button onClick={() => navigate('/tasks')} className="bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-full text-xs whitespace-nowrap">
            ✅ {t('todaysTasks')}
          </button>
          <button onClick={() => navigate('/goals')} className="bg-[#d4a853]/10 border border-[#d4a853]/30 text-[#d4a853] px-3 py-1.5 rounded-full text-xs whitespace-nowrap">
            🎯 {t('activeGoals')}
          </button>
          <button onClick={() => navigate('/finance')} className="bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-full text-xs whitespace-nowrap">
            💰 {t('recentTransactions')}
          </button>
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
            className="bg-gradient-to-r from-card to-secondary rounded-2xl p-4 border border-border cursor-pointer hover:border-primary transition-all"
            onClick={() => navigate('/dhikr')}
          >
            <p className="text-muted-foreground text-xs">{t('todaysDhikr')}</p>
            <p className="text-xl font-bold text-primary mt-0.5">
              {localStorage.getItem(`dhikr_total_${new Date().toDateString()}`) || '0'}
            </p>
            <p className="text-muted-foreground text-sm">{t('tapToContinue')}</p>
          </div>
        </div>

        {/* Daily Verse */}
        {dailyVerse && (
          <div className="mb-6 bg-card rounded-2xl border border-border p-5 text-center">
            <p className="text-xs text-[#d4a853] font-medium mb-2">📖 {t('verseOfDay')}</p>
            <p className="text-xl font-arabic text-foreground leading-relaxed mb-2">{dailyVerse.arabic}</p>
            <p className="text-sm text-muted-foreground italic">{dailyVerse.translation}</p>
            <p className="text-xs text-[#d4a853] mt-2">{dailyVerse.reference}</p>
          </div>
        )}

        {/* Quick Actions Grid */}
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('quickActions')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {filteredNavItems.map(item => (
            <QuickAction key={item.path} icon={item.icon} title={item.title} description={item.description} onClick={() => navigate(item.path)} />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function QuickAction({ icon, title, description, onClick }: { icon: string; title: string; description: string; onClick?: () => void }) {
  return (
    <div
      className="p-4 rounded-2xl bg-card border border-border hover:border-primary cursor-pointer active:scale-95 transition-all"
      onClick={onClick}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}