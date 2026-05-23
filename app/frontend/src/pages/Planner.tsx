import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
}

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
  const { t, language, isRTL } = useLanguage();
  const [view, setView] = useState<ViewMode>('agenda');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [hijriDate, setHijriDate] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', date: '', time: '', description: '' });

  useEffect(() => {
    const stored = localStorage.getItem('amanah-tasks');
    if (stored) setTasks(JSON.parse(stored));
    const storedAgenda = localStorage.getItem('amanah-agenda');
    if (storedAgenda) setAgendaItems(JSON.parse(storedAgenda));
  }, []);

  useEffect(() => {
    localStorage.setItem('amanah-agenda', JSON.stringify(agendaItems));
  }, [agendaItems]);

  useEffect(() => {
    const fetchHijri = async () => {
      try {
        const today = new Date();
        const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
        const res = await fetch(`https://api.aladhan.com/v1/gpiToH/${dateStr}`);
        const data = await res.json();
        const h = data.data.hijri;
        if (language === 'ar') {
          setHijriDate(`${h.day} ${h.month.ar} ${h.year} هـ`);
        } else {
          setHijriDate(`${h.day} ${h.month.en} ${h.year} AH`);
        }
      } catch {
        // silently fail
      }
    };
    fetchHijri();
  }, [language]);

  const todayStr = new Date().toISOString().split('T')[0];

  const todayTasks = tasks.filter(task => {
    if (task.date) return task.date === todayStr;
    return true;
  });

  const todayAgenda = agendaItems.filter(item => item.date === todayStr);

  const addAgendaItem = () => {
    if (!newItem.title.trim()) return;
    const item: AgendaItem = {
      id: Date.now().toString(),
      title: newItem.title.trim(),
      date: newItem.date || todayStr,
      time: newItem.time || '',
      description: newItem.description.trim(),
    };
    setAgendaItems(prev => [...prev, item]);
    setNewItem({ title: '', date: '', time: '', description: '' });
    setShowAddForm(false);
  };

  const removeAgendaItem = (id: string) => {
    setAgendaItems(prev => prev.filter(item => item.id !== id));
  };

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
    const taskCount = tasks.filter(t => t.date === dateStr).length;
    const agendaCount = agendaItems.filter(a => a.date === dateStr).length;
    return taskCount + agendaCount;
  };

  const hasItems = todayTasks.length > 0 || todayAgenda.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader
        icon="📋"
        title={t('planner')}
        rightAction={hijriDate ? <span className="text-xs text-[#D4A017]">{hijriDate}</span> : undefined}
      />

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* View Tabs */}
        <div className="flex bg-card rounded-xl p-1 mb-4 border border-border">
          {(['agenda', 'weekly', 'monthly'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                view === v ? 'bg-primary text-white' : 'text-muted-foreground'
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
              <h3 className="text-sm text-muted-foreground">{t('today')} — {new Date().toLocaleDateString()}</h3>
              <span className="text-xs text-primary">{todayTasks.length + todayAgenda.length} {t('tasks').toLowerCase()}</span>
            </div>

            {!hasItems ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
                    <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5" />
                    <path d="M8 14l2 2 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-foreground font-semibold mb-1">
                  {language === 'ar' ? 'لا توجد مواعيد اليوم' : 'No agenda items today'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === 'ar' ? 'اضغط + لإضافة موعد أو مهمة جديدة' : 'Tap + to add a new event or task'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Agenda Items */}
                {todayAgenda.map(item => (
                  <div key={item.id} className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#D4A017]" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.time && `${item.time} • `}{item.description || (language === 'ar' ? 'موعد' : 'Event')}
                      </p>
                    </div>
                    <button onClick={() => removeAgendaItem(item.id)} className="text-muted-foreground hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
                {/* Tasks */}
                {todayTasks.map(task => (
                  <div key={task.id} className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      task.completed ? 'bg-primary' : task.priority === 'high' ? 'bg-red-400' : task.priority === 'medium' ? 'bg-[#D4A017]' : 'bg-muted-foreground'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.title}</p>
                      <p className="text-[10px] text-muted-foreground">{task.category} • {task.priority}</p>
                    </div>
                    {task.completed && <span className="text-primary text-xs">✓</span>}
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
                    isToday ? 'bg-primary/10 border-primary' : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
                      isToday ? 'bg-primary text-white' : 'bg-background text-muted-foreground'
                    }`}>
                      <span className="text-[10px]">{day.toLocaleDateString(language === 'ar' ? 'ar' : 'en', { weekday: 'short' })}</span>
                      <span className="text-sm font-bold">{day.getDate()}</span>
                    </div>
                    <span className={`text-sm ${isToday ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {isToday ? t('today') : day.toLocaleDateString(language === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {count > 0 && (
                    <span className="bg-[#D4A017] text-white text-xs px-2 py-0.5 rounded-full font-medium">
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
            <h3 className="text-center text-foreground font-medium mb-2">
              {new Date().toLocaleDateString(language === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' })}
            </h3>
            {hijriDate && (
              <p className="text-center text-xs text-[#D4A017] mb-3">{hijriDate}</p>
            )}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {(language === 'ar'
                ? ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
                : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
              ).map(d => (
                <div key={d} className="text-center text-[10px] text-muted-foreground py-1">{d}</div>
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
                      isToday ? 'bg-primary text-white font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    {day}
                    {hasTask && <div className="w-1 h-1 rounded-full bg-[#D4A017] mt-0.5" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Add Agenda Item Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddForm(false)} />
          <div className="relative bg-card rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <h3 className="text-foreground font-semibold text-lg">
              {language === 'ar' ? 'إضافة موعد جديد' : 'Add New Event'}
            </h3>
            <input
              value={newItem.title}
              onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))}
              placeholder={language === 'ar' ? 'العنوان' : 'Title'}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newItem.date}
                onChange={e => setNewItem(p => ({ ...p, date: e.target.value }))}
                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none"
              />
              <input
                type="time"
                value={newItem.time}
                onChange={e => setNewItem(p => ({ ...p, time: e.target.value }))}
                className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary outline-none"
              />
            </div>
            <textarea
              value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
              placeholder={language === 'ar' ? 'الوصف (اختياري)' : 'Description (optional)'}
              rows={2}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground font-medium"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={addAgendaItem}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold"
              >
                {language === 'ar' ? 'إضافة' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddForm(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary text-white text-2xl shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-90 transition-all z-40"
      >
        +
      </button>

      <BottomNav />
    </div>
  );
}