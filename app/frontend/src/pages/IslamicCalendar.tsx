import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';

interface HijriDate {
  day: string;
  month: { number: number; en: string; ar: string };
  year: string;
  weekday: { en: string };
}

interface IslamicEvent {
  name: string;
  hijriMonth: number;
  hijriDay: number;
  description: string;
  icon: string;
}

const ISLAMIC_EVENTS: IslamicEvent[] = [
  { name: 'Islamic New Year', hijriMonth: 1, hijriDay: 1, description: 'Beginning of the Hijri calendar year', icon: '🌙' },
  { name: 'Ashura', hijriMonth: 1, hijriDay: 10, description: 'Day of fasting and remembrance', icon: '📿' },
  { name: 'Mawlid al-Nabi', hijriMonth: 3, hijriDay: 12, description: "Prophet Muhammad's (ﷺ) birthday", icon: '🕌' },
  { name: 'Isra & Mi\'raj', hijriMonth: 7, hijriDay: 27, description: 'Night Journey and Ascension', icon: '✨' },
  { name: 'Shab-e-Barat', hijriMonth: 8, hijriDay: 15, description: 'Night of Forgiveness', icon: '🤲' },
  { name: 'Ramadan Begins', hijriMonth: 9, hijriDay: 1, description: 'Start of the blessed month of fasting', icon: '🌙' },
  { name: 'Laylat al-Qadr', hijriMonth: 9, hijriDay: 27, description: 'Night of Power - better than 1000 months', icon: '⭐' },
  { name: 'Eid al-Fitr', hijriMonth: 10, hijriDay: 1, description: 'Festival of Breaking the Fast', icon: '🎉' },
  { name: 'Day of Arafah', hijriMonth: 12, hijriDay: 9, description: 'Best day for dua and fasting', icon: '🏔️' },
  { name: 'Eid al-Adha', hijriMonth: 12, hijriDay: 10, description: 'Festival of Sacrifice', icon: '🐑' },
];

const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
  'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', 'Sha\'ban',
  'Ramadan', 'Shawwal', 'Dhul Qi\'dah', 'Dhul Hijjah',
];

export default function IslamicCalendar() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hijriDate, setHijriDate] = useState<HijriDate | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchHijriDate = async () => {
      try {
        const today = new Date();
        const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
        const res = await fetch(`https://api.aladhan.com/v1/gpiToH/${dateStr}`);
        const data = await res.json();
        setHijriDate(data.data.hijri);
        setSelectedMonth(data.data.hijri.month.number);
      } catch {
        // Fallback
        setHijriDate(null);
      } finally {
        setLoading(false);
      }
    };
    fetchHijriDate();
  }, []);

  const getEventsForMonth = (month: number) => {
    return ISLAMIC_EVENTS.filter((e) => e.hijriMonth === month);
  };

  const getUpcomingEvents = () => {
    if (!hijriDate) return ISLAMIC_EVENTS.slice(0, 3);
    const currentMonth = hijriDate.month.number;
    const currentDay = parseInt(hijriDate.day);

    return ISLAMIC_EVENTS.filter((event) => {
      if (event.hijriMonth > currentMonth) return true;
      if (event.hijriMonth === currentMonth && event.hijriDay >= currentDay) return true;
      return false;
    }).slice(0, 4);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="w-16" />
          <h1 className="text-lg font-bold text-foreground">📅 Islamic Calendar</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Today's Hijri Date */}
        {hijriDate && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <CardContent className="p-6 text-center">
              <p className="text-indigo-200 text-sm">{hijriDate.weekday.en}</p>
              <p className="text-4xl font-bold mt-1">{hijriDate.day}</p>
              <p className="text-xl mt-1">{hijriDate.month.en}</p>
              <p className="text-indigo-200 text-sm">{hijriDate.year} AH</p>
              <p className="text-indigo-300 text-xs mt-2">{hijriDate.month.ar}</p>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Events */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">Upcoming Events</h2>
          <div className="space-y-3">
            {getUpcomingEvents().map((event) => (
              <Card key={event.name} className="border hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-2xl">
                    {event.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{event.name}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                      {event.hijriDay} {HIJRI_MONTHS[event.hijriMonth - 1]}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Month Selector */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">Browse by Month</h2>
          <div className="grid grid-cols-3 gap-2">
            {HIJRI_MONTHS.map((month, i) => (
              <Button
                key={month}
                size="sm"
                variant={selectedMonth === i + 1 ? 'default' : 'outline'}
                className={`text-xs ${selectedMonth === i + 1 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'text-foreground'}`}
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
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Events in {HIJRI_MONTHS[selectedMonth - 1]}
            </h3>
            {getEventsForMonth(selectedMonth).length > 0 ? (
              <div className="space-y-2">
                {getEventsForMonth(selectedMonth).map((event) => (
                  <Card key={event.name} className="border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20">
                    <CardContent className="p-3 flex items-center gap-3">
                      <span className="text-xl">{event.icon}</span>
                      <div>
                        <p className="font-medium text-sm text-foreground">{event.name}</p>
                        <p className="text-xs text-muted-foreground">Day {event.hijriDay} — {event.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No major events this month</p>
            )}
          </div>
        )}

        {/* Info */}
        <div className="p-4 rounded-xl bg-secondary border border-border">
          <p className="text-xs text-muted-foreground text-center">
            Hijri dates are approximate and may vary by 1-2 days based on moon sighting in your region.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}