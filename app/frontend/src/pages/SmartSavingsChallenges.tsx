import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import PremiumGate from '@/components/PremiumGate';
import { useSavingsNotifications } from '@/hooks/useSavingsNotifications';
import { useDailySavingsTip } from '@/hooks/useDailySavingsTip';
import EmailDigestToggle from '@/components/EmailDigestToggle';

interface Challenge {
  id: string;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  duration: number; // days
  targetAmount: number;
  icon: string;
  milestones: number[]; // percentages
}

interface JoinedChallenge {
  challengeId: string;
  joinedAt: string;
  savedAmount: number;
  completedMilestones: number[];
}

const STORAGE_KEY = 'amanah-savings-challenges';

function getDaysRemainingStatic(joinedAt: string, duration: number): number {
  const start = new Date(joinedAt).getTime();
  const end = start + duration * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}

const CHALLENGES: Challenge[] = [
  {
    id: '52-week',
    titleEn: '52-Week Challenge',
    titleAr: 'تحدي 52 أسبوع',
    descEn: 'Save incrementally each week. Week 1 = $1, Week 2 = $2... Week 52 = $52. Total: $1,378!',
    descAr: 'ادخر بشكل تصاعدي كل أسبوع. الأسبوع 1 = 1$، الأسبوع 2 = 2$... الأسبوع 52 = 52$. المجموع: 1,378$!',
    duration: 364,
    targetAmount: 1378,
    icon: '📅',
    milestones: [25, 50, 75, 100],
  },
  {
    id: 'no-spend',
    titleEn: 'No-Spend Week',
    titleAr: 'أسبوع بدون إنفاق',
    descEn: 'Challenge yourself to spend nothing on non-essentials for 7 days. Track what you save!',
    descAr: 'تحدَّ نفسك بعدم الإنفاق على غير الضروريات لمدة 7 أيام. تتبع ما توفره!',
    duration: 7,
    targetAmount: 200,
    icon: '🚫',
    milestones: [25, 50, 75, 100],
  },
  {
    id: 'round-up',
    titleEn: 'Round-Up Savings',
    titleAr: 'ادخار التقريب',
    descEn: 'Round up every purchase to the nearest dollar and save the difference. 30-day challenge!',
    descAr: 'قرّب كل عملية شراء لأقرب وحدة وادخر الفرق. تحدي 30 يوم!',
    duration: 30,
    targetAmount: 150,
    icon: '🔄',
    milestones: [25, 50, 75, 100],
  },
  {
    id: 'emergency-fund',
    titleEn: 'Emergency Fund Sprint',
    titleAr: 'سباق صندوق الطوارئ',
    descEn: 'Build a 1-month emergency fund in 90 days. Save a fixed amount daily!',
    descAr: 'ابنِ صندوق طوارئ لشهر واحد في 90 يوماً. ادخر مبلغاً ثابتاً يومياً!',
    duration: 90,
    targetAmount: 3000,
    icon: '🏃',
    milestones: [25, 50, 75, 100],
  },
  {
    id: 'ramadan-savings',
    titleEn: 'Ramadan Savings',
    titleAr: 'ادخار رمضان',
    descEn: 'Save for Ramadan expenses and charity. 30 days of intentional saving for the blessed month.',
    descAr: 'ادخر لمصاريف رمضان والصدقة. 30 يوماً من الادخار المقصود للشهر المبارك.',
    duration: 30,
    targetAmount: 500,
    icon: '🌙',
    milestones: [25, 50, 75, 100],
  },
];

