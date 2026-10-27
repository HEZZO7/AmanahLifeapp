# تحقيق HTTP 5xx في إنشاء مستخدم Auth — Subscription 009

التشغيل: `40469026749`؛ الحزمة: `bc471667afe320a0dccf9b4fad7a8d6a0e720449`؛
المصدر: `e6dd3fc5e014ea0539df8da12a6ee84582b302b9`.

## الدليل والنتيجة

الدليل الذي قدمه المستخدم يثبت schema_dependencies=passed ثم فشل
real_auth_jwt عند a_create_user مع response_error/server_error/http_5xx.
نجحت مجموعة واحدة من 21؛ لم تُختبر 19. نجح offline review ‏89/89 والفوترة
‏76/76 وindependent cleanup. لم تُنزّل سجلات خادم تاريخية أو تُعرض ردود خاصة.

**السبب الجذري غير مثبت.** يثبت تصنيف HTTP وصول 5xx عبر مسار Auth، لكنه لا
يثبت أن السبب GoTrue نفسه أو PostgreSQL أو gateway. يصنف SDK أخطاء HTTP 5xx
قبل فك تفاصيلها إلى AuthRetryableFetchError؛ لذا لا يتضمن server_error تحديدًا
للمرحلة الداخلية. لا يوجد دليل يبرر تغيير التطبيق أو Migration 009.

## تتبع قاعدة البيانات والـtriggers والتهيئة

تبدأ الحزمة بالـCLI الافتراضي المثبت 2.121.0، وبـinit/start في مساحة جديدة؛
تتم تهيئة Auth الأصلية بواسطة stack قبل fixture. فُحصت افتراضيات CLI في التحقيق
السابق بعد التحقق من archive SHA256: Auth/email signup مفعّلان، minimum password
length=6، ولا email confirmations أو SMTP أو hooks مفعلة. هذه ليست معاينة لبيئة
الحاوية التاريخية. لا تعدل الحزمة هذه الإعدادات أو تربط مشروعًا مستضافًا.

المسار الفعلي قبل إنشاء A هو fixture ثم 001/002/003/004/005/008، وليس 006 أو
007 أو 009. تعمل DDL كـpostgres؛ نجاحها لا يثبت صلاحيات اتصال GoTrue أو اكتمال
schema الذي يتوقعه binary أو نجاح معاملته في وقت الطلب.

- fixture يحفظ Auth الأصلي وroles؛ triggers التي ينشئها على public family tables.
- 001 يقيّد subscriptions وstart_trial؛ 002/003 يعالجان family helpers/entitlements؛
  004/005 يعالجان billing والجداول/الدوال وtrigger تحديث projection على subscriptions.
- 008 ينشئ BEFORE DELETE فقط على auth.users وsubscriptions. لا ينشئ INSERT/UPDATE
  trigger على auth.users. لا يظهر مسار DELETE لهذا الجدول في إنشاء مستخدم جديد
  بالطريق الذي روجع، لذلك لا يجوز اتهام guard الخاص بـ008 بهذا الدليل.
- لا يعرف التقرير triggers أو schema drift أو grants الفعلية الناتجة من native
  bootstrap في التشغيل التاريخي؛ ولا تُحذف أو تُعدل أي منها لتجاوز المشكلة.

في مصدر GoTrue المرجعي v2.197.0 عند
`4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`، يتحقق الطلب من Bearer JWT ودور
admin، ويقرأ وجود البريد، ثم ينشئ نموذج المستخدم وكلمة المرور. في المعاملة
يكتب auth.users وauth.identities وaudit log عند تفعيله، ويحدّث role والتأكيد
والـmetadata وينظف one-time tokens، ثم commit. قد تفشل قراءة DB أو كتابة/تحديث
أو function/trigger أو constraint أو صلاحية أو اتصال أو commit. وقد يحدث فشل
خدمة قبل المعاملة. هذه مسارات ممكنة في المصدر، وليست تشخيصًا للحادث.

مرجع الصورة مستخرج من CLI المتحقق منه سابقًا؛ لم تُثبت image bytes أو البيئة
التاريخية. لا يثبت هذا الفحص أن خادم التشغيل طابق كل تفاصيل المصدر المرجعي.

لم تُعد إعادة إنتاج native: البيئة ليست fresh GitHub-hosted ubuntu-24.04، ولا
يتوفر sudo على host أو stack مملوك مع ضوابط namespace/firewall المطلوبة. لا
تشغيل بديل بإعدادات أضعف ولا محاكاة لـAuth في المجموعات الأصلية.

## التشخيص المحدود المضاف

بعد فشل A/B create فقط، ومع HTTP 5xx المرصود فعلًا، يضاف اختياريًا
`checks[].authCreateServer` من 19 قيمة ثابتة. يُعاد فحص canonical workdir وowned
marker والمصدر وisolation journal، واسم Auth الكامل/project label وID الكامل
وnonprivileged status وPID المحفوظ وnamespace handle المثبت. لا قراءة لـEnv.
توقف الحاوية أو تغير PID يعطي رمز liveness ثابتًا دون قراءة logs أو دخول namespace
قديمة. فشل إثبات الملكية يمنع قراءة السجل ويعيد ownership_unverified.

