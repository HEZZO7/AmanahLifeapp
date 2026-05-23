import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import PremiumGate from '@/components/PremiumGate';
import PageHeader from '@/components/PageHeader';

interface SearchResult {
  type: string;
  title: string;
  description: string;
  icon: string;
}

const CATEGORIES_AR = ['الكل', 'المهام', 'الأهداف', 'المالية', 'القرآن', 'الأذكار'];
const CATEGORIES_EN = ['All', 'Tasks', 'Goals', 'Finance', 'Quran', 'Adhkar'];

const SAMPLE_RESULTS_AR: SearchResult[] = [
  { type: 'المهام', title: 'مراجعة الميزانية الشهرية', description: 'مهمة مجدولة ليوم الأحد - أولوية عالية', icon: '✅' },
  { type: 'المالية', title: 'مصاريف البقالة', description: 'إجمالي هذا الشهر: 850 ر.س من أصل 1200 ر.س', icon: '💰' },
  { type: 'الأهداف', title: 'ختم القرآن', description: 'التقدم: 15 جزء من 30 - 50%', icon: '🎯' },
  { type: 'الأذكار', title: 'أذكار الصباح', description: 'سبحان الله وبحمده - 100 مرة', icon: '📿' },
  { type: 'القرآن', title: 'سورة الكهف', description: 'آخر قراءة: الآية 45 - يوم الجمعة', icon: '📖' },
];

const SAMPLE_RESULTS_EN: SearchResult[] = [
  { type: 'Tasks', title: 'Monthly Budget Review', description: 'Scheduled for Sunday - High Priority', icon: '✅' },
  { type: 'Finance', title: 'Grocery Expenses', description: 'This month total: 850 of 1200 budget', icon: '💰' },
  { type: 'Goals', title: 'Complete Quran', description: 'Progress: 15 of 30 Juz - 50%', icon: '🎯' },
  { type: 'Adhkar', title: 'Morning Adhkar', description: 'SubhanAllah wa bihamdihi - 100 times', icon: '📿' },
  { type: 'Quran', title: 'Surah Al-Kahf', description: 'Last read: Ayah 45 - Friday', icon: '📖' },
];

const SUGGESTION_CHIPS_AR = ['ميزانيتي هذا الشهر', 'مهام اليوم', 'تقدم الأهداف', 'أذكار لم أكملها'];
const SUGGESTION_CHIPS_EN = ['My budget this month', 'Today\'s tasks', 'Goals progress', 'Incomplete adhkar'];

export default function AISearch() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const categories = isAr ? CATEGORIES_AR : CATEGORIES_EN;
  const results = isAr ? SAMPLE_RESULTS_AR : SAMPLE_RESULTS_EN;
  const chips = isAr ? SUGGESTION_CHIPS_AR : SUGGESTION_CHIPS_EN;

  const handleSearch = (searchQuery?: string) => {
    if (searchQuery) setQuery(searchQuery);
    setShowResults(true);
  };

  const filteredResults = activeCategory === 0
    ? results
    : results.filter(r => r.type === categories[activeCategory]);

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="🔍" title={isAr ? 'البحث الذكي' : 'Smart Search'} />

      <main className="max-w-lg mx-auto px-4 py-4">
        <PremiumGate requiredTier="balanced" featureName={isAr ? 'البحث الذكي' : 'Smart Search'}>
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
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={isAr ? 'ابحث في بياناتك...' : 'Search your data...'}
                className="w-full bg-card border border-border rounded-2xl ps-12 pe-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Suggestion Chips */}
            <div className="flex flex-wrap gap-2">
              {chips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(chip)}
                  className="bg-card border border-border px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-all"
                >
                  ✨ {chip}
                </button>
              ))}
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
            {showResults && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <p className="text-xs text-muted-foreground">
                  {isAr ? `${filteredResults.length} نتائج` : `${filteredResults.length} results`}
                </p>
                {filteredResults.map((result, i) => (
                  <div key={i} className="bg-card rounded-2xl p-4 border border-border hover:border-primary/50 transition-all">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{result.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-foreground font-medium text-sm">{result.title}</span>
                          <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            {result.type}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">{result.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!showResults && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a4a3a] flex items-center justify-center">
                  <span className="text-3xl">🔍</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  {isAr
                    ? 'ابحث بلغة طبيعية عن أي شيء في تطبيقك'
                    : 'Search naturally for anything in your app'}
                </p>
              </div>
            )}
          </div>
        </PremiumGate>
      </main>

      <BottomNav />
    </div>
  );
}