import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import PremiumGate from '@/components/PremiumGate';

interface Goal {
  id: string;
  title: string;
  category?: string;
  progress?: number;
}

interface CoachMessage {
  id: string;
  type: 'user' | 'coach';
  text: string;
  timestamp: number;
}

const CATEGORIES = {
  en: ['Spiritual Growth', 'Health & Fitness', 'Financial Wisdom', 'Relationships'],
  ar: ['النمو الروحي', 'الصحة واللياقة', 'الحكمة المالية', 'العلاقات'],
};

// Calls the real ai_life_coach Edge Function (Anthropic-backed) - this used
// to pick a random string out of a fixed, hardcoded array per category, with
// no AI involved at all despite the screen's name. Same endpoint the RN app
// uses (see amanahlife-rn's Phase 4 audit notes).
const AI_COACH_ENDPOINT = 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_ai_life_coach';

const WISDOM_QUOTES = {
  en: [
    { text: 'The best of you are those who are best to their families.', source: 'Prophet Muhammad ﷺ' },
    { text: 'Take advantage of five before five: your youth before old age, your health before sickness, your wealth before poverty, your free time before busyness, and your life before death.', source: 'Prophet Muhammad ﷺ' },
    { text: 'Whoever travels a path in search of knowledge, Allah makes easy for him a path to Paradise.', source: 'Prophet Muhammad ﷺ' },
    { text: 'The strong person is not the one who can wrestle someone else down. The strong person is the one who can control himself when he is angry.', source: 'Prophet Muhammad ﷺ' },
  ],
  ar: [
    { text: 'خيركم خيركم لأهله', source: 'النبي محمد ﷺ' },
    { text: 'اغتنم خمساً قبل خمس: شبابك قبل هرمك، وصحتك قبل سقمك، وغناك قبل فقرك، وفراغك قبل شغلك، وحياتك قبل موتك', source: 'النبي محمد ﷺ' },
    { text: 'من سلك طريقاً يلتمس فيه علماً سهل الله له به طريقاً إلى الجنة', source: 'النبي محمد ﷺ' },
    { text: 'ليس الشديد بالصُّرَعة، إنما الشديد الذي يملك نفسه عند الغضب', source: 'النبي محمد ﷺ' },
  ],
};

const HABIT_SUGGESTIONS = {
  en: [
    { habit: 'Morning Quran (10 min)', benefit: 'Improves focus and spiritual connection', icon: '📖' },
    { habit: 'Gratitude Journal', benefit: 'Write 3 things you\'re grateful for daily', icon: '✍️' },
    { habit: 'Evening Walk (20 min)', benefit: 'Reduces stress and improves sleep', icon: '🚶' },
    { habit: 'Weekly Charity', benefit: 'Even small amounts purify wealth', icon: '💝' },
    { habit: 'Digital Detox (1hr before bed)', benefit: 'Better sleep quality and mindfulness', icon: '📵' },
    { habit: 'Meal Prep Sunday', benefit: 'Healthier eating and time savings', icon: '🥗' },
  ],
  ar: [
    { habit: 'قرآن الصباح (10 دقائق)', benefit: 'يحسن التركيز والاتصال الروحي', icon: '📖' },
    { habit: 'دفتر الامتنان', benefit: 'اكتب 3 أشياء تشكر الله عليها يومياً', icon: '✍️' },
    { habit: 'مشي مسائي (20 دقيقة)', benefit: 'يقلل التوتر ويحسن النوم', icon: '🚶' },
    { habit: 'صدقة أسبوعية', benefit: 'حتى المبالغ الصغيرة تطهر المال', icon: '💝' },
    { habit: 'ديتوكس رقمي (ساعة قبل النوم)', benefit: 'نوم أفضل ويقظة ذهنية', icon: '📵' },
    { habit: 'تحضير وجبات الأحد', benefit: 'أكل صحي وتوفير وقت', icon: '🥗' },
  ],
};

