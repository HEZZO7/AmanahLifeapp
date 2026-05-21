import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface RamadanDay {
  day: number;
  fasted: boolean;
  quranPages: number;
  charity: number;
}

interface RamadanData {
  days: RamadanDay[];
  mealPlan: { suhoor: string[]; iftar: string[] };
  budget: { food: number; charity: number; gifts: number; decorations: number };
  eidBudget: { clothes: number; gifts: number; food: number; events: number };
  charityGoal: number;
  totalCharity: number;
}

const STORAGE_KEY = 'amanah_ramadan';

export default function RamadanPlanner() {
  const { language } = useLanguage();
  const [data, setData] = useState<RamadanData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return {
      days: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, fasted: false, quranPages: 0, charity: 0 })),
      mealPlan: {
        suhoor: ['Oatmeal & Dates', 'Eggs & Bread', 'Yogurt & Fruits', 'Rice & Chicken'],
        iftar: ['Dates & Water', 'Soup & Salad', 'Grilled Meat', 'Mixed Platter'],
      },
      budget: { food: 3000, charity: 2000, gifts: 1000, decorations: 500 },
      eidBudget: { clothes: 2000, gifts: 1500, food: 1000, events: 500 },
      charityGoal: 100,
      totalCharity: 0,
    };
  });

  const [activeTab, setActiveTab] = useState<'calendar' | 'meals' | 'budget' | 'eid' | 'charity'>('calendar');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const toggleFast = (day: number) => {
    setData(prev => ({
      ...prev,
      days: prev.days.map(d => d.day === day ? { ...d, fasted: !d.fasted } : d),
    }));
  };

  const updateQuranPages = (day: number, pages: number) => {
    setData(prev => ({
      ...prev,
      days: prev.days.map(d => d.day === day ? { ...d, quranPages: pages } : d),
    }));
  };

  const addDailyCharity = (day: number, amount: number) => {
    setData(prev => ({
      ...prev,
      days: prev.days.map(d => d.day === day ? { ...d, charity: d.charity + amount } : d),
      totalCharity: prev.totalCharity + amount,
    }));
  };

  // Countdown to next Ramadan (approximate)
  const countdown = useMemo(() => {
    const now = new Date();
    // Approximate next Ramadan start (shifts ~11 days earlier each year)
    const nextRamadan = new Date(2027, 1, 17); // Approximate
    if (nextRamadan < now) nextRamadan.setFullYear(nextRamadan.getFullYear() + 1);
    const diff = nextRamadan.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, []);

  const completedFasts = data.days.filter(d => d.fasted).length;
  const totalQuranPages = data.days.reduce((sum, d) => sum + d.quranPages, 0);

  const tabs = [
    { key: 'calendar' as const, label: language === 'ar' ? 'التقويم' : 'Calendar', icon: '📅' },
    { key: 'meals' as const, label: language === 'ar' ? 'الوجبات' : 'Meals', icon: '🍽️' },
    { key: 'budget' as const, label: language === 'ar' ? 'الميزانية' : 'Budget', icon: '💰' },
    { key: 'eid' as const, label: language === 'ar' ? 'العيد' : 'Eid', icon: '🎉' },
    { key: 'charity' as const, label: language === 'ar' ? 'الصدقة' : 'Charity', icon: '🤲' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">
            {language === 'ar' ? '🌙 مخطط رمضان والعيد' : '🌙 Ramadan & Eid Planner'}
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Countdown */}
        <div className="bg-gradient-to-r from-[#d4a853]/20 to-primary/20 rounded-2xl p-4 mb-4 border border-border text-center">
          <p className="text-xs text-muted-foreground">{language === 'ar' ? 'العد التنازلي لرمضان' : 'Countdown to Ramadan'}</p>
          <p className="text-3xl font-bold text-[#d4a853]">{countdown}</p>
          <p className="text-xs text-muted-foreground">{language === 'ar' ? 'يوم' : 'days'}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <p className="text-lg font-bold text-primary">{completedFasts}/30</p>
            <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'صيام' : 'Fasts'}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <p className="text-lg font-bold text-[#d4a853]">{totalQuranPages}</p>
            <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'صفحات قرآن' : 'Quran Pages'}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <p className="text-lg font-bold text-primary">{data.totalCharity}</p>
            <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'صدقة' : 'Charity'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-card text-muted-foreground border border-border'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {language === 'ar' ? '30 يوم رمضان' : '30 Days of Ramadan'}
            </h3>
            <div className="grid grid-cols-6 gap-2">
              {data.days.map(day => (
                <button
                  key={day.day}
                  onClick={() => toggleFast(day.day)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${
                    day.fasted
                      ? 'bg-primary/30 border border-primary text-primary'
                      : 'bg-secondary border border-border text-muted-foreground'
                  }`}
                >
                  <span className="font-bold">{day.day}</span>
                  {day.fasted && <span className="text-[8px]">✓</span>}
                </button>
              ))}
            </div>

            {/* Quran tracking for selected days */}
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                {language === 'ar' ? 'صفحات القرآن اليومية' : 'Daily Quran Pages'}
              </h4>
              <div className="grid grid-cols-5 gap-1">
                {data.days.slice(0, 10).map(day => (
                  <div key={day.day} className="text-center">
                    <p className="text-[9px] text-muted-foreground">D{day.day}</p>
                    <input
                      type="number"
                      value={day.quranPages || ''}
                      onChange={e => updateQuranPages(day.day, parseInt(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded text-center text-xs py-1 text-foreground"
                      min="0"
                      max="30"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Meals Tab */}
        {activeTab === 'meals' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                🌅 {language === 'ar' ? 'أفكار السحور' : 'Suhoor Ideas'}
              </h3>
              <div className="space-y-2">
                {data.mealPlan.suhoor.map((meal, i) => (
                  <div key={i} className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
                    <span className="text-sm">🥣</span>
                    <span className="text-sm text-foreground">{meal}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                🌙 {language === 'ar' ? 'أفكار الإفطار' : 'Iftar Ideas'}
              </h3>
              <div className="space-y-2">
                {data.mealPlan.iftar.map((meal, i) => (
                  <div key={i} className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
                    <span className="text-sm">🍲</span>
                    <span className="text-sm text-foreground">{meal}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Budget Tab */}
        {activeTab === 'budget' && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {language === 'ar' ? '💰 ميزانية رمضان' : '💰 Ramadan Budget'}
            </h3>
            {Object.entries(data.budget).map(([key, value]) => {
              const labels: Record<string, { en: string; ar: string; icon: string }> = {
                food: { en: 'Food & Groceries', ar: 'الطعام والمشتريات', icon: '🍽️' },
                charity: { en: 'Charity & Zakat', ar: 'الصدقة والزكاة', icon: '🤲' },
                gifts: { en: 'Gifts', ar: 'الهدايا', icon: '🎁' },
                decorations: { en: 'Decorations', ar: 'الزينة', icon: '🏮' },
              };
              const label = labels[key];
              return (
                <div key={key} className="mb-3 flex items-center gap-3">
                  <span className="text-lg">{label.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground">{language === 'ar' ? label.ar : label.en}</span>
                      <span className="text-muted-foreground">{value.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '60%' }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-border flex justify-between">
              <span className="text-sm font-semibold text-foreground">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
              <span className="text-sm font-bold text-[#d4a853]">
                {Object.values(data.budget).reduce((a, b) => a + b, 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Eid Tab */}
        {activeTab === 'eid' && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {language === 'ar' ? '🎉 ميزانية العيد' : '🎉 Eid Budget'}
            </h3>
            {Object.entries(data.eidBudget).map(([key, value]) => {
              const labels: Record<string, { en: string; ar: string; icon: string }> = {
                clothes: { en: 'Clothes', ar: 'الملابس', icon: '👔' },
                gifts: { en: 'Gifts & Eidiya', ar: 'الهدايا والعيدية', icon: '🎁' },
                food: { en: 'Food & Sweets', ar: 'الطعام والحلويات', icon: '🍰' },
                events: { en: 'Events & Outings', ar: 'الفعاليات والنزهات', icon: '🎪' },
              };
              const label = labels[key];
              return (
                <div key={key} className="mb-3 flex items-center gap-3">
                  <span className="text-lg">{label.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground">{language === 'ar' ? label.ar : label.en}</span>
                      <span className="text-muted-foreground">{value.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-[#d4a853] rounded-full" style={{ width: '40%' }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-border flex justify-between">
              <span className="text-sm font-semibold text-foreground">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
              <span className="text-sm font-bold text-[#d4a853]">
                {Object.values(data.eidBudget).reduce((a, b) => a + b, 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Charity Tab */}
        {activeTab === 'charity' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {language === 'ar' ? '🤲 متتبع الصدقة' : '🤲 Charity Tracker'}
              </h3>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-primary">{data.totalCharity}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'الهدف اليومي' : 'Daily Goal'}: {data.charityGoal}
                </p>
              </div>
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min((data.totalCharity / (data.charityGoal * 30)) * 100, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[10, 50, 100].map(amount => (
                  <button
                    key={amount}
                    onClick={() => addDailyCharity(1, amount)}
                    className="bg-primary/10 border border-primary/30 text-primary py-2 rounded-xl text-sm font-medium"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily charity log */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                {language === 'ar' ? 'سجل الصدقات' : 'Charity Log'}
              </h4>
              <div className="space-y-1">
                {data.days.filter(d => d.charity > 0).map(d => (
                  <div key={d.day} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                    <span className="text-foreground">{language === 'ar' ? 'يوم' : 'Day'} {d.day}</span>
                    <span className="text-primary font-medium">{d.charity}</span>
                  </div>
                ))}
                {data.days.filter(d => d.charity > 0).length === 0 && (
                  <p className="text-center text-muted-foreground text-xs py-4">
                    {language === 'ar' ? 'لم تسجل صدقات بعد' : 'No charity recorded yet'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}