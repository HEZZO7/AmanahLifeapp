import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import AppLogo from '@/components/AppLogo';

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const { language, isRTL, setLanguage } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: '🕌',
      title: isAr ? 'أوقات الصلاة' : 'Prayer Times',
      desc: isAr ? 'أوقات دقيقة مع تنبيهات وتتبع الأداء' : 'Accurate times with alerts and performance tracking',
      premium: false,
    },
    {
      icon: '📖',
      title: isAr ? 'قارئ القرآن' : 'Quran Reader',
      desc: isAr ? 'اقرأ واحفظ مع علامات مرجعية وتتبع التقدم' : 'Read and memorize with bookmarks and progress tracking',
      premium: false,
    },
    {
      icon: '💰',
      title: isAr ? 'التتبع المالي' : 'Financial Tracking',
      desc: isAr ? 'ميزانية ذكية وتتبع المصروفات والادخار' : 'Smart budgeting, expense tracking, and savings',
      premium: false,
    },
    {
      icon: '🤖',
      title: isAr ? 'المدرب الذكي' : 'AI Coaching',
      desc: isAr ? 'نصائح مخصصة وتخطيط ذكي بالذكاء الاصطناعي' : 'Personalized advice and AI-powered planning',
      premium: true,
    },
    {
      icon: '👨‍👩‍👧‍👦',
      title: isAr ? 'مشاركة عائلية' : 'Family Sharing',
      desc: isAr ? 'لوحة عائلية مشتركة وأهداف جماعية' : 'Shared family dashboard and group goals',
      premium: true,
    },
    {
      icon: '🌐',
      title: isAr ? 'متعدد اللغات' : 'Multi-Language',
      desc: isAr ? 'دعم كامل للعربية والإنجليزية مع RTL' : 'Full Arabic and English support with RTL',
      premium: false,
    },
    {
      icon: '📷',
      title: isAr ? 'ماسح الفواتير' : 'Receipt Scanner',
      desc: isAr ? 'امسح الفواتير وصنّف المصروفات تلقائياً' : 'Scan receipts and auto-categorize expenses',
      premium: true,
    },
    {
      icon: '📊',
      title: isAr ? 'نقاط الحياة الأسبوعية' : 'Weekly Life Score',
      desc: isAr ? 'تتبع صحتك الروحية والجسدية والمالية' : 'Track your spiritual, health, and financial wellness',
      premium: true,
    },
    {
      icon: '🎯',
      title: isAr ? 'ادخار ذكي' : 'Smart Savings',
      desc: isAr ? 'تحديات ادخار مع مكافآت وإنجازات' : 'Gamified savings challenges with milestones',
      premium: true,
    },
  ];

  const steps = [
    {
      num: '1',
      title: isAr ? 'سجّل حسابك' : 'Sign Up',
      desc: isAr ? 'أنشئ حسابك مجاناً في ثوانٍ' : 'Create your free account in seconds',
    },
    {
      num: '2',
      title: isAr ? 'حدد أهدافك' : 'Set Goals',
      desc: isAr ? 'اختر أهدافك الروحية والمالية والصحية' : 'Choose your spiritual, financial, and health goals',
    },
    {
      num: '3',
      title: isAr ? 'تتبع تقدمك' : 'Track Progress',
      desc: isAr ? 'راقب تقدمك يومياً واحتفل بإنجازاتك' : 'Monitor daily progress and celebrate achievements',
    },
  ];

  const testimonials = [
    {
      name: isAr ? 'أحمد م.' : 'Ahmed M.',
      text: isAr
        ? 'هذا التطبيق غيّر حياتي اليومية. أصبحت أكثر انتظاماً في صلواتي وأهدافي المالية.'
        : 'This app changed my daily life. I became more consistent with my prayers and financial goals.',
      role: isAr ? 'مهندس برمجيات' : 'Software Engineer',
    },
    {
      name: isAr ? 'فاطمة ع.' : 'Fatima A.',
      text: isAr
        ? 'أفضل تطبيق لإدارة الحياة. الميزات العائلية رائعة وتساعدنا على التنسيق.'
        : 'Best life management app. The family features are amazing and help us coordinate.',
      role: isAr ? 'معلمة' : 'Teacher',
    },
    {
      name: isAr ? 'عمر ك.' : 'Omar K.',
      text: isAr
        ? 'المدرب الذكي يقدم نصائح مفيدة جداً. أشعر بتحسن كبير في إنتاجيتي.'
        : 'The AI coach provides very useful advice. I feel a great improvement in my productivity.',
      role: isAr ? 'رائد أعمال' : 'Entrepreneur',
    },
  ];

  const showcaseScreens = [
    {
      label: isAr ? 'لوحة التحكم' : 'Dashboard',
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">AmanahLife</span>
            <div className="flex items-center gap-1 bg-[#1a3d2e] rounded-full px-2 py-0.5">
              <span className="text-[9px] text-primary">EN</span>
              <span className="text-[9px] text-muted-foreground">/</span>
              <span className="text-[9px] text-muted-foreground">عربي</span>
            </div>
          </div>
          <div className="bg-gradient-to-r from-[#C9972A]/20 to-[#C9972A]/5 border border-[#C9972A]/30 rounded-xl p-3 text-center">
            <span className="text-lg font-bold text-[#C9972A]">0 days 🔥</span>
            <p className="text-[9px] text-muted-foreground mt-0.5">{isAr ? 'سلسلة الصلاة' : 'Prayer Streak'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#1a3d2e] rounded-lg p-2 text-center">
              <p className="text-[9px] text-muted-foreground">{isAr ? 'المهام' : 'Tasks'}</p>
              <p className="text-xs font-bold text-white">0/0</p>
            </div>
            <div className="bg-[#1a3d2e] rounded-lg p-2 text-center">
              <p className="text-[9px] text-muted-foreground">{isAr ? 'الصلاة' : 'Prayer'}</p>
              <p className="text-xs font-bold text-white">0/5</p>
            </div>
            <div className="bg-[#1a3d2e] rounded-lg p-2 text-center">
              <p className="text-[9px] text-muted-foreground">{isAr ? 'الأهداف' : 'Goals'}</p>
              <p className="text-xs font-bold text-white">0</p>
            </div>
            <div className="bg-[#1a3d2e] rounded-lg p-2 text-center">
              <p className="text-[9px] text-muted-foreground">{isAr ? 'الادخار' : 'Savings'}</p>
              <p className="text-xs font-bold text-white">+0</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: isAr ? 'أوقات الصلاة' : 'Prayer Times',
      content: (
        <div className="space-y-3">
          <p className="text-xs font-bold text-white">🕌 {isAr ? 'أوقات الصلاة' : 'Prayer Times'}</p>
          <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-3">
            <p className="text-[9px] text-muted-foreground">{isAr ? 'الصلاة القادمة' : 'Next Prayer'}</p>
            <p className="text-sm font-bold text-primary">{isAr ? 'الظهر' : 'Dhuhr'} 12:18</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{isAr ? 'بعد ٥ ساعات و٤٣ دقيقة' : 'in 5h 43m'}</p>
          </div>
          <p className="text-[9px] text-muted-foreground text-center">📍 {isAr ? 'الموقع الحالي' : 'Current Location'}</p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-[#1a3d2e] rounded-full overflow-hidden">
              <div className="h-full w-0 bg-primary rounded-full"></div>
            </div>
            <span className="text-[9px] text-muted-foreground">0/5</span>
          </div>
        </div>
      ),
    },
    {
      label: isAr ? 'القرآن' : 'Quran Reader',
      content: (
        <div className="space-y-3">
          <p className="text-xs font-bold text-white">📖 {isAr ? 'القرآن' : 'Quran'}</p>
          <div className="bg-[#1a3d2e] rounded-xl p-3">
            <p className="text-[9px] text-muted-foreground">{isAr ? 'متابعة القراءة' : 'Continue Reading'}</p>
            <p className="text-sm font-bold text-white mt-0.5">{isAr ? 'البقرة' : 'Al-Baqara'}</p>
            <button className="mt-2 px-3 py-1 bg-primary/20 text-primary text-[9px] rounded-lg font-medium">
              {isAr ? 'استئناف' : 'Resume'}
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-[#1a3d2e] rounded-lg p-2">
              <div>
                <p className="text-[10px] font-medium text-white">{isAr ? 'الفاتحة' : 'Al-Faatiha'}</p>
                <p className="text-[8px] text-muted-foreground">{isAr ? '٧ آيات' : '7 ayahs'}</p>
              </div>
              <span className="text-[10px] text-muted-foreground font-arabic">الفاتحة</span>
            </div>
            <div className="flex items-center justify-between bg-[#1a3d2e] rounded-lg p-2">
              <div>
                <p className="text-[10px] font-medium text-white">{isAr ? 'البقرة' : 'Al-Baqara'}</p>
                <p className="text-[8px] text-muted-foreground">{isAr ? '٢٨٦ آية' : '286 ayahs'}</p>
              </div>
              <span className="text-[10px] text-muted-foreground font-arabic">البقرة</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: isAr ? 'المدرب الذكي' : 'AI Coach',
      content: (
        <div className="space-y-3 relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">🤖 {isAr ? 'المدرب الذكي' : 'AI Life Coach'}</p>
            <span className="text-[8px] bg-[#C9972A]/20 text-[#C9972A] border border-[#C9972A]/30 rounded-full px-1.5 py-0.5 font-semibold">Premium</span>
          </div>
          <div className="space-y-2 opacity-30 blur-[2px]">
            <div className="h-2.5 bg-[#1a3d2e] rounded w-full"></div>
            <div className="h-2.5 bg-[#1a3d2e] rounded w-4/5"></div>
            <div className="h-2.5 bg-[#1a3d2e] rounded w-3/5"></div>
            <div className="h-2.5 bg-[#1a3d2e] rounded w-full"></div>
            <div className="h-2.5 bg-[#1a3d2e] rounded w-2/3"></div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
            <span className="text-2xl mb-1">✨</span>
            <p className="text-[10px] font-bold text-white">{isAr ? 'المدرب الذكي' : 'AI Life Coach'}</p>
            <button className="mt-1.5 px-3 py-1 bg-[#C9972A] text-white text-[8px] rounded-lg font-semibold">
              {isAr ? 'فتح بالاشتراك' : 'Unlock with Premium'}
            </button>
          </div>
        </div>
      ),
    },
    {
      label: isAr ? 'المالية' : 'Finance',
      content: (
        <div className="space-y-3">
          <p className="text-xs font-bold text-white">💰 {isAr ? 'المالية' : 'Finance'}</p>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-[#1a3d2e] rounded-lg p-2 text-center">
              <p className="text-[8px] text-muted-foreground">{isAr ? 'الدخل' : 'Income'}</p>
              <p className="text-[10px] font-bold text-green-400">0</p>
            </div>
            <div className="bg-[#1a3d2e] rounded-lg p-2 text-center">
              <p className="text-[8px] text-muted-foreground">{isAr ? 'المصروفات' : 'Expenses'}</p>
              <p className="text-[10px] font-bold text-red-400">0</p>
            </div>
            <div className="bg-[#1a3d2e] rounded-lg p-2 text-center">
              <p className="text-[8px] text-muted-foreground">{isAr ? 'الادخار' : 'Savings'}</p>
              <p className="text-[10px] font-bold text-[#C9972A]">0%</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-muted-foreground">{isAr ? 'معدل الادخار' : 'Savings Rate'}</span>
              <span className="text-[8px] text-muted-foreground">0%</span>
            </div>
            <div className="h-1.5 bg-[#1a3d2e] rounded-full overflow-hidden">
              <div className="h-full w-0 bg-[#C9972A] rounded-full"></div>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground text-center italic">{isAr ? 'لا توجد معاملات بعد' : 'No transactions yet'}</p>
        </div>
      ),
    },
    {
      label: isAr ? 'العائلة' : 'Family Dashboard',
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">👨‍👩‍👧‍👦 {isAr ? 'العائلة' : 'Family'}</p>
            <span className="text-[8px] bg-primary/20 text-primary border border-primary/30 rounded-lg px-1.5 py-0.5 font-medium">+ {isAr ? 'دعوة' : 'Invite'}</span>
          </div>
          <div className="bg-gradient-to-r from-[#C9972A]/10 to-transparent border border-[#C9972A]/20 rounded-xl p-3 text-center">
            <p className="text-[8px] text-muted-foreground">{isAr ? 'نقاط المسؤولية' : 'Accountability Score'}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="text-sm font-bold text-[#C9972A]">0%</span>
              <span className="text-sm">🏆</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground mb-1.5">{isAr ? 'أفراد العائلة (١)' : 'Family Members (1)'}</p>
            <div className="flex items-center gap-2 bg-[#1a3d2e] rounded-lg p-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[8px] text-primary">👤</span>
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-medium text-white">{isAr ? 'أنت' : 'You'}</p>
                <p className="text-[7px] text-muted-foreground">{isAr ? 'مسؤول / مالك' : 'Admin / Owner'}</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Navigation Bar */}
      <nav className="border-b border-border/50 bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <AppLogo className="w-10 h-10" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{isAr ? 'أمانة لايف' : 'AmanahLife'}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{isAr ? 'رفيقك الذكي لحياة متوازنة' : 'Smart Life Companion'}</span>
            </div>
          </div>

          {/* Desktop Nav Actions - hidden on mobile */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center bg-card border border-border rounded-full p-0.5">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-xs rounded-full transition-all ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('ar')}
                className={`px-2 py-1 text-xs rounded-full transition-all ${language === 'ar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                عربي
              </button>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-card transition-colors"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              {isAr ? 'ابدأ مجاناً' : 'Get Started'}
            </button>
          </div>

          {/* Mobile Hamburger Button - visible on mobile only */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-border hover:bg-card transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/98 backdrop-blur-md px-4 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            {/* Language Toggle */}
            <div className="flex items-center justify-center">
              <div className="flex items-center bg-card border border-border rounded-full p-0.5">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1.5 text-sm rounded-full transition-all ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('ar')}
                  className={`px-3 py-1.5 text-sm rounded-full transition-all ${language === 'ar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  عربي
                </button>
              </div>
            </div>
            {/* Sign In */}
            <button
              onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
              className="w-full px-4 py-3 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-card transition-colors"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            {/* Get Started */}
            <button
              onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
              className="w-full px-4 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              {isAr ? 'ابدأ مجاناً' : 'Get Started'}
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              {isAr ? 'رفيقك لحياة متوازنة وهادفة' : 'Your Companion for a Balanced, Purposeful Life'}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl mx-auto px-2">
              {isAr
                ? 'تطبيق شامل يجمع بين تتبع العبادات، إدارة المالية، التخطيط الذكي، والمدرب الشخصي بالذكاء الاصطناعي.'
                : 'An all-in-one app combining worship tracking, financial management, smart planning, and AI-powered personal coaching.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8 px-4 sm:px-0">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-base sm:text-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              >
                {isAr ? 'ابدأ الآن' : 'Get Started'}
              </button>
              <button
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-8 py-3 border border-border text-foreground rounded-xl font-semibold text-base sm:text-lg hover:bg-card transition-colors"
              >
                {isAr ? 'اعرف المزيد' : 'Learn More'}
              </button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 px-4 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8 sm:mb-12">
              {isAr ? 'كل ما تحتاجه في مكان واحد' : 'Everything You Need in One Place'}
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, i) => (
              <AnimatedSection key={i}>
                <div
                  className={`relative overflow-visible bg-card border border-border rounded-2xl p-5 sm:p-6 transition-all duration-300 ${
                    feature.premium
                      ? 'hover:border-[#C9972A]/50 hover:shadow-lg hover:shadow-[#C9972A]/10'
                      : 'hover:border-primary/50 hover:shadow-lg'
                  }`}
                >
                  {feature.premium && (
                    <span
                      className={`absolute -top-3 ${isRTL ? 'left-4' : 'right-4'} bg-[#C9972A]/10 border border-[#C9972A]/40 text-[#C9972A] rounded-full px-2.5 py-0.5 text-xs font-semibold`}
                    >
                      ✨ Premium
                    </span>
                  )}
                  <span className="text-3xl sm:text-4xl block mb-3 sm:mb-4">{feature.icon}</span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.desc}</p>

                  {/* AI Coaching preview */}
                  {feature.icon === '🤖' && (
                    <div className="mt-4 rounded-xl p-3 bg-[#C9972A]/5 border border-[#C9972A]/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C9972A]"></span>
                        <span className="text-[10px] text-muted-foreground ml-1 uppercase tracking-wide">Live preview</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic m-0">
                        {isAr
                          ? '"أكملت ٣ من ٥ صلوات هذا الأسبوع. انتظام الفجر يحتاج اهتماماً. إليك خطة التحسين..."'
                          : '"You completed 3/5 prayers this week. Your Fajr consistency needs attention. Here\'s your 7-day plan..."'}
                      </p>
                    </div>
                  )}

                  {/* Receipt Scanner preview */}
                  {feature.icon === '📷' && (
                    <div className="mt-4 rounded-xl p-3 bg-primary/5 border border-primary/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        <span className="text-[10px] text-muted-foreground ml-1 uppercase tracking-wide">Live preview</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="text-xl flex-shrink-0">📷</span>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground italic">{isAr ? 'جارٍ مسح الفاتورة...' : 'Scanning receipt...'}</span>
                          <span className="text-xs text-green-500 font-semibold">{isAr ? '✓ أُضيف: قهوة $٤.٥٠ ← المصروفات' : '✓ Added: Coffee $4.50 → Expenses'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* App Showcase */}
      <section className="py-12 sm:py-16 px-4 bg-[#112920]">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10 sm:mb-12">
              <span className="inline-block bg-primary/10 border border-primary text-primary rounded-full px-4 py-1 text-xs font-semibold mb-4">
                {isAr ? 'التطبيق' : 'THE APP'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                {isAr ? 'شاهد التطبيق أثناء العمل' : 'See the App in Action'}
              </h2>
              <p className="text-[#9DB8B0] text-sm">
                {isAr ? 'شاشات حقيقية من التطبيق. بدون تصاميم وهمية.' : 'Real screens from the app. No mockups.'}
              </p>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {showcaseScreens.map((screen, i) => (
              <AnimatedSection key={i}>
                <div className="min-w-[240px] sm:min-w-0 snap-start flex flex-col gap-3">
                  <div className="bg-[#0A1A14] border border-primary/15 rounded-2xl p-3.5 flex-1">
                    {screen.content}
                  </div>
                  <p className="text-center text-sm font-semibold text-primary">{screen.label}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8 sm:mb-12">
              {isAr ? 'كيف يعمل' : 'How It Works'}
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((step, i) => (
              <AnimatedSection key={i}>
                <div className="text-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mx-auto mb-4">
                    <span className="text-lg sm:text-xl font-bold text-primary">{step.num}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-12 sm:py-16 px-4 bg-card/50">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              {isAr ? 'خطط بسيطة وشفافة' : 'Simple, Transparent Pricing'}
            </h2>
            <p className="text-muted-foreground mb-6 sm:mb-8">
              {isAr ? 'ابدأ مجاناً. قم بالترقية عندما تكون جاهزاً.' : 'Start free. Upgrade when you are ready.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
                <h3 className="font-bold text-foreground">{isAr ? 'مجاني' : 'Free'}</h3>
                <p className="text-2xl font-bold text-foreground mt-2">$0</p>
                <p className="text-sm text-muted-foreground mt-1">{isAr ? 'الميزات الأساسية' : 'Basic features'}</p>
              </div>
              <div className="bg-card border-2 border-[#D4A017] rounded-xl p-4 sm:p-5 shadow-lg">
                <h3 className="font-bold text-[#D4A017]">{isAr ? 'المتوازنة' : 'Balanced'}</h3>
                <p className="text-2xl font-bold text-foreground mt-2">$6.99<span className="text-sm text-muted-foreground">/{isAr ? 'شهر' : 'mo'}</span></p>
                <p className="text-sm text-muted-foreground mt-1">{isAr ? 'ميزات AI متقدمة' : 'Advanced AI features'}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
                <h3 className="font-bold text-foreground">{isAr ? 'العائلة' : 'Family'}</h3>
                <p className="text-2xl font-bold text-foreground mt-2">$12.99<span className="text-sm text-muted-foreground">/{isAr ? 'شهر' : 'mo'}</span></p>
                <p className="text-sm text-muted-foreground mt-1">{isAr ? 'حتى 6 أفراد' : 'Up to 6 members'}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              {isAr ? 'عرض جميع الأسعار' : 'See Full Pricing'}
            </button>
          </AnimatedSection>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8 sm:mb-12">
              {isAr ? 'ماذا يقول مستخدمونا' : 'What Our Users Say'}
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((t, i) => (
              <AnimatedSection key={i}>
                <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
                  <p className="text-muted-foreground text-sm italic mb-4">&ldquo;{t.text}&rdquo;</p>
                  <div>
                    <p className="font-bold text-foreground text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 px-4 bg-primary/5">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatedSection>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              {isAr ? 'ابدأ رحلتك اليوم' : 'Start Your Journey Today'}
            </h2>
            <p className="text-muted-foreground mb-6 sm:mb-8 px-2">
              {isAr ? 'انضم إلى آلاف المستخدمين الذين يعيشون حياة أكثر توازناً وإنتاجية.' : 'Join thousands of users living a more balanced and productive life.'}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-10 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-base sm:text-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
              {isAr ? 'سجّل مجاناً' : 'Sign Up Free'}
            </button>
          </AnimatedSection>
        </div>
      </section>

      <Footer />
    </div>
  );
}