import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';

export default function ContactSupport() {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const subjectOptions = [
    { value: 'general', label: isAr ? 'استفسار عام' : 'General' },
    { value: 'bug', label: isAr ? 'تقرير خطأ' : 'Bug Report' },
    { value: 'billing', label: isAr ? 'الفوترة' : 'Billing' },
    { value: 'feature', label: isAr ? 'طلب ميزة' : 'Feature Request' },
    { value: 'other', label: isAr ? 'أخرى' : 'Other' },
  ];

  const faqs = [
    {
      q: isAr ? 'كيف يمكنني إعادة تعيين كلمة المرور؟' : 'How can I reset my password?',
      a: isAr
        ? 'انقر على "نسيت كلمة المرور" في صفحة تسجيل الدخول وأدخل بريدك الإلكتروني. ستتلقى رابطاً لإعادة التعيين.'
        : 'Click "Forgot Password" on the login page and enter your email. You will receive a reset link.',
    },
    {
      q: isAr ? 'كيف يمكنني إلغاء اشتراكي؟' : 'How can I cancel my subscription?',
      a: isAr
        ? 'اذهب إلى الإعدادات > الاشتراك > إلغاء الاشتراك. ستستمر في الوصول حتى نهاية فترة الفوترة.'
        : 'Go to Settings > Subscription > Cancel Subscription. You will retain access until the end of your billing period.',
    },
    {
      q: isAr ? 'هل بياناتي آمنة؟' : 'Is my data secure?',
      a: isAr
        ? 'نعم، نستخدم تشفير SSL وقواعد بيانات آمنة. بياناتك محمية وفقاً لمعايير الصناعة.'
        : 'Yes, we use SSL encryption and secure databases. Your data is protected according to industry standards.',
    },
    {
      q: isAr ? 'هل يمكنني تصدير بياناتي؟' : 'Can I export my data?',
      a: isAr
        ? 'نعم، اذهب إلى الإعدادات > تصدير البيانات لتنزيل بياناتك بتنسيق JSON أو CSV.'
        : 'Yes, go to Settings > Export Data to download your data in JSON or CSV format.',
    },
    {
      q: isAr ? 'كيف تعمل أوقات الصلاة؟' : 'How do prayer times work?',
      a: isAr
        ? 'نستخدم موقعك الجغرافي مع واجهة Aladhan API لحساب أوقات الصلاة الدقيقة لمنطقتك.'
        : 'We use your geolocation with the Aladhan API to calculate accurate prayer times for your area.',
    },
    {
      q: isAr ? 'هل التطبيق متاح بدون إنترنت؟' : 'Is the app available offline?',
      a: isAr
        ? 'معظم الميزات تعمل بدون إنترنت باستخدام التخزين المحلي. بعض الميزات مثل أوقات الصلاة تحتاج اتصال.'
        : 'Most features work offline using local storage. Some features like prayer times require an internet connection.',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = JSON.parse(localStorage.getItem('support_messages') || '[]');
    existing.push({ ...formData, timestamp: new Date().toISOString() });
    localStorage.setItem('support_messages', JSON.stringify(existing));
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="💬" title={isAr ? 'الدعم والتواصل' : 'Contact & Support'} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Response time notice */}
        <div className="mb-6 bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="font-semibold text-foreground">
              {isAr ? 'وقت الاستجابة المتوقع' : 'Expected Response Time'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isAr ? 'في أقرب وقت ممكن' : 'As soon as possible'}
            </p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mb-8 bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-bold text-foreground mb-3">
            {isAr ? 'تواصل معنا مباشرة' : 'Contact Us Directly'}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xl">📧</span>
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'الدعم الفني' : 'Support'}</p>
              <a
                href="mailto:support@amanahlife.com"
                className="text-primary hover:underline"
              >
                support@amanahlife.com
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl">👤</span>
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'الرئيس التنفيذي' : 'CEO'}</p>
              <a
                href="mailto:CEO@amanahlife.com"
                className="text-primary hover:underline"
              >
                CEO@amanahlife.com
              </a>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="mb-8 bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {isAr ? 'أرسل لنا رسالة' : 'Send Us a Message'}
          </h2>

          {submitted ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-3 block">✅</span>
              <p className="text-lg font-bold text-foreground">
                {isAr ? 'تم إرسال رسالتك بنجاح!' : 'Your message has been sent!'}
              </p>
              <p className="text-muted-foreground mt-2">
                {isAr ? 'سنرد عليك في أقرب وقت ممكن.' : "We'll get back to you as soon as possible."}
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ name: '', email: '', subject: '', message: '' });
                }}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
              >
                {isAr ? 'إرسال رسالة أخرى' : 'Send Another Message'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {isAr ? 'الاسم' : 'Name'}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
                  placeholder={isAr ? 'اسمك الكامل' : 'Your full name'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {isAr ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
                  placeholder={isAr ? 'your@email.com' : 'your@email.com'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {isAr ? 'الموضوع' : 'Subject'}
                </label>
                <select
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">{isAr ? 'اختر الموضوع' : 'Select a subject'}</option>
                  {subjectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {isAr ? 'الرسالة' : 'Message'}
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary resize-none"
                  placeholder={isAr ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                {isAr ? 'إرسال' : 'Send Message'}
              </button>
            </form>
          )}
        </div>

        {/* FAQ Section */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-background/50 transition-colors"
                >
                  <span className="font-medium text-foreground text-sm">{faq.q}</span>
                  <span className="text-muted-foreground text-lg ml-2 rtl:mr-2 rtl:ml-0">
                    {expandedFaq === index ? '−' : '+'}
                  </span>
                </button>
                {expandedFaq === index && (
                  <div className="px-3 pb-3 text-sm text-muted-foreground">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}