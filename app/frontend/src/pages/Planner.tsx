import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface Task {
  id: string;
  title: string;
  category: string;
  priority: string;
  completed: boolean;
  date?: string;
}

type ViewMode = 'agenda' | 'weekly' | 'monthly';

export default function Planner() {
  const { t } = useLanguage();
  const [view, setView] = useState<ViewMode>('agenda');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hijriDate, setHijriDate] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('amanah-tasks');
    if (stored) {
      setTasks(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    const fetchHijri = async () => {
      try {
        const today = new Date();
        const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
        const res = await fetch(`https://api.aladhan.com/v1/gpiToH/${dateStr}`);
        const data = await res.json();
        const h = data.data.hijri;
        setHijriDate(`${h.day} ${h.month.en} ${h.year} AH`);
      } catch {
        // silently fail
      }
    };
    fetchHijri();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const todayTasks = tasks.filter(task => {
    if (task.date) return task.date === todayStr;
    return true; // tasks without date show in today's agenda
  });

  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const getMonthDays = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getTaskCountForDate = (date: Date): number => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter(t => t.date === dateStr).length;
  };

  return (
    <div className="min-h-screen bg-[#0a2e1f] dark:bg-[#0a2e1f] pb-20">
      <header className="border-b border-[#1a4d35] bg-[#0a2e1f]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
          <h1 className="text-xl font-bold text-white">📅 {t('planner')}</h1>
          {hijriDate && <span className="text-xs text-[#d4a853]">{hijriDate}</span>}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* View Tabs */}
        <div className="flex bg-[#0f3d2a] rounded-xl p-1 mb-4 border border-[#1a4d35]">
          {(['agenda', 'weekly', 'monthly'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                view === v ? 'bg-[#14b8a6] text-white' : 'text-gray-400'
              }`}
            >
              {t(v)}
            </button>
          ))}
        </div>

        {/* Agenda View */}
        {view === 'agenda' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm text-gray-400">{t('today')} — {new Date().toLocaleDateString()}</h3>
              <span className="text-xs text-[#14b8a6]">{todayTasks.length} {t('tasks').toLowerCase()}</span>
            </div>
            {todayTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-2">✨</p>
                <p>{t('noTasks')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map(task => (
                  <div key={task.id} className="bg-[#0f3d2a] rounded-xl p-3 border border-[#1a4d35] flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      task.completed ? 'bg-[#14b8a6]' : task.priority === 'high' ? 'bg-red-400' : task.priority === 'medium' ? 'bg-[#d4a853]' : 'bg-gray-500'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>{task.title}</p>
                      <p className="text-[10px] text-gray-500">{task.category} • {task.priority}</p>
                    </div>
                    {task.completed && <span className="text-[#14b8a6] text-xs">✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Weekly View */}
        {view === 'weekly' && (
          <div className="space-y-2">
            {getWeekDays().map((day, i) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const count = getTaskCountForDate(day);
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    isToday ? 'bg-[#14b8a6]/10 border-[#14b8a6]' : 'bg-[#0f3d2a] border-[#1a4d35]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
                      isToday ? 'bg-[#14b8a6] text-white' : 'bg-[#0a2e1f] text-gray-400'
                    }`}>
                      <span className="text-[10px]">{day.toLocaleDateString('en', { weekday: 'short' })}</span>
                      <span className="text-sm font-bold">{day.getDate()}</span>
                    </div>
                    <span className={`text-sm ${isToday ? 'text-white font-medium' : 'text-gray-400'}`}>
                      {isToday ? t('today') : day.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {count > 0 && (
                    <span className="bg-[#d4a853] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Monthly View */}
        {view === 'monthly' && (
          <div>
            <h3 className="text-center text-white font-medium mb-3">
              {new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-[10px] text-gray-500 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getMonthDays().map((day, i) => {
                if (day === null) return <div key={i} />;
                const isToday = day === new Date().getDate();
                const dateObj = new Date(new Date().getFullYear(), new Date().getMonth(), day);
                const hasTask = getTaskCountForDate(dateObj) > 0;
                return (
                  <div
                    key={i}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm ${
                      isToday ? 'bg-[#14b8a6] text-white font-bold' : 'text-gray-400'
                    }`}
                  >
                    {day}
                    {hasTask && <div className="w-1 h-1 rounded-full bg-[#d4a853] mt-0.5" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}