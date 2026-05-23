import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

interface IslamicEvent {
  name: string;
  nameAr: string;
  hijriMonth: number;
  hijriDay: number;
  description: string;
  descriptionAr: string;
  icon: string;
  gregorianApprox: string; // approximate Gregorian date string
  gregorianApproxAr: string;
}

// Comprehensive events list with approximate Gregorian dates for 1447-1448 AH
const ISLAMIC_EVENTS: IslamicEvent[] = [
  // Muharram 1447 (past - July 2025)
  { name: 'Islamic New Year', nameAr: 'رأس السنة الهجرية', hijriMonth: 1, hijriDay: 1, description: 'Beginning of the Hijri calendar year', descriptionAr: 'بداية السنة الهجرية الجديدة', icon: '🌙', gregorianApprox: 'Jul 7, 2025', gregorianApproxAr: '٧ يوليو ٢٠٢٥' },
  { name: 'Ashura', nameAr: 'عاشوراء', hijriMonth: 1, hijriDay: 10, description: 'Day of fasting and remembrance', descriptionAr: 'يوم صيام وذكرى', icon: '📿', gregorianApprox: 'Jul 16, 2025', gregorianApproxAr: '١٦ يوليو ٢٠٢٥' },
  // Safar 1447
  { name: 'Hijra of the Prophet ﷺ', nameAr: 'هجرة النبي ﷺ', hijriMonth: 2, hijriDay: 1, description: 'Commemoration of the Prophet\'s migration', descriptionAr: 'ذكرى هجرة النبي ﷺ من مكة إلى المدينة', icon: '🕋', gregorianApprox: 'Aug 5, 2025', gregorianApproxAr: '٥ أغسطس ٢٠٢٥' },
  // Rabi al-Awwal 1447
  { name: 'Mawlid al-Nabi', nameAr: 'المولد النبوي', hijriMonth: 3, hijriDay: 12, description: "Prophet Muhammad's (ﷺ) birthday", descriptionAr: 'ذكرى مولد النبي محمد ﷺ', icon: '🕌', gregorianApprox: 'Sep 16, 2025', gregorianApproxAr: '١٦ سبتمبر ٢٠٢٥' },
  // Rajab 1447
  { name: "Isra' & Mi'raj", nameAr: 'الإسراء والمعراج', hijriMonth: 7, hijriDay: 27, description: 'Night Journey and Ascension', descriptionAr: 'ليلة الإسراء والمعراج', icon: '✨', gregorianApprox: 'Jan 26, 2026', gregorianApproxAr: '٢٦ يناير ٢٠٢٦' },
  // Sha'ban 1447
  { name: 'Laylat al-Bara\'ah', nameAr: 'ليلة النصف من شعبان', hijriMonth: 8, hijriDay: 15, description: 'Night of Forgiveness - mid-Sha\'ban', descriptionAr: 'ليلة النصف من شعبان - ليلة المغفرة', icon: '🌕', gregorianApprox: 'Feb 12, 2026', gregorianApproxAr: '١٢ فبراير ٢٠٢٦' },
  // Ramadan 1447
  { name: 'Ramadan Begins', nameAr: 'بداية رمضان', hijriMonth: 9, hijriDay: 1, description: 'Start of the blessed month of fasting', descriptionAr: 'بداية شهر الصيام المبارك', icon: '🌙', gregorianApprox: 'Feb 28, 2026', gregorianApproxAr: '٢٨ فبراير ٢٠٢٦' },
  { name: 'Laylat al-Qadr', nameAr: 'ليلة القدر', hijriMonth: 9, hijriDay: 27, description: 'Night of Power - better than 1000 months', descriptionAr: 'ليلة خير من ألف شهر', icon: '⭐', gregorianApprox: 'Mar 26, 2026', gregorianApproxAr: '٢٦ مارس ٢٠٢٦' },
  // Shawwal 1447
  { name: 'Eid al-Fitr', nameAr: 'عيد الفطر', hijriMonth: 10, hijriDay: 1, description: 'Festival of Breaking the Fast', descriptionAr: 'عيد الفطر المبارك', icon: '🎉', gregorianApprox: 'Mar 30, 2026', gregorianApproxAr: '٣٠ مارس ٢٠٢٦' },
  { name: 'Six Days of Shawwal', nameAr: 'ست من شوال', hijriMonth: 10, hijriDay: 2, description: 'Recommended fasting of 6 days', descriptionAr: 'صيام ستة أيام من شوال', icon: '🌿', gregorianApprox: 'Mar 31, 2026', gregorianApproxAr: '٣١ مارس ٢٠٢٦' },
  // Dhul Qi'dah 1447
  { name: 'Sacred Month Begins', nameAr: 'بداية الشهر الحرام', hijriMonth: 11, hijriDay: 1, description: 'Dhul Qi\'dah - one of the four sacred months', descriptionAr: 'ذو القعدة - أحد الأشهر الحرم', icon: '🕊️', gregorianApprox: 'Apr 27, 2026', gregorianApproxAr: '٢٧ أبريل ٢٠٢٦' },
  { name: 'Hajj Preparation', nameAr: 'التهيؤ للحج', hijriMonth: 11, hijriDay: 25, description: 'Pilgrims begin preparing for Hajj journey', descriptionAr: 'يبدأ الحجاج بالتهيؤ لرحلة الحج', icon: '🧳', gregorianApprox: 'May 21, 2026', gregorianApproxAr: '٢١ مايو ٢٠٢٦' },
  // Dhul Hijjah 1447 (~May 27 - Jun 25, 2026)
  { name: 'Start of Dhul Hijjah', nameAr: 'بداية ذو الحجة', hijriMonth: 12, hijriDay: 1, description: 'The best 10 days of the year begin', descriptionAr: 'بداية أفضل عشرة أيام في السنة', icon: '🌟', gregorianApprox: 'May 27, 2026', gregorianApproxAr: '٢٧ مايو ٢٠٢٦' },
  { name: 'First 10 Days Fasting', nameAr: 'صيام العشر الأوائل', hijriMonth: 12, hijriDay: 1, description: 'Recommended fasting during the first 9 days', descriptionAr: 'صيام مستحب في الأيام التسعة الأولى', icon: '🤲', gregorianApprox: 'May 27 - Jun 4, 2026', gregorianApproxAr: '٢٧ مايو - ٤ يونيو ٢٠٢٦' },
  { name: 'Day of Tarwiyah', nameAr: 'يوم التروية', hijriMonth: 12, hijriDay: 8, description: 'Pilgrims head to Mina - start of Hajj rites', descriptionAr: 'يتوجه الحجاج إلى منى - بداية مناسك الحج', icon: '⛺', gregorianApprox: 'Jun 3, 2026', gregorianApproxAr: '٣ يونيو ٢٠٢٦' },
  { name: 'Day of Arafah', nameAr: 'يوم عرفة', hijriMonth: 12, hijriDay: 9, description: 'Best day for dua and fasting - pillar of Hajj', descriptionAr: 'أفضل يوم للدعاء والصيام - ركن الحج الأعظم', icon: '🏔️', gregorianApprox: 'Jun 4, 2026', gregorianApproxAr: '٤ يونيو ٢٠٢٦' },
  { name: 'Eid al-Adha', nameAr: 'عيد الأضحى', hijriMonth: 12, hijriDay: 10, description: 'Festival of Sacrifice', descriptionAr: 'عيد الأضحى المبارك', icon: '🐑', gregorianApprox: 'Jun 5, 2026', gregorianApproxAr: '٥ يونيو ٢٠٢٦' },
  { name: 'Days of Tashreeq', nameAr: 'أيام التشريق', hijriMonth: 12, hijriDay: 11, description: 'Days of eating, drinking, and remembrance of Allah (11-13 Dhul Hijjah)', descriptionAr: 'أيام أكل وشرب وذكر الله (١١-١٣ ذو الحجة)', icon: '🎊', gregorianApprox: 'Jun 6-8, 2026', gregorianApproxAr: '٦-٨ يونيو ٢٠٢٦' },
  // Muharram 1448 (~Jun 26, 2026)
  { name: 'Islamic New Year 1448', nameAr: 'رأس السنة الهجرية ١٤٤٨', hijriMonth: 1, hijriDay: 1, description: 'Beginning of the new Hijri year 1448', descriptionAr: 'بداية السنة الهجرية ١٤٤٨', icon: '🌙', gregorianApprox: 'Jun 26, 2026', gregorianApproxAr: '٢٦ يونيو ٢٠٢٦' },
  { name: 'Ashura 1448', nameAr: 'عاشوراء ١٤٤٨', hijriMonth: 1, hijriDay: 10, description: 'Day of fasting and remembrance', descriptionAr: 'يوم صيام وذكرى', icon: '📿', gregorianApprox: 'Jul 5, 2026', gregorianApproxAr: '٥ يوليو ٢٠٢٦' },
];

