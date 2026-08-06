import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import PremiumGate from '@/components/PremiumGate';
import PageHeader from '@/components/PageHeader';
import SearchHistory from '@/components/SearchHistory';
import { useSearchHistory } from '@/hooks/useSearchHistory';

interface SearchResult {
  type: string;
  title: string;
  description: string;
  icon: string;
}

const CATEGORIES_AR = ['الكل', 'المهام', 'الأهداف', 'المالية', 'القرآن', 'الأذكار'];
const CATEGORIES_EN = ['All', 'Tasks', 'Goals', 'Finance', 'Quran', 'Adhkar'];

const SUGGESTION_CHIPS_AR = ['ميزانيتي هذا الشهر', 'مهام اليوم', 'تقدم الأهداف', 'أذكار لم أكملها'];
const SUGGESTION_CHIPS_EN = ['My budget this month', 'Today\'s tasks', 'Goals progress', 'Incomplete adhkar'];

// Calls the real app_11941c8fec_ai_search Edge Function (Claude-backed) -
// Phase J (Phase D decision, 2026-08). This used to return a hardcoded
// static array of 5 sample results, identical for every query and every
// user. Tasks/goals/finance/adhkar/Quran progress are localStorage-only
// (no server tables for any of them - confirmed while building this), so
// the client gathers its own local data and sends it in the request body;
// Claude interprets the query against it and returns real matches.
const AI_SEARCH_ENDPOINT = 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_ai_search';

function gatherLocalData() {
  const readJson = (key: string, fallback: unknown) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const tasks = (readJson('amanah_tasks', []) as unknown[]).slice(0, 30);
  const goals = (readJson('amanah-goals', []) as unknown[]).slice(0, 20);
  const transactions = (readJson('amanah-transactions', []) as unknown[]).slice(-30);
  const adhkarToday = readJson(`adhkar_progress_${new Date().toDateString()}`, null);
  const quranBookmarks = (readJson('quran_bookmarks', []) as unknown[]).slice(0, 20);
  const quranLastRead = readJson('quran_last_read', null);

  return { tasks, goals, transactions, adhkarToday, quranBookmarks, quranLastRead };
}

export default function AISearch() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const { history, addSearch, deleteSearch, clearHistory, isLoading: historyLoading } = useSearchHistory('ai');

  const categories = isAr ? CATEGORIES_AR : CATEGORIES_EN;
  const chips = isAr ? SUGGESTION_CHIPS_AR : SUGGESTION_CHIPS_EN;

  const runSearch = async (q: string) => {
    setSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first');
        return;
      }

      const response = await fetch(AI_SEARCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ query: q, language: isAr ? 'ar' : 'en', data: gatherLocalData() }),
      });
      const responseData = await response.json();

      if (!response.ok || responseData.error) {
        toast.error(isAr ? 'البحث الذكي غير متاح حالياً' : 'Smart Search is currently unavailable');
        setResults([]);
        return;
      }

      setResults(responseData.results || []);
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء البحث' : 'Something went wrong while searching');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (searchQuery?: string) => {
    const q = searchQuery || query;
    if (q.trim()) {
      if (searchQuery) setQuery(searchQuery);
      addSearch(q.trim());
      setShowResults(true);
      setIsFocused(false);
      runSearch(q.trim());
    }
  };

  const handleHistorySelect = (selectedQuery: string) => {
    setQuery(selectedQuery);
    setIsFocused(false);
    addSearch(selectedQuery);
    setShowResults(true);
    runSearch(selectedQuery);
  };

  const filteredResults = activeCategory === 0
    ? results
    : results.filter(r => r.type === categories[activeCategory]);

  const showHistory = isFocused && !query.trim() && history.length > 0;

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
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={isAr ? 'ابحث في بياناتك...' : 'Search your data...'}
                className="w-full bg-card border border-border rounded-2xl ps-12 pe-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Search History */}
            {showHistory && (
              <div className="bg-card/50 rounded-2xl p-3 border border-border">
                <SearchHistory
                  history={history}
                  isLoading={historyLoading}
                  onSelect={handleHistorySelect}
                  onDelete={deleteSearch}
                  onClearAll={clearHistory}
                />
              </div>
            )}

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
            {showResults && searching && (
              <div className="flex flex-col items-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
                <p className="text-muted-foreground text-sm">{isAr ? 'جاري البحث...' : 'Searching...'}</p>
              </div>
            )}
            {showResults && !searching && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <p className="text-xs text-muted-foreground">
                  {isAr ? `${filteredResults.length} نتائج` : `${filteredResults.length} results`}
                </p>
                {filteredResults.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    {isAr ? 'لم يتم العثور على نتائج مطابقة' : 'No matching results found'}
                  </p>
                )}
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
            {!showResults && !showHistory && (
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