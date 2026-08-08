import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import PageHeader from '@/components/PageHeader';
import { getNavItems, getCategories, CategoryId } from '@/lib/dashboardNav';

/**
 * Category landing page — Phase G dashboard restructure. One
 * parameterized route for all 4 categories (Worship/Finance/Planning/
 * Growth), reached by tapping a category card on the home page. Shows
 * that category's feature sub-grid, reusing the exact same
 * `grid-cols-2 md:grid-cols-4` grid the old flat "Quick Actions" grid
 * used on Index.tsx.
 *
 * Does not touch SmartBriefing/DuaOfTheDay/Streaks or any of Index.tsx's
 * excused-period-aware streak logic - this page only reads the static
 * nav data from src/lib/dashboardNav.ts, nothing stateful.
 */
export default function CategoryLanding() {
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  const { language, isRTL } = useLanguage();

  const categoryId = category as CategoryId;
  const categoryDef = getCategories(language).find((c) => c.id === categoryId);
  const items = getNavItems(language).filter((i) => i.category === categoryId);

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon={categoryDef?.icon || ''} title={categoryDef?.title || ''} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!!categoryDef?.description && (
          <p className="text-muted-foreground text-sm mb-4">{categoryDef.description}</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="bg-card border border-border rounded-2xl p-4 text-start hover:shadow-lg transition-all"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-sm font-semibold text-foreground">{item.title}</div>
              {!!item.description && (
                <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
