# حزمة CI محلية غير مفعلة

الهدف: f29d8df16e434e8cd064968e4b832e9c8f84e2fb. راجع local-supabase-integration-review-ar.md أولًا. لا تشغيل أو موارد سحابية أو نشر أو دمج في هذه المرحلة.

## مواضع الملفات عند الإيداع في PR #2

- docs/ci/local-supabase-integration-review-ar.md: تقرير الأمان والنتائج والفجوات.
- docs/ci/local-supabase-setup-ar.md: هذه التعليمات.
- docs/ci/local-supabase-static-validation.json: نتائج المراجعة الثابتة فقط.
- docs/ci/notification-local-supabase.yml.proposed: template خارج مسار workflows.
- ci/notification-local/: scripts وsource-manifest ونسخ dependencies المحددة.

## بعد إغلاق عوائق التبعيات والحصول على موافقة تشغيل صريحة لاحقًا

1. أنشئ فرعًا مخصصًا ci/local-notification-validation-approved من commit المقترح الذي تمت مراجعته في PR #2. لا تنشئ فرعًا من f29 وحده؛ ذلك commit لا يحتوي harness.
2. على ذلك الفرع فقط، انسخ docs/ci/notification-local-supabase.yml.proposed إلى .github/workflows/notification-local-supabase.yml. لا تعدل SHA التطبيق أو توسع الشبكة أو تضف secrets. إضافة الملف ودفعه إلى هذا الفرع هو التفعيل ويحتاج الموافقة؛ لا تنفذه الآن. كل push لاحق إلى الفرع قد يعيد التشغيل؛ لا schedule أو PR trigger.
3. راقب Actions. المطلوب نجاح الخطوات كاملة وملخص مراحل مكتمل وتنظيف ناجح. skip/timeout/FAIL/NOT ESTABLISHED ليست نجاح تكامل. لا تشارك status.json أو keys أو JWT أو raw logs؛ شارك الحالة وأسماء الفحوص فقط.

ينشئ harness مشروع CLI محليًا غير مربوط، ومستخدمين اصطناعيين، وجداول الإشعارات وحدها. لا تنفذ setup.sql أو Migration007 من Supabase SQL Editor؛ كلاهما للتشغيل المحلي المحدد داخل الحزمة فقط. لا تحتاج001–006 أو SMTP/OAuth/VAPID/INTERNAL_PUSH_SECRET أو أي مفتاح إنتاجي.

بعد تحميل التبعيات يُحذف proxy الخارجي قبل إنشاء المستخدمين. تحفظ فقط ملفات المصدر الـ13 المسموح بها. الصور ونسخ الخدمات/مفاتيح CLI يفحصها harness في الذاكرة؛ لا يطبعها. تسجيل hashes عند التشغيل لا يغني عن مراجعتها وتثبيتها مسبقًا كما في التقرير.

## التنظيف والفشل

always يستهدف project ID واحدًا مشتقًا من run ID وattempt داخل RUNNER_TEMP، ويوقف local CLI بـno-backup ويتحقق من غياب حاوياته وvolumes والشبكة. لا --all أو موارد حالية أو إنتاج. فشل التنظيف يفشل job ولا يطبع raw logs. إذا مات runner فإن GitHub يزيل آلة الاختبار المؤقتة؛ لا يوجد مشروع مستضاف أو secrets منشأة خارجها. لا تعالج الفشل بتوسعة grants أو تعطيل RLS أو استعمال مفتاح إنتاجي أو فتح الشبكة تلقائيًا.

## فحص الحزمة دون Docker

يمكن تشغيل python3 ci/notification-local/review-static.py للفحوص offline فقط. لا يستدعي Docker أو SQL أو workflow. نجاحه لا يثبت تكامل Supabase. نموذج config upstream استُخدم أيضًا في المراجعة خارج المستودع؛ CLI الحقيقي لم ينفذ هنا.

التكلفة المشروطة والقيود في التقرير. PR #2 مسودة، الاشتراكات No-Go، والمنتجات الرقمية مستقلة.