يقرأ probe فقط 64 سطرًا كحد أقصى ضمن نافذة طلب محدودة؛ cutoff=5s وlimit=512KiB.
تبقى stdout/stderr في buffer خاص في الذاكرة ويُتخلص منه؛ لا تُكتب السجلات الخام
إلى ملف أو console أو artifact. لا تغيّر إعدادات تسجيل GoTrue أو مستوى SQL logging.

يُقبل حدث JSON واحد فقط من api/error لعملية POST admin/users المكتملة بـ5xx.
لا توجد مطابقة request_id مستقلة؛ المطابقة زمنية وللعملية داخل stack المعزول.
إن تعددت الأحداث أو غابت، تكون النتيجة ambiguous_auth_log أو no_matching_auth_log؛
التأخر في التسجيل أو اختلاف التنسيق لا يجيز تخمين السبب أو قراءة نطاق أوسع.

تُستخرج فقط علامة SQLSTATE ذات الصيغة الثابتة الخاصة بالـdriver من حقل error
في ذلك الحدث، وتُحوّل إلى dependency/privilege/constraint/raised_exception/
connection/resource/timeout/transaction/data_error/other. لا يخرج الكود الأصلي
أو SQL أو نص الخطأ أو أسماء الجداول والدوال. تعدد الأكواد يعطي ambiguous_database_error.
وجود panic منظم يعطي gotrue_panic، والباقي gotrue_server_unclassified. رموز
liveness والـSQLSTATE تصف الدليل المرصود، ولا تثبت أصلًا محددًا أو trigger بعينه.

يرفض controller والـsummary قيمة غير معروفة أو على مجموعة أخرى أو نتيجة passed
أو دون http_5xx. لا يعيد التشخيص الطلب أو يحول فشلًا إلى نجاح أو يلغي assertion.
تبقى JWT verification وauthorization وNoNewPrivs وcapability drops والعزل
وownership وsource verification وindependent cleanup كما هي. لا تعديل لتطبيق
أو Migration 009 أو fixture/metadata/lockfile.

## الاختبارات والأدلة المحلية

- الحزمة: 97/97، دون فشل أو تخطي. الاختبارات الثمانية الجديدة تغطي تصنيف SQLSTATE
  دون إخراج بيانات، ورفض الأدلة غير المرتبطة/الملتبسة، وضوابط الملكية والـPID
  والnamespace، وحدود القراءة/الفشل، ورفض التفاصيل المزورة عبر controller/summary.
- جميع ملفات root tests للتطبيق مع deny-network والـpreference loader الموجود:
  390/390، وتشمل 76 اختبار فوترة. فشل أول استدعاء دون loader بثلاثة module-resolution
  errors؛ نجح باستخدام loader الموجود دون تغيير test أو assertion أو application.
- hosts: ‏9/9؛ workflow: ‏14/14؛ ونجحت Node syntax وgit diff --check.
- تحقق source bytes وGit blobs وSHA256 لملفات المصدر الـ12، مع تطابق Python
  hashlib وGNU sha256sum لملفات الحزمة العشرة وإصدارات التبعيات التسع. تُحدّث
  بصمات ملفات الحزمة الخمسة المتغيرة فقط؛ app source hashes وsource pin ثابتة.

اختُبر قالب docker inspect الفعلي على حاوية مؤقتة لم تُشغّل، بـnetwork=none،
ودون Auth/DB process. حُذفت الحاوية. ثم شمل التحقق الـanonymous volume الذي أنشأه
Docker: حدث إنشاء وحيد قبل الحاوية بـ1ms، بلا نشاط متزامن آخر؛ تأكد أن الحجم
صفر وRefCount=0 ثم حُذف، وتحقق غياب الاثنين. هذا فحص template/cleanup فقط، وليس
تنفيذًا لفحوص Auth أو independent cleanup الخاصة بالتشغيل التاريخي.

تغيرت integration.mjs وlocal-runtime.mjs وsafety.mjs وreview.test.mjs وREADME.md
وsource-manifest.json تحت app/frontend/tests/subscription-009-local/، مع هذه
المذكرة وdocs/evidence/subscription-009-auth-server-40469026749.json.

يبقى القرار NO-GO للإنتاج والفوترة حتى 21/21 وفحوص billing/provider المنفصلة.
الخطوة التالية هي مراجعة commit الحزمة وتحديث PACKAGE_SHA يدويًا على main، ثم
قراءة authCreateServer من أي تشغيل لاحق مصرح به إذا تكرر 5xx. لا تعديل main
أو dispatch أو deployment في هذا العمل.

commit الحزمة: `63bffbc81558e43b3098673947a0a120231e98b6`.
التغيير اليدوي المطلوب في workflow على main:

```yaml
PACKAGE_SHA: 63bffbc81558e43b3098673947a0a120231e98b6
```

يبقى SOURCE_SHA=e6dd3fc5e014ea0539df8da12a6ee84582b302b9 وcheckout الحزمة
`ref: ${{ env.PACKAGE_SHA }}` وشرط main وكل ضوابط التشغيل كما هي.
ثُبت المرجع على نسخة workflow في فرع الاسترداد فقط، دون إطلاقها.
