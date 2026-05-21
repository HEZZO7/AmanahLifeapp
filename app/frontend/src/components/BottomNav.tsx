import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const [showSearchModal, setShowSearchModal] = useState(false);

  const NAV_ITEMS = [
    { path: '/', icon: '🏠', label: language === 'ar' ? 'الرئيسية' : 'Dashboard' },
    { path: '/finance', icon: '💰', label: language === 'ar' ? 'المالية' : 'Finance' },
    { path: 'search-modal', icon: 'search', label: language === 'ar' ? 'بحث' : 'Search' },
    { path: '/planner', icon: 'calendar', label: language === 'ar' ? 'المخطط' : 'Planner' },
    { path: '/settings', icon: '☰', label: language === 'ar' ? 'المزيد' : 'More' },
  ];

  const handleNavClick = (item: typeof NAV_ITEMS[0]) => {
    if (item.path === 'search-modal') {
      setShowSearchModal(true);
    } else {
      navigate(item.path);
    }
  };

  const renderIcon = (item: typeof NAV_ITEMS[0], isActive: boolean) => {
    if (item.icon === 'search') {
      return (
        <svg className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    }
    if (item.icon === 'calendar') {
      return (
        <svg className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} strokeLinecap="round" />
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} strokeLinecap="round" />
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
        </svg>
      );
    }
    return <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>;
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border shadow-lg">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.path !== 'search-modal' && location.pathname === item.path;
            const isSearchActive = item.path === 'search-modal' && (location.pathname === '/search' || location.pathname === '/ai-search');
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item)}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive || isSearchActive
                    ? 'bg-primary/20 scale-105'
                    : 'hover:bg-secondary active:scale-95'
                }`}
              >
                {renderIcon(item, isActive || isSearchActive)}
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive || isSearchActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Search Mode Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowSearchModal(false)} />
          <div className="relative bg-card rounded-t-3xl w-full max-w-lg p-6 pb-8 shadow-xl animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
            <h3 className="text-foreground font-semibold text-lg mb-4 text-center">
              {language === 'ar' ? 'اختر نوع البحث' : 'Choose Search Type'}
            </h3>
            <div className="space-y-3">
              {/* Classic Search - Free */}
              <button
                onClick={() => { setShowSearchModal(false); navigate('/search'); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-background hover:border-primary/50 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-foreground font-medium text-sm">
                    {language === 'ar' ? 'البحث الكلاسيكي' : 'Classic Search'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'بحث نصي في المحتوى والصفحات' : 'Text search across content & pages'}
                  </p>
                </div>
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                  {language === 'ar' ? 'مجاني' : 'Free'}
                </span>
              </button>

              {/* AI Smart Search - Premium */}
              <button
                onClick={() => { setShowSearchModal(false); navigate('/ai-search'); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-background hover:border-[#d4a853]/50 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[#d4a853]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#d4a853]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-foreground font-medium text-sm">
                    {language === 'ar' ? 'البحث الذكي بالذكاء الاصطناعي' : 'AI Smart Search'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'بحث بلغة طبيعية في بياناتك' : 'Natural language search across your data'}
                  </p>
                </div>
                <span className="text-[10px] bg-[#d4a853]/20 text-[#d4a853] px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1L9 9l-8 3 8 3 3 8 3-8 8-3-8-3z" />
                  </svg>
                  Premium
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}