const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhul Qi'dah", 'Dhul Hijjah',
];

const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الثانية', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

/**
 * Dynamically approximate the Hijri date based on known anchor points.
 * This is used ONLY as a fallback when the API call fails.
 * Anchor: 1 Muharram 1447 AH ≈ July 7, 2025 (Gregorian)
 * Average Hijri month length: ~29.5306 days
 */
function approximateHijriDate(): { day: number; month: number; year: number } {
  const anchorGregorian = new Date(2025, 6, 7); // July 7, 2025 = 1 Muharram 1447
  const today = new Date();
  const diffMs = today.getTime() - anchorGregorian.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const hijriDayLength = 29.5306;
  const totalHijriDays = Math.floor(diffDays * (354.36667 / 365.25)); // scale Gregorian to Hijri
  const hijriMonthsSinceAnchor = Math.floor(totalHijriDays / hijriDayLength);
  const hijriDayInMonth = Math.floor(totalHijriDays - hijriMonthsSinceAnchor * hijriDayLength) + 1;

  const totalMonths = hijriMonthsSinceAnchor; // months since 1 Muharram 1447
  const yearOffset = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12; // 0-based

  return {
    day: Math.min(Math.max(hijriDayInMonth, 1), 30),
    month: monthIndex + 1, // 1-based
    year: 1447 + yearOffset,
  };
}

