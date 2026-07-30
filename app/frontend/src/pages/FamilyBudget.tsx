import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import LockedFeatureModal from '@/components/LockedFeatureModal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RATES,
  readLocal,
  writeLocal,
  mirrorToServer,
  hasUnclaimedLegacyBlob,
  describeLegacyBlob,
  claimLegacyBlob,
  declineLegacyBlob,
  type BudgetCategory,
  type FamilyBudgetData,
} from '@/lib/familyBudgetSync';

// Types, RATES and the local-storage helpers all live in lib/familyBudgetSync
// now, since the server mirror needs the same definitions and duplicating them
// is exactly how the two platforms drift apart.

const CURRENCIES = ['USD', 'EUR', 'GBP'];

const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { name: 'Housing', nameAr: 'السكن', icon: '🏠', budgeted: 2000, actual: 0 },
  { name: 'Food', nameAr: 'الطعام', icon: '🍽️', budgeted: 1500, actual: 0 },
  { name: 'Transport', nameAr: 'المواصلات', icon: '🚗', budgeted: 500, actual: 0 },
  { name: 'Education', nameAr: 'التعليم', icon: '📚', budgeted: 800, actual: 0 },
  { name: 'Healthcare', nameAr: 'الصحة', icon: '🏥', budgeted: 300, actual: 0 },
  { name: 'Charity', nameAr: 'الصدقة', icon: '🤲', budgeted: 500, actual: 0 },
  { name: 'Entertainment', nameAr: 'الترفيه', icon: '🎮', budgeted: 200, actual: 0 },
  { name: 'Utilities', nameAr: 'المرافق', icon: '💡', budgeted: 400, actual: 0 },
];

const EMPTY_DATA: FamilyBudgetData = {
  members: [],
  annualGoals: { hajj: 20000, education: 15000, emergency: 10000, savings: 30000 },
  monthlyBudget: 6200,
  categories: DEFAULT_CATEGORIES,
  income: [],
  expenses: [],
};

