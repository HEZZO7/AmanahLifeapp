import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface Goal {
  id: string;
  title: string;
  category: 'Personal' | 'Financial' | 'Spiritual' | 'Family';
  targetDate: string;
  progress: number;
  status: 'Active' | 'Completed' | 'Paused';
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  completed?: boolean;
  date?: string;
}

export default function ProgressAnalytics() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  const goals: Goal[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('amanah-goals') || '[]');
    } catch {
      return [];
    }
  }, []);

  const tasks: Task[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('amanah-tasks') || '[]');
    } catch {
      return [];
    }
  }, []);

  const dhikrCount = useMemo(() => {
    const todayKey = `dhikr_total_${new Date().toDateString()}`;
    return parseInt(localStorage.getItem(todayKey) || '0', 10);
  }, []);

  const streakData = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem('amanah-streaks') || '{}');
      return {
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
      };
    } catch {
      return { currentStreak: 0, longestStreak: 0 };
    }
  }, []);

  // Section 1: Individual Progress by Category
  const categoryProgress = useMemo(() => {
    const categories: Array<'Personal' | 'Financial' | 'Spiritual' | 'Family'> = [
      'Personal',
      'Financial',
      'Spiritual',
      'Family',
    ];
    const categoryLabels: Record<string, { ar: string; en: string }> = {
      Personal: { ar: 'شخصي', en: 'Personal' },
      Financial: { ar: 'مالي', en: 'Financial' },
      Spiritual: { ar: 'روحي', en: 'Spiritual' },
      Family: { ar: 'عائلي', en: 'Family' },
    };

    return categories.map((cat) => {
      const catGoals = goals.filter((g) => g.category === cat);
      const avgProgress =
        catGoals.length > 0
          ? Math.round(catGoals.reduce((sum, g) => sum + g.progress, 0) / catGoals.length)
          : 0;
      return {
        name: categoryLabels[cat][language],
        progress: avgProgress,
        count: catGoals.length,
      };
    });
  }, [goals, language]);

  // Section 2: Family Overview (Pie chart - goal status distribution)
  const statusDistribution = useMemo(() => {
    const completed = goals.filter((g) => g.status === 'Completed').length;
    const active = goals.filter((g) => g.status === 'Active').length;
    const paused = goals.filter((g) => g.status === 'Paused').length;
    return [
      {
        name: language === 'ar' ? 'مكتمل' : 'Completed',
        value: completed,
        color: '#22c55e',
      },
      {
        name: language === 'ar' ? 'نشط' : 'Active',
        value: active,
        color: '#c9a96e',
      },
      {
        name: language === 'ar' ? 'متوقف' : 'Paused',
        value: paused,
        color: '#6b7280',
      },
    ].filter((d) => d.value > 0);
  }, [goals, language]);

  // Section 3: Progress Over Time (last 8 weeks)
  const weeklyTrends = useMemo(() => {
    const weeks: Array<{ week: string; progress: number; tasks: number }> = [];
    const now = new Date();

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekLabel =
        language === 'ar'
          ? `أسبوع ${8 - i}`
          : `W${8 - i}`;

      // Goals created before this week's end with progress
      const relevantGoals = goals.filter((g) => {
        const created = new Date(g.createdAt);
        return created <= weekEnd;
      });
      const avgProgress =
        relevantGoals.length > 0
          ? Math.round(
              relevantGoals.reduce((sum, g) => sum + g.progress, 0) / relevantGoals.length
            )
          : 0;

      // Tasks completed in this week
      const weekTasks = tasks.filter((t) => {
        if (!t.date || !t.completed) return false;
        const taskDate = new Date(t.date);
        return taskDate >= weekStart && taskDate < weekEnd;
      }).length;

      weeks.push({ week: weekLabel, progress: avgProgress, tasks: weekTasks });
    }
    return weeks;
  }, [goals, tasks, language]);

  // Section 4: Goal Status Cards
  const goalStatus = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter((g) => g.status === 'Completed').length;
    const active = goals.filter((g) => g.status === 'Active').length;
    const paused = goals.filter((g) => g.status === 'Paused').length;
    return { total, completed, active, paused };
  }, [goals]);

  // Section 5: Activity Summary
  const activitySummary = useMemo(() => {
    const completedTasks = tasks.filter((t) => t.completed).length;
    const totalTasks = tasks.length;
    return { completedTasks, totalTasks };
  }, [tasks]);

  return (
    <div className="min-h-screen bg-background pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="🏅" title={language === 'ar' ? 'تحليلات التقدم' : 'Progress Analytics'} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Section 1: Individual Progress by Category */}
        <section className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {language === 'ar' ? 'التقدم حسب الفئة' : 'Progress by Category'}
          </h2>
          {goals.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryProgress} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar dataKey="progress" fill="#c9a96e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-3xl mb-2">📊</p>
              <p>{language === 'ar' ? 'أضف أهدافاً لرؤية التقدم' : 'Add goals to see progress'}</p>
            </div>
          )}
        </section>

        {/* Section 2: Family Overview (Pie Chart) */}
        <section className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {language === 'ar' ? 'نظرة عامة' : 'Overview'}
          </h2>
          {statusDistribution.length > 0 ? (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-3xl mb-2">🎯</p>
              <p>{language === 'ar' ? 'لا توجد أهداف بعد' : 'No goals yet'}</p>
            </div>
          )}
        </section>

        {/* Section 3: Progress Over Time */}
        <section className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {language === 'ar' ? 'التقدم عبر الزمن' : 'Progress Over Time'}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="progress"
                stroke="#c9a96e"
                strokeWidth={2}
                dot={{ fill: '#c9a96e', r: 4 }}
                name={language === 'ar' ? 'التقدم %' : 'Progress %'}
              />
              <Line
                type="monotone"
                dataKey="tasks"
                stroke="#1FC7C1"
                strokeWidth={2}
                dot={{ fill: '#1FC7C1', r: 4 }}
                name={language === 'ar' ? 'المهام المنجزة' : 'Tasks Done'}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Section 4: Goal Status Cards */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4">
            {language === 'ar' ? 'حالة الأهداف' : 'Goal Status'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-green-500 text-lg">✓</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{goalStatus.completed}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'مكتمل' : 'Completed'}
              </p>
              {goalStatus.total > 0 && (
                <p className="text-xs text-green-500 mt-1">
                  {Math.round((goalStatus.completed / goalStatus.total) * 100)}%
                </p>
              )}
            </div>

            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-[#c9a96e]/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-[#c9a96e] text-lg">◐</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{goalStatus.active}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
              </p>
              {goalStatus.total > 0 && (
                <p className="text-xs text-[#c9a96e] mt-1">
                  {Math.round((goalStatus.active / goalStatus.total) * 100)}%
                </p>
              )}
            </div>

            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-gray-500 text-lg">⏸</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{goalStatus.paused}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'متوقف' : 'Paused'}
              </p>
              {goalStatus.total > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round((goalStatus.paused / goalStatus.total) * 100)}%
                </p>
              )}
            </div>

            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-primary text-lg">Σ</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{goalStatus.total}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'إجمالي' : 'Total'}
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Activity Summary */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4">
            {language === 'ar' ? 'ملخص النشاط' : 'Activity Summary'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <p className="text-2xl mb-1">📿</p>
              <p className="text-xl font-bold text-[#c9a96e]">{dhikrCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'ذكر اليوم' : "Today's Dhikr"}
              </p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-xl font-bold text-primary">
                {activitySummary.completedTasks}/{activitySummary.totalTasks}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'المهام المنجزة' : 'Tasks Done'}
              </p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <p className="text-2xl mb-1">🔥</p>
              <p className="text-xl font-bold text-orange-500">{streakData.currentStreak}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'التتابع الحالي' : 'Current Streak'}
              </p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <p className="text-2xl mb-1">🏆</p>
              <p className="text-xl font-bold text-[#1FC7C1]">{streakData.longestStreak}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'أطول تتابع' : 'Longest Streak'}
              </p>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}