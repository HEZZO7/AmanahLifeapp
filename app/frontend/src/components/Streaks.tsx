import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StreakData {
  appStreak: number;
  prayerStreak: number;
  quranStreak: number;
  savingsStreak: number;
  xp: number;
  level: number;
  title: string;
  badges: { icon: string; name: string; earned: boolean }[];
}

const LEVEL_TITLES_EN = ['Beginner', 'Seeker', 'Devoted', 'Scholar', 'Master'];
const LEVEL_TITLES_AR = ['مبتدئ', 'باحث', 'متعبد', 'عالم', 'متقن'];

export default function Streaks() {
  const { language } = useLanguage();
  const [data, setData] = useState<StreakData | null>(null);

  useEffect(() => {
    // Calculate app usage streak
    const today = new Date();
    let appStreak = 0;
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = `amanah_visit_${date.toISOString().split('T')[0]}`;
      if (localStorage.getItem(key)) {
        appStreak++;
      } else {
        if (i === 0) continue;
        break;
      }
    }
    // Mark today's visit
    localStorage.setItem(`amanah_visit_${today.toISOString().split('T')[0]}`, '1');

    // Prayer streak
    let prayerStreak = 0;
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const prayerData = localStorage.getItem(`prayer_completed_${date.toDateString()}`);
      if (prayerData) {
        const completed = JSON.parse(prayerData);
        if (completed.length >= 5) {
          prayerStreak++;
        } else {
          break;
        }
      } else {
        if (i === 0) continue;
        break;
      }
    }

    // Quran streak
    let quranStreak = 0;
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = `amanah_quran_${date.toISOString().split('T')[0]}`;
      if (localStorage.getItem(key)) {
        quranStreak++;
      } else {
        if (i === 0) continue;
        break;
      }
    }

    // Savings streak (days under daily budget)
    let savingsStreak = 0;
    const budgetData = JSON.parse(localStorage.getItem('amanah_family_budget') || '{}');
    const monthlyBudget = budgetData.monthlyBudget || 5000;
    const dailyBudget = monthlyBudget / 30;
    const transactions = JSON.parse(localStorage.getItem('amanah-transactions') || '[]');

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayExpenses = transactions
        .filter((t: { type?: string; date?: string }) => t.type === 'expense' && t.date === dateStr)
        .reduce((sum: number, t: { amount?: number }) => sum + (t.amount || 0), 0);
      if (dayExpenses <= dailyBudget) {
        savingsStreak++;
      } else {
        break;
      }
    }

    // XP calculation
    const totalPrayers = prayerStreak * 5 * 10; // 10 XP per prayer
    const totalQuran = quranStreak * 20; // 20 XP per session
    const dhikrTotal = parseInt(localStorage.getItem(`dhikr_total_${today.toDateString()}`) || '0', 10);
    const totalDhikr = dhikrTotal * 5; // 5 XP per dhikr (today only for simplicity)
    const xp = totalPrayers + totalQuran + totalDhikr + (appStreak * 5);

    const level = Math.min(Math.floor(xp / 100), 4);
    const titles = language === 'ar' ? LEVEL_TITLES_AR : LEVEL_TITLES_EN;
    const title = titles[level];

    // Badges
    const badges = [
      { icon: '🌟', name: language === 'ar' ? 'أول أسبوع' : 'First Week', earned: appStreak >= 7 },
      { icon: '💪', name: language === 'ar' ? 'شهر قوي' : 'Month Strong', earned: appStreak >= 30 },
      { icon: '🌙', name: language === 'ar' ? 'محارب رمضان' : 'Ramadan Warrior', earned: prayerStreak >= 30 },
      { icon: '💰', name: language === 'ar' ? 'موفر الحج' : 'Hajj Saver', earned: savingsStreak >= 60 },
      { icon: '📖', name: language === 'ar' ? 'قارئ القرآن' : 'Quran Reader', earned: quranStreak >= 7 },
      { icon: '🏆', name: language === 'ar' ? 'المتفوق' : 'Overachiever', earned: xp >= 500 },
    ];

    setData({ appStreak, prayerStreak, quranStreak, savingsStreak, xp, level, title, badges });
  }, [language]);

  if (!data) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">
          {language === 'ar' ? '🏅 الإنجازات' : '🏅 Achievements'}
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-xs bg-[#D4A017]/20 text-[#D4A017] px-2 py-0.5 rounded-full font-semibold">
            Lv.{data.level + 1} {data.title}
          </span>
          <span className="text-xs text-muted-foreground">{data.xp} XP</span>
        </div>
      </div>

      {/* Streaks Row */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{data.appStreak}</p>
          <p className="text-[9px] text-muted-foreground">{language === 'ar' ? 'استخدام' : 'App'} 🔥</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{data.prayerStreak}</p>
          <p className="text-[9px] text-muted-foreground">{language === 'ar' ? 'صلاة' : 'Prayer'} 🕌</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{data.quranStreak}</p>
          <p className="text-[9px] text-muted-foreground">{language === 'ar' ? 'قرآن' : 'Quran'} 📖</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{data.savingsStreak}</p>
          <p className="text-[9px] text-muted-foreground">{language === 'ar' ? 'توفير' : 'Savings'} 💰</p>
        </div>
      </div>

      {/* XP Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{language === 'ar' ? 'التقدم للمستوى التالي' : 'Next Level Progress'}</span>
          <span>{data.xp % 100}/100 XP</span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-[#D4A017] rounded-full transition-all"
            style={{ width: `${(data.xp % 100)}%` }}
          />
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {data.badges.map((badge, i) => (
          <span
            key={i}
            className={`text-xs px-2 py-1 rounded-full ${
              badge.earned
                ? 'bg-[#D4A017]/20 text-[#D4A017]'
                : 'bg-secondary/50 text-muted-foreground'
            }`}
            title={badge.name}
          >
            {badge.icon} {badge.name}
          </span>
        ))}
      </div>
    </div>
  );
}