export default function SmartSavingsChallenges() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [joinedChallenges, setJoinedChallenges] = useState<JoinedChallenge[]>([]);
  const [celebratingMilestone, setCelebratingMilestone] = useState<string | null>(null);
  const [addAmountId, setAddAmountId] = useState<string | null>(null);
  const [addValue, setAddValue] = useState('');
  const {
    permissionStatus,
    isEnabled: notificationsEnabled,
    enableNotifications,
    disableNotifications,
    celebrateMilestone: notifyCelebrateMilestone,
  } = useSavingsNotifications(language);

  const tipChallenges = useMemo(() => {
    return joinedChallenges.map(j => {
      const challenge = CHALLENGES.find(c => c.id === j.challengeId);
      if (!challenge) return null;
      const daysRemaining = getDaysRemainingStatic(j.joinedAt, challenge.duration);
      const progress = Math.min(100, Math.round((j.savedAmount / challenge.targetAmount) * 100));
      return {
        id: challenge.id,
        title: isAr ? challenge.titleAr : challenge.titleEn,
        targetAmount: challenge.targetAmount,
        savedAmount: j.savedAmount,
        daysRemaining,
        progress,
      };
    }).filter(Boolean) as { id: string; title: string; targetAmount: number; savedAmount: number; daysRemaining: number; progress: number }[];
  }, [joinedChallenges, isAr]);

  const { tip: dailyTip, isLoading: tipLoading, refreshTip } = useDailySavingsTip(tipChallenges, language);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setJoinedChallenges(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  function saveJoined(updated: JoinedChallenge[]) {
    setJoinedChallenges(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function joinChallenge(challengeId: string) {
    const newJoined: JoinedChallenge = {
      challengeId,
      joinedAt: new Date().toISOString(),
      savedAmount: 0,
      completedMilestones: [],
    };
    saveJoined([...joinedChallenges, newJoined]);
  }

  function leaveChallenge(challengeId: string) {
    saveJoined(joinedChallenges.filter(j => j.challengeId !== challengeId));
  }

  function addSavings(challengeId: string, amount: number) {
    const challenge = CHALLENGES.find(c => c.id === challengeId);
    if (!challenge) return;

    const updated = joinedChallenges.map(j => {
      if (j.challengeId !== challengeId) return j;
      const newAmount = j.savedAmount + amount;
      const progress = (newAmount / challenge.targetAmount) * 100;

      // Check milestones
      const newMilestones = [...j.completedMilestones];
      for (const milestone of challenge.milestones) {
        if (progress >= milestone && !newMilestones.includes(milestone)) {
          newMilestones.push(milestone);
          setCelebratingMilestone(`${challengeId}-${milestone}`);
          setTimeout(() => setCelebratingMilestone(null), 3000);
          // Send browser notification for milestone
          const challengeName = isAr ? challenge.titleAr : challenge.titleEn;
          notifyCelebrateMilestone(challengeName, milestone);
        }
      }

      return { ...j, savedAmount: newAmount, completedMilestones: newMilestones };
    });
    saveJoined(updated);
    setAddAmountId(null);
    setAddValue('');
  }

  function getDaysRemaining(joinedAt: string, duration: number): number {
    const start = new Date(joinedAt).getTime();
    const end = start + duration * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
  }

  function isJoined(challengeId: string): boolean {
    return joinedChallenges.some(j => j.challengeId === challengeId);
  }

  function getJoinedData(challengeId: string): JoinedChallenge | undefined {
    return joinedChallenges.find(j => j.challengeId === challengeId);
  }

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
          <h1 className="text-xl font-bold text-foreground">
            🏆 {isAr ? 'تحديات الادخار' : 'Savings Challenges'}
          </h1>
          <div className="flex items-center gap-2">
            <EmailDigestToggle />
            <button
              onClick={notificationsEnabled ? disableNotifications : enableNotifications}
              className={`relative p-2 rounded-lg border transition-all ${
                notificationsEnabled
                  ? 'border-[#c9a96e]/50 bg-[#c9a96e]/10 text-[#c9a96e]'
                  : 'border-border bg-background text-muted-foreground hover:border-[#c9a96e]/30'
              }`}
              title={
                permissionStatus === 'denied'
                  ? (isAr ? 'الإشعارات محظورة في المتصفح' : 'Notifications blocked in browser')
                  : notificationsEnabled
                    ? (isAr ? 'إيقاف التذكيرات' : 'Disable Reminders')
                    : (isAr ? 'تفعيل التذكيرات' : 'Enable Reminders')
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {notificationsEnabled && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
              {permissionStatus === 'denied' && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <PremiumGate requiredTier="balanced" featureName={isAr ? 'تحديات الادخار' : 'Savings Challenges'}>
          <div className="space-y-4">
            {/* Celebration Overlay */}
            {celebratingMilestone && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
                <div className="bg-card rounded-2xl p-8 text-center border border-[#c9a96e] shadow-xl max-w-sm mx-4">
                  <p className="text-5xl mb-4">🎉🎊🏆</p>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {isAr ? 'مبروك!' : 'Congratulations!'}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {isAr
                      ? `وصلت إلى ${celebratingMilestone.split('-')[1]}% من هدفك!`
                      : `You reached ${celebratingMilestone.split('-')[1]}% of your goal!`}
                  </p>
                </div>
              </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-2xl p-4 border border-border text-center">
                <p className="text-2xl font-bold text-[#c9a96e]">{joinedChallenges.length}</p>
                <p className="text-xs text-muted-foreground">{isAr ? 'تحديات نشطة' : 'Active Challenges'}</p>
              </div>
              <div className="bg-card rounded-2xl p-4 border border-border text-center">
                <p className="text-2xl font-bold text-primary">
                  {joinedChallenges.reduce((sum, j) => sum + j.savedAmount, 0)}
                </p>
                <p className="text-xs text-muted-foreground">{isAr ? 'إجمالي المدخرات' : 'Total Saved'}</p>
              </div>
            </div>

            {/* Daily Savings Tip */}
            {joinedChallenges.length > 0 && (
              <div className="bg-gradient-to-r from-[#c9a96e]/10 to-primary/10 border border-[#c9a96e]/30 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💡</span>
                    <h3 className="text-sm font-bold text-foreground">
                      {isAr ? 'نصيحة الادخار اليومية' : 'Daily Savings Tip'}
                    </h3>
                  </div>
                  <button
                    onClick={refreshTip}
                    disabled={tipLoading}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-[#c9a96e] hover:bg-[#c9a96e]/10 transition-all disabled:opacity-50"
                    title={isAr ? 'تحديث' : 'Refresh'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tipLoading ? 'animate-spin' : ''}>
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 16h5v5" />
                    </svg>
                  </button>
                </div>
                {tipLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 bg-muted-foreground/20 rounded-full w-full animate-pulse" />
                    <div className="h-3 bg-muted-foreground/20 rounded-full w-3/4 animate-pulse" />
                  </div>
                ) : dailyTip ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{dailyTip}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {isAr ? 'جارٍ تحميل النصيحة...' : 'Loading tip...'}
                  </p>
                )}
              </div>
            )}

            {/* Challenge Cards */}
            {CHALLENGES.map(challenge => {
              const joined = isJoined(challenge.id);
              const data = getJoinedData(challenge.id);
              const progress = data ? (data.savedAmount / challenge.targetAmount) * 100 : 0;
              const daysLeft = data ? getDaysRemaining(data.joinedAt, challenge.duration) : challenge.duration;

              return (
                <div key={challenge.id} className="bg-card rounded-2xl p-4 border border-border">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{challenge.icon}</span>
                      <div>
                        <h3 className="text-foreground font-bold text-sm">
                          {isAr ? challenge.titleAr : challenge.titleEn}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {challenge.duration} {isAr ? 'يوم' : 'days'} • {isAr ? 'الهدف:' : 'Target:'} {challenge.targetAmount}
                        </p>
                      </div>
                    </div>
                    {joined ? (
                      <button
                        onClick={() => leaveChallenge(challenge.id)}
                        className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg hover:bg-red-500/10"
                      >
                        {isAr ? 'مغادرة' : 'Leave'}
                      </button>
                    ) : (
                      <button
                        onClick={() => joinChallenge(challenge.id)}
                        className="text-xs text-[#c9a96e] border border-[#c9a96e]/30 px-2 py-1 rounded-lg hover:bg-[#c9a96e]/10"
                      >
                        {isAr ? 'انضمام' : 'Join'}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">
                    {isAr ? challenge.descAr : challenge.descEn}
                  </p>

                  {joined && data && (
                    <>
                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{Math.min(100, Math.round(progress))}%</span>
                          <span>{daysLeft} {isAr ? 'يوم متبقي' : 'days left'}</span>
                        </div>
                        <div className="w-full h-3 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#c9a96e] to-[#D4A017] transition-all duration-500"
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                      </div>

                      {/* Milestones */}
                      <div className="flex gap-2 mb-3">
                        {challenge.milestones.map(m => (
                          <div
                            key={m}
                            className={`flex-1 text-center py-1 rounded-lg text-xs font-medium ${
                              data.completedMilestones.includes(m)
                                ? 'bg-[#c9a96e]/20 text-[#c9a96e] border border-[#c9a96e]/30'
                                : 'bg-background text-muted-foreground border border-border'
                            }`}
                          >
                            {data.completedMilestones.includes(m) ? '✅' : ''} {m}%
                          </div>
                        ))}
                      </div>

                      {/* Add Savings */}
                      {addAmountId === challenge.id ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={addValue}
                            onChange={(e) => setAddValue(e.target.value)}
                            placeholder={isAr ? 'المبلغ' : 'Amount'}
                            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                          />
                          <button
                            onClick={() => addSavings(challenge.id, parseFloat(addValue) || 0)}
                            className="bg-[#c9a96e] text-white px-4 py-2 rounded-lg text-sm font-medium"
                          >
                            {isAr ? 'إضافة' : 'Add'}
                          </button>
                          <button
                            onClick={() => { setAddAmountId(null); setAddValue(''); }}
                            className="text-muted-foreground px-2"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddAmountId(challenge.id)}
                          className="w-full bg-primary/10 border border-primary/30 text-primary py-2 rounded-xl text-sm font-medium hover:bg-primary/20 transition-all"
                        >
                          💰 {isAr ? 'إضافة مدخرات' : 'Add Savings'}
                        </button>
                      )}

                      <p className="text-center text-xs text-muted-foreground mt-2">
                        {isAr ? 'المحفوظ:' : 'Saved:'} {data.savedAmount} / {challenge.targetAmount}
                      </p>
                    </>
                  )}
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