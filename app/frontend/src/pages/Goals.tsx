import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface Goal {
  id: string;
  title: string;
  category: 'Personal' | 'Financial' | 'Spiritual' | 'Family';
  targetDate: string;
  progress: number;
  status: 'Active' | 'Completed' | 'Paused';
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  Personal: '👤',
  Financial: '💰',
  Spiritual: '🕌',
  Family: '👨‍👩‍👧‍👦',
};

export default function Goals() {
  const { t } = useLanguage();
  const [goals, setGoals] = useState<Goal[]>(() => {
    const stored = localStorage.getItem('amanah-goals');
    return stored ? JSON.parse(stored) : [];
  });
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [newGoal, setNewGoal] = useState({ title: '', category: 'Personal' as Goal['category'], targetDate: '', progress: 0 });

  useEffect(() => {
    localStorage.setItem('amanah-goals', JSON.stringify(goals));
  }, [goals]);

  const addGoal = () => {
    if (!newGoal.title.trim()) return;
    const goal: Goal = {
      id: Date.now().toString(),
      title: newGoal.title,
      category: newGoal.category,
      targetDate: newGoal.targetDate,
      progress: newGoal.progress,
      status: 'Active',
      createdAt: new Date().toISOString(),
    };
    setGoals([goal, ...goals]);
    setNewGoal({ title: '', category: 'Personal', targetDate: '', progress: 0 });
    setShowForm(false);
  };

  const updateProgress = (id: string, progress: number) => {
    setGoals(goals.map(g => {
      if (g.id === id) {
        const status = progress >= 100 ? 'Completed' : g.status;
        return { ...g, progress: Math.min(100, progress), status };
      }
      return g;
    }));
  };

  const toggleStatus = (id: string) => {
    setGoals(goals.map(g => {
      if (g.id === id) {
        const nextStatus = g.status === 'Active' ? 'Paused' : g.status === 'Paused' ? 'Active' : g.status;
        return { ...g, status: nextStatus };
      }
      return g;
    }));
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
  };

  const getLinkedTasksCount = (goalTitle: string): number => {
    try {
      const tasks = JSON.parse(localStorage.getItem('amanah-tasks') || '[]');
      return tasks.filter((t: { title?: string; category?: string }) =>
        t.title?.toLowerCase().includes(goalTitle.toLowerCase()) ||
        t.category?.toLowerCase().includes(goalTitle.toLowerCase())
      ).length;
    } catch {
      return 0;
    }
  };

  const filteredGoals = goals.filter(g => {
    if (filterCategory !== 'All' && g.category !== filterCategory) return false;
    if (filterStatus !== 'All' && g.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a2e1f] dark:bg-[#0a2e1f] pb-20">
      <header className="border-b border-[#1a4d35] bg-[#0a2e1f]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
          <h1 className="text-xl font-bold text-white">🎯 {t('goals')}</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#14b8a6] text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            + {t('addGoal')}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Add Goal Form */}
        {showForm && (
          <div className="bg-[#0f3d2a] rounded-2xl p-4 mb-4 border border-[#1a4d35]">
            <input
              type="text"
              placeholder={t('title')}
              value={newGoal.title}
              onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              className="w-full bg-[#0a2e1f] border border-[#1a4d35] rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-[#14b8a6]"
            />
            <select
              value={newGoal.category}
              onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value as Goal['category'] })}
              className="w-full bg-[#0a2e1f] border border-[#1a4d35] rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-[#14b8a6]"
            >
              <option value="Personal">{t('personal')}</option>
              <option value="Financial">{t('financial')}</option>
              <option value="Spiritual">{t('spiritual')}</option>
              <option value="Family">{t('family')}</option>
            </select>
            <input
              type="date"
              value={newGoal.targetDate}
              onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
              className="w-full bg-[#0a2e1f] border border-[#1a4d35] rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-[#14b8a6]"
            />
            <div className="flex gap-2">
              <button onClick={addGoal} className="flex-1 bg-[#14b8a6] text-white py-2 rounded-lg text-sm font-medium">
                {t('save')}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 bg-[#1a4d35] text-gray-300 py-2 rounded-lg text-sm">
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {['All', 'Personal', 'Financial', 'Spiritual', 'Family'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filterCategory === cat ? 'bg-[#14b8a6] text-white' : 'bg-[#0f3d2a] text-gray-400 border border-[#1a4d35]'
              }`}
            >
              {cat === 'All' ? t('all') : t(cat.toLowerCase())}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          {['All', 'Active', 'Completed', 'Paused'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filterStatus === st ? 'bg-[#d4a853] text-white' : 'bg-[#0f3d2a] text-gray-400 border border-[#1a4d35]'
              }`}
            >
              {st === 'All' ? t('all') : st === 'Active' ? t('active') : st === 'Completed' ? t('completed') : t('paused')}
            </button>
          ))}
        </div>

        {/* Goals List */}
        {filteredGoals.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-2">🎯</p>
            <p>{t('addGoal')}</p>
          </div>
        )}

        <div className="space-y-3">
          {filteredGoals.map(goal => (
            <div key={goal.id} className="bg-[#0f3d2a] rounded-2xl p-4 border border-[#1a4d35]">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{CATEGORY_ICONS[goal.category]}</span>
                  <div>
                    <h3 className="text-white font-medium text-sm">{goal.title}</h3>
                    <p className="text-xs text-gray-500">{goal.category} • {goal.targetDate || 'No deadline'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleStatus(goal.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      goal.status === 'Active' ? 'bg-[#14b8a6]/20 text-[#14b8a6]' :
                      goal.status === 'Completed' ? 'bg-[#d4a853]/20 text-[#d4a853]' :
                      'bg-gray-600/20 text-gray-400'
                    }`}
                  >
                    {goal.status === 'Active' ? t('active') : goal.status === 'Completed' ? t('completed') : t('paused')}
                  </button>
                  <button onClick={() => deleteGoal(goal.id)} className="text-red-400 text-xs px-1">✕</button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{t('progress')}</span>
                  <span className="text-[#d4a853]">{goal.progress}%</span>
                </div>
                <div className="h-2 bg-[#0a2e1f] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#14b8a6] to-[#d4a853] rounded-full transition-all"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              </div>

              {/* Progress Controls */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[10, 25, 50, 75, 100].map(val => (
                    <button
                      key={val}
                      onClick={() => updateProgress(goal.id, val)}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        goal.progress >= val ? 'bg-[#14b8a6]/30 text-[#14b8a6]' : 'bg-[#0a2e1f] text-gray-500'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-gray-500">
                  {t('linkedTasks')}: {getLinkedTasksCount(goal.title)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}