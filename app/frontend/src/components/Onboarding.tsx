import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const ONBOARDING_KEY = 'amanah-onboarding-complete';

const steps = [
  {
    icon: '🕌',
    titleAr: 'مرحباً بك في أمانة',
    titleEn: 'Welcome to AmanahLife',
    descAr: 'رفيقك الشامل للحياة الإسلامية المتوازنة. نساعدك على تنظيم عبادتك، أموالك، وأهدافك في مكان واحد.',
    descEn: 'Your comprehensive companion for a balanced, purposeful life. We help you organize your wellness, lifestyle, and goals in one place.',
  },
  {
    icon: '⭐',
    titleAr: 'المميزات الأساسية',
    titleEn: 'Key Features',
    descAr: 'أوقات الصلاة • قارئ القرآن • عداد الأذكار • حاسبة الزكاة • متتبع الصيام • إدارة المهام • التخطيط المالي',
    descEn: 'Prayer Times • Quran Reader • Dhikr Counter • Giving Tracker • Fasting Tracker • Task Manager • Lifestyle Planning',
  },
  {
    icon: '💎',
    titleAr: 'اكتشف الباقة المميزة',
    titleEn: 'Discover Premium',
    descAr: 'احصل على تخطيط ذكي بالذكاء الاصطناعي، تتبع ميزانية العائلة، رؤى متقدمة، والمزيد مع تجربة مجانية لمدة 7 أيام.',
    descEn: 'Get AI-powered planning, family budget tracking, advanced insights, and more with a free 7-day trial.',
  },
  {
    icon: '🚀',
    titleAr: 'هيا نبدأ!',
    titleEn: "Let's Get Started!",
    descAr: 'ابدأ رحلتك نحو حياة إسلامية منظمة ومتوازنة. بارك الله فيك!',
    descEn: 'Begin your journey towards an organized and balanced life. We are here to support you every step of the way!',
  },
];

export default function Onboarding() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setAnimating(false);
      }, 200);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="relative w-[90%] max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl">
        {/* Skip button */}
        {!isLast && (
          <button
            onClick={handleComplete}
            className="absolute top-4 end-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isAr ? 'تخطي' : 'Skip'}
          </button>
        )}

        {/* Content */}
        <div className={`flex flex-col items-center text-center transition-all duration-200 ${animating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#c9a96e]/20 to-[#1a4a3a]/30 flex items-center justify-center mb-6">
            <span className="text-5xl">{step.icon}</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            {isAr ? step.titleAr : step.titleEn}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-xs">
            {isAr ? step.descAr : step.descEn}
          </p>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-8 h-2 bg-[#c9a96e]'
                  : 'w-2 h-2 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleNext}
          className="w-full bg-[#c9a96e] hover:bg-[#b8944f] text-white font-semibold py-3.5 rounded-xl transition-all text-base"
        >
          {isLast
            ? (isAr ? 'ابدأ الآن' : 'Get Started')
            : (isAr ? 'التالي' : 'Next')}
        </button>
      </div>
    </div>
  );
}