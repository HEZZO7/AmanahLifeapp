import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTimeFormat } from '@/contexts/TimeFormatContext';
import BottomNav from '@/components/BottomNav';
import PremiumGate from '@/components/PremiumGate';
import PageHeader from '@/components/PageHeader';

const SAMPLE_SCHEDULE_AR = [
  { time: '05:00', task: 'صلاة الفجر + أذكار الصباح', priority: 'high' },
  { time: '06:00', task: 'تلاوة القرآن (جزء واحد)', priority: 'high' },
  { time: '07:00', task: 'رياضة خفيفة + إفطار صحي', priority: 'medium' },
  { time: '08:00', task: 'العمل - المهام ذات الأولوية العالية', priority: 'high' },
  { time: '12:00', task: 'صلاة الظهر + استراحة', priority: 'high' },
  { time: '14:00', task: 'العمل - اجتماعات ومتابعات', priority: 'medium' },
  { time: '15:30', task: 'صلاة العصر', priority: 'high' },
  { time: '18:00', task: 'صلاة المغرب + وقت العائلة', priority: 'high' },
  { time: '19:30', task: 'صلاة العشاء + أذكار المساء', priority: 'high' },
  { time: '21:00', task: 'مراجعة اليوم + التخطيط للغد', priority: 'medium' },
];

const SAMPLE_SCHEDULE_EN = [
  { time: '05:00', task: 'Fajr Prayer + Morning Adhkar', priority: 'high' },
  { time: '06:00', task: 'Quran Recitation (1 Juz)', priority: 'high' },
  { time: '07:00', task: 'Light Exercise + Healthy Breakfast', priority: 'medium' },
  { time: '08:00', task: 'Work - High Priority Tasks', priority: 'high' },
  { time: '12:00', task: 'Dhuhr Prayer + Break', priority: 'high' },
  { time: '14:00', task: 'Work - Meetings & Follow-ups', priority: 'medium' },
  { time: '15:30', task: 'Asr Prayer', priority: 'high' },
  { time: '18:00', task: 'Maghrib Prayer + Family Time', priority: 'high' },
  { time: '19:30', task: 'Isha Prayer + Evening Adhkar', priority: 'high' },
  { time: '21:00', task: 'Day Review + Tomorrow Planning', priority: 'medium' },
];

const TIPS_AR = [
  'ابدأ يومك بأذكار الصباح لتحسين التركيز والإنتاجية',
  'خصص وقتاً ثابتاً للقرآن بعد الفجر مباشرة',
  'اجعل المهام الصعبة في الصباح الباكر عندما تكون طاقتك في أعلى مستوى',
  'خذ استراحات قصيرة بين المهام للحفاظ على الإنتاجية',
];

const TIPS_EN = [
  'Start your day with morning adhkar to improve focus and productivity',
  'Dedicate fixed time for Quran right after Fajr',
  'Schedule difficult tasks in early morning when energy is highest',
  'Take short breaks between tasks to maintain productivity',
];

export default function AIPlanning() {
  const { language } = useLanguage();
  const { formatTime } = useTimeFormat();
  const isAr = language === 'ar';
  const [showSchedule, setShowSchedule] = useState(false);

  const schedule = isAr ? SAMPLE_SCHEDULE_AR : SAMPLE_SCHEDULE_EN;
  const tips = isAr ? TIPS_AR : TIPS_EN;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="🧠" title={isAr ? 'التخطيط الذكي' : 'Smart Planning'} />

      <main className="max-w-lg mx-auto px-4 py-4">
        <PremiumGate requiredTier="balanced" featureName={isAr ? 'التخطيط الذكي' : 'Smart Planning'}>
          <div className="space-y-4">
            {/* AI Suggestions Header */}
            <div className="bg-gradient-to-br from-[#1a4a3a] to-[#0d3328] rounded-2xl p-4 border border-[#1a4a3a]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✨</span>
                <h2 className="text-foreground font-bold">
                  {isAr ? 'مساعد التخطيط بالذكاء الاصطناعي' : 'AI Planning Assistant'}
                </h2>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                {isAr
                  ? 'احصل على جدول يومي مخصص يراعي أوقات الصلاة وأولوياتك'
                  : 'Get a personalized daily schedule that respects prayer times and your priorities'}
              </p>
              <button
                onClick={() => setShowSchedule(true)}
                className="w-full bg-[#c9a96e] hover:bg-[#b8944f] text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {isAr ? 'إنشاء خطة اليوم' : 'Generate Today\'s Plan'}
              </button>
            </div>

            {/* Generated Schedule */}
            {showSchedule && (
              <div className="bg-card rounded-2xl p-4 border border-border animate-in fade-in duration-300">
                <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                  <span>📋</span>
                  {isAr ? 'جدولك المقترح لليوم' : 'Your Suggested Schedule'}
                </h3>
                <div className="space-y-2">
                  {schedule.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-all">
                      <span className="text-xs text-muted-foreground font-mono w-14">{formatTime(item.time)}</span>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        item.priority === 'high' ? 'bg-emerald-400' : 'bg-[#c9a96e]'
                      }`} />
                      <span className="text-foreground text-sm flex-1">{item.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Recommendations */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                <span>🎯</span>
                {isAr ? 'توصيات الأولويات' : 'Priority Recommendations'}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <span className="text-xs font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded">
                    {isAr ? 'عاجل' : 'URGENT'}
                  </span>
                  <span className="text-foreground text-sm">
                    {isAr ? 'مراجعة الميزانية الشهرية' : 'Monthly Budget Review'}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#c9a96e]/10 border border-[#c9a96e]/20">
                  <span className="text-xs font-bold text-[#c9a96e] bg-[#c9a96e]/20 px-2 py-0.5 rounded">
                    {isAr ? 'مهم' : 'IMPORTANT'}
                  </span>
                  <span className="text-foreground text-sm">
                    {isAr ? 'إكمال ورد القرآن اليومي' : 'Complete Daily Quran Portion'}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                    {isAr ? 'مقترح' : 'SUGGESTED'}
                  </span>
                  <span className="text-foreground text-sm">
                    {isAr ? 'تمارين رياضية 30 دقيقة' : '30 Minutes Exercise'}
                  </span>
                </div>
              </div>
            </div>

            {/* Personalized Tips */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
                <span>💡</span>
                {isAr ? 'نصائح مخصصة لك' : 'Personalized Tips'}
              </h3>
              <div className="space-y-2">
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 p-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span className="text-muted-foreground text-sm">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PremiumGate>
      </main>

      <BottomNav />
    </div>
  );
}