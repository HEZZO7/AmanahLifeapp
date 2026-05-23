import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface SearchItem {
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  category: string;
  categoryAr: string;
  icon: string;
  path: string;
}

const SEARCHABLE_ITEMS: SearchItem[] = [
  { title: 'Prayer Times', titleAr: 'أوقات الصلاة', description: 'View daily prayer times with countdown', descriptionAr: 'عرض أوقات الصلاة اليومية مع العد التنازلي', category: 'Worship', categoryAr: 'عبادة', icon: '🕌', path: '/prayer-times' },
  { title: 'Quran Reader', titleAr: 'القرآن الكريم', description: 'Read Quran with Arabic text and English translation', descriptionAr: 'قراءة القرآن بالعربية مع الترجمة', category: 'Worship', categoryAr: 'عبادة', icon: '📖', path: '/quran' },
  { title: 'Dhikr Counter', titleAr: 'عداد الذكر', description: 'Digital tasbeeh counter with presets', descriptionAr: 'عداد تسبيح رقمي مع إعدادات مسبقة', category: 'Worship', categoryAr: 'عبادة', icon: '📿', path: '/dhikr' },
  { title: 'Duas Collection', titleAr: 'الأدعية', description: 'Categorized duas with Arabic and transliteration', descriptionAr: 'أدعية مصنفة بالعربية والترجمة', category: 'Worship', categoryAr: 'عبادة', icon: '🤲', path: '/duas' },
  { title: 'Morning & Evening Adhkar', titleAr: 'أذكار الصباح والمساء', description: 'Daily adhkar with count tracking', descriptionAr: 'أذكار يومية مع تتبع العدد', category: 'Worship', categoryAr: 'عبادة', icon: '🌅', path: '/adhkar' },
  { title: 'Qibla Finder', titleAr: 'اتجاه القبلة', description: 'Find Qibla direction using compass', descriptionAr: 'تحديد اتجاه القبلة بالبوصلة', category: 'Worship', categoryAr: 'عبادة', icon: '🧭', path: '/qibla' },
  { title: 'Giving Tracker', titleAr: 'متتبع العطاء', description: 'Track giving with multi-currency support', descriptionAr: 'تتبع العطاء بعملات متعددة', category: 'Lifestyle', categoryAr: 'نمط الحياة', icon: '💰', path: '/giving-tracker' },
  { title: 'Finance Tracker', titleAr: 'المالية', description: 'Track income and expenses', descriptionAr: 'تتبع الدخل والمصروفات', category: 'Finance', categoryAr: 'مالية', icon: '💵', path: '/finance' },
  { title: 'Family Budget', titleAr: 'ميزانية العائلة', description: 'Family budget planning and tracking', descriptionAr: 'تخطيط وتتبع ميزانية العائلة', category: 'Finance', categoryAr: 'مالية', icon: '👨‍👩‍👧‍👦', path: '/family-budget' },
  { title: 'Financial Dashboard', titleAr: 'لوحة التحكم المالية', description: 'KPIs, trends, and savings goals', descriptionAr: 'مؤشرات الأداء والاتجاهات وأهداف التوفير', category: 'Finance', categoryAr: 'مالية', icon: '📊', path: '/financial-dashboard' },
  { title: 'Halal Investment', titleAr: 'الاستثمار الحلال', description: 'Ethical finance and investment tracker', descriptionAr: 'تتبع التمويل والاستثمار الأخلاقي', category: 'Finance', categoryAr: 'مالية', icon: '📈', path: '/halal-investment' },
  { title: 'Planner', titleAr: 'المخطط', description: 'Agenda, weekly and monthly calendar', descriptionAr: 'جدول أعمال وتقويم أسبوعي وشهري', category: 'Planning', categoryAr: 'تخطيط', icon: '📅', path: '/planner' },
  { title: 'Task Manager', titleAr: 'المهام', description: 'Manage tasks with priorities and categories', descriptionAr: 'إدارة المهام بالأولويات والتصنيفات', category: 'Planning', categoryAr: 'تخطيط', icon: '✅', path: '/tasks' },
  { title: 'Goals', titleAr: 'الأهداف', description: 'Set and track your goals', descriptionAr: 'تحديد وتتبع أهدافك', category: 'Planning', categoryAr: 'تخطيط', icon: '🎯', path: '/goals' },
  { title: 'Daily Routine', titleAr: 'الورد اليومي', description: 'Morning routine and daily habits', descriptionAr: 'الروتين الصباحي والعادات اليومية', category: 'Planning', categoryAr: 'تخطيط', icon: '☀️', path: '/daily-routine' },
  { title: 'Hijri Calendar', titleAr: 'التقويم الهجري', description: 'Hijri calendar with important dates', descriptionAr: 'التقويم الهجري مع التواريخ المهمة', category: 'Reference', categoryAr: 'مرجع', icon: '🗓️', path: '/calendar' },
  { title: 'Fasting Tracker', titleAr: 'تتبع الصيام', description: 'Track fasting days and Ramadan progress', descriptionAr: 'تتبع أيام الصيام وتقدم رمضان', category: 'Worship', categoryAr: 'عبادة', icon: '🌙', path: '/fasting' },
  { title: 'Wellness', titleAr: 'العافية', description: 'Mood, sleep, hydration tracking', descriptionAr: 'تتبع المزاج والنوم والترطيب', category: 'Health', categoryAr: 'صحة', icon: '💚', path: '/wellness' },
  { title: 'Ramadan Planner', titleAr: 'مخطط رمضان', description: 'Ramadan budget and charity planning', descriptionAr: 'ميزانية رمضان وتخطيط الصدقات', category: 'Planning', categoryAr: 'تخطيط', icon: '🕋', path: '/ramadan-planner' },
  { title: 'Settings', titleAr: 'الإعدادات', description: 'App settings and preferences', descriptionAr: 'إعدادات التطبيق والتفضيلات', category: 'App', categoryAr: 'التطبيق', icon: '⚙️', path: '/settings' },
  { title: 'Subscription', titleAr: 'الاشتراك', description: 'Manage your subscription plan', descriptionAr: 'إدارة خطة اشتراكك', category: 'App', categoryAr: 'التطبيق', icon: '⭐', path: '/subscription' },
];

