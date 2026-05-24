import { useLanguage } from '@/contexts/LanguageContext';
import { SearchHistoryItem } from '@/hooks/useSearchHistory';

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  isLoading: boolean;
  onSelect: (query: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export default function SearchHistory({
  history,
  isLoading,
  onSelect,
  onDelete,
  onClearAll,
}: SearchHistoryProps) {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-secondary flex items-center justify-center">
          <span className="text-lg">🕐</span>
        </div>
        <p className="text-muted-foreground text-xs">
          {isAr ? 'لا يوجد سجل بحث' : 'No search history'}
        </p>
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return isAr ? 'الآن' : 'Just now';
    if (diffMins < 60) return isAr ? `${diffMins} د` : `${diffMins}m ago`;
    if (diffHours < 24) return isAr ? `${diffHours} س` : `${diffHours}h ago`;
    if (diffDays < 7) return isAr ? `${diffDays} ي` : `${diffDays}d ago`;
    return date.toLocaleDateString(isAr ? 'ar' : 'en', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          🕐 {isAr ? 'عمليات البحث الأخيرة' : 'Recent Searches'}
        </span>
        <button
          onClick={onClearAll}
          className="text-[10px] text-destructive hover:text-destructive/80 transition-colors"
        >
          {isAr ? 'مسح الكل' : 'Clear All'}
        </button>
      </div>

      {/* History Items */}
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 group"
          >
            <button
              onClick={() => onSelect(item.query)}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/40 transition-all text-start"
            >
              <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-foreground truncate flex-1">{item.query}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatTime(item.created_at)}
              </span>
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              aria-label={isAr ? 'حذف' : 'Delete'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}