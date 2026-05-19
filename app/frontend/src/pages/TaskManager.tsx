import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

type Priority = 'high' | 'medium' | 'low';
type Category = 'worship' | 'work' | 'personal' | 'health';

interface Task {
  id: string;
  title: string;
  priority: Priority;
  category: Category;
  completed: boolean;
  date: string;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#ef4444',
  medium: '#d4a853',
  low: '#14b8a6',
};

const CATEGORY_ICONS: Record<Category, string> = {
  worship: '🕌',
  work: '💼',
  personal: '👤',
  health: '💪',
};

export default function TaskManager() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState<Category>('personal');
  const [filter, setFilter] = useState<'all' | Category>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toDateString());

  // Week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + i);
    return d;
  });

  useEffect(() => {
    const stored = localStorage.getItem('amanah_tasks');
    if (stored) setTasks(JSON.parse(stored));
  }, []);

  const saveTasks = (updated: Task[]) => {
    setTasks(updated);
    localStorage.setItem('amanah_tasks', JSON.stringify(updated));
  };

  const addTask = () => {
    if (!title.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      title: title.trim(),
      priority,
      category,
      completed: false,
      date: selectedDate,
    };
    saveTasks([...tasks, newTask]);
    setTitle('');
    setShowForm(false);
  };

  const toggleTask = (id: string) => {
    saveTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id));
  };

  const filteredTasks = tasks.filter((task) => {
    const dateMatch = task.date === selectedDate;
    const catMatch = filter === 'all' || task.category === filter;
    return dateMatch && catMatch;
  });

  const completedCount = filteredTasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">{t('tasks')}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {completedCount}/{filteredTasks.length} {t('completed')}
        </p>
      </header>

      {/* Week Calendar Strip */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {weekDays.map((day) => {
          const isSelected = day.toDateString() === selectedDate;
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return (
            <button
              key={day.toDateString()}
              onClick={() => setSelectedDate(day.toDateString())}
              className={`flex-shrink-0 w-12 py-2 rounded-xl text-center transition-all ${
                isSelected
                  ? 'bg-primary text-white'
                  : 'bg-card text-muted-foreground hover:bg-secondary'
              }`}
            >
              <p className="text-[10px]">{dayNames[day.getDay()]}</p>
              <p className="text-lg font-bold">{day.getDate()}</p>
            </button>
          );
        })}
      </div>

      {/* Category Filters */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {(['all', 'worship', 'work', 'personal', 'health'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
              filter === cat
                ? 'bg-[#d4a853] text-white'
                : 'bg-card text-muted-foreground hover:bg-secondary'
            }`}
          >
            {cat === 'all' ? t('all') : `${CATEGORY_ICONS[cat]} ${t(cat)}`}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="px-4 py-3 space-y-2">
        {filteredTasks.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No tasks for this day</p>
        )}
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
              task.completed
                ? 'bg-primary/5 border-primary/20 opacity-60'
                : 'bg-card border-border'
            }`}
          >
            <button
              onClick={() => toggleTask(task.id)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                task.completed ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}
            >
              {task.completed && <span className="text-white text-xs">✓</span>}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-foreground text-sm ${task.completed ? 'line-through' : ''}`}>{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs">{CATEGORY_ICONS[task.category]}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}
                >
                  {t(task.priority)}
                </span>
              </div>
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              className="text-muted-foreground hover:text-red-400 text-sm"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add Task Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-card rounded-t-3xl p-6 space-y-4">
            <h3 className="text-foreground font-semibold text-lg">{t('addTask')}</h3>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('title')}
              className="w-full p-3 rounded-xl bg-secondary text-foreground placeholder-muted-foreground border border-border focus:border-primary outline-none"
            />
            <div>
              <p className="text-muted-foreground text-sm mb-2">{t('priority')}</p>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                      priority === p
                        ? 'text-white'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                    style={priority === p ? { backgroundColor: PRIORITY_COLORS[p] } : {}}
                  >
                    {t(p)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-sm mb-2">{t('category')}</p>
              <div className="flex gap-2">
                {(['worship', 'work', 'personal', 'health'] as Category[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                      category === c
                        ? 'bg-[#d4a853] text-white'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {CATEGORY_ICONS[c]} {t(c)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 p-3 rounded-xl bg-secondary text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={addTask}
                className="flex-1 p-3 rounded-xl bg-primary text-white font-semibold"
              >
                {t('addTask')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary text-white text-2xl shadow-lg flex items-center justify-center hover:bg-[#0d9488] active:scale-90 transition-all z-40"
      >
        +
      </button>

      <BottomNav />
    </div>
  );
}