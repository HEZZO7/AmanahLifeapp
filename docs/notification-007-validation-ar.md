# التحقق المعزول من Migration 007

PR #2 مسودة. لا إذن SQL إنتاجي أو نشر أو دمج. الاشتراكات المدفوعة **No-Go** والمنتجات الرقمية مستقلة. لا تغيير لمنطق الفوترة أو 001–006 أو Edge/Cron/Webhooks/Lemon Squeezy.

## التغيير والدليل

- يضيف فحص 007 النهائي `MAINTAIN` و`MAINTAIN WITH GRANT OPTION` إلى `has_table_privilege` على PostgreSQL 17+ فقط؛ 15/16 لا تقبل اسم الصلاحية. يفحص الوصول الفعلي، بما فيه PUBLIC والوراثة. لا يسحب منح دور مخصص مجهول تلقائيًا؛ وجود وصول متبقٍّ يُفشل المعاملة كاملة.
- النموذج يطابق metadata CSV: `id uuid PRIMARY KEY` و`user_id NOT NULL UNIQUE` للتفضيلات، ومفاتيح خارجية بلا افتراض CASCADE؛ NOT NULL لـtimezone/language وcreated_at/updated_at، ولـendpoint/p256dh/auth_key في Push؛ markers من نوع `date`؛ الأعلام الستة nullable؛ السياسات الثماني القديمة، منها PUBLIC ALL true. تعابير defaults الإنتاجية محجوبة في CSV؛ UTC/en/now/gen_random_uuid **قيم اختبار تمثيلية** وليست إثباتًا لتعابير الإنتاج.
- SQL يعمل مرتين، مع مقارنة الصفوف كاملة واختبار العزل والإدراج الأول والموقع وعمليات الخادم. اختبارات الفشل تقارن البيانات وACL الأعمدة والجداول وRLS والسياسات وOIDs والفهارس والقيود قبل محاولة الترحيل وبعد rollback.
- PG17: سحب MAINTAIN المباشر لثلاثة أدوار/جدولين، ثم 12 حالة وراثة (كل دور × كل جدول × مع/دون grant option) وحالة SELECT موروثة. PG15: تجاوز الاسم غير المدعوم مع اختبار rollback الوراثة المعتاد.
- Job مستقل على PG15 وPG17 بمالك postgres غير superuser لكنه BYPASSRLS/CREATEROLE كما في الإنتاج. لا كائنات دفع في bootstrap. PostgREST **v12.2.12** فعلي مع HS256 عشوائي وauthenticator NOINHERIT وSET ROLE وJWT claims. لا أسرار مستضافة في CI.

## حدود الإثبات وتوافق العميل

SQL اليدوي `ON CONFLICT ... DO UPDATE SET timezone=...` ليس طلب Supabase-js نفسه. PostgREST merge-duplicates يُدخل أعمدة الطلب، ومنها user_id، في فرع UPDATE؛ و007 يمنع UPDATE(user_id) عمدًا.

المشغّل يفحص طلبَي الويب الحاليين: location upsert في `PrayerTimes.tsx` وpreference upsert في `BackupRestore.tsx`. عند رفضهما يسجل **BLOCKED** في `notification-postgrest-results.json`، ولا يدعي توافق العميل. PATCH ذاتي محدود للأعلام والموقع يُختبر كعملية مسموحة، لكنه لا يستبدل العميل تلقائيًا هنا. إذا ثبت الرفض يلزم إصلاح متوافق مستقل واختبارات إدراج/تحديث/تزامن وفشل حفظ؛ لا توسيع UPDATE(user_id) لمجرد تمرير الاختبار.

**نجاح اختبارات الأمن لا يعني نجاح توافق العميل أو جاهزية الطرح.** التقرير يفصل `securityPassed` و`compatibility` و`hostedAuthVerified`، ويظل `rolloutReady=false`؛ الـprobes التشخيصية ليست اختبارات قبول ناجحة للتوافق.

## الاختبار المستضاف — مُجهّز، لا يُنفذ دون بيئة معتمدة

لم ينشأ مشروع أو مورد أو مستخدم. لا تتوفر جلسات مستضافة معتمدة هنا. HTTP الآلي يعمل داخل CI فقط؛ لا يثبت بوابة Supabase المستضافة أو إصدار PostgREST أو JWKS أو البنية المنشورة.

بعد موافقة منفصلة فقط، على مشغّل مخول:

1. اختيار مشروع Supabase **معزول قائم ومعتمد**، بلا عملاء أو إرسال/وظائف مجدولة. لا الإنتاج ولا alias له، ولا حاجة إلى Lemon Squeezy أو تبديل وضع المتجر.
2. تجهيز جداول الإشعارات المطابقة و007 بالعزل بإجراء معتمد؛ حسابان مختلفان وصف تفضيلات مسبق لكل حساب. metadata للمستخدمين `amanahlife_fixture: "notification-007"`. لا ينفذ المشغّل هذا الإعداد أو ينشئ مستخدمين.
3. تسجيل الدخول محليًا للحسابين والحصول على جلستين قصيرتين، مع publishable/anon key فقط؛ لا service_role ولا signing secret. لا مشاركة مفاتيح/JWT في الدردشة أو Git.
4. تخزين متغيرات الاختبار في ملف 0600 **خارج المستودع**، ثم Node 22+:

```sh
node --env-file=/absolute/path/outside-repo/notification-isolated.env app/frontend/tests/notification-postgrest-integration.mjs
```

الأسماء المطلوبة (القيم يضعها المشغّل محليًا فقط):