const CATEGORIES = ['All', 'Worship', 'Finance', 'Planning', 'Health', 'Reference', 'App'];
const CATEGORIES_AR = ['الكل', 'عبادة', 'مالية', 'تخطيط', 'صحة', 'مرجع', 'التطبيق'];

export default function ClassicSearch() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  const categories = isAr ? CATEGORIES_AR : CATEGORIES;

  const filteredItems = useMemo(() => {
    let items = SEARCHABLE_ITEMS;

    // Filter by category
    if (activeCategory > 0) {
      const catName = CATEGORIES[activeCategory];
      items = items.filter(item => item.category === catName);
    }

    // Filter by query
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.titleAr.includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.descriptionAr.includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.categoryAr.includes(q)
      );
    }

    return items;
  }, [query, activeCategory]);

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="🔍" title={isAr ? 'البحث' : 'Search'} />

      <main className="max-w-lg mx-auto px-4 py-4">
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <svg className="absolute top-3.5 start-4 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'ابحث عن صفحة أو ميزة...' : 'Search pages, features, content...'}
              className="w-full bg-card border border-border rounded-2xl ps-12 pe-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
              autoFocus
            />
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveCategory(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === i
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border text-muted-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isAr ? `${filteredItems.length} نتيجة` : `${filteredItems.length} results`}
            </p>
            {filteredItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full bg-card rounded-2xl p-4 border border-border hover:border-primary/50 transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-foreground font-medium text-sm">
                        {isAr ? item.titleAr : item.title}
                      </span>
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {isAr ? item.categoryAr : item.category}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {isAr ? item.descriptionAr : item.description}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-muted-foreground mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}

            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-3xl">🔍</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  {isAr ? 'لا توجد نتائج' : 'No results found'}
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {isAr ? 'جرب كلمات بحث مختلفة' : 'Try different search terms'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}