# 🕌 AmanahLife — Atoms.dev Master Prompt

## 📂 Source Code
The full source code is available at: https://github.com/HEZZO7/amanahlife
Please clone and analyze this repository completely before doing anything else.

---

## 🎯 مهمتك

أنت مطوّر خبير كلّفت ببناء **AmanahLife** — تطبيق SaaS إسلامي متكامل من الدرجة الأولى (Top-Tier).

**هدفك:** تحليل المشروع بالكامل، ثم نقله وبناءه كمنصة SaaS احترافية مستقلة تماماً — بدون أي اعتماد على خوادم base44 — جاهزة للنشر على Hostinger وكتطبيق Android و iOS.

---

## 📦 ما بين يديك

### الكود الحالي (base44 platform):
- **Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend الحالي (يجب استبداله كلياً):** base44 SDK — Deno serverless functions
- **20 صفحة كاملة** مبنية ومصممة
- **~298 ملف** بمنطق تطبيق متكامل
- **ثنائي اللغة:** عربي كامل RTL + إنجليزي LTR

### قاعدة البيانات الحالية (base44 entities → حوّلها لـ Supabase):
| Entity | الوصف |
|--------|--------|
| Settings | إعدادات المستخدم، اللغة، الاشتراك |
| Task | المهام مع التكرار والأولوية |
| Goal | الأهداف بالفئات والتقدم |
| Transaction | الدخل والمصروفات |
| Budget | حدود الإنفاق الشهرية |
| PrayerLog | تتبع الصلوات اليومية |
| RamadanLog | الصيام، السحور، الإفطار، القرآن |
| CharityLog | الصدقات والزكاة |
| ZakatRecord | حسابات الزكاة |
| WellnessLog | المزاج، النوم، الترطيب، التوتر |
| Event | أحداث التقويم |
| Family + FamilyMember | إدارة العائلة |
| CourseLog + CourseMilestone | التعلم والدورات |
| WorkProject + WorkInvoice | المشاريع والفواتير |
| AIInsight | رؤى الذكاء الاصطناعي |
| Subscription | إدارة الاشتراكات |
| VaultDocuments | وثائق آمنة مشفرة |
| WasiyyahNotes | الوصية الإسلامية |
| ReminderLog | سجل التذكيرات |
| LearningLog | سجل التعلم |
| MahrRecord | سجل المهر |
| HalalScanResults | نتائج فحص الحلال |
| LifeReview | تقارير مراجعة الحياة |
| Invoice | الفواتير العامة |
| Milestone | المراحل |
| FamilyWealth | ثروة العائلة |

### الـ Backend Functions الحالية (base44/Deno → حوّلها لـ Node.js/Express):
1. `generateLifeReview` — تقارير الحياة الشهرية والسنوية بالذكاء الاصطناعي
2. `aiInsightTriggers` — 8 أنواع رؤى ذكاء اصطناعي يومية تلقائية
3. `analyzeHalalTransactions` — تحليل المعاملات للتحقق من الحلال
4. `stripeCheckout` — إنشاء جلسات الدفع
5. `stripeWebhook` — استقبال أحداث Stripe
6. `stripePortal` — بوابة إدارة الاشتراك
7. `prayerReminders` — تذكيرات الصلاة
8. `schedulePrayerReminders` — جدولة تذكيرات الصلاة
9. `prayerTimeNotifications` — إشعارات أوقات الصلاة
10. `taskDueReminders` — تذكيرات استحقاق المهام
11. `overdueTasksReminders` — تذكيرات المهام المتأخرة
12. `notificationTriggers` — نظام الإشعارات الكامل
13. `wellnessReminders` — تذكيرات الصحة اليومية
14. `subscriptionRenewalReminder` — تذكيرات تجديد الاشتراك
15. `archiveCompletedTasks` — أرشفة المهام المكتملة تلقائياً
16. `syncGoalProgress` — مزامنة تقدم الأهداف

