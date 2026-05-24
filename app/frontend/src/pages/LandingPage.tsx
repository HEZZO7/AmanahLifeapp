import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import AppLogo from '@/components/AppLogo';

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const { language, isRTL, setLanguage } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();

  const features = [
    {
      icon: '🕌',
      title: isAr ? 'أوقات الصلاة' : 'Prayer Times',
      desc: isAr ? 'أوقات دقيقة مع تنبيهات وتتبع الأداء' : 'Accurate times with alerts and performance tracking',
    },
    {
      icon: '📖',
      title: isAr ? 'قارئ القرآن' : 'Quran Reader',
      desc: isAr ? 'اقرأ واحفظ مع علامات مرجعية وتتبع التقدم' : 'Read and memorize with bookmarks and progress tracking',
    },
    {
      icon: '💰',
      title: isAr ? 'التتبع المالي' : 'Financial Tracking',
      desc: isAr ? 'ميزانية ذكية وتتبع المصروفات والادخار' : 'Smart budgeting, expense tracking, and savings',
    },
    {
      icon: '🤖',
      title: isAr ? 'المدرب الذكي' : 'AI Coaching',
      desc: isAr ? 'نصائح مخصصة وتخطيط ذكي بالذكاء الاصطناعي' : 'Personalized advice and AI-powered planning',
    },
    {
      icon: '👨‍👩‍👧‍👦',
      title: isAr ? 'مشاركة عائلية' : 'Family Sharing',
      desc: isAr ? 'لوحة عائلية مشتركة وأهداف جماعية' : 'Shared family dashboard and group goals',
    },
    {
      icon: '🌐',
      title: isAr ? 'متعدد اللغات' : 'Multi-Language',
      desc: isAr ? 'دعم كامل للعربية والإنجليزية مع RTL' : 'Full Arabic and English support with RTL',
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
          <div className="flex items-center gap-3">
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
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
              {isAr ? 'رفيقك لحياة متوازنة وهادفة' : 'Your Companion for a Balanced, Purposeful Life'}
            </h1>
            <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
              {isAr
                ? 'تطبيق شامل يجمع بين تتبع العبادات، إدارة المالية، التخطيط الذكي، والمدرب الشخصي بالذكاء الاصطناعي.'
                : 'An all-in-one app combining worship tracking, financial management, smart planning, and AI-powered personal coaching.'}
            </p>
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              >
                {isAr ? 'ابدأ الآن' : 'Get Started'}
              </button>
              <button
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-3 border border-border text-foreground rounded-xl font-semibold text-lg hover:bg-card transition-colors"
              >
                {isAr ? 'اعرف المزيد' : 'Learn More'}
              </button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-foreground text-center mb-12">
              {isAr ? 'كل ما تحتاجه في مكان واحد' : 'Everything You Need in One Place'}
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <AnimatedSection key={i}>
                <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg transition-all duration-300">
                  <span className="text-4xl block mb-4">{feature.icon}</span>
                  <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-foreground text-center mb-12">
              {isAr ? 'كيف يعمل' : 'How It Works'}
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <AnimatedSection key={i}>
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-primary">{step.num}</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-16 px-4 bg-card/50">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {isAr ? 'خطط بسيطة وشفافة' : 'Simple, Transparent Pricing'}
            </h2>
            <p className="text-muted-foreground mb-8">
              {isAr ? 'ابدأ مجاناً. قم بالترقية عندما تكون جاهزاً.' : 'Start free. Upgrade when you are ready.'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-bold text-foreground">{isAr ? 'مجاني' : 'Free'}</h3>
                <p className="text-2xl font-bold text-foreground mt-2">$0</p>
                <p className="text-sm text-muted-foreground mt-1">{isAr ? 'الميزات الأساسية' : 'Basic features'}</p>
              </div>
              <div className="bg-card border-2 border-[#D4A017] rounded-xl p-5 shadow-lg">
                <h3 className="font-bold text-[#D4A017]">{isAr ? 'المتوازنة' : 'Balanced'}</h3>
                <p className="text-2xl font-bold text-foreground mt-2">$6.99<span className="text-sm text-muted-foreground">/{isAr ? 'شهر' : 'mo'}</span></p>
                <p className="text-sm text-muted-foreground mt-1">{isAr ? 'ميزات AI متقدمة' : 'Advanced AI features'}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
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
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-foreground text-center mb-12">
              {isAr ? 'ماذا يقول مستخدمونا' : 'What Our Users Say'}
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <AnimatedSection key={i}>
                <div className="bg-card border border-border rounded-2xl p-6">
                  <p className="text-muted-foreground text-sm italic mb-4">"{t.text}"</p>
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
      <section className="py-16 px-4 bg-primary/5">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {isAr ? 'ابدأ رحلتك اليوم' : 'Start Your Journey Today'}
            </h2>
            <p className="text-muted-foreground mb-8">
              {isAr ? 'انضم إلى آلاف المستخدمين الذين يعيشون حياة أكثر توازناً وإنتاجية.' : 'Join thousands of users living a more balanced and productive life.'}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="px-10 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
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