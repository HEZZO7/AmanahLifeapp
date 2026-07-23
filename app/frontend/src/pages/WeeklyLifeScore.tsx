import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import PremiumGate from '@/components/PremiumGate';

interface DimensionScore {
  name: string;
  nameAr: string;
  score: number;
  icon: string;
  color: string;
}

interface WeeklyRecord {
  weekStart: string;
  scores: number[];
  overall: number;
}

const STORAGE_KEY = 'amanah-weekly-life-scores';

function calculateScores(): DimensionScore[] {
  // Spiritual: based on prayer completions this week
  let spiritualScore = 0;
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const prayerData = localStorage.getItem(`prayer_completed_${date.toDateString()}`);
    if (prayerData) {
      const completed = JSON.parse(prayerData);
      spiritualScore += (completed.length / 5) * (100 / 7);
    }
  }

  // Health: based on wellness logs
  const wellnessData = localStorage.getItem('amanah-wellness');
  let healthScore = 50;
  if (wellnessData) {
    try {
      const logs = JSON.parse(wellnessData);
      const recentLogs = logs.slice(-7);
      if (recentLogs.length > 0) {
        healthScore = Math.min(100, recentLogs.length * 14 + 10);
      }
    } catch { /* ignore */ }
  }

  // Financial: based on savings rate from transactions
  const transactions = JSON.parse(localStorage.getItem('amanah-transactions') || '[]');
  let financialScore = 50;
  if (transactions.length > 0) {
    const income = transactions
      .filter((t: { type?: string }) => t.type === 'income')
      .reduce((sum: number, t: { amount?: number }) => sum + (t.amount || 0), 0);
    const expenses = transactions
      .filter((t: { type?: string }) => t.type === 'expense')
      .reduce((sum: number, t: { amount?: number }) => sum + (t.amount || 0), 0);
    if (income > 0) {
      const savingsRate = (income - expenses) / income;
      financialScore = Math.min(100, Math.max(0, savingsRate * 100 + 30));
    }
  }

  // Social: based on family goals
  const goals = JSON.parse(localStorage.getItem('amanah-goals') || '[]');
  const familyGoals = goals.filter((g: { category?: string }) =>
    g.category === 'Family' || g.category === 'Social'
  );
  const socialScore = familyGoals.length > 0
    ? Math.min(100, familyGoals.reduce((sum: number, g: { progress?: number }) => sum + (g.progress || 0), 0) / familyGoals.length + 20)
    : 40;

  // Personal Growth: based on tasks completed
  // Was 'amanah-tasks' (dash) - key-name mismatch with TaskManager.tsx's
  // real key, fixed 2026-07-23.
  const tasks = JSON.parse(localStorage.getItem('amanah_tasks') || '[]');
  const completedTasks = tasks.filter((t: { completed?: boolean }) => t.completed);
  const growthScore = tasks.length > 0
    ? Math.min(100, (completedTasks.length / Math.max(tasks.length, 1)) * 100)
    : 30;

  return [
    { name: 'Spiritual', nameAr: 'الروحاني', score: Math.round(spiritualScore), icon: '🕌', color: '#1FC7C1' },
    { name: 'Health', nameAr: 'الصحة', score: Math.round(healthScore), icon: '💚', color: '#4ade80' },
    { name: 'Financial', nameAr: 'المالي', score: Math.round(financialScore), icon: '💰', color: '#c9a96e' },
    { name: 'Social', nameAr: 'الاجتماعي', score: Math.round(socialScore), icon: '👥', color: '#a78bfa' },
    { name: 'Growth', nameAr: 'النمو الشخصي', score: Math.round(growthScore), icon: '📈', color: '#f472b6' },
  ];
}

const RECOMMENDATIONS = {
  en: {
    Spiritual: 'Try to complete all 5 daily prayers and add morning adhkar to your routine.',
    Health: 'Log your wellness data daily - track mood, sleep, and hydration for better insights.',
    Financial: 'Review your spending this week. Consider setting a daily budget limit.',
    Social: 'Schedule quality time with family. Even 15 minutes of undivided attention matters.',
    Growth: 'Break large tasks into smaller ones. Complete at least 3 tasks daily.',
  },
  ar: {
    Spiritual: 'حاول إتمام الصلوات الخمس يومياً وأضف أذكار الصباح لروتينك.',
    Health: 'سجل بيانات صحتك يومياً - تتبع المزاج والنوم والترطيب لرؤى أفضل.',
    Financial: 'راجع إنفاقك هذا الأسبوع. فكر في وضع حد يومي للميزانية.',
    Social: 'خصص وقتاً نوعياً للعائلة. حتى 15 دقيقة من الاهتمام الكامل مهمة.',
    Growth: 'قسم المهام الكبيرة إلى أصغر. أكمل 3 مهام يومياً على الأقل.',
  },
};

