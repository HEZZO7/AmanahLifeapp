# Migration 007 — إعداد التنفيذ المعزول ومراجعته الأمنية

تاريخ الفحص: 2026-11-03. المستودع `HEZZO7/AmanahLifeapp`؛ الفرع
`repair/migration007-notification-security-20261102`؛ الأصل الكامل
`7c7e6694144c6cdb1f9b924803031f7830f97966`.
هذه حزمة تحضير فقط؛ **لم تُشغّل workflow أو SQL أو PostgreSQL Native** في هذه الجولة.

## التشخيص والقيود

- روجعت ملفات workflows الستة الموجودة في الأصل وفي `main` الموثق
  `3ebe497e0fdd4c9c081422b92c48d4bef03518ec`. جميعها يدوية؛ لم تتغير.
- workflow القديمة `amanahlife-migration-007-local-once.yml` تعتمد مصدر
  `3968fa6795bab794e72596d23d87c6b388659098` وحزمة
  `497add8ef047ac6770c6d728febf15e7ee61680f` وNode 22.23.3؛ لا تشغّل الحالات
  التسع عشرة الحالية. لا يجوز عرض نتائجها كتحقق لهذه الحزمة.
- `subscription-009-native-validation.yml` في فرع الإصلاح مثبتة على مصدر/حزمة
  أقدم وNode 24.19.0. فُحص سجل Actions للقراءة فقط؛ أحدث تشغيلين متاحين بتاريخ
  2026-11-01 كانا يدويين لفرع Phase 3، أحدهما ناجح والآخر فاشل. لا يثبتان حالة007.
- GitHub connector رفض endpoint قائمة workflows باعتباره غير مدعوم؛ أمكن فحص
  الملفات وسجل التشغيل عبر GET المعتمد. إعدادات Actions الإدارية والحصص والسياسات
  التنظيمية الحالية غير مثبتة؛ صلاحية المستودع وحدها لا تثبت إتاحة runners.
- الملف الجديد غير موجود في `main`. توثيق GitHub الرسمي يشترط وجود workflow اليدوية
  في الفرع الافتراضي. لذلك لن تُسجّل هذه الإضافة نفسها تلقائياً، ولا يزيل `--ref`
  الشرط. يلزم اعتماد مستقل لأي تسجيل في main ثم اعتماد للتشغيل؛ لم يُجر أي منهما.
- لم أكرر تنزيل PGlite في executor. يبقى عائق الجولة السابقة موثقاً: اتصال الوكيل
  وDocker socket يُرفضان بـEPERM. لم تُغيّر إعدادات الشبكة أو TLS أو صلاحيات النظام.

## ما أُعد فعلياً

| المسار | الغرض |
|---|---|
| `.github/workflows/migration007-isolated-security.yml` | تشغيل يدوي مستقل، matrix لـPGlite وNative، `ubuntu-latest`، Node24.19.0، artifacts منقحة |
| `ci/migration007/run.mjs` | تحقق المصدر والبصمات، تشغيل ملف SQL المحدد، اشتراط19 نجاحاً، PostgreSQL17.6 المعزول والتنظيف |
| `ci/migration007/install.mjs` | `npm ci` من lockfile الأصلي فقط، بلا lifecycle scripts أو إعدادات npm شخصية أو أسرار مستضافة |
| `ci/migration007/native-cases.mjs` |15 مجموعة تكميلية، مستخرجة من Fixture الحالات الأصلية، لا استبدال لمعايير قبولها |
| `ci/migration007/reporter.mjs` | إخراج allowlist لأسماء الحالات والعدّ ورموز الأخطاء فقط |
| `ci/migration007/inputs.json` | بصمات SHA-256، SRI الأصلي، أصل Git، digest صورة PostgreSQL |
| `ci/migration007/postgres-image-provenance.json` | دليل رسمي ثابت لنسخة الصورة وlinux/amd64؛ لم تُنزّل أو تُشغّل محلياً |
| `ci/migration007/Run-Migration007.ps1` و`README.md` | بديل Windows مع أوامر PowerShell وعدم تجاوز سياسات النظام |
| `app/frontend/tests/migration007-workflow.test.mjs` |7 مراجعات تحضير تشمل رفض النجاح الوهمي وحماية التقارير والعزل والبصمات |
| هذا التقرير | الأدلة والقيود وقرار الجولة |

لم يتغير كود التطبيق أو Edge Functions أو Migration007 أو الحالات التسع عشرة
أو package/lockfile أو حزمة Native الأصلية ذات79 ملفاً و21 مجموعة.

## المراجعة الأمنية

- حدث `workflow_dispatch` فقط؛ لا push/PR/schedule/workflow_call أو نشر أو دمج.
  شرط المستودع/فرع الإصلاح والـSHA المعتمد الكامل يفشل صراحة عند عدم التطابق.
- `contents: read` فقط، تثبيت Actions الرسمية بـSHA كامل، `persist-credentials: false`.
  لا production environment ولا `secrets.*` ولا OIDC أو طلب لصلاحية كتابة.
  artifacts تستخدم هوية التخزين المؤقتة المخصصة للتشغيل، ولا تستدعي صلاحية إنتاج.
- checkout يثبت SHA الحدث؛ input manifest يتحقق من جميع المدخلات التنفيذية وFixture
  والأصل. لا تعديل على PGlite0.3.14 أو assertions؛ لا تثبيت لتبعيات التطبيق أو SDK جديد.
