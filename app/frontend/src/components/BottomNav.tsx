import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();

  const NAV_ITEMS = [
    { path: '/', icon: '🏠', label: language === 'ar' ? 'الرئيسية' : 'Dashboard' },
    { path: '/finance', icon: '💰', label: language === 'ar' ? 'المالية' : 'Finance' },
    { path: '/ai-search', icon: '🔍', label: language === 'ar' ? 'بحث' : 'Search' },
    { path: '/planner', icon: '📅', label: language === 'ar' ? 'المخطط' : 'Planner' },
    { path: '/settings', icon: '☰', label: language === 'ar' ? 'المزيد' : 'More' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border shadow-lg">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-primary/20 scale-105'
                  : 'hover:bg-secondary active:scale-95'
              }`}
            >
              <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}