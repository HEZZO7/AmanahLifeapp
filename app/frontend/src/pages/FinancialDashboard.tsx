import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import PremiumGate from '@/components/PremiumGate';
import PageHeader from '@/components/PageHeader';

interface Transaction {
  type: string;
  amount: number;
  category?: string;
  date?: string;
}

export default function FinancialDashboard() {
  const { language } = useLanguage();

  const dashboardData = useMemo(() => {
    const transactions: Transaction[] = JSON.parse(localStorage.getItem('amanah-transactions') || '[]');
    const budgetData = JSON.parse(localStorage.getItem('amanah_family_budget') || '{}');

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const netWorth = totalIncome - totalExpenses + (budgetData.annualGoals?.savings || 0) * 0.1;
    const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = t.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (t.amount || 0);
      });

    // Monthly trend (last 6 months)
    const monthlyData: { month: string; income: number; expenses: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toISOString().slice(0, 7);
      const monthLabel = d.toLocaleDateString(language === 'ar' ? 'ar' : 'en', { month: 'short' });
      const monthIncome = transactions
        .filter(t => t.type === 'income' && t.date?.startsWith(monthStr))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const monthExpenses = transactions
        .filter(t => t.type === 'expense' && t.date?.startsWith(monthStr))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      monthlyData.push({ month: monthLabel, income: monthIncome, expenses: monthExpenses });
    }

    // Savings goals
    const goals = budgetData.annualGoals || { hajj: 20000, education: 15000, emergency: 10000, savings: 30000 };
    const saved = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, netWorth, savingsRate, categoryTotals, monthlyData, goals, saved };
  }, [language]);

  const maxCategory = Math.max(...Object.values(dashboardData.categoryTotals), 1);
  const maxMonthly = Math.max(
    ...dashboardData.monthlyData.map(m => Math.max(m.income, m.expenses)),
    1
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader icon="📊" title={language === 'ar' ? 'لوحة التحكم المالية' : 'Financial Dashboard'} />

      <main className="max-w-lg mx-auto px-4 py-4">
        <PremiumGate requiredTier="balanced" featureName={language === 'ar' ? 'لوحة التحكم المالية' : 'Financial Dashboard'}>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">💰 {language === 'ar' ? 'صافي الثروة' : 'Net Worth'}</p>
              <p className="text-xl font-bold text-[#D4A017]">{Math.round(dashboardData.netWorth).toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">📈 {language === 'ar' ? 'معدل التوفير' : 'Savings Rate'}</p>
              <p className={`text-xl font-bold ${dashboardData.savingsRate >= 20 ? 'text-primary' : 'text-red-400'}`}>
                {dashboardData.savingsRate}%
              </p>
              <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'شهري' : 'Monthly'}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">💵 {language === 'ar' ? 'إجمالي الدخل' : 'Total Income'}</p>
              <p className="text-xl font-bold text-primary">{dashboardData.totalIncome.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">🧾 {language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</p>
              <p className="text-xl font-bold text-red-400">{dashboardData.totalExpenses.toLocaleString()}</p>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="bg-card rounded-2xl border border-border p-4 mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {language === 'ar' ? '📊 توزيع المصروفات' : '📊 Expense Breakdown'}
            </h3>
            {Object.entries(dashboardData.categoryTotals).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {language === 'ar' ? 'لا توجد بيانات بعد' : 'No data yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(dashboardData.categoryTotals)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground">{cat}</span>
                        <span className="text-muted-foreground">{amount.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-[#D4A017] rounded-full"
                          style={{ width: `${(amount / maxCategory) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Monthly Trend */}
          <div className="bg-card rounded-2xl border border-border p-4 mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {language === 'ar' ? '📈 الاتجاه الشهري' : '📈 Monthly Trend'}
            </h3>
            <div className="space-y-3">
              {dashboardData.monthlyData.map((m, idx) => (
                <div key={idx}>
                  <p className="text-xs text-muted-foreground mb-1">{m.month}</p>
                  <div className="flex gap-1 items-center">
                    <div className="flex-1">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-0.5">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(m.income / maxMonthly) * 100}%` }} />
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(m.expenses / maxMonthly) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-[9px] text-muted-foreground w-16 text-right">
                      <p className="text-primary">{m.income}</p>
                      <p className="text-red-400">{m.expenses}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 justify-center">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 bg-primary rounded-full" /> {language === 'ar' ? 'دخل' : 'Income'}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 bg-red-400 rounded-full" /> {language === 'ar' ? 'مصروفات' : 'Expenses'}
              </span>
            </div>
          </div>

          {/* Savings Goals */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {language === 'ar' ? '🎯 أهداف التوفير' : '🎯 Savings Goals'}
            </h3>
            {Object.entries(dashboardData.goals).map(([key, target]) => {
              const labels: Record<string, { en: string; ar: string }> = {
                hajj: { en: 'Hajj Fund', ar: 'صندوق الحج' },
                education: { en: 'Education', ar: 'التعليم' },
                emergency: { en: 'Emergency', ar: 'الطوارئ' },
                savings: { en: 'General Savings', ar: 'التوفير العام' },
              };
              const label = labels[key] || { en: key, ar: key };
              const allocated = Math.round(dashboardData.saved * 0.25); // Split evenly
              const pct = Math.min(Math.round((allocated / (target as number)) * 100), 100);
              return (
                <div key={key} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground">{language === 'ar' ? label.ar : label.en}</span>
                    <span className="text-muted-foreground">{pct}% ({allocated.toLocaleString()}/{(target as number).toLocaleString()})</span>
                  </div>
                  <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-[#D4A017] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </PremiumGate>
      </main>

      <BottomNav />
    </div>
  );
}