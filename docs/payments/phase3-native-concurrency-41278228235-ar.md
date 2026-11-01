# Phase 3 — إصلاح سياق جلسات السباق

**الإنتاج والفوترة NO-GO. لا تشغيل Actions أو Supabase Auth Native جديد أو provider calls.**

## الأساس والدليل

- الفرع: `diagnostic/payment-phase3-race-context-20261101`، من
  `114dca2706619a4ffb1e8e1776a50f7053f1d783`، بلا merge أو تغيير main.
- التشغيل المبلغ عنه: https://github.com/HEZZO7/AmanahLifeapp/actions/runs/41278228235
- `SOURCE_SHA=7e7ee889c4f356ba1da1856a668ca6e32fc791dd` يبقى ثابتًا.
- الحزمة المتأثرة: `f954d978a23bae5ae86bb55fc5455d37267a99e6`.
- وفق النتيجة المتحقق منها المقدمة من المالك:19/21 Native ناجحة، checkout_wins_race
  sql_session_failed، deletion_wins_race required_lock_not_observed، والتنظيف ناجح.
  لم نحمّل artifact جديدًا أو نُعد طلب GitHub API المحظور سابقًا؛ الدليل الجديد
  أدناه إعادة إنتاج SQL محلية مستقلة، وليس ادعاء قراءة logs التشغيل المستضاف.

## السبب المثبت لكل فشل

`sql()` يمرّر PGOPTIONS بمهلات ثابتة ومع
amanahlife.local_test=approved وamanahlife.security_fixture=isolated.
أما Session فكانت تمرّر المهلات وحدها. خيارات اتصال PostgreSQL لا تنتقل تلقائيًا
من اتصال التحكم إلى الاتصالات المستقلة، ولم يضبط BEGIN هذا السياق.

1. **checkout_wins_race:** أول DO في reserveSQL يرفض السياق المفقود بـSQLSTATE
   P0001، قبل UPDATE payment_environment أو RPC الحجز أو FK/row lock.
   ON_ERROR_STOP يجعل psql يخرج3؛ Session يحوّل ذلك إلى sql_session_failed.
2. **deletion_wins_race:** DELETE يمسك القفل، لكن اتصال Checkout الثاني يخرج
   بالسبب P0001 نفسه قبل الوصول إلى FK التي ينبغي أن تنتظر. لذلك لا يجد
   waitForBlock اتصالًا ينتظر القفل، وينتهي required_lock_not_observed.

أُعيد إنتاج المسارين على PostgreSQL17.11 باتصالات psql مستقلة، وأُثبت غياب
local_test في اتصال الخيارات القديمة وخروج3 وP0001، وعدم وجود FK wait.
بعد التصحيح شوهدت علاقة waiter/blocker فعلًا عبر pg_blocking_pids وwait_event_type.
السبب harness/session initialization؛ لا عيب migrations مثبت في هذا التحقيق.
يبقى تأكيد أثر التصحيح داخل GoTrue/بيئة runner مرهونًا بتشغيل Native معتمد جديد.

## أصغر تصحيح تنفيذي

- `app/frontend/tests/payment-phase3-native/local-runtime.mjs`: ثابت واحد
  SQL_FIXTURE_OPTIONS للخيارات الموجودة أصلًا في التحكم، يستخدمه sql وSession.
  لم تتغير عبارات SQL أو BEGIN/COMMIT/ROLLBACK أو lock observation أو المهلات.
- `review.test.mjs`: إثبات أن مساري التحكم والسباق يستخدمان السياق نفسه، وأن
  خيارات المهلات والسياق مغلقة ومحددة؛ التحقق من checksum لاختبار SQL الجديد.
- `ci/payment-phase3/races-postgres.test.mjs`: regression مستقلة على PostgreSQL
  حقيقي، لا تختزل Auth Native إلى mock ولا تدّعي تشغيل GoTrue.
- `README.md` و`source-manifest.json`: تعليمات التشغيل وhashes محدّثة بعد مقارنة
  hashlib وsha256sum؛ ملف regression إضافي ضمن allowlist ثابتة.
- `ci/payment-phase3/verify-inputs.py`: تحقق إضافي إلزامي من regressionFiles
  وSHA256 وGit blob الملف المثبت؛ كل فحوص المصدر والحزمة والتاريخ السابقة محفوظة.
- workflow الفرع فقط: PACKAGE_SHA جديد وbranch guard جديد، مع بقاء الموافقة
  اليدوية وcleanup المستقل وimmutable SOURCE_SHA وقيود الشبكة كما كانت.

**integration.mjs بالكامل، وكل أجسام المجموعات الـ21 و177 assertion، مطابقة بايتًا
للحزمة المتأثرة.** safety.mjs وisolation.mjs وfixture.sql وphase3-schema.sql
وmetadata.sql وكل migrations001–011 ومصدر التطبيق دون تغيير. المجموعات الـ19
التي نجحت مستضافة لم تُعدّل؛ لم نُعد تنفيذها مستضافة هنا أو ننسب نجاحًا جديدًا لها.

