import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Clock } from 'lucide-react';

interface PrayerReminderConfig {
  fajr: { enabled: boolean; minutesBefore: number };
  dhuhr: { enabled: boolean; minutesBefore: number };
  asr: { enabled: boolean; minutesBefore: number };
  maghrib: { enabled: boolean; minutesBefore: number };
  isha: { enabled: boolean; minutesBefore: number };
}

const DEFAULT_CONFIG: PrayerReminderConfig = {
  fajr: { enabled: true, minutesBefore: 15 },
  dhuhr: { enabled: true, minutesBefore: 10 },
  asr: { enabled: true, minutesBefore: 10 },
  maghrib: { enabled: true, minutesBefore: 5 },
  isha: { enabled: true, minutesBefore: 10 },
};

const PRAYER_NAMES = {
  fajr: { en: 'Fajr', ar: 'الفجر' },
  dhuhr: { en: 'Dhuhr', ar: 'الظهر' },
  asr: { en: 'Asr', ar: 'العصر' },
  maghrib: { en: 'Maghrib', ar: 'المغرب' },
  isha: { en: 'Isha', ar: 'العشاء' },
};

const MINUTE_OPTIONS = [5, 10, 15, 20, 30];

export default function PrayerReminderSettings() {
  const { language } = useLanguage();
  const { isSubscribed, permission } = useNotifications();
  const isAr = language === 'ar';

  const [config, setConfig] = useState<PrayerReminderConfig>(() => {
    try {
      const stored = localStorage.getItem('amanah-prayer-reminders');
      if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch { /* ignore */ }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('amanah-prayer-reminders', JSON.stringify(config));
    // Set up timers for prayer reminders
    setupPrayerTimers(config);
  }, [config]);

  const togglePrayer = (prayer: keyof PrayerReminderConfig) => {
    setConfig(prev => ({
      ...prev,
      [prayer]: { ...prev[prayer], enabled: !prev[prayer].enabled },
    }));
  };

  const setMinutes = (prayer: keyof PrayerReminderConfig, minutes: number) => {
    setConfig(prev => ({
      ...prev,
      [prayer]: { ...prev[prayer], minutesBefore: minutes },
    }));
  };

  // Only show if notifications are enabled
  if (!isSubscribed || permission !== 'granted') {
    return null;
  }

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="text-sm text-muted-foreground">
          {isAr ? 'تذكير الصلاة الذكي' : 'Smart Prayer Reminders'}
        </h3>
      </div>

      <p className="text-[10px] text-muted-foreground mb-3">
        {isAr
          ? 'تنبيه قبل وقت الصلاة بعدد الدقائق المحدد'
          : 'Get notified before each prayer time'}
      </p>

      <div className="space-y-2.5">
        {(Object.keys(PRAYER_NAMES) as Array<keyof PrayerReminderConfig>).map((prayer) => (
          <div key={prayer} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => togglePrayer(prayer)}
                className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0 ${
                  config[prayer].enabled ? 'bg-primary' : 'bg-secondary'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all ${
                  config[prayer].enabled ? 'left-[19px]' : 'left-[3px]'
                }`} />
              </button>
              <span className="text-foreground text-sm">
                {isAr ? PRAYER_NAMES[prayer].ar : PRAYER_NAMES[prayer].en}
              </span>
            </div>

            {config[prayer].enabled && (
              <select
                value={config[prayer].minutesBefore}
                onChange={(e) => setMinutes(prayer, Number(e.target.value))}
                className="bg-background border border-border rounded-lg px-2 py-1 text-foreground text-xs focus:outline-none focus:border-primary"
              >
                {MINUTE_OPTIONS.map(m => (
                  <option key={m} value={m}>
                    {m} {isAr ? 'د' : 'min'}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Setup prayer time reminders using setTimeout
function setupPrayerTimers(config: PrayerReminderConfig) {
  // Clear any existing timers
  const existingTimers = (window as any).__prayerTimers || [];
  existingTimers.forEach((t: number) => clearTimeout(t));
  (window as any).__prayerTimers = [];

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  // Get prayer times from cache or fetch
  const cachedTimes = localStorage.getItem('amanah-prayer-times-today');
  if (!cachedTimes) {
    // Fetch prayer times
    fetchAndSchedule(config);
    return;
  }

  try {
    const timings = JSON.parse(cachedTimes);
    schedulePrayerNotifications(timings, config);
  } catch {
    fetchAndSchedule(config);
  }
}

async function fetchAndSchedule(config: PrayerReminderConfig) {
  try {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      const res = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=2`
      );
      const data = await res.json();
      const timings = data.data.timings;
      
      localStorage.setItem('amanah-prayer-times-today', JSON.stringify(timings));
      schedulePrayerNotifications(timings, config);
    });
  } catch {
    // Silently fail
  }
}

function schedulePrayerNotifications(timings: Record<string, string>, config: PrayerReminderConfig) {
  const prayers: Array<{ key: keyof PrayerReminderConfig; timeKey: string }> = [
    { key: 'fajr', timeKey: 'Fajr' },
    { key: 'dhuhr', timeKey: 'Dhuhr' },
    { key: 'asr', timeKey: 'Asr' },
    { key: 'maghrib', timeKey: 'Maghrib' },
    { key: 'isha', timeKey: 'Isha' },
  ];

  const now = new Date();
  const timers: number[] = [];

  const prayerNamesEn: Record<string, string> = {
    fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha'
  };
  const prayerNamesAr: Record<string, string> = {
    fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء'
  };

  const lang = localStorage.getItem('amanah-language') || 'en';

  for (const prayer of prayers) {
    if (!config[prayer.key].enabled) continue;

    const timeStr = timings[prayer.timeKey];
    if (!timeStr) continue;

    const [h, m] = timeStr.split(':').map(Number);
    const prayerTime = new Date();
    prayerTime.setHours(h, m, 0, 0);

    // Subtract minutes before
    const reminderTime = new Date(prayerTime.getTime() - config[prayer.key].minutesBefore * 60000);

    if (reminderTime > now) {
      const delay = reminderTime.getTime() - now.getTime();
      const timer = window.setTimeout(() => {
        const title = lang === 'ar'
          ? `⏰ تذكير ${prayerNamesAr[prayer.key]}`
          : `⏰ ${prayerNamesEn[prayer.key]} Reminder`;
        const body = lang === 'ar'
          ? `صلاة ${prayerNamesAr[prayer.key]} بعد ${config[prayer.key].minutesBefore} دقيقة`
          : `${prayerNamesEn[prayer.key]} prayer in ${config[prayer.key].minutesBefore} minutes`;

        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/assets/amanah-logo.png',
            badge: 'https://mgx-backend-cdn.metadl.com/generate/images/1249149/2026-07-03/rxr47qaaaiqq/amanah-logo_variant_1.png',
            tag: `prayer-${prayer.key}`,
            vibrate: [200, 100, 200],
          });
        });
      }, delay);
      timers.push(timer);
    }
  }

  (window as any).__prayerTimers = timers;
}