export default function FamilyBudget() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { tier, isTrialActive, loading: subLoading } = useSubscription();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const hasAccess = tier === 'family' || isTrialActive;
  const [lockedModalOpen, setLockedModalOpen] = useState(true);
  const [data, setData] = useState<FamilyBudgetData>(EMPTY_DATA);

  // Local storage is still the read source in this phase; the server mirror
  // below is write-only until step 2 flips reads over.
  const [loaded, setLoaded] = useState(false);
  const [legacyPrompt, setLegacyPrompt] = useState<{ members: number; income: number; expenses: number } | null>(null);

  useEffect(() => {
    setData(readLocal(userId) ?? EMPTY_DATA);
    setLegacyPrompt(hasUnclaimedLegacyBlob(userId) ? describeLegacyBlob() : null);
    setLoaded(true);
  }, [userId]);

  const [activeTab, setActiveTab] = useState<'family' | 'budget' | 'income' | 'expenses'>('budget');
  const [newMember, setNewMember] = useState({ name: '', role: '' });
  const [newIncome, setNewIncome] = useState({ source: '', amount: '', currency: 'USD' });
  const [newExpense, setNewExpense] = useState({ category: 'Housing', description: '', amount: '', currency: 'USD' });

  useEffect(() => {
    if (!loaded) return;
    writeLocal(userId, data);
  }, [data, userId, loaded]);

  // Server mirror (Phase B step 1). Debounced so typing into the budget does
  // not fire a request per keystroke, and deliberately silent: a failure here
  // must never change what the user sees, because local storage is still the
  // source of truth. Failures are logged for diagnosis only.
  const mirrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded || !userId || !hasAccess) return;
    if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
    mirrorTimer.current = setTimeout(() => {
      mirrorToServer(userId, data).then((res) => {
        if (!res.ok) console.warn('[FamilyBudget] server mirror failed:', res.error);
      });
    }, 1500);
    return () => {
      if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
    };
  }, [data, userId, loaded, hasAccess]);

  const handleClaimLegacy = () => {
    const claimed = claimLegacyBlob(userId);
    if (claimed) setData(claimed);
    setLegacyPrompt(null);
  };

  const handleDeclineLegacy = () => {
    declineLegacyBlob(userId);
    setLegacyPrompt(null);
  };

  const addMember = () => {
    if (!newMember.name) return;
    setData(prev => ({
      ...prev,
      members: [...prev.members, { id: Date.now().toString(), ...newMember }],
    }));
    setNewMember({ name: '', role: '' });
  };

  const removeMember = (id: string) => {
    setData(prev => ({ ...prev, members: prev.members.filter(m => m.id !== id) }));
  };

  const addIncome = () => {
    if (!newIncome.source || !newIncome.amount) return;
    setData(prev => ({
      ...prev,
      income: [...prev.income, {
        id: Date.now().toString(),
        source: newIncome.source,
        amount: parseFloat(newIncome.amount),
        currency: newIncome.currency,
        date: new Date().toISOString().split('T')[0],
      }],
    }));
    setNewIncome({ source: '', amount: '', currency: 'USD' });
  };

  const addExpense = () => {
    if (!newExpense.description || !newExpense.amount) return;
    const amt = parseFloat(newExpense.amount);
    setData(prev => ({
      ...prev,
      expenses: [...prev.expenses, {
        id: Date.now().toString(),
        category: newExpense.category,
        description: newExpense.description,
        amount: amt,
        currency: newExpense.currency,
        date: new Date().toISOString().split('T')[0],
      }],
      categories: prev.categories.map(c =>
        c.name === newExpense.category ? { ...c, actual: c.actual + amt * (RATES[newExpense.currency] || 1) } : c
      ),
    }));
    setNewExpense({ category: 'Housing', description: '', amount: '', currency: 'USD' });
  };

  const totalIncome = data.income.reduce((sum, i) => sum + i.amount * (RATES[i.currency] || 1), 0);
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount * (RATES[e.currency] || 1), 0);



  const tabs = [
    { key: 'family' as const, label: language === 'ar' ? 'العائلة' : 'Family', icon: '👨‍👩‍👧‍👦' },
    { key: 'budget' as const, label: language === 'ar' ? 'الميزانية' : 'Budget', icon: '📊' },
    { key: 'income' as const, label: language === 'ar' ? 'الدخل' : 'Income', icon: '💵' },
    { key: 'expenses' as const, label: language === 'ar' ? 'المصروفات' : 'Expenses', icon: '🧾' },
  ];

  if (subLoading) return null;

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader icon="👨‍👩‍👧‍👦" title={language === 'ar' ? 'ميزانية العائلة' : 'Family Budget'} />
        <LockedFeatureModal
          open={lockedModalOpen}
          onOpenChange={(open) => {
            setLockedModalOpen(open);
            if (!open) navigate('/subscription');
          }}
          requiredPlan="family"
        />
        <main className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center text-center">
          <span className="text-5xl mb-4">🔒</span>
          <p className="text-foreground font-semibold mb-2">
            {language === 'ar' ? 'ميزة مدفوعة' : 'Premium Feature'}
          </p>
          <p className="text-muted-foreground text-sm">
            {language === 'ar'
              ? 'ميزانية العائلة متاحة في خطة أمانة العائلة.'
              : 'Family Budget is available in the Family Plan.'}
          </p>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader icon="👨‍👩‍👧‍👦" title={language === 'ar' ? 'ميزانية العائلة' : 'Family Budget'} />

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* One-time prompt for a pre-existing, unscoped local budget.
            The old storage key recorded no owner, so on a shared browser this
            data may belong to a different account. It holds real salary and
            expense figures and is about to be mirrored to a shared, server-side
            family record, so it is never claimed automatically - the user has
            to say it is theirs. Declining leaves the data untouched for its
            actual owner to claim when they next sign in. */}
        {legacyPrompt && (
          <Card className="p-4 mb-4 border-primary/40 bg-primary/5">
            <p className="font-semibold text-foreground text-sm mb-1">
              {language === 'ar' ? 'وجدنا ميزانية عائلية على هذا الجهاز' : 'We found a family budget saved on this device'}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              {language === 'ar'
                ? 'قد تكون هذه البيانات لحساب آخر استخدم هذا المتصفح. لن نضيفها إلى حسابك إلا إذا أكدت أنها لك.'
                : "It may belong to another account that used this browser. We won't add it to your account unless you confirm it's yours."}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {language === 'ar'
                ? `تحتوي على ${legacyPrompt.members} فرد، و${legacyPrompt.income} دخل، و${legacyPrompt.expenses} مصروف.`
                : `It contains ${legacyPrompt.members} member(s), ${legacyPrompt.income} income entr(ies) and ${legacyPrompt.expenses} expense(s).`}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleClaimLegacy}>
                {language === 'ar' ? 'نعم، هذه بياناتي' : "Yes, this is mine"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDeclineLegacy}>
                {language === 'ar' ? 'ليست لي' : "Not mine"}
              </Button>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-card text-muted-foreground border border-border'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'الدخل' : 'Income'}</p>
            <p className="text-sm font-bold text-primary">{Math.round(totalIncome).toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'المصروفات' : 'Expenses'}</p>
            <p className="text-sm font-bold text-red-400">{Math.round(totalExpenses).toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'المتبقي' : 'Balance'}</p>
            <p className={`text-sm font-bold ${totalIncome - totalExpenses >= 0 ? 'text-[#D4A017]' : 'text-red-400'}`}>
              {Math.round(totalIncome - totalExpenses).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Family Tab */}
        {activeTab === 'family' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {language === 'ar' ? 'أفراد العائلة' : 'Family Members'}
              </h3>
              {data.members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                  <button onClick={() => removeMember(m.id)} className="text-red-400 text-xs">✕</button>
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <input
                  value={newMember.name}
                  onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                  placeholder={language === 'ar' ? 'الاسم' : 'Name'}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground"
                />
                <input
                  value={newMember.role}
                  onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}
                  placeholder={language === 'ar' ? 'الدور' : 'Role'}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground"
                />
                <button onClick={addMember} className="bg-primary text-white px-3 py-2 rounded-lg text-xs font-medium">+</button>
              </div>
            </div>

            {/* Annual Goals */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {language === 'ar' ? '🎯 الأهداف السنوية' : '🎯 Annual Goals'}
              </h3>
              {Object.entries(data.annualGoals).map(([key, value]) => {
                const labels: Record<string, { en: string; ar: string; icon: string }> = {
                  hajj: { en: 'Hajj Fund', ar: 'صندوق الحج', icon: '🕋' },
                  education: { en: 'Education', ar: 'التعليم', icon: '🎓' },
                  emergency: { en: 'Emergency', ar: 'الطوارئ', icon: '🚨' },
                  savings: { en: 'Savings', ar: 'التوفير', icon: '🏦' },
                };
                const label = labels[key];
                const progress = Math.min((totalIncome * 0.1) / value * 100, 100); // simplified
                return (
                  <div key={key} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground">{label.icon} {language === 'ar' ? label.ar : label.en}</span>
                      <span className="text-muted-foreground">{value.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Budget Tab */}
        {activeTab === 'budget' && (
          <div className="space-y-3">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {language === 'ar' ? 'الميزانية الشهرية' : 'Monthly Budget'}
              </h3>
              {data.categories.map((cat, idx) => {
                const pct = cat.budgeted > 0 ? Math.min((cat.actual / cat.budgeted) * 100, 100) : 0;
                const over = cat.actual > cat.budgeted;
                return (
                  <div key={idx} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground">{cat.icon} {language === 'ar' ? cat.nameAr : cat.name}</span>
                      <span className={over ? 'text-red-400' : 'text-muted-foreground'}>
                        {Math.round(cat.actual).toLocaleString()}/{cat.budgeted.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${over ? 'bg-red-400' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Income Tab */}
        {activeTab === 'income' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {language === 'ar' ? 'إضافة دخل' : 'Add Income'}
              </h3>
              <div className="space-y-2">
                <input
                  value={newIncome.source}
                  onChange={e => setNewIncome(p => ({ ...p, source: e.target.value }))}
                  placeholder={language === 'ar' ? 'المصدر' : 'Source'}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newIncome.amount}
                    onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))}
                    placeholder={language === 'ar' ? 'المبلغ' : 'Amount'}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                  <select
                    value={newIncome.currency}
                    onChange={e => setNewIncome(p => ({ ...p, currency: e.target.value }))}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={addIncome} className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium">
                  {language === 'ar' ? 'إضافة' : 'Add Income'}
                </button>
              </div>
            </div>

            {/* Income List */}
            <div className="space-y-2">
              {data.income.slice().reverse().map(entry => (
                <div key={entry.id} className="bg-card rounded-xl border border-border p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-foreground">{entry.source}</p>
                    <p className="text-xs text-muted-foreground">{entry.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">+{entry.amount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {language === 'ar' ? 'إضافة مصروف' : 'Add Expense'}
              </h3>
              <div className="space-y-2">
                <select
                  value={newExpense.category}
                  onChange={e => setNewExpense(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  {data.categories.map(c => (
                    <option key={c.name} value={c.name}>{c.icon} {language === 'ar' ? c.nameAr : c.name}</option>
                  ))}
                </select>
                <input
                  value={newExpense.description}
                  onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))}
                  placeholder={language === 'ar' ? 'الوصف' : 'Description'}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))}
                    placeholder={language === 'ar' ? 'المبلغ' : 'Amount'}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                  <select
                    value={newExpense.currency}
                    onChange={e => setNewExpense(p => ({ ...p, currency: e.target.value }))}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={addExpense} className="w-full bg-red-500/80 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium">
                  {language === 'ar' ? 'إضافة مصروف' : 'Add Expense'}
                </button>
              </div>
            </div>

            {/* Expenses List */}
            <div className="space-y-2">
              {data.expenses.slice().reverse().map(entry => (
                <div key={entry.id} className="bg-card rounded-xl border border-border p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-foreground">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{entry.category} • {entry.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-400">-{entry.amount.toLocaleString()}</p>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}