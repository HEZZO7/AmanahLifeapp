import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
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

const COACHING_RESPONSES = {
  en: {
    'Spiritual Growth': [
      'Based on your prayer streak, try adding 10 minutes of Quran reflection after Fajr. Small consistent acts are more beloved to Allah than large sporadic ones.',
      'Consider setting a weekly goal to memorize 3 new ayahs. Your consistency in dhikr shows you have the discipline for it.',
      'Your spiritual growth is on track! Try incorporating dua during your commute to maximize blessed moments.',
    ],
    'Health & Fitness': [
      'I notice you haven\'t logged wellness data recently. Start with just 5 minutes of stretching after Fajr prayer.',
      'Hydration is key! Try drinking water at each prayer time - that\'s 5 glasses minimum throughout the day.',
      'Consider fasting Mondays and Thursdays - it combines spiritual reward with proven health benefits.',
    ],
    'Financial Wisdom': [
      'Your savings rate could improve. Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings & charity.',
      'Review your subscriptions this week. Even small recurring expenses add up over a year.',
      'Consider setting up automatic transfers to your savings on payday - pay yourself first!',
    ],
    'Relationships': [
      'Schedule a weekly family activity. Quality time strengthens bonds more than expensive gifts.',
      'Reach out to a friend you haven\'t spoken to in a while. The Prophet ﷺ emphasized maintaining ties.',
      'Practice active listening today. Put your phone away during conversations with loved ones.',
    ],
  },
  ar: {
    'النمو الروحي': [
      'بناءً على سلسلة صلواتك، حاول إضافة 10 دقائق من تدبر القرآن بعد الفجر. الأعمال الصغيرة المستمرة أحب إلى الله من الكبيرة المنقطعة.',
      'فكر في تحديد هدف أسبوعي لحفظ 3 آيات جديدة. التزامك بالذكر يدل على أن لديك الانضباط لذلك.',
      'نموك الروحي على المسار الصحيح! حاول دمج الدعاء أثناء تنقلك لتعظيم اللحظات المباركة.',
    ],
    'الصحة واللياقة': [
      'ألاحظ أنك لم تسجل بيانات صحية مؤخراً. ابدأ بـ 5 دقائق فقط من التمدد بعد صلاة الفجر.',
      'الترطيب مهم! حاول شرب الماء عند كل صلاة - هذا 5 أكواب كحد أدنى خلال اليوم.',
      'فكر في صيام الاثنين والخميس - يجمع بين الأجر الروحي والفوائد الصحية المثبتة.',
    ],
    'الحكمة المالية': [
      'معدل ادخارك يمكن أن يتحسن. جرب قاعدة 50/30/20: 50% احتياجات، 30% رغبات، 20% ادخار وصدقة.',
      'راجع اشتراكاتك هذا الأسبوع. حتى المصاريف المتكررة الصغيرة تتراكم على مدار العام.',
      'فكر في إعداد تحويلات تلقائية لمدخراتك يوم الراتب - ادفع لنفسك أولاً!',
    ],
    'العلاقات': [
      'خصص نشاطاً عائلياً أسبوعياً. الوقت الجيد يقوي الروابط أكثر من الهدايا الغالية.',
      'تواصل مع صديق لم تتحدث معه منذ فترة. النبي ﷺ أكد على صلة الرحم.',
      'مارس الاستماع الفعال اليوم. ضع هاتفك جانباً أثناء المحادثات مع أحبائك.',
    ],
  },
};

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
  const isAr = language === 'ar';
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showWisdom, setShowWisdom] = useState(false);

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

  const askCoach = (category: string) => {
    setSelectedCategory(category);
    const lang = isAr ? 'ar' : 'en';
    const catKey = category as keyof typeof COACHING_RESPONSES.en;
    const responses = COACHING_RESPONSES[lang][catKey] || [];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    const userMsg: CoachMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: isAr ? `أحتاج نصيحة حول: ${category}` : `I need advice on: ${category}`,
      timestamp: Date.now(),
    };

    const coachMsg: CoachMessage = {
      id: (Date.now() + 1).toString(),
      type: 'coach',
      text: randomResponse || (isAr ? 'استمر في العمل الجيد!' : 'Keep up the great work!'),
      timestamp: Date.now() + 100,
    };

    setMessages(prev => [...prev, userMsg, coachMsg]);
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
                    onClick={() => askCoach(cat)}
                    className={`p-3 rounded-xl text-sm font-medium transition-all border ${
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

            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                  <span>💬</span>
                  {isAr ? 'محادثة المدرب' : 'Coach Chat'}
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
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
                </div>
              </div>
            )}

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