export default function IslamicCalendar() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();

  // Use dynamic fallback instead of hardcoded values
  const fallback = approximateHijriDate();

  const [selectedMonth, setSelectedMonth] = useState<number>(fallback.month);
  const [hijriDay, setHijriDay] = useState<number>(fallback.day);
  const [hijriMonth, setHijriMonth] = useState<number>(fallback.month);
  const [hijriYear, setHijriYear] = useState<number>(fallback.year);
  const [loading, setLoading] = useState(true);

  const hijriMonths = isAr ? HIJRI_MONTHS_AR : HIJRI_MONTHS_EN;

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchHijriDate = async () => {
      try {
        // Use Makkah city timings endpoint which returns the Hijri date based on Makkah timezone
        const res = await fetch(
          'https://api.aladhan.com/v1/timingsByCity?city=Makkah&country=Saudi+Arabia&method=4'
        );
        const data = await res.json();

        if (data?.data?.date?.hijri) {
          const hijri = data.data.date.hijri;
          const day = parseInt(hijri.day, 10);
          const month = hijri.month.number;
          const year = parseInt(hijri.year, 10);

          setHijriDay(day);
          setHijriMonth(month);
          setHijriYear(year);
          setSelectedMonth(month);
        }
      } catch {
        // Fallback values already set from approximateHijriDate()
      } finally {
        setLoading(false);
      }
    };
    fetchHijriDate();
  }, []);

  // Get upcoming events from current date forward (next ~3 months)
  const getUpcomingEvents = () => {
    const upcoming: (IslamicEvent & { sortKey: number })[] = [];

    for (const event of ISLAMIC_EVENTS) {
      let sortKey = 0;

      if (event.hijriMonth > hijriMonth) {
        // Future month in current year
        sortKey = (event.hijriMonth - hijriMonth) * 30 + event.hijriDay;
      } else if (event.hijriMonth === hijriMonth && event.hijriDay >= hijriDay) {
        // Current month, upcoming day
        sortKey = event.hijriDay - hijriDay;
      } else if (event.hijriMonth <= hijriMonth) {
        // Next year (for browse purposes, show at end)
        sortKey = (12 - hijriMonth + event.hijriMonth) * 30 + event.hijriDay;
      }

      // Only show events in the next ~3 months
      if (
        (event.hijriMonth === hijriMonth && event.hijriDay >= hijriDay) ||
        (event.hijriMonth > hijriMonth && event.hijriMonth <= hijriMonth + 3) ||
        // Handle wrap-around for Muharram after Dhul Hijjah
        (hijriMonth >= 10 && event.hijriMonth <= (hijriMonth + 3) - 12 && event.gregorianApprox.includes('2026'))
      ) {
        // Filter out duplicate "Islamic New Year" / "Ashura" entries - use the 1448 versions if we're in late 1447
        if (hijriMonth >= 11 && event.hijriMonth === 1 && !event.name.includes('1448')) {
          continue;
        }
        upcoming.push({ ...event, sortKey });
      }
    }

    return upcoming.sort((a, b) => a.sortKey - b.sortKey);
  };

  // Group upcoming events by month
  const getGroupedUpcomingEvents = () => {
    const events = getUpcomingEvents();
    const groups: { month: number; monthName: string; monthNameAr: string; year: number; events: IslamicEvent[] }[] = [];

    for (const event of events) {
      let year = hijriYear;
      if (event.hijriMonth < hijriMonth) {
        year = hijriYear + 1;
      }

      const existing = groups.find(g => g.month === event.hijriMonth && g.year === year);
      if (existing) {
        existing.events.push(event);
      } else {
        groups.push({
          month: event.hijriMonth,
          monthName: HIJRI_MONTHS_EN[event.hijriMonth - 1],
          monthNameAr: HIJRI_MONTHS_AR[event.hijriMonth - 1],
          year,
          events: [event],
        });
      }
    }

    return groups;
  };

  const getEventsForMonth = (month: number) => {
    return ISLAMIC_EVENTS.filter((e) => e.hijriMonth === month);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const groupedEvents = getGroupedUpcomingEvents();

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="📅" title={isAr ? 'التقويم الإسلامي' : 'Islamic Calendar'} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Current Hijri Month Banner */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
          <CardContent className="p-6 text-center relative z-10">
            <p className="text-emerald-200 text-sm font-medium tracking-wide uppercase">
              {isAr ? 'الشهر الحالي' : 'Current Month'}
            </p>
            <p className="text-5xl font-bold mt-2 font-serif" style={{ fontFamily: isAr ? 'Amiri, serif' : 'inherit' }}>
              {isAr ? HIJRI_MONTHS_AR[hijriMonth - 1] : HIJRI_MONTHS_EN[hijriMonth - 1]}
            </p>
            <p className="text-2xl mt-2 text-emerald-100">
              {isAr ? `${hijriYear} هـ` : `${hijriYear} AH`}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-lg">📅</span>
              <span className="text-sm text-emerald-100">
                {isAr
                  ? `اليوم: ${hijriDay} ${HIJRI_MONTHS_AR[hijriMonth - 1]}`
                  : `Today: ${hijriDay} ${HIJRI_MONTHS_EN[hijriMonth - 1]}`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events Section */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="text-xl">🗓️</span>
            {isAr ? 'الأحداث القادمة' : 'Upcoming Events'}
          </h2>

          {groupedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isAr ? 'لا توجد أحداث قادمة' : 'No upcoming events'}
            </p>
          ) : (
            <div className="space-y-6">
              {groupedEvents.map((group) => (
                <div key={`${group.month}-${group.year}`}>
                  {/* Month Group Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm font-semibold text-primary px-3 py-1 rounded-full bg-primary/10">
                      {isAr ? group.monthNameAr : group.monthName} {group.year} {isAr ? 'هـ' : 'AH'}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Events in this month */}
                  <div className="space-y-3">
                    {group.events.map((event, idx) => (
                      <Card
                        key={`${event.name}-${idx}`}
                        className="border border-border/50 hover:shadow-lg transition-all duration-200 hover:border-primary/30"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                              {event.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-base">
                                {isAr ? event.nameAr : event.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {isAr ? event.descriptionAr : event.description}
                              </p>
                            </div>
                          </div>
                          {/* Date badges */}
                          <div className="flex flex-wrap gap-2 mt-3 ml-16">
                            <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                              🌙 {event.hijriDay} {isAr ? HIJRI_MONTHS_AR[event.hijriMonth - 1] : HIJRI_MONTHS_EN[event.hijriMonth - 1]}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full">
                              📆 {isAr ? event.gregorianApproxAr : event.gregorianApprox}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Browse by Month */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="text-xl">📖</span>
            {isAr ? 'تصفح حسب الشهر' : 'Browse by Month'}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {hijriMonths.map((month, i) => (
              <Button
                key={month}
                size="sm"
                variant={selectedMonth === i + 1 ? 'default' : 'outline'}
                className={`text-xs h-10 ${
                  selectedMonth === i + 1
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700'
                    : i + 1 === hijriMonth
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 border-2'
                      : 'text-foreground'
                }`}
                onClick={() => setSelectedMonth(i + 1)}
              >
                {month}
              </Button>
            ))}
          </div>
        </div>

        {/* Events for Selected Month */}
        {selectedMonth && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <span>📋</span>
              {isAr
                ? `أحداث شهر ${HIJRI_MONTHS_AR[selectedMonth - 1]}`
                : `Events in ${HIJRI_MONTHS_EN[selectedMonth - 1]}`}
            </h3>
            {getEventsForMonth(selectedMonth).length > 0 ? (
              <div className="space-y-2">
                {getEventsForMonth(selectedMonth).map((event, idx) => (
                  <Card key={`browse-${event.name}-${idx}`} className="border-primary/20 bg-primary/5">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{event.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground">
                            {isAr ? event.nameAr : event.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isAr ? event.descriptionAr : event.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2 ml-8">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          🌙 {isAr ? `${event.hijriDay} ${HIJRI_MONTHS_AR[event.hijriMonth - 1]}` : `${event.hijriDay} ${HIJRI_MONTHS_EN[event.hijriMonth - 1]}`}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          📆 ≈ {isAr ? event.gregorianApproxAr : event.gregorianApprox}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-3xl mb-2">🕊️</p>
                  <p className="text-sm text-muted-foreground">
                    {isAr ? 'لا توجد أحداث رئيسية هذا الشهر' : 'No major events this month'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? 'شهر هادئ للعبادة والتأمل' : 'A quiet month for worship and reflection'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Info Note */}
        <div className="p-4 rounded-xl bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            {isAr
              ? '⚠️ التواريخ الهجرية تقريبية وقد تختلف بيوم أو يومين بناءً على رؤية الهلال في منطقتك. يرجى التأكد من التقويم المحلي.'
              : '⚠️ Hijri dates are approximate and may vary by 1-2 days based on moon sighting in your region. Please confirm with your local calendar.'}
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}