```text
NOTIFICATION_TEST_MODE=isolated-hosted
NOTIFICATION_TEST_MUTATION=synthetic-users-only
NOTIFICATION_TEST_PROJECT_REF=<approved-isolated-ref>
NOTIFICATION_TEST_URL=https://<approved-isolated-ref>.supabase.co
NOTIFICATION_TEST_PUBLIC_KEY=<local-public-project-key>
NOTIFICATION_TEST_JWT_A=<short-lived-synthetic-session-A>
NOTIFICATION_TEST_JWT_B=<short-lived-synthetic-session-B>
```

الحارس يرفض ref الإنتاج المعروف، والأسماء المخصصة، وHTTP، وredirects، وservice keys، والحساب المتكرر والجلسات غير المناسبة. **فك JWT محليًا حارس إعداد فقط**؛ البوابة/PostgREST تتحقق التوقيع، و`/auth/v1/user` يتحقق الهوية للحسابين قبل الكتابة في الوضع المستضاف.

5. التقرير لا يطبع JWT أو معرفات المستخدمين أو التفضيلات أو استجابات الأخطاء. يختبر القراءة الذاتية والأجنبية، PATCH للأعلام والموقع، منع الهوية/الحقول الداخلية/INSERT أجنبي/DELETE/Push، وJWT غائب/تالف/payload معدل مع التوقيع الأصلي. يعيد القيم المؤكدة السابقة في finally ويتحقق منها. إنهاء العملية بالقوة أو انقطاع الشبكة أثناء الاستعادة قد يترك **بيانات اختبار فقط** معدلة؛ `restoreFailed` يستلزم تنظيفًا يدويًا بالعزل. لا تستخدمه مع عملاء حقيقيين.
6. CI يتحقق كذلك بـSQL من حفظ markers/timestamps وتسجيلات الأجهزة بعد HTTP. المشغّل المستضاف بلا صلاحية خادم؛ تحقق الحقول الداخلية وmetadata يحتاج مشغل العزل المخول دون استخراج بيانات عملاء.

## ترتيب الطرح الدقيق — خطة مستقبلية تحتاج موافقة

1. اعتماد PG15/17 وHTTP المحلي، ثم Supabase المستضاف المعزول للحسابين مع upsert/RETURNING/defaults وJWT الحقيقي. حسم كل BLOCKED في التقرير.
2. إصلاح/طرح عميل متوافق لـPrayerTimes وBackupRestore إذا أثبتت النتائج الرفض؛ لا سحب المنح قبل توفره. تحقق نسخة المحمول `a2c0048` والأجهزة الأقدم لبروتوكول التفضيلات الستة، دون تعديل فوترة المحمول هنا.
3. توثيق الإصدارات وخطة اعتماد العملاء/الحد الأدنى للإصدار؛ تجهيز إصدار إشعارات محدود منفصل عن الفوترة. لا نشر كامل PR #2 تلقائيًا.
4. موافقة إنتاجية صريحة جديدة، snapshot آمن للبيانات/ACL/RLS/القيود، وفحص defaults المطلوبة بلا عرض أسرار؛ مطابقة عدم ظهور Triggers/Partitions/وراثة جديدة، وصلاحيات منفذ 007 وسجل migrations ونافذة أقفال مقبولة. defaults منشئي postgres وsupabase_admin موضوع منفصل لا تصلحه 007.
5. عميل ويب متوافق واعتماد العملاء أولًا، مع المحمول المتوافق؛ ثم إصلاح get/update_preferences القائم (`7f2e821` أو نسخة مدققة تتضمنه) بعد بوابة التوافق. **ليس هذا إذن نشر**. خدمة service_role تتجاوز RLS ولذلك يلزم التحقق من نسخة حارس الهوية المنشورة.
6. **007 وحده** بعد الموافقة بمعاملته الكاملة وفحصه النهائي وreload schema؛ لا 001–006 أو Cron/Vault/Webhooks/أسرار/إعدادات دفع في هذه الخطوة. لا تجاوز preflight أو إضافة منح ارتجالية.
7. تحقق metadata بعد التطبيق وعزل JWT وعمليات ذاتية وفق خطة معتمدة بلا تعديل بيانات عميل حقيقي؛ راقب أخطاء 401/403/5xx وفشل الحفظ والجدولة القائمة من سجلات منقحة. نجاح Cron/HTTP200 لا يثبت تسليم Push؛ لا إرسال حقيقي هنا.

## الفشل والتراجع

فشل preflight أو الفحص النهائي يعيد ACL/Policies تلقائيًا ضمن المعاملة؛ اختبارات الوراثة تتحقق أيضًا من الصفوف/الفهارس/القيود. الفشل بعد COMMIT يحتاج forward fix محدودًا ومعتمدًا؛ لا إعادة PUBLIC true أو TRUNCATE أو UPDATE(user_id) أو endpoint يقبل استبدال الهوية، ولا الرجوع لنسخ backup تنقل مفاتيح الأجهزة. لا حذف أو restore شامل: 007 لا يغير الصفوف أو Schema البيانات. استعادة snapshot لتلف مثبت فقط وبموافقة منفصلة.

لم تختبر حمل/أقفال الإنتاج أو انقطاع Supabase المستضاف أو توزيع العملاء؛ هذه بوابات طرح. CI وPostgREST المفتوح المصدر لا يضيفان اشتراك خدمة مدفوعًا، ويخضعان لحدود GitHub Actions؛ تكلفة العزل المستضاف تعتمد على مورد قائم معتمد ولم يُنشأ أي مورد. نتائج CI الفعلية في وصف PR والتقرير النهائي. جاهزية مراجعة الكود لا تجيز إطلاق الاشتراكات.
