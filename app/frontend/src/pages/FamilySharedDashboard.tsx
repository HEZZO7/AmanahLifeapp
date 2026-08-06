import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import LockedFeatureModal from '@/components/LockedFeatureModal';
import { useNavigate } from 'react-router-dom';

// Membership (who's in the family, their role/age group) is REAL as of this
// pass - backed by app_11941c8fec_families / app_11941c8fec_family_members
// via the app_11941c8fec_family_invite Edge Function. Shared Goals below are
// still device-local only (explicitly out of scope for this pass - no
// migration was requested for them), so they carry their own disclaimer now
// that the surrounding membership data is real; leaving them unlabeled next
// to a real member list would wrongly imply they're actually shared.
const FAMILIES_TABLE = 'app_11941c8fec_families';
const MEMBERS_TABLE = 'app_11941c8fec_family_members';
const FAMILY_INVITE_ENDPOINT = 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_family_invite';

type AgeGroup = 'adult' | 'minor';

interface FamilyMember {
  id: string;
  user_id: string | null;
  display_name: string;
  member_role: 'owner' | 'member';
  age_group: AgeGroup;
  household_role: string | null;
}

interface FamilyRecord {
  id: string;
  name: string;
  join_code: string;
  owner_user_id: string;
}

interface SharedGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  category: string;
}

const SHARED_GOALS_KEY = 'amanah-family-shared-goals';