---

## 🏗️ المعمارية المطلوبة (Target Architecture)

### Frontend (حافظ على الـ UI كما هو تماماً):
```
React 18 + Vite + Tailwind CSS + shadcn/ui + Framer Motion
↓
استبدل فقط: @base44/sdk → axios + @tanstack/react-query + JWT
↓
أنشئ: src/services/api.js — كل API calls تمر من هنا
```

### Backend الجديد (Node.js):
```
Node.js + Express.js
├── /auth          — JWT authentication + refresh tokens
├── /api/v1/       — REST API لكل entity (CRUD كامل)
├── /webhooks/     — Stripe webhooks
├── /cron/         — Scheduled jobs بـ node-cron
└── /ai/           — Claude API integrations
```

### قاعدة البيانات:
```
Supabase (PostgreSQL)
├── حوّل كل entity لـ SQL table
├── أضف user_id لكل table
├── Row Level Security (RLS) لعزل بيانات المستخدمين
├── Supabase Auth للمصادقة
└── Supabase Storage لـ VaultDocuments
```

### الاستضافة:
```
Frontend → Hostinger Static Hosting أو hPanel
Backend  → Hostinger VPS (Node.js + PM2)
Database → Supabase
CDN      → Cloudflare (اختياري)
```

### Mobile:
```
Capacitor.js فوق React
├── Android APK
├── iOS IPA
├── @capacitor/push-notifications — FCM
├── @capacitor/geolocation — للقبلة وأوقات الصلاة
└── @capacitor/local-notifications — تذكيرات محلية
```

---

## 📱 الميزات الكاملة (لا تفوّت شيئاً)

### 1. Dashboard الرئيسي
- Life Score محسوبة من: صلاة + مهام + صحة + مالية
- تقويم مهام الأسبوع
- ملخص الصلوات اليوم (0/5)
- ملخص مالي (دخل/مصروفات/رصيد)
- رؤى الذكاء الاصطناعي اليومية
- تنبيهات المهام المتأخرة
- أحداث إسلامية وتقويم هجري

### 2. المهام (Planner)
- عرض يومي / أسبوعي / أجندة
- أولوية: عالية / متوسطة / منخفضة
- حالة: قيد الانتظار / جارية / مكتملة
- تكرار: يومي / أسبوعي / شهري
- ربط المهام بالأهداف
- مهام العائلة المشتركة
- قوالب مهام جاهزة (Morning Routine, Weekly Review, etc.)

### 3. المالية (Finance)
- إضافة معاملات بالفئات (طعام، نقل، سكن، صحة...)
- تتبع الميزانية الشهرية
- تنبيه عند 85% و100% من الميزانية
- حاسبة الزكاة (نصاب الذهب والفضة)
- فحص الحلال بالذكاء الاصطناعي
- تصدير Excel/CSV
- فواتير العمل

### 4. الأهداف (Goals)
- فئات: شخصي / مالي / روحي / عائلي / صحي
- تتبع التقدم مع مراحل (Milestones)
- أهداف مشتركة مع العائلة
- ربط المهام بالأهداف

### 5. الروحانيات (Spiritual)
- تتبع الصلوات الخمس يومياً
- سجل قراءة القرآن مع نقاط (0/20 صفحة)
- مؤشر اتجاه القبلة (Compass)
- أوقات الصلاة حسب الموقع (Aladhan API)
- سجل الصدقات والزكاة
- أذكار الصباح والمساء مع عداد تسبيح
- هيت ماب للاستمرارية وStreak

### 6. رمضان (Ramadan)
- سجل الصيام اليومي
- تتبع السحور والإفطار
- شبكة 30 يوم مرئية
- تتبع صفحات القرآن في رمضان
- تخطيط العيد والميزانية
- Ramadan Mode خاص يغيّر الواجهة
- عداد الأيام حتى رمضان

