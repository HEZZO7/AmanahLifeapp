import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

interface PrayerTime {
  name: string;
  time: string;
  icon: string;
}

interface PrayerData {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

const PRAYER_NAMES_AR: Record<string, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

export default function PrayerTimes() {
  const { user, loading: authLoading } = useAuth();
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<string>('');
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; countdown: string } | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  const fetchPrayerTimes = useCallback(async (lat: number, lng: number) => {
    try {
      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      const res = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=2`
      );
      const data = await res.json();
      const timings: PrayerData = data.data.timings;
      setLocation(data.data.meta.timezone || (language === 'ar' ? 'موقعك' : 'Your Location'));

      const prayerList: PrayerTime[] = [
        { name: 'Fajr', time: timings.Fajr, icon: '🌅' },
        { name: 'Sunrise', time: timings.Sunrise, icon: '☀️' },
        { name: 'Dhuhr', time: timings.Dhuhr, icon: '🌤️' },
        { name: 'Asr', time: timings.Asr, icon: '⛅' },
        { name: 'Maghrib', time: timings.Maghrib, icon: '🌇' },
        { name: 'Isha', time: timings.Isha, icon: '🌙' },
      ];
      setPrayers(prayerList);
      updateNextPrayer(prayerList);
    } catch {
      toast.error(language === 'ar' ? 'فشل في تحميل مواقيت الصلاة' : 'Failed to fetch prayer times');
    } finally {
      setLoading(false);
    }
  }, [language]);

  const updateNextPrayer = (prayerList: PrayerTime[]) => {
    const now = new Date();
    for (const prayer of prayerList) {
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerDate = new Date();
      prayerDate.setHours(hours, minutes, 0, 0);
      if (prayerDate > now) {
        const diff = prayerDate.getTime() - now.getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setNextPrayer({
          name: prayer.name,
          time: prayer.time,
          countdown: `${h}h ${m}m`,
        });
        return;
      }
    }
    const tomorrowLabel = language === 'ar' ? 'الفجر (غداً)' : 'Fajr (tomorrow)';
    setNextPrayer({ name: tomorrowLabel, time: prayerList[0]?.time || '', countdown: '' });
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchPrayerTimes(pos.coords.latitude, pos.coords.longitude),
        () => {
          // Default to Mecca if location denied or timed out
          fetchPrayerTimes(21.4225, 39.8262);
          toast.info(language === 'ar'
            ? 'يتم استخدام موقع مكة المكرمة. فعّل الموقع لنتائج دقيقة.'
            : 'Using default location (Mecca). Enable location for accurate times.');
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    } else {
      fetchPrayerTimes(21.4225, 39.8262);
    }
  }, [fetchPrayerTimes, language]);

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (prayers.length > 0) updateNextPrayer(prayers);
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayers]);

  const toggleCompleted = (name: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Load completed from localStorage
  useEffect(() => {
    const today = new Date().toDateString();
    const saved = localStorage.getItem(`prayer_completed_${today}`);
    if (saved) setCompleted(new Set(JSON.parse(saved)));
  }, []);

  // Save completed to localStorage
  useEffect(() => {
    const today = new Date().toDateString();
    localStorage.setItem(`prayer_completed_${today}`, JSON.stringify([...completed]));
  }, [completed]);

  const getPrayerDisplayName = (name: string): string => {
    if (language === 'ar') {
      return PRAYER_NAMES_AR[name] || name;
    }
    return name;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'جاري تحميل مواقيت الصلاة...' : 'Loading prayer times...'}
          </p>
        </div>
      </div>
    );
  }

  const completedCount = [...completed].filter((n) => n !== 'Sunrise').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="w-16" />
          <h1 className="text-lg font-bold text-foreground">
            🕌 {language === 'ar' ? 'مواقيت الصلاة' : 'Prayer Times'}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Next Prayer Card */}
        {nextPrayer && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <CardContent className="p-6 text-center">
              <p className="text-blue-100 text-sm">
                {language === 'ar' ? 'الصلاة القادمة' : 'Next Prayer'}
              </p>
              <h2 className="text-3xl font-bold mt-1">
                {language === 'ar' && PRAYER_NAMES_AR[nextPrayer.name]
                  ? PRAYER_NAMES_AR[nextPrayer.name]
                  : nextPrayer.name}
              </h2>
              <p className="text-xl mt-1">{nextPrayer.time}</p>
              {nextPrayer.countdown && (
                <p className="text-blue-200 mt-2 text-sm">
                  {language === 'ar' ? 'بعد' : 'in'} {nextPrayer.countdown}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Location */}
        <p className="text-sm text-muted-foreground text-center">
          📍 {language === 'ar' ? 'الموقع:' : 'Location:'} {location}
        </p>

        {/* Progress */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'تقدم اليوم:' : "Today's Progress:"}{' '}
            <span className="font-bold text-emerald-600">{completedCount}/5</span>{' '}
            {language === 'ar' ? 'صلوات مكتملة' : 'prayers completed'}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${(completedCount / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Prayer List */}
        <div className="space-y-3">
          {prayers.map((prayer) => (
            <Card
              key={prayer.name}
              className={`border transition-all ${completed.has(prayer.name) ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}`}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{prayer.icon}</span>
                  <div>
                    <p className={`font-semibold ${completed.has(prayer.name) ? 'text-emerald-700' : 'text-foreground'}`}>
                      {getPrayerDisplayName(prayer.name)}
                    </p>
                    <p className="text-sm text-muted-foreground">{prayer.time}</p>
                  </div>
                </div>
                {prayer.name !== 'Sunrise' && (
                  <Button
                    size="sm"
                    variant={completed.has(prayer.name) ? 'default' : 'outline'}
                    className={completed.has(prayer.name) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    onClick={() => toggleCompleted(prayer.name)}
                  >
                    {completed.has(prayer.name)
                      ? (language === 'ar' ? '✓ تم' : '✓ Done')
                      : (language === 'ar' ? 'تسجيل' : 'Mark')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}