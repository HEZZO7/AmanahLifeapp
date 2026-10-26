# Subscription 009 — الاسترداد والتحقق المحلي، 2026-10-26

الحالة: **NO-GO للإنتاج والفوترة**. لا نشر أو تشغيل SQL إنتاجي أو طلب دفع فعلي.

## المصدر والإصلاح

- بدأ فرع `recovery/subscription-009-validation-20261026` نظيفًا عند
  `880faf9053b7e21c06ae10542c47ab446a04d493`، مطابقًا لفرع
  `review/subscription-009-harness-corrections-20261021`.
- يحتوي المصدر على commit إضافي واحد فوق `review/subscription-009-local-20261021`.
  يتباعد عن `main` بـ52 مقابل 7 commits؛ لم تُدمج الفروع ولم تتغير `main`.
- مصدر التطبيق المصحح: `e6dd3fc5e014ea0539df8da12a6ee84582b302b9`.
  تستخدم الحزمة هذا المصدر المثبت، وcommit الحزمة اللاحق بصورة منفصلة.
- لم تُسترد commits العمل القديم الثلاثة أو أرشيفاه المفقودان؛ هذا إصلاح جديد
  مبني على المصدر الموجود، مع الحفاظ على التاريخ الحالي.

أُعيد إنتاج الخلل على PostgreSQL 17 باستخدام تعريفَي الدوال القديمين داخل
معاملة أُلغيت: أعاد الحذف `DELETE 0` وكانت النتيجة
`authSurvives=true` و`trialHistorySurvives=false`.

يرفض Migration 009 الآن أي `BEFORE DELETE` غير مراجع على `auth.users`
في readiness ومرة أخرى قبل التنظيف داخل DELETE. يشمل ذلك row/statement
وreplica triggers. لم تتغير FKs أو ACLs أو نطاق الجداول الخمسة أو سياسة 008.
تعذر readiness يفشل مغلقًا؛ وجود triggers شرعية إضافية يتطلب مراجعة مستقلة.
لا يُعتمد على HTTP preflight وحده لمنع trigger متأخر. تؤكد طبقة Auth الغياب
بـ`404/user_not_found` قبل إعلان النجاح؛ أي نتيجة ملتبسة تبقى 503 دون إعادة حذف.

## نتائج فعلية

| التحقق | النتيجة |
|---|---|
| جميع `tests/*.test.mjs` مع منع الشبكة وloader القائم | 390 ناجحًا، 0 فشل، 0 skipped |
| `subscription-009-local` عبر `npm run review:offline` | 52 ناجحًا، 0 فشل، 0 skipped |
| `account-deletion-veto-regression.sql` على PostgreSQL 17 | 11 سيناريو ناجحًا: 4 veto، 6 rollback، وضابط AFTER/disabled BEFORE |
| Migration 009 مرتين متتاليتين | نجح |
| مجموعات SQL القائمة للاشتراكات والعائلة ومساعداتها والدفع ودورة الاشتراك | 5 ملفات اختبارات ناجحة، وجميع ملفات الإعداد/migrations الخمسة عشر اكتملت |
| `npm run build`، بما فيه prerender | نجح |
| `npm run lint` | نجح |
| `tsc --noEmit -p tsconfig.app.json` | فشل بتسعة أخطاء سابقة خارج ملفات الإصلاح |
| مجموعات PostgreSQL/Auth الأصلية الـ21 | **NOT TESTED** بالكامل |

التشغيل الأول للاختبارات الواسعة تعثر بسبب غياب `react-test-renderer`.
أضيفت نسخة `18.3.1` محليًا كما في CI، دون تعديل `package.json` أو lockfile،
ثم أُعيد التشغيل واجتازت الاختبارات الـ390. التشغيل الأول لمراجعة الحزمة بعد
تثبيت المصدر الجديد كشف assertion ما زال مثبتًا على المصدر القديم؛ حُدّث إلى
SHA المصدر المصحح المحدد، وأعيد التحقق من checksum، ثم اجتازت المراجعات الـ52.