### 7. العائلة (Family)
- إنشاء مجموعة عائلية بكود دعوة
- مهام مشتركة بين أفراد العائلة
- ميزانية مشتركة
- أهداف مشتركة
- ثروة العائلة (FamilyWealth)
- سجل المهر (MahrRecord)

### 8. التعلم (Learning)
- تتبع الدورات (Udemy/Coursera/غيرها)
- مراحل ومعالم لكل دورة
- نسبة الإتمام

### 9. العمل (Work)
- إدارة المشاريع
- فواتير العملاء
- تتبع المدفوع والمتأخر

### 10. الصحة (Wellness)
- سجل يومي: مزاج + نوم + ترطيب + توتر
- رسوم بيانية للاتجاهات (7 أيام / 30 يوم)
- نتيجة الصحة اليومية

### 11. التحليلات (Analytics) — Premium
- اتجاهات المالية 6 أشهر
- انتظام الصلاة
- إتمام المهام
- اتجاه الصحة

### 12. مساعد الذكاء الاصطناعي
- محادثة مع سياق كامل لبيانات المستخدم
- اقتراحات استباقية يومية
- رؤى تلقائية (8 أنواع)

### 13. مراجعة الحياة (Life Reviews) — Premium
- تقرير شهري بالذكاء الاصطناعي
- تقرير سنوي
- تصدير PDF
- مقارنات وتوصيات

### 14. الإنجازات (Achievements)
- شارات ومكافآت
- استمراريات وStreaks

### 15. الخزنة الآمنة (Amana Vault) — Family
- رفع ملفات مشفرة
- مستندات العائلة المهمة
- وثائق الوصية

### 16. البحث (Search)
- بحث شامل في المهام، المعاملات، الأهداف، التقويم

### 17. الأرشيف (Archive)
- المهام والأهداف المكتملة

### 18. الإعدادات (Settings)
- اللغة: عربي/إنجليزي
- الثيم: فاتح/داكن
- الدولة والعملة (16 دولة)
- الأرقام الهندية (اختياري)
- تقويم هجري وأحداث إسلامية
- وضع رمضان
- الإشعارات التفصيلية
- إدارة الاشتراك

---

## 💰 نظام الاشتراكات (SaaS)

### الخطط:
```
Free "رفيق الحياة" — مجاني
├── مهام وأهداف أساسية
├── تتبع الصلاة
├── حاسبة الزكاة
└── تذكيرات أساسية

Premium "الحياة المتوازنة"
├── شهري: $6.99 USD
├── سنوي: $69.99 USD (وفر 17%)
├── كل مميزات Free
├── إدارة الميزانية
├── رؤى الذكاء الاصطناعي (غير محدودة)
├── تقارير الحياة الشهرية والسنوية
└── تذكيرات متقدمة

Family "أمانة العائلة"
├── شهري: $13.99 USD
├── سنوي: $139.99 USD
├── كل مميزات Premium
├── مشاركة العائلة (حتى 5 أفراد)
├── ميزانية مشتركة
└── Amana Vault
```

### العملات: SAR, AED, EGP, KWD, QAR, BHD, OMR, JOD, USD, GBP, EUR, CAD, AUD
### الدفع: Stripe Checkout + Webhooks + Customer Portal

---

## 🔔 نظام الإشعارات

1. مهمة متأخرة (فورية)
2. مهمة تستحق قبل ساعة أو يوم (حسب إعداد المستخدم)
3. أوقات الصلاة (قبل 15 دقيقة افتراضياً، قابل للتعديل)
4. تجاوز الميزانية (85% و100%)
5. رؤى الذكاء الاصطناعي (يومية)
6. تجديد الاشتراك (قبل 7 أيام)
7. تذكيرات الصحة اليومية
8. ساعات الصمت (22:00 - 06:00 افتراضياً)

**Web:** Web Push API
**Mobile:** Firebase Cloud Messaging (FCM)

---

