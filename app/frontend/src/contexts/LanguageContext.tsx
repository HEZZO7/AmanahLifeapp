import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ar' | 'en';

interface Translations {
  [key: string]: { ar: string; en: string };
}

const translations: Translations = {
  home: { ar: 'الرئيسية', en: 'Home' },
  prayer: { ar: 'الصلاة', en: 'Prayer' },
  quran: { ar: 'القرآن', en: 'Quran' },
  dhikr: { ar: 'الذكر', en: 'Dhikr' },
  duas: { ar: 'الدعاء', en: 'Duas' },
  dailyRoutine: { ar: 'الورد اليومي', en: 'Daily Routine' },
  fasting: { ar: 'الصيام', en: 'Fasting' },
  tasks: { ar: 'المهام', en: 'Tasks' },
  adhkar: { ar: 'الأذكار', en: 'Adhkar' },
  finance: { ar: 'المالية', en: 'Finance' },
  welcome: { ar: 'مرحباً بك', en: 'Welcome' },
  chooseLanguage: { ar: 'اختر لغتك', en: 'Choose your language' },
  arabic: { ar: 'العربية', en: 'Arabic' },
  english: { ar: 'الإنجليزية', en: 'English' },
  continue: { ar: 'متابعة', en: 'Continue' },
  morning: { ar: 'أذكار الصباح', en: 'Morning Adhkar' },
  evening: { ar: 'أذكار المساء', en: 'Evening Adhkar' },
  afterPrayer: { ar: 'أذكار بعد الصلاة', en: 'After Prayer' },
  sleep: { ar: 'أذكار النوم', en: 'Sleep Adhkar' },
  suhoor: { ar: 'السحور', en: 'Suhoor' },
  iftar: { ar: 'الإفطار', en: 'Iftar' },
  fastingStatus: { ar: 'حالة الصيام', en: 'Fasting Status' },
  salary: { ar: 'الراتب', en: 'Salary' },
  freelance: { ar: 'عمل حر', en: 'Freelance' },
  investment: { ar: 'استثمار', en: 'Investment' },
  gift: { ar: 'هدية', en: 'Gift' },
  other: { ar: 'أخرى', en: 'Other' },
  housing: { ar: 'السكن', en: 'Housing' },
  food: { ar: 'الطعام', en: 'Food' },
  transport: { ar: 'المواصلات', en: 'Transport' },
  education: { ar: 'التعليم', en: 'Education' },
  healthcare: { ar: 'الصحة', en: 'Healthcare' },
  charity: { ar: 'الصدقة', en: 'Charity' },
  entertainment: { ar: 'الترفيه', en: 'Entertainment' },
  utilities: { ar: 'المرافق', en: 'Utilities' },
  editTransaction: { ar: 'تعديل المعاملة', en: 'Edit Transaction' },
  saveChanges: { ar: 'حفظ التغييرات', en: 'Save Changes' },
  income: { ar: 'الدخل', en: 'Income' },
  expense: { ar: 'المصروفات', en: 'Expense' },
  savings: { ar: 'المدخرات', en: 'Savings' },
  addTransaction: { ar: 'إضافة معاملة', en: 'Add Transaction' },
  amount: { ar: 'المبلغ', en: 'Amount' },
  category: { ar: 'الفئة', en: 'Category' },
  description: { ar: 'الوصف', en: 'Description' },
  worship: { ar: 'عبادة', en: 'Worship' },
  work: { ar: 'عمل', en: 'Work' },
  personal: { ar: 'شخصي', en: 'Personal' },
  health: { ar: 'صحة', en: 'Health' },
  high: { ar: 'عالي', en: 'High' },
  medium: { ar: 'متوسط', en: 'Medium' },
  low: { ar: 'منخفض', en: 'Low' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  pending: { ar: 'قيد الانتظار', en: 'Pending' },
  all: { ar: 'الكل', en: 'All' },
  today: { ar: 'اليوم', en: 'Today' },
  streak: { ar: 'التتابع', en: 'Streak' },
  days: { ar: 'أيام', en: 'days' },
  minutes: { ar: 'دقيقة', en: 'min' },
  morningRoutine: { ar: 'روتين الصباح', en: 'Morning Routine' },
  weeklyReview: { ar: 'مراجعة أسبوعية', en: 'Weekly Review' },
  healthDay: { ar: 'يوم صحي', en: 'Health Day' },
  deepFocus: { ar: 'تركيز عميق', en: 'Deep Focus' },
  learningSession: { ar: 'جلسة تعلم', en: 'Learning Session' },
  qibla: { ar: 'القبلة', en: 'Qibla' },
  zakat: { ar: 'حاسبة العطاء', en: 'Giving Tracker' },
  calendar: { ar: 'التقويم', en: 'Calendar' },
  signOut: { ar: 'تسجيل الخروج', en: 'Sign Out' },
  assalamuAlaikum: { ar: 'السلام عليكم! 👋', en: 'Assalamu Alaikum! 👋' },
  islamicCompanion: { ar: 'رفيقك الذكي', en: 'Your smart life companion' },
  quickActions: { ar: 'إجراءات سريعة', en: 'Quick Actions' },
  verseOfDay: { ar: 'آية اليوم', en: 'Verse of the Day' },
  nextPrayer: { ar: 'الصلاة القادمة', en: 'Next Prayer' },
  prayerStreak: { ar: 'تتابع الصلاة', en: 'Prayer Streak' },
  todaysDhikr: { ar: 'ذكر اليوم', en: "Today's Dhikr" },
  keepGoing: { ar: 'استمر!', en: 'Keep it going!' },
  tapToContinue: { ar: 'اضغط للمتابعة', en: 'Tap to continue' },
  quranPages: { ar: 'صفحات القرآن', en: 'Quran Pages' },
  goal: { ar: 'الهدف', en: 'Goal' },
  pages: { ar: 'صفحات', en: 'pages' },
  addTask: { ar: 'إضافة مهمة', en: 'Add Task' },
  title: { ar: 'العنوان', en: 'Title' },
  priority: { ar: 'الأولوية', en: 'Priority' },
  savingsRate: { ar: 'معدل الادخار', en: 'Savings Rate' },
  monthlyIncome: { ar: 'الدخل الشهري', en: 'Monthly Income' },
  monthlyExpense: { ar: 'المصروفات الشهرية', en: 'Monthly Expenses' },
  transactions: { ar: 'المعاملات', en: 'Transactions' },
  // Phase 4 translations
  goals: { ar: 'الأهداف', en: 'Goals' },
  wellness: { ar: 'العافية', en: 'Wellness' },
  planner: { ar: 'المخطط', en: 'Planner' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  exportData: { ar: 'تصدير البيانات', en: 'Export Data' },
  profile: { ar: 'الملف الشخصي', en: 'Profile' },
  theme: { ar: 'المظهر', en: 'Theme' },
  currency: { ar: 'العملة', en: 'Currency' },
  notifications: { ar: 'الإشعارات', en: 'Notifications' },
  active: { ar: 'نشط', en: 'Active' },
  paused: { ar: 'متوقف', en: 'Paused' },
  financial: { ar: 'مالي', en: 'Financial' },
  spiritual: { ar: 'روحي', en: 'Spiritual' },
  family: { ar: 'عائلي', en: 'Family' },
  mood: { ar: 'المزاج', en: 'Mood' },
  hydration: { ar: 'الماء', en: 'Hydration' },
  stress: { ar: 'التوتر', en: 'Stress' },
  agenda: { ar: 'جدول الأعمال', en: 'Agenda' },
  weekly: { ar: 'أسبوعي', en: 'Weekly' },
  monthly: { ar: 'شهري', en: 'Monthly' },
  financialSummary: { ar: 'الملخص المالي', en: 'Financial Summary' },
  overdue: { ar: 'متأخر', en: 'Overdue' },
  search: { ar: 'بحث', en: 'Search' },
  darkMode: { ar: 'الوضع الداكن', en: 'Dark Mode' },
  lightMode: { ar: 'الوضع الفاتح', en: 'Light Mode' },
  ramadanMode: { ar: 'وضع رمضان', en: 'Ramadan Mode' },
  hijriCalendar: { ar: 'التقويم الهجري', en: 'Hijri Calendar' },
  easternNumerals: { ar: 'الأرقام العربية', en: 'Eastern Arabic Numerals' },
  addGoal: { ar: 'إضافة هدف', en: 'Add Goal' },
  targetDate: { ar: 'التاريخ المستهدف', en: 'Target Date' },
  progress: { ar: 'التقدم', en: 'Progress' },
  linkedTasks: { ar: 'المهام المرتبطة', en: 'Linked Tasks' },
  wellnessScore: { ar: 'مؤشر العافية', en: 'Wellness Score' },
  weeklyTrend: { ar: 'الاتجاه الأسبوعي', en: 'Weekly Trend' },
  logToday: { ar: 'تسجيل اليوم', en: 'Log Today' },
  cups: { ar: 'أكواب', en: 'cups' },
  hours: { ar: 'ساعات', en: 'hours' },
  noTasks: { ar: 'لا توجد مهام', en: 'No tasks' },
  exportGoals: { ar: 'تصدير الأهداف', en: 'Export Goals' },
  exportFinance: { ar: 'تصدير المالية', en: 'Export Finance' },
  dailySummary: { ar: 'ملخص اليوم', en: 'Daily Summary' },
  shortcuts: { ar: 'اختصارات', en: 'Shortcuts' },
  todaysTasks: { ar: 'مهام اليوم', en: "Today's Tasks" },
  activeGoals: { ar: 'الأهداف النشطة', en: 'Active Goals' },
  recentTransactions: { ar: 'المعاملات الأخيرة', en: 'Recent Transactions' },
  status: { ar: 'الحالة', en: 'Status' },
  save: { ar: 'حفظ', en: 'Save' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  delete: { ar: 'حذف', en: 'Delete' },
  edit: { ar: 'تعديل', en: 'Edit' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Priority: URL param > al_lang (from landing page) > amanah_language > default 'en'
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang');
      if (urlLang === 'ar' || urlLang === 'en') {
        // Persist URL param choice
        localStorage.setItem('amanah_language', urlLang);
        localStorage.setItem('al_lang', urlLang);
        localStorage.setItem('amanah_lang', urlLang);
        return urlLang;
      }
      const alLang = localStorage.getItem('al_lang');
      if (alLang === 'ar' || alLang === 'en') {
        localStorage.setItem('amanah_language', alLang);
        return alLang;
      }
      const stored = localStorage.getItem('amanah_language');
      if (stored === 'ar' || stored === 'en') {
        return stored;
      }
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('amanah_language', lang);
    localStorage.setItem('al_lang', lang);
    localStorage.setItem('amanah_lang', lang);
  };

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language];
    }
    return key;
  };

  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    // Fallback for prerendering (SSR/Node) where LanguageProvider is not available
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: (key: string) => key,
      isRTL: false,
    };
  }
  return context;
}

export function hasLanguagePreference(): boolean {
  return localStorage.getItem('amanah_language') !== null;
}