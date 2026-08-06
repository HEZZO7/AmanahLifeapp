/**
 * Dashboard nav data — Phase G category restructure. Single source for
 * both the home page's category selector and each category's landing
 * page, so the two never drift out of sync. Mirrors amanahlife-rn's
 * src/lib/dashboardNav.ts (same category grouping) - paths here are web
 * routes (no "/(tabs)" prefix), and existing web wording/icons are kept
 * as-is rather than overwritten with RN's copies.
 *
 * Blog and Settings are excluded (Settings is already reachable via
 * BottomNav; Blog gets a small link on the Growth landing page). Family
 * Dashboard and Receipt Scanner are ALSO excluded for now - both are
 * explicit Phase D items still awaiting a product decision (real backend
 * vs. pulling from sale) - not dropped, just not part of this grouping
 * yet, matching the approved Phase G plan's explicit call-out of this gap.
 */
export type CategoryId = 'worship' | 'finance' | 'planning' | 'growth';

export interface NavItem {
  icon: string;
  title: string;
  description: string;
  path: string;
  category: CategoryId;
}

export interface CategoryDef {
  id: CategoryId;
  icon: string;
  title: string;
  description: string;
}

export function getNavItems(language: string): NavItem[] {
  const ar = language === 'ar';
  return [
    { icon: '🕌', title: ar ? 'الصلاة' : 'Prayer', description: ar ? 'تتبع الصلوات' : 'Track daily prayers', path: '/prayer-times', category: 'worship' },
    { icon: '📖', title: ar ? 'القرآن' : 'Quran', description: ar ? 'قراءة وحفظ' : 'Read & bookmark', path: '/quran', category: 'worship' },
    { icon: '🤲', title: ar ? 'الدعاء' : 'Duas', description: ar ? 'أدعية مأثورة' : 'Supplications', path: '/duas', category: 'worship' },
    { icon: '📿', title: ar ? 'الذكر' : 'Dhikr', description: ar ? 'التسبيح' : 'Remembrance', path: '/dhikr', category: 'worship' },
    { icon: '🍃', title: ar ? 'الأذكار' : 'Adhkar', description: ar ? 'الصباح والمساء' : 'Morning & Evening', path: '/adhkar', category: 'worship' },
    { icon: '⏱️', title: ar ? 'الصيام' : 'Fasting', description: ar ? 'تتبع الصيام' : 'Track fasting', path: '/fasting', category: 'worship' },
    { icon: '🧭', title: ar ? 'القبلة' : 'Qibla', description: ar ? 'تحديد الاتجاه' : 'Find direction', path: '/qibla', category: 'worship' },
    { icon: '🗓️', title: ar ? 'التقويم' : 'Calendar', description: ar ? 'التواريخ الهجرية' : 'Hijri dates', path: '/calendar', category: 'worship' },
    { icon: '🌙', title: ar ? 'مخطط رمضان' : 'Ramadan Plan', description: ar ? 'رمضان والعيد' : 'Ramadan & Eid', path: '/ramadan-planner', category: 'worship' },

    { icon: '💰', title: ar ? 'المالية' : 'Finance', description: ar ? 'تتبع المالية' : 'Track finances', path: '/finance', category: 'finance' },
    { icon: '💎', title: ar ? 'الزكاة والعطاء' : 'Zakat & Giving', description: ar ? 'تتبع العطاء' : 'Track giving', path: '/giving-tracker', category: 'finance' },
    { icon: '👨‍👩‍👧‍👦', title: ar ? 'ميزانية العائلة' : 'Family Budget', description: ar ? 'مخطط الميزانية' : 'Budget planner', path: '/family-budget', category: 'finance' },
    { icon: '🔔', title: ar ? 'تذكير الفواتير' : 'Bill Reminders', description: ar ? 'تتبع الفواتير' : 'Track bills', path: '/bill-reminders', category: 'finance' },
    { icon: '📊', title: ar ? 'لوحة مالية' : 'Dashboard', description: ar ? 'مؤشرات مالية' : 'Lifestyle KPIs', path: '/financial-dashboard', category: 'finance' },
    { icon: '📈', title: ar ? 'استثمار حلال' : 'Halal Invest', description: ar ? 'التمويل الأخلاقي' : 'Ethical finance', path: '/halal-investment', category: 'finance' },
    { icon: '🏆', title: ar ? 'تحديات الادخار' : 'Savings Challenges', description: ar ? 'تحديات ممتعة' : 'Gamified saving', path: '/savings-challenges', category: 'finance' },

    { icon: '✅', title: ar ? 'المهام' : 'Tasks', description: ar ? 'إدارة المهام' : 'Manage tasks', path: '/tasks', category: 'planning' },
    { icon: '🌅', title: ar ? 'الروتين اليومي' : 'Daily Routine', description: ar ? 'العادات اليومية' : 'Daily habits', path: '/daily-routine', category: 'planning' },
    { icon: '📋', title: ar ? 'المخطط' : 'Planner', description: ar ? 'خطط يومك' : 'Plan your day', path: '/planner', category: 'planning' },
    { icon: '🎯', title: ar ? 'الأهداف' : 'Goals', description: ar ? 'تتبع الأهداف' : 'Track goals', path: '/goals', category: 'planning' },

    { icon: '💚', title: ar ? 'العافية' : 'Wellness', description: ar ? 'تتبع الصحة' : 'Health tracking', path: '/wellness', category: 'growth' },
    { icon: '🤖', title: ar ? 'المدرب الذكي' : 'AI Life Coach', description: ar ? 'نصائح مخصصة' : 'Personalized coaching', path: '/ai-life-coach', category: 'growth' },
    { icon: '💯', title: ar ? 'مؤشر الحياة' : 'Life Score', description: ar ? 'تقييم أسبوعي' : 'Weekly assessment', path: '/weekly-life-score', category: 'growth' },
    { icon: '🏅', title: ar ? 'تحليلات التقدم' : 'Progress Analytics', description: ar ? 'تتبع وتحليل' : 'Track & analyze', path: '/progress-analytics', category: 'growth' },
  ];
}

export function getCategories(language: string): CategoryDef[] {
  const ar = language === 'ar';
  return [
    { id: 'worship', icon: '🕌', title: ar ? 'العبادة' : 'Worship', description: ar ? 'الصلاة والقرآن والأذكار' : 'Prayer, Quran & remembrance' },
    { id: 'finance', icon: '💰', title: ar ? 'المالية' : 'Finance', description: ar ? 'الميزانية والزكاة والادخار' : 'Budget, Zakat & saving' },
    { id: 'planning', icon: '📋', title: ar ? 'التخطيط' : 'Planning', description: ar ? 'المهام والأهداف والروتين' : 'Tasks, goals & routines' },
    { id: 'growth', icon: '💯', title: ar ? 'النمو' : 'Growth', description: ar ? 'العافية ومؤشر الحياة' : 'Wellness & life score' },
  ];
}