export default function WeeklyLifeScore() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [dimensions, setDimensions] = useState<DimensionScore[]>([]);
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyRecord[]>([]);
  const [overallScore, setOverallScore] = useState(0);

  useEffect(() => {
    const scores = calculateScores();
    setDimensions(scores);
    const overall = Math.round(scores.reduce((sum, d) => sum + d.score, 0) / scores.length);
    setOverallScore(overall);

    // Save to weekly history
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const thisWeekStart = getWeekStart();
    const existingIdx = stored.findIndex((r: WeeklyRecord) => r.weekStart === thisWeekStart);
    const record: WeeklyRecord = {
      weekStart: thisWeekStart,
      scores: scores.map(s => s.score),
      overall,
    };
    if (existingIdx >= 0) {
      stored[existingIdx] = record;
    } else {
      stored.push(record);
      if (stored.length > 8) stored.shift();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setWeeklyHistory(stored.slice(-4));
  }, []);

  function getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    const weekStart = new Date(now.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }

  function getScoreColor(score: number): string {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  }

  function getScoreBg(score: number): string {
    if (score >= 70) return 'bg-emerald-500/20 border-emerald-500/30';
    if (score >= 50) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  }

  const lowestDimension = dimensions.length > 0
    ? dimensions.reduce((min, d) => d.score < min.score ? d : min, dimensions[0])
    : null;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="💯" title={isAr ? 'مؤشر الحياة الأسبوعي' : 'Weekly Life Score'} />

      <main className="max-w-lg mx-auto px-4 py-4">
        <PremiumGate requiredTier="balanced" featureName={isAr ? 'مؤشر الحياة' : 'Weekly Life Score'}>
          <div className="space-y-4">
            {/* Overall Score */}
            <div className={`rounded-2xl p-6 border text-center ${getScoreBg(overallScore)}`}>
              <p className="text-muted-foreground text-sm mb-2">
                {isAr ? 'النتيجة الإجمالية' : 'Overall Score'}
              </p>
              <p className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore}
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                {overallScore >= 70
                  ? (isAr ? '🌟 أداء ممتاز! استمر' : '🌟 Excellent! Keep it up')
                  : overallScore >= 50
                  ? (isAr ? '💪 جيد، يمكنك التحسن' : '💪 Good, room for improvement')
                  : (isAr ? '🔄 تحتاج لمزيد من الجهد' : '🔄 Needs more effort')}
              </p>
            </div>

            {/* Dimension Scores */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h3 className="text-foreground font-bold mb-4 flex items-center gap-2">
                <span>📐</span>
                {isAr ? 'تفاصيل الأبعاد' : 'Dimension Breakdown'}
              </h3>
              <div className="space-y-3">
                {dimensions.map((dim) => (
                  <div key={dim.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground flex items-center gap-2">
                        {dim.icon} {isAr ? dim.nameAr : dim.name}
                      </span>
                      <span className={`text-sm font-bold ${getScoreColor(dim.score)}`}>
                        {dim.score}/100
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${dim.score}%`, backgroundColor: dim.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Trend */}
            {weeklyHistory.length > 1 && (
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                  <span>📈</span>
                  {isAr ? 'الاتجاه الأسبوعي' : 'Weekly Trend'}
                </h3>
                <div className="flex items-end justify-between gap-2 h-24">
                  {weeklyHistory.map((week, i) => {
                    const height = Math.max(10, (week.overall / 100) * 100);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className={`text-xs font-bold ${getScoreColor(week.overall)}`}>
                          {week.overall}
                        </span>
                        <div
                          className="w-full rounded-t-lg transition-all duration-300"
                          style={{
                            height: `${height}%`,
                            backgroundColor: week.overall >= 70 ? '#4ade80' : week.overall >= 50 ? '#facc15' : '#f87171',
                            opacity: i === weeklyHistory.length - 1 ? 1 : 0.5,
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {isAr ? `أ${i + 1}` : `W${i + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {lowestDimension && (
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                  <span>💡</span>
                  {isAr ? 'توصيات للتحسين' : 'Improvement Recommendations'}
                </h3>
                <div className="bg-[#c9a96e]/10 border border-[#c9a96e]/20 rounded-xl p-3">
                  <p className="text-xs text-[#c9a96e] font-medium mb-1">
                    {isAr ? 'أقل بُعد:' : 'Lowest dimension:'} {lowestDimension.icon} {isAr ? lowestDimension.nameAr : lowestDimension.name} ({lowestDimension.score}/100)
                  </p>
                  <p className="text-sm text-foreground">
                    {RECOMMENDATIONS[isAr ? 'ar' : 'en'][lowestDimension.name as keyof typeof RECOMMENDATIONS.en]}
                  </p>
                </div>
                {dimensions
                  .filter(d => d.score < 50 && d.name !== lowestDimension.name)
                  .slice(0, 2)
                  .map(dim => (
                    <div key={dim.name} className="mt-2 bg-background/50 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {dim.icon} {isAr ? dim.nameAr : dim.name} ({dim.score}/100)
                      </p>
                      <p className="text-sm text-foreground">
                        {RECOMMENDATIONS[isAr ? 'ar' : 'en'][dim.name as keyof typeof RECOMMENDATIONS.en]}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </PremiumGate>
      </main>

      <BottomNav />
    </div>
  );
}