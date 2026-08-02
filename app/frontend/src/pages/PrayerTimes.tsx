import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTimeFormat } from '@/contexts/TimeFormatContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { getUserItem, setUserItem } from '@/lib/userStorage';
import {
  calculatePrayerTimes, CALCULATION_METHODS, DEFAULT_CALCULATION_METHOD, CalculationMethodKey,
} from '@/lib/prayerCalculation';
import { CURATED_CITIES, CityOption } from '@/lib/curatedCities';
import ExcusedPeriodsDialog from '@/components/ExcusedPeriodsDialog';

interface PrayerTime {
  name: string;
  time: string;
  icon: string;
}

const PRAYER_NAMES_AR: Record<string, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

const MECCA_COORDS = { latitude: 21.4225, longitude: 39.8262 };
const CALC_METHOD_KEY = 'prayer_calc_method';
const LOCATION_MODE_KEY = 'prayer_location_mode';
const MANUAL_CITY_KEY = 'prayer_manual_city';

export default function PrayerTimes() {
  const { user, loading: authLoading } = useAuth();
  const { language, isRTL } = useLanguage();
  const { formatTime } = useTimeFormat();
  const navigate = useNavigate();
  const userId = user?.id ?? null;
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<string>('');
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; countdown: string } | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const [calcMethod, setCalcMethod] = useState<CalculationMethodKey>(DEFAULT_CALCULATION_METHOD);
  const [locationMode, setLocationMode] = useState<'auto' | 'manual'>('auto');
  const [manualCity, setManualCity] = useState<CityOption | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [excusedDialogOpen, setExcusedDialogOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  const computePrayerTimes = useCallback((lat: number, lng: number, locationLabel: string, method: CalculationMethodKey) => {
    const timings = calculatePrayerTimes(lat, lng, new Date(), method);
    setLocation(locationLabel);
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
    setLoading(false);
  }, []);

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

  const loadByLocation = useCallback((method: CalculationMethodKey, mode: 'auto' | 'manual', city: CityOption | null) => {
    if (mode === 'manual' && city) {
      computePrayerTimes(city.lat, city.lon, language === 'ar' ? city.nameAr : city.name, method);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => computePrayerTimes(pos.coords.latitude, pos.coords.longitude, language === 'ar' ? 'موقعك الحالي' : 'Your location', method),
        () => {
          // Denied, unavailable, or timed out (timeout below) - Mecca default.
          // maximumAge lets the browser return a recent cached fix instantly
          // instead of renegotiating GPS every time - the browser's own
          // equivalent of a "last known location" fallback.
          computePrayerTimes(MECCA_COORDS.latitude, MECCA_COORDS.longitude, language === 'ar' ? 'مكة المكرمة (افتراضي)' : 'Mecca (default)', method);
          toast.info(language === 'ar'
            ? 'يتم استخدام موقع مكة المكرمة. فعّل الموقع لنتائج دقيقة، أو اختر مدينتك يدوياً.'
            : 'Using default location (Mecca). Enable location for accurate times, or set your city manually.');
        },
        { timeout: 10000, maximumAge: 300000 }
      );
    } else {
      computePrayerTimes(MECCA_COORDS.latitude, MECCA_COORDS.longitude, language === 'ar' ? 'مكة المكرمة (افتراضي)' : 'Mecca (default)', method);
    }
  }, [computePrayerTimes, language]);

  // Load persisted location/method settings once, populate state for the
  // settings dialog, and compute prayer times against them.
  useEffect(() => {
    const savedMethod = (getUserItem(CALC_METHOD_KEY, userId) as CalculationMethodKey | null) || DEFAULT_CALCULATION_METHOD;
    const savedMode = getUserItem(LOCATION_MODE_KEY, userId) === 'manual' ? 'manual' : 'auto';
    const savedCityRaw = getUserItem(MANUAL_CITY_KEY, userId);
    let savedCity: CityOption | null = null;
    if (savedCityRaw) { try { savedCity = JSON.parse(savedCityRaw); } catch { /* ignore corrupt value */ } }
    setCalcMethod(savedMethod);
    setLocationMode(savedMode);
    setManualCity(savedCity);
    loadByLocation(savedMethod, savedMode, savedCity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const applyLocationMode = (mode: 'auto' | 'manual', city: CityOption | null) => {
    setLocationMode(mode);
    setManualCity(city);
    setUserItem(LOCATION_MODE_KEY, userId, mode);
    if (city) setUserItem(MANUAL_CITY_KEY, userId, JSON.stringify(city));
    setLoading(true);
    loadByLocation(calcMethod, mode, city);
  };

  const applyCalcMethod = (method: CalculationMethodKey) => {
    setCalcMethod(method);
    setUserItem(CALC_METHOD_KEY, userId, method);
    setLoading(true);
    loadByLocation(method, locationMode, manualCity);
  };

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'جاري تحميل مواقيت الصلاة...' : 'Loading prayer times...'}
          </p>
        </div>
      </div>
    );
  }

  const completedCount = [...completed].filter((n) => n !== 'Sunrise').length;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="🕌" title={language === 'ar' ? 'مواقيت الصلاة' : 'Prayer Times'} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Next Prayer Card */}
        {nextPrayer && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-[#1FC7C1] to-[#178F8A] text-white">
            <CardContent className="p-6 text-center">
              <p className="text-teal-100 text-sm">
                {language === 'ar' ? 'الصلاة القادمة' : 'Next Prayer'}
              </p>
              <h2 className="text-3xl font-bold mt-1">
                {language === 'ar' && PRAYER_NAMES_AR[nextPrayer.name]
                  ? PRAYER_NAMES_AR[nextPrayer.name]
                  : nextPrayer.name}
              </h2>
              <p className="text-xl mt-1">{formatTime(nextPrayer.time)}</p>
              {nextPrayer.countdown && (
                <p className="text-teal-100 mt-2 text-sm">
                  {language === 'ar' ? 'بعد' : 'in'} {nextPrayer.countdown}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Location - click to change location / calculation method */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full text-sm text-muted-foreground text-center hover:text-foreground transition-colors"
        >
          📍 {language === 'ar' ? 'الموقع:' : 'Location:'} {location} · ⚙️
        </button>

        {/* Progress */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'تقدم اليوم:' : "Today's Progress:"}{' '}
            <span className="font-bold text-emerald-500">{completedCount}/5</span>{' '}
            {language === 'ar' ? 'صلوات مكتملة' : 'prayers completed'}
          </p>
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
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
              className={`border transition-all ${completed.has(prayer.name) ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700' : 'bg-card border-border'}`}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{prayer.icon}</span>
                  <div>
                    <p className={`font-semibold ${completed.has(prayer.name) ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
                      {getPrayerDisplayName(prayer.name)}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatTime(prayer.time)}</p>
                  </div>
                </div>
                {prayer.name !== 'Sunrise' && (
                  <Button
                    size="sm"
                    variant={completed.has(prayer.name) ? 'default' : 'outline'}
                    className={completed.has(prayer.name) ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-border text-foreground hover:bg-secondary'}
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

        {/* Discreet entry point - no dashboard tile, no notification about it. */}
        <button
          onClick={() => setExcusedDialogOpen(true)}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground mt-2"
        >
          {language === 'ar' ? 'عذر شرعي' : 'Excused period'}
        </button>
        <ExcusedPeriodsDialog open={excusedDialogOpen} onOpenChange={setExcusedDialogOpen} />
      </main>

      {/* Location + calculation-method settings */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'إعدادات مواقيت الصلاة' : 'Prayer Time Settings'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="location" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="location">{language === 'ar' ? 'الموقع' : 'Location'}</TabsTrigger>
              <TabsTrigger value="method">{language === 'ar' ? 'طريقة الحساب' : 'Calculation Method'}</TabsTrigger>
            </TabsList>

            <TabsContent value="location" className="flex-1 overflow-hidden flex flex-col gap-3 mt-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={locationMode === 'auto' ? 'default' : 'outline'}
                  className={locationMode === 'auto' ? 'bg-primary hover:bg-primary/90' : ''}
                  onClick={() => applyLocationMode('auto', manualCity)}
                >
                  {language === 'ar' ? '📡 تلقائي (GPS)' : '📡 Automatic (GPS)'}
                </Button>
                <Button
                  variant={locationMode === 'manual' ? 'default' : 'outline'}
                  className={locationMode === 'manual' ? 'bg-primary hover:bg-primary/90' : ''}
                  onClick={() => manualCity && applyLocationMode('manual', manualCity)}
                >
                  {language === 'ar' ? '🏙️ يدوي' : '🏙️ Manual'}
                </Button>
              </div>
              <Input
                placeholder={language === 'ar' ? 'ابحث عن مدينة...' : 'Search for a city...'}
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
              />
              <div className="flex-1 overflow-y-auto space-y-1">
                {CURATED_CITIES.filter((c) =>
                  !citySearch ||
                  c.name.toLowerCase().includes(citySearch.toLowerCase()) ||
                  c.nameAr.includes(citySearch) ||
                  c.country.toLowerCase().includes(citySearch.toLowerCase())
                ).map((c) => (
                  <button
                    key={`${c.name}-${c.countryCode}`}
                    onClick={() => { applyLocationMode('manual', c); setSettingsOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary text-left"
                  >
                    <span className="text-sm font-medium text-foreground">{language === 'ar' ? c.nameAr : c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.country}</span>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="method" className="flex-1 overflow-y-auto mt-3 space-y-1">
              {CALCULATION_METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => { applyCalcMethod(m.key); setSettingsOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary text-left"
                >
                  <span className={`text-sm ${calcMethod === m.key ? 'font-semibold text-primary' : 'text-foreground'}`}>
                    {language === 'ar' ? m.labelAr : m.labelEn}
                  </span>
                  {calcMethod === m.key && <span className="text-primary">✓</span>}
                </button>
              ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}