## إعادة الإنتاج المحلية وضوابطها

خُصص cluster جديد تحت mkdtemp خاص0700، باستعمال مستخدم غير root، واتصالات
Unix socket0700 فقط، listen_addresses فارغة وhost auth reject؛ لا TCP أو PGHOST
أو كلمات مرور أو إعدادات مستخدم موروثة. schema Auth اصطناعي ومعلن، وfixtures
وmigrations001–011 الأصلية تُطبّق دون تعديل، داخل هذه القاعدة المملوكة فقط.

أدوات PostgreSQL17.11 استُخرجت خارج Git دون system installation أو scripts
للحزم. جرى تحقق توقيع Debian InRelease بمفاتيح النظام، وSHA256 لـPackages.xz
وللحزمتين قبل الاستخراج:

- server: d2ce1ddffafa783f9acda4c92c86fc21e8288bff3782d739294f14fa797d7886
- client: 9d8558f8dd57c8e92e218a20698383575d53742ca3f9e7c2b7fe5f246d5216ae

الفحوص الثمانية: إعادة إنتاج خطأي السياق القديم؛ checkout commit يرفض الحذف
42501 ويحفظ ملكية الحجز؛ checkout rollback يسمح بالحذف؛ deletion commit يرفض
الحجز23503؛ deletion rollback يحفظ trial والملكية؛ paid projection commit تحت
قفل صف يرفض الحذف42501 ويحفظ trial؛ وأخيرًا إثبات زوال العمليات/socket/data/logs.
لكل حالة سجل حساب تحكم آخر يجب أن يبقى مطابقًا، وcheckout gate مرئية false
خارج المعاملة. انتظار الأقفال مبني على حالة PostgreSQL وبمهلة محدودة، بلا sleep
اعتباطي أو إعادة محاولة mutation. لا raw SQL errors أو معرفات أو بيانات خاصة
تُطبع أو تُرفع. التنظيف يثبت UID وcmdline/datadir قبل إيقاف العملية المملوكة فقط.

## نتائج الفحوص النهائية

| الفحص | النتيجة |
|---|---|
| PostgreSQL17.11 مستقل متعدد الاتصالات |8/8 PASS؛ التنظيف PASS |
| package offline / WASM |23/23 PASS |
| original historical review |135/135 PASS |
| application payment/security offline |270/270 PASS |
| Phase2 SQL/WASM |17/17 PASS |
| Python integrity unit tests |4/4 PASS |
| TypeScript كامل + payment strict types |PASS |
| ESLint دون quiet |0 errors، warning سابقة واحدة في PrayerTimes:108 |
| original009 manifest / source integrity |PASS؛ دون تغيير المصدر الأصلي |
| syntax وdiff hygiene |PASS |
| Native مستضاف جديد / Lemon Test |NOT EXECUTED |

لا skips/xfail أو PASS وهمية. نتائج SQL المحلية لا تثبت real GoTrue أو isolated
worker أو تطابق صور Supabase أو العملاء الحقيقيين. لا يُنسب21/21 إلى هذه الحزمة
قبل التشغيل المستضاف الفعلي. لا نشر أو تغيير إعدادات مزوّد أو تفعيل Checkout.

## القرار والإجراء الواحد التالي

**تشغيل Native مستضاف جديد واحد مبرر بعد الموافقة الصريحة.** يراجع المالك commit
النهائي ثم يشغل subscription-009-native-validation.yml على الفرع
`diagnostic/payment-phase3-race-context-20261101` مع approve_disposable_run=true.
لا إعادة محاولة run القديم، ولا تعديل main أو أسرار Lemon/Supabase مستضافة.
يبقى الإنتاج والفوترة NO-GO حتى21/21 جديدة وقبول Lemon Squeezy Test المنفصل،
ومعالجة عوائق الإشعارات/BackupRestore وretention UX وجرد legacy/production schema
الموثقة في تقارير Phase3 السابقة.

## النسخة المصححة والتحقق المستقل

- `PACKAGE_SHA=2bc848ff3751d4668c3ef2024d9f15348b392540`.
- `SOURCE_SHA=7e7ee889c4f356ba1da1856a668ca6e32fc791dd`، دون تغيير.
- PASS للفاحص المستقل من نسختين worktree نظيفتين مثبتتين بـSHA فعليين:
  22 source files و14 package files و7 historical references وملف regression
  إضافي واحد، مع hashes وGit blob comparison وdependency pins.
- actionlint PASS للـworkflow والـdispatcher. التعديل التشغيلي فيه PACKAGE_SHA
  وGITHUB_REF guard فقط؛ شروط runner/approval/cleanup/verdict unchanged.
- لم نُجرِ dispatch، ولا توجد نتائج Native جديدة لهذه الحزمة بعد.
