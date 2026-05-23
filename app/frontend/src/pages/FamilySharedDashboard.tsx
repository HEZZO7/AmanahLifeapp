import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  prayerStreak: number;
  quranPages: number;
}

interface SharedGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  category: string;
}

const STORAGE_KEY = 'amanah-family-members';
const SHARED_GOALS_KEY = 'amanah-family-shared-goals';

export default function FamilySharedDashboard() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCategory, setGoalCategory] = useState('savings');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setMembers(JSON.parse(saved));
    const savedGoals = localStorage.getItem(SHARED_GOALS_KEY);
    if (savedGoals) setSharedGoals(JSON.parse(savedGoals));
  }, []);

  const saveMembers = (updated: FamilyMember[]) => {
    setMembers(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const saveGoals = (updated: SharedGoal[]) => {
    setSharedGoals(updated);
    localStorage.setItem(SHARED_GOALS_KEY, JSON.stringify(updated));
  };

  const handleInvite = () => {
    if (!inviteName.trim()) return;
    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      joinedAt: new Date().toISOString(),
      prayerStreak: Math.floor(Math.random() * 30) + 1,
      quranPages: Math.floor(Math.random() * 50) + 5,
    };
    saveMembers([...members, newMember]);
    setInviteName('');
    setInviteEmail('');
    setShowInvite(false);
  };

  const handleAddGoal = () => {
    if (!goalTitle.trim() || !goalTarget) return;
    const newGoal: SharedGoal = {
      id: Date.now().toString(),
      title: goalTitle.trim(),
      target: Number(goalTarget),
      current: 0,
      category: goalCategory,
    };
    saveGoals([...sharedGoals, newGoal]);
    setGoalTitle('');
    setGoalTarget('');
    setShowAddGoal(false);
  };

  const removeMember = (id: string) => {
    saveMembers(members.filter(m => m.id !== id));
  };

  // Combined financial summary from existing transactions
  const financialSummary = useMemo(() => {
    const transactions = JSON.parse(localStorage.getItem('amanah-transactions') || '[]');
    const totalIncome = transactions
      .filter((t: { type?: string }) => t.type === 'income')
      .reduce((sum: number, t: { amount?: number }) => sum + (t.amount || 0), 0);
    const totalExpense = transactions
      .filter((t: { type?: string }) => t.type === 'expense')
      .reduce((sum: number, t: { amount?: number }) => sum + (t.amount || 0), 0);
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }, []);

  // Read existing goals
  const existingGoals = useMemo(() => {
    const goals = JSON.parse(localStorage.getItem('amanah-goals') || '[]');
    return goals.slice(0, 5);
  }, []);

  // Accountability score
  const accountabilityScore = useMemo(() => {
    const myStreak = Number(localStorage.getItem('amanah-prayer-streak') || '0');
    const avgStreak = members.length > 0
      ? members.reduce((sum, m) => sum + m.prayerStreak, myStreak) / (members.length + 1)
      : myStreak;
    const goalsProgress = sharedGoals.length > 0
      ? sharedGoals.reduce((sum, g) => sum + (g.target > 0 ? g.current / g.target : 0), 0) / sharedGoals.length
      : 0;
    return Math.min(100, Math.round((avgStreak * 2) + (goalsProgress * 50) + (members.length * 5)));
  }, [members, sharedGoals]);

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="👨‍👩‍👧" title={language === 'ar' ? 'لوحة العائلة' : 'Family Dashboard'} />

      {/* Action Button */}
      <div className="max-w-4xl mx-auto px-4 pt-4 flex justify-end">
        <Button size="sm" onClick={() => setShowInvite(true)}>
          {language === 'ar' ? '+ دعوة' : '+ Invite'}
        </Button>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Invite Modal */}
        {showInvite && (
          <Card className="p-4 border-primary/30 bg-card">
            <h3 className="font-semibold text-foreground mb-3">
              {language === 'ar' ? 'دعوة فرد من العائلة' : 'Invite Family Member'}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder={language === 'ar' ? 'الاسم' : 'Name'}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <input
                type="email"
                placeholder={language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInvite}>
                  {language === 'ar' ? 'إرسال دعوة' : 'Send Invite'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Accountability Score */}
        <Card className="p-5 bg-gradient-to-r from-primary/20 to-[#1FC7C1]/20 border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'نقاط المسؤولية العائلية' : 'Family Accountability Score'}
              </p>
              <p className="text-3xl font-bold text-primary mt-1">{accountabilityScore}%</p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-primary flex items-center justify-center">
              <span className="text-2xl">🏆</span>
            </div>
          </div>
        </Card>

        {/* Family Members */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {language === 'ar' ? 'أفراد العائلة' : 'Family Members'} ({members.length + 1})
          </h2>
          <div className="space-y-2">
            {/* Current user */}
            <Card className="p-3 border-primary/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">👤</div>
                  <div>
                    <p className="font-medium text-foreground">{language === 'ar' ? 'أنا' : 'You'}</p>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المسؤول' : 'Admin'}</p>
                  </div>
                </div>
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                  {language === 'ar' ? 'مسؤول' : 'Owner'}
                </span>
              </div>
            </Card>
            {members.map(member => (
              <Card key={member.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4A017]/20 flex items-center justify-center text-lg">👤</div>
                    <div>
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email || (language === 'ar' ? 'بدون بريد' : 'No email')}</p>
                    </div>
                  </div>
                  <button onClick={() => removeMember(member.id)} className="text-red-400 text-xs hover:text-red-300">
                    {language === 'ar' ? 'إزالة' : 'Remove'}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Prayer Streak Comparison */}
        {members.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {language === 'ar' ? '🕌 مقارنة سلسلة الصلاة' : '🕌 Prayer Streak Comparison'}
            </h2>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{language === 'ar' ? 'أنا' : 'You'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '60%' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">🔥</span>
                  </div>
                </div>
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{member.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#D4A017] rounded-full"
                          style={{ width: `${Math.min(100, member.prayerStreak * 3.3)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{member.prayerStreak}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Combined Financial Summary */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {language === 'ar' ? '💰 الملخص المالي المشترك' : '💰 Combined Financial Summary'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'الدخل' : 'Income'}</p>
              <p className="text-lg font-bold text-primary">{financialSummary.totalIncome}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المصروفات' : 'Expenses'}</p>
              <p className="text-lg font-bold text-red-400">{financialSummary.totalExpense}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'الرصيد' : 'Balance'}</p>
              <p className="text-lg font-bold text-[#D4A017]">{financialSummary.balance}</p>
            </Card>
          </div>
        </div>

        {/* Shared Goals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">
              {language === 'ar' ? '🎯 الأهداف المشتركة' : '🎯 Shared Goals'}
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowAddGoal(true)}>
              {language === 'ar' ? '+ هدف' : '+ Goal'}
            </Button>
          </div>

          {showAddGoal && (
            <Card className="p-4 mb-3 border-primary/30">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'عنوان الهدف' : 'Goal title'}
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
                <input
                  type="number"
                  placeholder={language === 'ar' ? 'المبلغ المستهدف' : 'Target amount'}
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                >
                  <option value="savings">{language === 'ar' ? 'ادخار' : 'Savings'}</option>
                  <option value="charity">{language === 'ar' ? 'صدقة' : 'Charity'}</option>
                  <option value="education">{language === 'ar' ? 'تعليم' : 'Education'}</option>
                  <option value="hajj">{language === 'ar' ? 'حج/عمرة' : 'Hajj/Umrah'}</option>
                </select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddGoal}>
                    {language === 'ar' ? 'إضافة' : 'Add'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddGoal(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {sharedGoals.map(goal => (
              <Card key={goal.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground text-sm">{goal.title}</span>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{goal.category}</span>
                </div>
                <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {goal.current} / {goal.target}
                </p>
              </Card>
            ))}
            {sharedGoals.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">
                {language === 'ar' ? 'لا توجد أهداف مشتركة بعد' : 'No shared goals yet'}
              </p>
            )}
          </div>
        </div>

        {/* Individual Goals from existing data */}
        {existingGoals.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {language === 'ar' ? '📋 أهدافي الشخصية' : '📋 My Personal Goals'}
            </h2>
            <div className="space-y-2">
              {existingGoals.map((goal: { id?: string; title?: string; status?: string }, idx: number) => (
                <Card key={goal.id || idx} className="p-3 flex items-center justify-between">
                  <span className="text-sm text-foreground">{goal.title || 'Goal'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    goal.status === 'Active' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {goal.status || 'Active'}
                  </span>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}