export default function AILifeCoach() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showWisdom, setShowWisdom] = useState(false);
  const [question, setQuestion] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('amanah-goals');
    if (stored) {
      try {
        setGoals(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  const categories = isAr ? CATEGORIES.ar : CATEGORIES.en;
  const wisdom = isAr ? WISDOM_QUOTES.ar : WISDOM_QUOTES.en;
  const habits = isAr ? HABIT_SUGGESTIONS.ar : HABIT_SUGGESTIONS.en;

  const askCoach = async (text: string) => {
    if (!text.trim() || coachLoading) return;
    if (!user) { toast.error(isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first'); return; }

    const userMsg: CoachMessage = { id: Date.now().toString(), type: 'user', text, timestamp: Date.now() };
    const historyForRequest = [...messages, userMsg].slice(-6);
    setMessages(prev => [...prev, userMsg]);
    setCoachLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first'); return; }

      const response = await fetch(AI_COACH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          message: text,
          language: isAr ? 'ar' : 'en',
          goals: goals.slice(0, 5),
          history: historyForRequest,
        }),
      });
      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'coach', text: data.reply, timestamp: Date.now() + 100 }]);
      } else {
        toast.error(isAr ? 'المدرب الذكي غير متاح حالياً' : 'AI coach is currently unavailable');
      }
    } catch {
      toast.error(isAr ? 'حدث خطأ في الاتصال' : 'Connection error occurred');
    } finally {
      setCoachLoading(false);
    }
  };

  const askCategoryCoach = (category: string) => {
    setSelectedCategory(category);
    askCoach(isAr ? `أحتاج نصيحة حول: ${category}` : `I need advice on: ${category}`);
  };

  const sendQuestion = () => {
    const text = question.trim();
    if (!text) return;
    setQuestion('');
    askCoach(text);
  };

  const randomQuote = wisdom[Math.floor(Math.random() * wisdom.length)];

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="🤖" title={isAr ? 'المدرب الذكي' : 'AI Life Coach'} />

      <main className="max-w-lg mx-auto px-4 py-4">
        <PremiumGate requiredTier="balanced" featureName={isAr ? 'المدرب الذكي' : 'AI Life Coach'}>
          <div className="space-y-4">
            {/* Welcome Card */}
            <div className="bg-gradient-to-br from-[#1a4a3a] to-[#0d3328] rounded-2xl p-4 border border-[#1a4a3a]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🧠</span>
                <h2 className="text-foreground font-bold">
                  {isAr ? 'مدربك الشخصي' : 'Your Personal Coach'}
                </h2>
              </div>
              <p className="text-muted-foreground text-sm">
                {isAr
                  ? 'احصل على نصائح مخصصة بناءً على أهدافك وعاداتك'
                  : 'Get personalized advice based on your goals and habits'}
              </p>
            </div>

            {/* Category Selection */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                <span>🎯</span>
                {isAr ? 'اختر مجال النصيحة' : 'Choose Coaching Area'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat, i) => (
                  <button
                    key={i}
                    onClick={() => askCategoryCoach(cat)}
                    disabled={coachLoading}
                    className={`p-3 rounded-xl text-sm font-medium transition-all border disabled:opacity-50 ${
                      selectedCategory === cat
                        ? 'bg-[#c9a96e]/20 border-[#c9a96e] text-[#c9a96e]'
                        : 'bg-background/50 border-border text-foreground hover:border-primary'
                    }`}
                  >
                    {['🕌', '💪', '💰', '❤️'][i]} {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages + free-text question */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                <span>💬</span>
                {isAr ? 'محادثة المدرب' : 'Coach Chat'}
              </h3>
              {messages.length > 0 && (
                <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
                  {messages.slice(-6).map(msg => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl text-sm ${
                        msg.type === 'user'
                          ? 'bg-primary/10 border border-primary/20 text-foreground ms-8'
                          : 'bg-[#c9a96e]/10 border border-[#c9a96e]/20 text-foreground me-4'
                      }`}
                    >
                      {msg.type === 'coach' && (
                        <span className="text-xs text-[#c9a96e] font-medium block mb-1">
                          🤖 {isAr ? 'المدرب' : 'Coach'}
                        </span>
                      )}
                      {msg.text}
                    </div>
                  ))}
                  {coachLoading && (
                    <div className="p-3 rounded-xl text-sm bg-[#c9a96e]/10 border border-[#c9a96e]/20 text-muted-foreground me-4 flex items-center gap-2">
                      <span className="inline-block w-3 h-3 border-2 border-[#c9a96e] border-t-transparent rounded-full animate-spin" />
                      {isAr ? 'المدرب يكتب...' : 'Coach is thinking...'}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendQuestion(); }}
                  placeholder={isAr ? 'اسأل مدربك الذكي...' : 'Ask your AI coach...'}
                  disabled={coachLoading}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-50"
                />
                <button
                  onClick={sendQuestion}
                  disabled={coachLoading || !question.trim()}
                  className="bg-[#c9a96e] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  ➤
                </button>
              </div>
            </div>

            {/* Goals-Based Advice */}
            {goals.length > 0 && (
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                  <span>📋</span>
                  {isAr ? 'نصائح بناءً على أهدافك' : 'Advice Based on Your Goals'}
                </h3>
                <div className="space-y-2">
                  {goals.slice(0, 3).map(goal => (
                    <div key={goal.id} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                        {(goal.progress || 0)}%
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{goal.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {(goal.progress || 0) < 30
                            ? (isAr ? 'ابدأ بخطوات صغيرة يومية' : 'Start with small daily steps')
                            : (goal.progress || 0) < 70
                            ? (isAr ? 'أنت في الطريق الصحيح!' : 'You\'re on the right track!')
                            : (isAr ? 'أوشكت على الإنجاز!' : 'Almost there!')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Habit Suggestions */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                <span>🌱</span>
                {isAr ? 'عادات مقترحة' : 'Suggested Habits'}
              </h3>
              <div className="space-y-2">
                {habits.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-background/50 transition-all">
                    <span className="text-xl">{h.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{h.habit}</p>
                      <p className="text-xs text-muted-foreground">{h.benefit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivational Wisdom */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                <span>✨</span>
                {isAr ? 'حكمة اليوم' : 'Daily Wisdom'}
              </h3>
              <button
                onClick={() => setShowWisdom(!showWisdom)}
                className="w-full bg-[#c9a96e]/10 border border-[#c9a96e]/30 rounded-xl p-4 text-center transition-all hover:bg-[#c9a96e]/20"
              >
                {showWisdom ? (
                  <div>
                    <p className="text-foreground text-sm italic mb-2">"{randomQuote.text}"</p>
                    <p className="text-[#c9a96e] text-xs font-medium">— {randomQuote.source}</p>
                  </div>
                ) : (
                  <p className="text-[#c9a96e] text-sm font-medium">
                    {isAr ? '✨ اضغط لعرض حكمة اليوم' : '✨ Tap to reveal today\'s wisdom'}
                  </p>
                )}
              </button>
            </div>
          </div>
        </PremiumGate>
      </main>

      <BottomNav />
    </div>
  );
}