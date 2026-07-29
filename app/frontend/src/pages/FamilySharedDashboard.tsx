import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import LockedFeatureModal from '@/components/LockedFeatureModal';
import { useNavigate } from 'react-router-dom';

// NOTE: no per-member worship stats here on purpose. This interface used to
// carry prayerStreak/quranPages, which were generated with Math.random() at
// invite time and then rendered as if they were that person's real prayer
// and Quran activity. Family members' actual worship data does not exist
// server-side yet, so it is simply unknown - and unknown is shown as unknown,
// never guessed at. Re-add these only when they can be read from real
// per-user server data.
interface FamilyMember {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
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
  const { tier, isTrialActive, loading: subLoading } = useSubscription();
  const hasAccess = tier === 'family' || isTrialActive;
  const [lockedModalOpen, setLockedModalOpen] = useState(true);
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

  // Financial summary from THIS DEVICE's own transactions only. This was
  // previously labelled "Combined Financial Summary", implying it aggregated
  // the whole family's finances - it never did. Transactions live in
  // localStorage per device, so there is nothing family-wide to combine until
  // transactions exist server-side. Labelled honestly in the UI below.
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

  // Accountability score, computed ONLY from data we genuinely have: this
  // user's own prayer streak and real progress on real shared goals.
  // Previously this averaged in every member's prayerStreak - i.e. the
  // Math.random() values above - and added a flat bonus per member, so
  // adding names to a local list inflated a number presented as a family
  // accountability measure. Other members' real activity is unknown until
  // per-user worship data exists server-side, so it is excluded rather than
  // estimated. Labelled in the UI as covering your own activity, not the
  // family's.
  const accountabilityScore = useMemo(() => {
    const myStreak = Number(localStorage.getItem('amanah-prayer-streak') || '0');
    const goalsProgress = sharedGoals.length > 0
      ? sharedGoals.reduce((sum, g) => sum + (g.target > 0 ? g.current / g.target : 0), 0) / sharedGoals.length
      : 0;
    return Math.min(100, Math.round((myStreak * 2) + (goalsProgress * 50)));
  }, [sharedGoals]);

  if (subLoading) return null;

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
        <PageHeader icon="👨‍👩‍👧" title={language === 'ar' ? 'لوحة العائلة' : 'Family Dashboard'} />
        <LockedFeatureModal
          open={lockedModalOpen}
          onOpenChange={(open) => {
            setLockedModalOpen(open);
            if (!open) navigate('/subscription');
          }}
          requiredPlan="family"
        />
        <main className="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center text-center">
          <span className="text-5xl mb-4">🔒</span>
          <p className="text-foreground font-semibold mb-2">
            {language === 'ar' ? 'ميزة مدفوعة' : 'Premium Feature'}
          </p>
          <p className="text-muted-foreground text-sm">
            {language === 'ar'
              ? 'لوحة العائلة متاحة في خطة أمانة العائلة.'
              : 'Family Dashboard is available in the Family Plan.'}
          </p>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="👨‍👩‍👧" title={language === 'ar' ? 'لوحة العائلة' : 'Family Dashboard'} />

      {/* Action Button */}
      <div className="max-w-4xl mx-auto px-4 pt-4 flex justify-end">
        <Button size="sm" onClick={() => setShowInvite(true)}>
          {language === 'ar' ? '+ إضافة' : '+ Add'}
        </Button>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Invite Modal */}
        {showInvite && (
          <Card className="p-4 border-primary/30 bg-card">
            <h3 className="font-semibold text-foreground mb-1">
              {language === 'ar' ? 'إضافة فرد من العائلة' : 'Add Family Member'}
            </h3>
            {/* No invite is actually sent - this only adds a name to this
                device's local list. Said plainly rather than labelling the
                button "Send Invite", which promised an email that never went. */}
            <p className="text-xs text-muted-foreground mb-3">
              {language === 'ar'
                ? 'يُضاف الاسم إلى قائمتك على هذا الجهاز. لا يتم إرسال دعوة بالبريد الإلكتروني بعد.'
                : "Adds the name to your list on this device. No email invite is sent yet."}
            </p>
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
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Device-local notice: this screen does not sync between family members yet. */}
        <Card className="p-3 border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {language === 'ar'
              ? 'ℹ️ تُحفظ بيانات لوحة العائلة على هذا الجهاز فقط في الوقت الحالي. لم تتم مشاركتها مع أفراد عائلتك بعد، ولا يمكن عرض نشاطهم الحقيقي هنا حتى الآن.'
              : "ℹ️ Family Dashboard data is currently stored on this device only. It isn't shared with your family members yet, and their real activity can't be shown here until it is."}
          </p>
        </Card>

        {/* Accountability Score - your own activity only, see comment on the useMemo above */}
        <Card className="p-5 bg-gradient-to-r from-primary/20 to-[#1FC7C1]/20 border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'نقاط مسؤوليتك' : 'Your Accountability Score'}
              </p>
              <p className="text-3xl font-bold text-primary mt-1">{accountabilityScore}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {language === 'ar'
                  ? 'استناداً إلى سلسلتك والأهداف المشتركة'
                  : 'Based on your own streak and shared goals'}
              </p>
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

        {/* Prayer Streak Comparison - intentionally NOT rendering per-member
            streaks. These were Math.random() values shown as real worship
            data. Restore a real comparison only once per-user prayer data is
            readable from the server for every member. */}
        {members.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {language === 'ar' ? '🕌 مقارنة سلسلة الصلاة' : '🕌 Prayer Streak Comparison'}
            </h2>
            <Card className="p-4 border-dashed">
              <p className="text-sm text-muted-foreground text-center">
                {language === 'ar' ? 'غير متاح بعد' : 'Not yet available'}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-2 leading-relaxed">
                {language === 'ar'
                  ? 'لا تتم مزامنة بيانات الصلاة بين أفراد العائلة بعد، لذا لا يمكن عرض سلاسلهم هنا.'
                  : "Prayer data isn't synced between family members yet, so their streaks can't be shown here."}
              </p>
            </Card>
          </div>
        )}

        {/* Financial summary - your own numbers only, NOT family-wide. See the
            comment on financialSummary above; there is nothing to combine
            until transactions exist server-side. */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {language === 'ar' ? '💰 ملخصي المالي' : '💰 My Financial Summary'}
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            {language === 'ar'
              ? 'بياناتك على هذا الجهاز فقط — لا تشمل أفراد العائلة الآخرين بعد.'
              : "Your own data on this device only - doesn't include other family members yet."}
          </p>
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