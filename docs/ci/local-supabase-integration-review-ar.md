# مراجعة أمان وإعادة إنتاج حزمة Supabase المحلية

المصدر المستهدف: `HEZZO7/AmanahLifeapp`، PR #2 المسودة، `f29d8df16e434e8cd064968e4b832e9c8f84e2fb`. هذه مراجعة للحزمة غير المفعلة، وليست نتيجة تكامل. لا تشغيل workflow أو Docker/Supabase أو SQL في هذه المراجعة. لا تغييرات على التطبيق أو Migration 007 أو الإنتاج.

**القرار: لا تفعّل الحزمة بعد.** التصحيحات المقترحة جاهزة للمراجعة، لكن قفل سلسلة التبعيات ونجاح التشغيل الحقيقي لم يثبتا. يبقى إطلاق الاشتراكات No-Go والمنتجات الرقمية مستقلة.

| البند | النتيجة | الدليل وحدودها |
|---|---|---|
| الصلاحيات وأحداث GitHub | PASS للمقترح | contents:read فقط؛ action checkout مثبت على SHA كامل مع persist-credentials:false؛ لا PR/fork/pull_request_target/workflow_run أو OIDC أو environment أو secrets.* |
| عدم التفعيل | PASS | الملف docs/ci/notification-local-supabase.yml.proposed خارج .github/workflows؛ لا trigger فعال جديد. رفعه كملف توثيق لا يفعله |
| حدود بيانات الاختبار | PASS بالمصدر؛ التشغيل غير مثبت | staging لقائمة 13 Git blob مثبتًا؛ حاويات التطبيق لا تركب المستودع الكامل أو .env أو .git أو Docker socket. بيئة harness تنظف بـenv -i وHOME مؤقت |
| مفاتيح الإنتاج وبيانات العملاء | PASS من حيث المدخلات | لا أسرار مستضافة أو مفاتيح دفع أو بيانات عملاء في الحزمة. مفاتيح service_role المحلية تنشأ عبر CLI محلي جديد ولا تدخل حاوية assertions؛ متاحة فقط لإنشاء/حذف المستخدمين وداخل Edge الأصلي |
| منع طلبات الإنتاج | NOT VERIFIED تشغيليًا | شبكة internal، إزالة proxy قبل المستخدمين، فحص env المحلي والمنافذ ومقارنة المفاتيح، ثم canary موجب على bridge ومحاولة مرفوضة من namespaces الخدمات الخمس. لم ينفذ أي من ذلك فعليًا |
| دقة مخطط الإشعارات | PARTIAL | PK(id)، UNIQUE(user_id)، مفاتيح push، FK وNOT NULL وأنواع markers DATE من fixture المدقق. defaults تمثيلية وليست دليلًا إنتاجيًا |
| الفشل والنتائج | PASS بمراجعة التحكم والفحوص الثابتة | set -euo pipefail؛ psql ON_ERROR_STOP؛ assertions حقيقية؛ baseline/007 مرتين مع بصمات بيانات؛ summary لا يثبت اكتمالًا عند فقد marker أو فشل phase أو teardown. لا continue-on-error أو تحويل فشل الخدمات إلى نجاح |
| التنفيذ الفعلي على Ubuntu | NOT VERIFIED | تصميمه يستخدم Docker وPython وNode وCLI على ubuntu-24.04 قياسي؛ لا خدمة مدفوعة لازمة. البيئة الحالية لا تتيح daemon. التوافق الفعلي ووقت التشغيل ومقدار القرص غير مقاسة |
| قابلية إعادة الإنتاج | FAIL كضمان كامل | مصدر/Action/CLI version مثبتة، ونسخ SDK التسع مطابقة lockfile التطبيق. لكن checksum CLI من نفس release وليس hash مستقلًا معتمدًا؛ صور tags دون digests مسبقة؛ imports Edge @2/@3 غير مقفلة؛ lock/integrity npm يسجل بعد التحميل فقط |
| السجلات والاحتفاظ | PASS بالمصدر | لا artifacts/cache upload؛ لا start/status/DB/Edge raw logs. regression logs تبقى على runner المؤقت. Summary ثابت ومنقح. سجلات GitHub العادية تخضع لمدة احتفاظ المستودع الحالية، ولم نفحص إعدادها أو نغيره |
| النشر والدمج والفوترة | PASS بالمصدر | لا deploy/link/login/db push أو مزود دفع أو API لإنشاء مشاريع/دمج/تعديل billing. GITHUB_TOKEN للقراءة فقط. جميع أوامر SQL داخل postgres محلي محدد الاسم |