## 🎨 نظام الألوان والثيم (لا تغيّر أبداً)

```css
/* Dark Mode — الافتراضي */
--mizan-bg: #0a2420
--mizan-surface: #112e29
--mizan-emerald: #2d9e6b
--mizan-gold: #c9a84c
--mizan-text: #e8f5f0
--mizan-border: #1e4a42

/* Light Mode */
--mizan-bg: #f0faf5
--mizan-surface: #ffffff
--mizan-emerald: #1a7a52
--mizan-gold: #b8962e
--mizan-text: #1a2e29
```

---

## 🌍 دعم اللغات

- **العربية:** RTL كامل، خط عربي واضح، أرقام هندية اختيارية
- **الإنجليزية:** LTR كامل
- التبديل من الإعدادات أو شاشة الترحيب الأولى

---

## 🚀 خطة العمل المطلوبة خطوة بخطوة

### المرحلة 1: التحليل (ابدأ هنا)
1. استنسخ الـ repo وافهم كل ملف
2. حدّد كل نقاط الاتصال بـ `@base44/sdk`
3. ارسم خريطة الـ data flow الكاملة
4. أعطني تقرير شامل عن حالة المشروع

### المرحلة 2: Backend جديد
1. أنشئ مشروع Node.js + Express منفصل في `/backend`
2. صمّم قاعدة البيانات في Supabase
3. اكتب كل الـ REST API endpoints
4. حوّل كل base44 functions لـ Express routes أو cron jobs
5. اربط Stripe

### المرحلة 3: Frontend Migration
1. احذف `@base44/sdk` و `@base44/vite-plugin`
2. أنشئ `src/services/api.js` مركزي
3. حدّث كل component ليستخدم الـ services الجديدة
4. حافظ على الـ UI بالكامل كما هو في الصور المرفقة

### المرحلة 4: Mobile
1. أضف Capacitor للمشروع
2. اضبط Android و iOS
3. أضف Push Notifications و Geolocation
4. اختبر على Android

### المرحلة 5: Deploy
1. أعدّ `ecosystem.config.js` لـ PM2 على Hostinger VPS
2. أعدّ build script للـ frontend
3. اكتب `DEPLOYMENT.md` بتعليمات كاملة

---

## ✅ معايير النجاح

- [ ] تسجيل مستخدم جديد من الصفر يعمل
- [ ] Onboarding (اختيار لغة + دولة + إعدادات أولية)
- [ ] كل الـ 20 صفحة تعمل بدون أخطاء
- [ ] الاشتراكات عبر Stripe تعمل كاملاً
- [ ] الإشعارات تُرسل في أوقاتها
- [ ] الذكاء الاصطناعي يولّد رؤى وتقارير
- [ ] يعمل على Android و iOS
- [ ] RTL/LTR يتبدّل بسلاسة
- [ ] Dark/Light mode يعمل
- [ ] صفر اعتماد على base44

---

## ⚠️ قواعد لا تتجاوزها

1. **لا تغيّر الـ UI أبداً** — الصور المرفقة هي المرجع الوحيد للتصميم
2. **الألوان الإسلامية محفوظة** — الأخضر الداكن والذهبي هوية التطبيق
3. **الكود موجود بالكامل** — مهمتك نقله وتحريره فقط
4. **كل entity في `/base44/entities/`** يحتوي schema كامل — استخدمه حرفياً
5. **كل function في `/base44/functions/`** فيه منطق كامل — حوّله لـ Node.js
6. **لا تحذف أي ميزة** موجودة في الكود الحالي
7. **اكتب tests** للـ API endpoints المهمة

---

ابدأ بقراءة الـ repo كاملاً، ثم أعطني:
1. تقريرك عن حالة المشروع
2. خطتك التفصيلية للتنفيذ
3. أي أسئلة قبل البدء

🚀 هذا مشروع رائع — ابنه بشكل صحيح ومحترف