export default function FamilySharedDashboard() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, isTrialActive, loading: subLoading } = useSubscription();
  const hasAccess = tier === 'family' || isTrialActive;
  const [lockedModalOpen, setLockedModalOpen] = useState(true);

  const [familyLoading, setFamilyLoading] = useState(true);
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [myMembership, setMyMembership] = useState<FamilyMember | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [joinAgeGroup, setJoinAgeGroup] = useState<AgeGroup>('adult');
  const [joinHouseholdRole, setJoinHouseholdRole] = useState('');
  const [joining, setJoining] = useState(false);

  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCategory, setGoalCategory] = useState('savings');

  const loadFamily = useCallback(async () => {
    if (!user) return;
    setFamilyLoading(true);
    try {
      const { data: myRows } = await supabase
        .from(MEMBERS_TABLE)
        .select('id, user_id, display_name, member_role, age_group, household_role, family_id')
        .eq('user_id', user.id);

      if (!myRows || myRows.length === 0) {
        setFamily(null);
        setMembers([]);
        setMyMembership(null);
        return;
      }

      const mine = myRows[0];
      setMyMembership(mine);

      const [{ data: familyRow }, { data: roster }] = await Promise.all([
        supabase.from(FAMILIES_TABLE).select('id, name, join_code, owner_user_id').eq('id', mine.family_id).maybeSingle(),
        supabase.from(MEMBERS_TABLE).select('id, user_id, display_name, member_role, age_group, household_role').eq('family_id', mine.family_id),
      ]);

      setFamily(familyRow || null);
      setMembers(roster || []);
    } finally {
      setFamilyLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFamily();
    const savedGoals = localStorage.getItem(SHARED_GOALS_KEY);
    if (savedGoals) setSharedGoals(JSON.parse(savedGoals));
  }, [loadFamily]);

  const saveGoals = (updated: SharedGoal[]) => {
    setSharedGoals(updated);
    localStorage.setItem(SHARED_GOALS_KEY, JSON.stringify(updated));
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || sendingInvite) return;
    setSendingInvite(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first'); return; }

      const response = await fetch(FAMILY_INVITE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'send', email: inviteEmail.trim(), language }),
      });
      const data = await response.json();

      if (!response.ok || data.error === 'family_plan_required') {
        toast.error(language === 'ar' ? 'دعوة أفراد العائلة متاحة في خطة أمانة العائلة' : 'Inviting family members requires the Family Plan');
        return;
      }
      if (data.error) {
        toast.error(language === 'ar' ? 'تعذّر إرسال الدعوة' : 'Could not send the invite');
        return;
      }

      if (data.emailSent) {
        toast.success(language === 'ar' ? 'تم إرسال الدعوة' : 'Invite sent');
      } else {
        toast.success(
          language === 'ar'
            ? `شارك هذا الرمز مع أفراد عائلتك: ${data.joinCode}`
            : `Share this code with your family member: ${data.joinCode}`
        );
      }
      setInviteEmail('');
      setShowInvite(false);
      loadFamily();
    } catch {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء إرسال الدعوة' : 'Something went wrong sending the invite');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !joinDisplayName.trim() || joining) return;
    setJoining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first'); return; }

      const response = await fetch(FAMILY_INVITE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: 'accept',
          joinCode: joinCode.trim(),
          displayName: joinDisplayName.trim(),
          ageGroup: joinAgeGroup,
          householdRole: joinHouseholdRole.trim() || undefined,
          language,
        }),
      });
      const data = await response.json();

      if (data.error === 'invalid_code') {
        toast.error(language === 'ar' ? 'رمز الانضمام غير صحيح' : 'Invalid join code');
        return;
      }
      if (data.error === 'already_member') {
        toast.error(language === 'ar' ? 'أنت عضو بالفعل في هذه العائلة' : "You're already a member of this family");
        loadFamily();
        return;
      }
      if (!response.ok || data.error) {
        toast.error(language === 'ar' ? 'تعذّر الانضمام إلى العائلة' : 'Could not join the family');
        return;
      }

      toast.success(language === 'ar' ? 'تم الانضمام إلى العائلة' : 'Joined the family');
      setShowJoin(false);
      setJoinCode('');
      setJoinDisplayName('');
      setJoinHouseholdRole('');
      loadFamily();
    } catch {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الانضمام' : 'Something went wrong joining');
    } finally {
      setJoining(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    // RLS (family_members_delete_if_owner_or_self) already allows exactly
    // this: the family owner can remove anyone, any member can remove
    // themselves - no edge function needed for this one.
    const { error } = await supabase.from(MEMBERS_TABLE).delete().eq('id', memberId);
    if (error) {
      toast.error(language === 'ar' ? 'تعذّرت الإزالة' : 'Could not remove member');
      return;
    }
    loadFamily();
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

  // Financial summary from THIS DEVICE's own transactions only. This was
  // previously labelled "Combined Financial Summary", implying it aggregated
  // the whole family's finances - it never did, and still doesn't (Family
  // Budget data stays deliberately separate from this dashboard per
  // instruction). Transactions live in localStorage per device.
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

  const existingGoals = useMemo(() => {
    const goals = JSON.parse(localStorage.getItem('amanah-goals') || '[]');
    return goals.slice(0, 5);
  }, []);

  // Accountability score, computed ONLY from data we genuinely have: this
  // user's own prayer streak and real progress on real shared goals. Other
  // members' real activity is unknown until per-user worship data exists
  // server-side (see PROJECT.md's Family Dashboard activity-data migration
  // sizing note), so it stays excluded rather than estimated.
  const accountabilityScore = useMemo(() => {
    const myStreak = Number(localStorage.getItem('amanah-prayer-streak') || '0');
    const goalsProgress = sharedGoals.length > 0
      ? sharedGoals.reduce((sum, g) => sum + (g.target > 0 ? g.current / g.target : 0), 0) / sharedGoals.length
      : 0;
    return Math.min(100, Math.round((myStreak * 2) + (goalsProgress * 50)));
  }, [sharedGoals]);

  const isOwner = myMembership?.member_role === 'owner';
  const roleLabel = (m: FamilyMember) => {
    if (m.household_role) return m.household_role;
    return m.member_role === 'owner' ? (language === 'ar' ? 'المسؤول' : 'Admin') : (language === 'ar' ? 'عضو' : 'Member');
  };
  const ageGroupLabel = (g: AgeGroup) => (g === 'minor' ? (language === 'ar' ? 'قاصر' : 'Minor') : (language === 'ar' ? 'بالغ' : 'Adult'));

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

      {!familyLoading && family && (
        <div className="max-w-4xl mx-auto px-4 pt-4 flex justify-end">
          <Button size="sm" onClick={() => setShowInvite(true)}>
            {language === 'ar' ? '+ دعوة' : '+ Invite'}
          </Button>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {familyLoading && (
          <p className="text-center text-muted-foreground text-sm py-8">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        )}

        {/* No family yet: create one by inviting, or join an existing one via code */}
        {!familyLoading && !family && (
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {language === 'ar' ? 'ابدأ عائلتك' : 'Start Your Family'}
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                {language === 'ar'
                  ? 'ادعُ فرداً من العائلة بالبريد الإلكتروني لإنشاء عائلتك.'
                  : 'Invite a family member by email to create your family.'}
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
                <Button size="sm" onClick={handleSendInvite} disabled={sendingInvite}>
                  {language === 'ar' ? 'دعوة' : 'Invite'}
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {language === 'ar' ? 'لديك رمز دعوة؟' : 'Have an invite code?'}
              </h3>
              {!showJoin ? (
                <Button size="sm" variant="outline" onClick={() => setShowJoin(true)}>
                  {language === 'ar' ? 'الانضمام إلى عائلة' : 'Join a Family'}
                </Button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'رمز الانضمام' : 'Join code'}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm uppercase"
                  />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'اسمك' : 'Your name'}
                    value={joinDisplayName}
                    onChange={(e) => setJoinDisplayName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                  />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'صلة القرابة (اختياري، مثال: ابنة)' : 'Relationship (optional, e.g. Daughter)'}
                    value={joinHouseholdRole}
                    onChange={(e) => setJoinHouseholdRole(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setJoinAgeGroup('adult')}
                      className={`flex-1 py-2 rounded-lg text-sm border ${joinAgeGroup === 'adult' ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground'}`}
                    >
                      {language === 'ar' ? 'بالغ' : 'Adult'}
                    </button>
                    <button
                      onClick={() => setJoinAgeGroup('minor')}
                      className={`flex-1 py-2 rounded-lg text-sm border ${joinAgeGroup === 'minor' ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground'}`}
                    >
                      {language === 'ar' ? 'قاصر' : 'Minor'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleJoin} disabled={joining}>
                      {language === 'ar' ? 'انضمام' : 'Join'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowJoin(false)}>
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {!familyLoading && family && (
          <>
            {/* Invite Modal */}
            {showInvite && (
              <Card className="p-4 border-primary/30 bg-card">
                <h3 className="font-semibold text-foreground mb-1">
                  {language === 'ar' ? 'دعوة فرد من العائلة' : 'Invite a Family Member'}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {language === 'ar'
                    ? 'سيتلقون بريداً إلكترونياً برمز انضمام حقيقي.'
                    : "They'll receive a real email with a join code."}
                </p>
                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder={language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSendInvite} disabled={sendingInvite}>
                      {language === 'ar' ? 'إرسال' : 'Send'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

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

            {/* Family Members - real, synced via app_11941c8fec_family_members */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                {language === 'ar' ? 'أفراد العائلة' : 'Family Members'} ({members.length})
              </h2>
              <div className="space-y-2">
                {members.map(member => (
                  <Card key={member.id} className={member.user_id === user?.id ? 'p-3 border-primary/30' : 'p-3'}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">👤</div>
                        <div>
                          <p className="font-medium text-foreground">
                            {member.user_id === user?.id ? (language === 'ar' ? 'أنا' : 'You') : member.display_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {roleLabel(member)} · {ageGroupLabel(member.age_group)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                          {member.member_role === 'owner' ? (language === 'ar' ? 'مسؤول' : 'Owner') : (language === 'ar' ? 'عضو' : 'Member')}
                        </span>
                        {(isOwner || member.user_id === user?.id) && member.member_role !== 'owner' && (
                          <button onClick={() => handleRemoveMember(member.id)} className="text-red-400 text-xs hover:text-red-300">
                            {language === 'ar' ? 'إزالة' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Prayer Streak Comparison - intentionally NOT rendering per-member
                streaks. Real weekly worship comparison needs prayer/Quran/
                fasting/task completion to exist server-side per user, which
                it doesn't yet (see PROJECT.md sizing note) - membership being
                real doesn't change that. */}
            {members.length > 1 && (
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
          </>
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

        {/* Shared Goals - still device-local only, NOT actually synced to
            other family members even though membership above now is real.
            Disclaimer is load-bearing, not decorative - see the file header
            comment. */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-foreground">
              {language === 'ar' ? '🎯 الأهداف المشتركة' : '🎯 Shared Goals'}
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowAddGoal(true)}>
              {language === 'ar' ? '+ هدف' : '+ Goal'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {language === 'ar'
              ? 'تُحفظ هذه الأهداف على هذا الجهاز فقط ولا تُشارك مع أفراد العائلة بعد.'
              : "These goals are saved on this device only and aren't actually shared with family members yet."}
          </p>

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