عنوان إنتاج عام موجود في مصدر المشروع ليس سرًا يمكن ضمان إخفائه عن host الذي ينفذ checkout؛ لذلك لا ندعي استحالة معرفته عالميًا. ما يفرضه المقترح هو عدم تحميل إعداداته في مسار الاختبار وعدم إتاحة مدخلات إنتاج للتطبيق المحلي. منع الاتصال الفعلي من التطبيق المحلي يحتاج نجاح فحوص الشبكة، ولا تكفي مراجعة الكود لإثباته. ولا تمثل هذه المراجعة مسح أسرار كاملًا لتاريخ المستودع.

## التصحيحات المجهزة

1. استبدال mount المستودع الكامل بـ13 ملفًا مسموحًا وبصمات Git الفعلية، ورفض الانحراف أو الروابط الرمزية/المسارات الخارجة أو عنوان Supabase مستضاف في الملفات المشغلة.
2. تصحيح مرجع SDK: lockfile التطبيق في f29 يحدد 2.110.0، لا 2.106.0 المستخدم في المقترح الأول. package.json يثبت نسخ التسع dependencies؛ record-deps يرفض أي graph أو نسخة مختلفة ويسجل integrity. هذا لا يغني عن frozen lock مسبق.
3. تمثيل صلاحيات وسياسات الإنتاج غير الآمنة قبل007، وإثبات تجاوز anon داخل transaction يُتراجع عنه، ثم تطبيق007 مرتين وفحص عدم تغيير البيانات.
4. إضافة INSERT عابر للحسابات يجب أن يفشل بـ42501، وتحقق true ثم false عبر Edge حتى لا ينجح اختبار false بسبب بقاء قيمة سابقة.
5. canary متاح فعلًا مع positive control، ثم حجب من namespace كل خدمة، وفحص loopback-only والمفاتيح المحلية وعدم وجود VAPID/internal/payment secrets؛ لا probe إلى نطاق إنتاجي.
6. جعل teardown جزءًا من النتيجة: فشل إيقاف stack أو بقاء containers/volumes يفشل خطوة التنظيف والـjob. لا ملخص نجاح شامل قبل اكتمالها. عند فقد runner أو الإلغاء القسري قد لا تنفذ always؛ المشروع محلي على runner مؤقت ولا توجد موارد سحابية لتنظيفها.
7. تضييق بيئة host، وتأكيد تعطيل migrations/seed والخدمات غير اللازمة وOAuth/SMTP الخارجي في config، وحجب raw logs.

## ما يشغله المقترح عند اعتماد تشغيله لاحقًا

- مستخدمان أصليان في Auth المحلي، وتسجيل دخول بكلمة مرور، وgetSession/getUser وJWTs صادرة فعليًا من Auth؛ ليس توقيع JWT اصطناعيًا لاجتياز الاختبار.
- JWT غائب أو تالف أو معدّل، وعزل RLS وقراءة الأعمدة، وcount=exact للذات/الآخر، ورفض user_id/id/markers/Push المباشر.
- facade الفعلي لـPrayerTimes وBackupRestore مع حقول backup قديمة، والحفاظ على false، وجلستين متزامنتين لأول INSERT: صفر PATCH مرتين، INSERT201 و23505/409، ثم PATCH retry واحد.
- get/update_preferences الأصليان من مصدر ثابت مع Authorization فقط كما في العملاء، وكذلك apikey+JWT؛ حفظ true ثم false وقراءة الستة وغياب تغيير بيانات B.
- أربعة ملفات regression أصلية مع منع HTTP/TCP. لا اختبار UI أو RN كامل، ولا إرسال Web Push أو تشغيل Scheduler.