- SQL في PGlite ذاكرة فقط مع deny-network. Native يستخدم صورة PostgreSQL17.6 رسمية
  مثبتة بالـdigest، في حاوية جديدة `--network none` بلا منافذ أو host mounts، مع تعطيل
  TCP وقرص read-only وtmpfs. بيانات وأدوار صناعية فقط؛ لا connection URL مقبول.
- فحوص RLS/ACL تشمل anon، عزل A/B، أسرار Push، أعمدة الهوية/المؤشرات، grant options،
  TRUNCATE وTRIGGER وREFERENCES، MAINTAIN، العضويات و`pg_maintain` والتراجع الذري.
  MAINTAIN يتحقق بالصلاحية الفعلية وفشل العضويات؛ لا ادعاء بتنفيذ VACUUM مرفوض.
- fixture تستخدم auth.uid صناعية؛ ليست GoTrue أو JWT أو Edge منشورة. خدمة SQL
  المصرح بها لا تبرهن وحدها على كل سلوك Edge. معايير التوافق وخطة007 السابقة محفوظة.
- لا صفوف أو قيم assertions أو headers أو env أو raw npm/SQL logs داخل artifacts؛
  الإخفاق يحتفظ باسم الحالة ورمز الخطأ/SQLSTATE. التنظيف شرط إلزامي للنجاح.

## نتائج هذه الجولة

| الفحص المنفّذ | نجاح | فشل | تخطٍ | النتيجة |
|---|---:|---:|---:|---|
| اختبارات المصدر، كل ملف في عملية مستقلة؛23 ملفاً |460|0|0| PASS؛ الأصل453 مع7 مراجعات جديدة |
| مراجعات التحضير007 ضمنها:6 سابقة و7 جديدة |13|0|0| PASS؛ ليست SQL |
| TypeScript التطبيق `tsc --noEmit -p tsconfig.app.json` |—|0|—| PASS |
| ESLint `--quiet ./src` |—|0|—| PASS |
| production build بواسطة Vite |—|0|—| PASS محلياً؛ لم يُنشر |
| syntax لملفات التشغيل الأربعة وYAML parse |—|0|—| PASS |
| PGlite19 SQL |0|—|—| NOT RUN / BLOCKED؛ لم تُحاول إعادة التنزيل |
| PostgreSQL17 Native15 |0|—|—| NOT RUN؛ حزمة جاهزة للمراجعة والتشغيل المصرّح |
| تشغيل PowerShell على Windows |0|—|—| NOT RUN؛ لا pwsh في executor |
| workflow في Actions |0|—|—| NOT DISPATCHED |

قيود الاختبار المحلي: إنشاء subprocess من Node يرد EPERM؛ قد تظهر نتيجة harness
واحدة دون تشغيل assertions. يمنع runner الجديد ذلك بفحص خطأ spawn وعدد19 وsummary.
لذلك شُغّل كل ملف source مباشرة في عملية مستقلة مع `--test-isolation=none`، مع
deny-network. تجربة تجميع كل الملفات في عملية واحدة أعطت429/31 بسبب تداخل محاكيات
الوحدات؛ الفصل أعاد عزل الملفات وأنتج460/0 دون تغيير أي assertion. لم تعتمد التجربة
المجمعة كنجاح. لم تُعد payment-types المنفصلة في هذه الجولة؛ لم يتغير كودها.

## البصمات المرجعية والقبول

- ملف SQL19 الأصلي: `0e0c0fb809c82c6cfa9f77e9fbf36f899d58ef8a12c4a1cd076a1317a5d6dd85`.
- Migration007: `d82c9ec53d32ccdc1a5edff927671aaccd34925626934992f762f066d46cb3db`.
- lockfile PGlite: `50c7667bb51d88b946b2e67386c53549414725566ae5206487eea9f42fd86b5e`.
- صورةPG17.6 amd64: `sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3`.
  طابقت metadata مستودع Docker Library الرسمي في الالتزام
  `ab035ece34e102cc24d3238b7290a14b85c5123b`؛ التوثيق في ملف provenance.
- بقية بصمات المدخلات مثبتة في `ci/migration007/inputs.json` وتُضم بصمته للتقرير التنفيذي
  عند التشغيل. التزام النشر النهائي يُذكر في تسليم المحادثة تجنباً لبصمة ذاتية دورية.

الخطوة المسموحة التالية: اتباع [حزمة التشغيل](../../ci/migration007/README.md) على Windows
مع SHA الفرع المراجع، أو اعتماد تسجيل workflow ثم تشغيلها بصورة منفصلة.
قبول SQL يتطلب19/19 وNative15/15 بلا skip مع versions/hashes صحيحة وتنظيف ناجح.
لا تعوّض هذه المجموعات Native21 الأصلية أو Metadata المستضافة الناقصة: بعض defaults
وتعريفات القيود والسياسات والـACL الكاملة لا تزال غير مثبتة، وتبعيات حذف الحساب ذات
NO ACTION موثقة في التقرير السابق دون حذف فعلي. لا تستعاد سياساتPUBLIC المفتوحة في
أي خطة احتواء/تراجع؛ خطة الإصلاح ومعاييرها السابقة لم تتغير.

**القرار:** تحضير التنفيذ مكتمل محلياً؛ إثبات SQL/RLS ما زال BLOCKED حتى التشغيل الفعلي
المصرّح. لا GO للتكامل أو الإنتاج بناءً على workflow فقط. الإنتاج والفوترة الحية **NO-GO**.