استُخدم container جديد باسم `amanah-009-recovery-pg` مع `--network none`،
دون منافذ منشورة أو بيانات عميل، وصورة `postgres:17` ذات digest
`sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe`.
اختبارات SQL تستخدم Auth schema تمثيليًا لا GoTrue/JWT؛ ليست تشغيلًا للحزمة الأصلية.
شُغّلت مجموعة SQL القائمة في قاعدة أخرى؛ حُذفت فقط أوامر CREATE لثلاثة roles
موجودة بالفعل من نسخة الإعداد في الذاكرة، دون تغيير fixtures المستودع.
اختبار veto الجديد يعيد كل كتاباته بـROLLBACK. أزيل container الاختبار بعد التحقق.

أخطاء TypeScript في notifications و`familyBudgetSync` و`FamilyBudget`
وخصائص `PageHeader` في الصفحات؛ لم تُخفّض assertions أو إعدادات TypeScript.

## سلامة المصدر والحزمة

كانت بصمات المصدر الاثنتي عشرة وملفات الحزمة العشرة مطابقة عند البداية.
بعد الإصلاح تغيّر من مدخلات المصدر فقط Migration 009 وadapter `index.ts`.
حُسب SHA256 بطريقتين مستقلتين (`hashlib` و`sha256sum`)، وGit blob بطريقتين
(`hashlib` مع framing و`git hash-object`)؛ قورنت أيضًا bytes مع source commit.
أُعيد تثبيت manifest وassertion المصدر إلى SHA المصحح، وجُددت فقط بصمات
الحزمة المتأثرة. لم تتغير migration order أو checksum الرسمي للـCLI أو أي
قواعد عزل. لا تغييرات لازمة على `metadata.sql` لأن schema/ACL/trigger layout
لم يتغير. زادت assertions مجموعة veto لتختبر DELETE المباشر بعد preflight أيضًا.

## مراجعة Lemon Squeezy

تمت مراجعة توقيع HMAC على الجسم الخام قبل JSON، وفصل test/live وstore/customer
bindings، وreservation قبل checkout، وdeduplication/revisions، وإعادة جلب
الأدلة canonical، وحفظ الفترات المدفوعة ومعالجة refund/reconciliation.
نجحت اختبارات الدفع والتوقيع القائمة ضمن الاختبارات الـ390، ومجموعتا SQL
للدفع ودورة الاشتراك. لم تُرسل أي طلبات فعلية إلى المزود ولم تتغير إعداداته.
يبقى الكتالوج الفعلي، الإلغاء/refund عند المزود، ضبط العامل ومراقبته وDeno/Edge
parity غير متحقق. حذف الحساب لا ينفذ cancellation؛ وجود تاريخ فوترة يمنع الحذف.

## العائق والخطوة التالية

الحزمة الكاملة تشترط standard GitHub-hosted `ubuntu-24.04`، وNode `24.19.0`
وSupabase CLI `2.121.0` وأرشيفه المتحقق، وصلاحيات namespace/firewall الموثقة.
البيئة الحالية ليست ذلك runner ولا تحتوي الـCLI؛ لم تُزوّر متغيرات GitHub أو
تُخفف الشروط. لا توجد نتائج GoTrue/Auth/JWT أو race groups أصلية متحققة.

الخطوة التالية تشغيل الحزمة المثبتة في runner مطابق ضمن تنفيذ معزول مراجع،
بـcheckouts منفصلين للمصدر والحزمة، ثم فحص كل مجموعة من الـ21 وتنظيف الموارد
المملوكة. لا تكفي هذه النتائج المحلية للسماح بالنشر أو الاشتراكات المدفوعة.
يبقى اختلاف `main`، وسياسة بيانات الأسرة المحتفظ بها، وتكافؤ production schema،
والكتالوج ودورة المزود وعامل reconciliation عوائق إصدار مستقلة.