**ما شغلناه الآن فقط:** خمسة اختبارات offline للحزمة نفسها، وفحص YAML/permissions/trigger، وتحويل config على template upstream، ومطابقة/staging ملفات المصدر الـ13. لا تطبيق007 أو SQL parser/execution أو JWT/PostgREST/Edge integration أو regression التطبيق في هذه الجلسة. لا تنسب نجاح CI التاريخي إلى هذه الحزمة.

## شروط قبل التفعيل ثم قبل أي rollout

1. تثبيت ومراجعة digest صور CLI/Node/Python والخدمات، وhash مستقل لثنائية CLI، وfrozen npm/Deno graph مع integrity. إعدادات Actions المسموح بها في الحساب لم تتوفر عبر موصل القراءة؛ يلزم التحقق من السماح بـcheckout والـstandard runner عند الاعتماد. لا نطلب أسرارًا.
2. مراجعة الحزمة واعتماد فرع/تشغيل واحد صراحةً. لا تنقل template الآن. متغير LOCAL_ONLY_APPROVAL علامة تحقق تقنية وليس موافقة بشرية مستقلة.
3. نجاح فعلي لكل phase، وكل migration/data/race/assertion/regression، ثم teardown؛ اللون الأخضر مع job skipped أو summary جزئي لا يعتبر نجاحًا.
4. قبل استنتاج تطابق إنتاج: تأكيد defaults الحقيقية، إعدادات JWT/JWKS/gateway، صلاحيات مالك postgres، نسخة PostgreSQL والـSDK/Edge/الويب/المحمول المنشورة. قد يكون postgres المحلي SUPERUSER. اختبار JWT منتهي صالح التوقيع غير موجود؛ tampering ليس بديلًا عنه. SDK logout/account switch لا يثبت إبطال JWT صادر سابقًا فورًا.
5. لا rollout بناء على نجاح محلي وحده، ولا نشر billing migrations001–006 مع007. المخطط المحلي لا يختبر تبعيات/تريجرات إنتاج غير معروفة ولا يوفر downgrading إلى grants الواسعة؛ أي تغيير إنتاجي له موافقة وخطة مستقلة.

## الوقت والتكلفة

مستودع AmanahLifeapp كان public عند القراءة. standard ubuntu-24.04 مجاني لدقائق Actions في المستودعات العامة؛ لا larger runner أو artifacts/cache أو Supabase cloud resources. تقدير 15–30 دقيقة باردة، job بحد40 دقيقة وخطوة الاختبار35، وتنزيلات2–5GB؛ ليست قياسات. preflight يرفض قرصًا أقل من8GiB أو RAM أقل من8GiB ولا يرقّي runner تلقائيًا. تقييد Actions بالحساب أو rate limit للتنزيلات قد يمنع التشغيل. إذا صار المستودع private فالـjob يُتخطى، ولا يجوز وصفه بنجاح التكامل.

المراجع الرسمية: https://docs.github.com/en/billing/concepts/product-billing/github-actions ؛ https://supabase.com/docs/guides/local-development/cli/getting-started ؛ https://github.com/supabase/cli/releases/tag/v2.121.0

لم نعدل workflows الحالية غير المثبتة بالـSHA خارج نطاق الحزمة. إيداع هذا المقترح يستخدم [skip ci] لمنع تشغيل CI المعتاد؛ template نفسه لا يمكن اكتشافه كـworkflow. يبقى PR #2 مسودة دون دمج أو نشر.

## الملفات المضافة بالضبط (17، دون ملفات تطبيق أو workflows نشطة)

```text
ci/notification-local/assert-network.py
ci/notification-local/cache-proxy.py
ci/notification-local/cleanup.sh
ci/notification-local/configure.py
ci/notification-local/package.json
ci/notification-local/record-deps.py
ci/notification-local/review-static.py
ci/notification-local/run.sh
ci/notification-local/setup.sql
ci/notification-local/source-manifest.json
ci/notification-local/stage.py
ci/notification-local/suite.mjs
ci/notification-local/summarize.py
docs/ci/local-supabase-integration-review-ar.md
docs/ci/local-supabase-setup-ar.md
docs/ci/local-supabase-static-validation.json
docs/ci/notification-local-supabase.yml.proposed
```
