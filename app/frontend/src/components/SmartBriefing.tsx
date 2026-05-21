import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BriefingData {
  greeting: string;
  nextPrayer: string | null;
  dailySpending: number;
  dailyBudget: number;
  streak: number;
  tasksCount: number;
  quote: { text: string; source: string };
}

const quotes = [
  { ar: 'إن الله لا يضيع أجر المحسنين', en: 'Indeed, Allah does not allow to be lost the reward of those who do good.', source: 'Quran 9:120' },
  { ar: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', en: 'Whoever fears Allah, He will make a way out for him.', source: 'Quran 65:2' },
  { ar: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', en: 'For indeed, with hardship will be ease.', source: 'Quran 94:5' },
  { ar: 'وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ', en: 'And cooperate in righteousness and piety.', source: 'Quran 5:2' },
  { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', en: 'Our Lord, give us good in this world.', source: 'Quran 2:201' },
  { ar: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ', en: 'Do not despair of the mercy of Allah.', source: 'Quran 12:87' },
  { ar: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', en: 'Actions are judged by intentions.', source: 'Hadith - Bukhari' },
];

export default function SmartBriefing() {
  const { language } = useLanguage();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    let greeting: string;
    if (hour < 12) {
      greeting = language === 'ar' ? 'صباح الخير ☀️' : 'Good Morning ☀️';
    } else if (hour < 17) {
      greeting = language === 'ar' ? 'مساء الخير 🌤️' : 'Good Afternoon 🌤️';
    } else {
      greeting = language === 'ar' ? 'مساء النور 🌙' : 'Good Evening 🌙';
    }

    // Next prayer from localStorage cache
    const prayerCache = localStorage.getItem('amanah_next_prayer');
    const nextPrayer = prayerCache || null;

    // Daily spending
    const transactions = JSON.parse(localStorage.getItem('amanah-transactions') || '[]');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayExpenses = transactions
      .filter((t: { type?: string; date?: string }) => t.type === 'expense' && t.date === todayStr)
      .reduce((sum: number, t: { amount?: number }) => sum + (t.amount || 0), 0);

    const budgetData = JSON.parse(localStorage.getItem('amanah_family_budget') || '{}');
    const monthlyBudget = budgetData.monthlyBudget || 5000;
    const dailyBudget = Math.round(monthlyBudget / 30);

    // Streak
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

    // Tasks count
    const tasks = JSON.parse(localStorage.getItem('amanah-tasks') || '[]');
    const todayTasks = tasks.filter((t: { date?: string; completed?: boolean }) =>
      (!t.date || t.date === todayStr) && !t.completed
    );

    // Daily quote
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const quoteIdx = dayOfYear % quotes.length;
    const quote = {
      text: language === 'ar' ? quotes[quoteIdx].ar : quotes[quoteIdx].en,
      source: quotes[quoteIdx].source,
    };

    setBriefing({
      greeting,
      nextPrayer,
      dailySpending: todayExpenses,
      dailyBudget,
      streak: currentStreak,
      tasksCount: todayTasks.length,
      quote,
    });
  }, [language]);

  if (!briefing) return null;

  return (
    <div className="bg-gradient-to-br from-primary/20 to-card rounded-2xl border border-border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-foreground">{briefing.greeting}</h3>
        <span className="text-xs text-muted-foreground">
          {language === 'ar' ? 'ملخص يومي' : 'Daily Briefing'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {briefing.nextPrayer && (
          <div className="bg-background/50 rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground">🕌 {language === 'ar' ? 'الصلاة القادمة' : 'Next Prayer'}</p>
            <p className="text-sm font-semibold text-foreground">{briefing.nextPrayer}</p>
          </div>
        )}
        <div className="bg-background/50 rounded-xl p-2.5">
          <p className="text-[10px] text-muted-foreground">💰 {language === 'ar' ? 'الإنفاق اليوم' : 'Today\'s Spending'}</p>
          <p className={`text-sm font-semibold ${briefing.dailySpending > briefing.dailyBudget ? 'text-red-400' : 'text-primary'}`}>
            {briefing.dailySpending}/{briefing.dailyBudget}
          </p>
        </div>
        <div className="bg-background/50 rounded-xl p-2.5">
          <p className="text-[10px] text-muted-foreground">🔥 {language === 'ar' ? 'السلسلة' : 'Streak'}</p>
          <p className="text-sm font-semibold text-[#d4a853]">{briefing.streak} {language === 'ar' ? 'يوم' : 'days'}</p>
        </div>
        <div className="bg-background/50 rounded-xl p-2.5">
          <p className="text-[10px] text-muted-foreground">✅ {language === 'ar' ? 'المهام المتبقية' : 'Tasks Left'}</p>
          <p className="text-sm font-semibold text-foreground">{briefing.tasksCount}</p>
        </div>
      </div>

      <div className="bg-background/30 rounded-xl p-3 text-center">
        <p className="text-sm text-foreground italic">"{briefing.quote.text}"</p>
        <p className="text-[10px] text-[#d4a853] mt-1">{briefing.quote.source}</p>
      </div>
    </div>
  );
}