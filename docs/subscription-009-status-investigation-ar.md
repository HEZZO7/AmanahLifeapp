# Subscription 009 — فشل مرحلة status

التشغيل محل التحقيق:
https://github.com/HEZZO7/AmanahLifeapp/actions/runs/40272569296

## الأدلة وحدود التشخيص

بحسب الأدلة المتحققة التي قدمها المستخدم، خرج harness بـ1 دون تنفيذ أي من
المجموعات الـ21، وكان التقرير
`phase=status, category=command_failed, exit=1`. نجحت اختبارات الفوترة الـ76
ومراجعات الحزمة الـ52 والتنظيف المستقل. المصدر
`e6dd3fc5e014ea0539df8da12a6ee84582b302b9` والحزمة القديمة
`8d5cdd246233a4a7ef4ad7ea2a62815ece08b153`.

فشلت محاولة قراءة metadata لهذا التشغيل من البيئة الحالية عند proxy بـ403؛
لم تُنزّل artifacts أو raw logs ولم يُعد تشغيل المحاولة الفاشلة.
لذلك تُنسب نتائج التشغيل أعلاه إلى دليل المستخدم، لا إلى قراءة مستقلة للسجلات.

**السبب الجذري غير محسوم.** التقرير يثبت فشل subprocess، لكنه لا يثبت أن
الأمر الفاشل هو `supabase status`. يمتد اسم المرحلة نفسه إلى أوامر لاحقة أيضًا.
لا توجد أدلة تسمح بتعديل صلاحيات أو شبكات أو إعدادات CLI لتجاوز هذا الفشل.

## المسار الفعلي في الحزمة المثبتة

قبل `notify('status')` تتحقق الحزمة من runner وSHA المصدر وبصماته والحزمة
وأرشيف CLI الرسمي، وعدم وجود stack سابق، وملكية workdir، والمنافذ، وقواعد
حماية منافذ الخدمات. يجب أن ينجح `supabase init` ثم `supabase start`، وأن
يبقى `project-ref` غائبًا وتبقى migrations الخاصة بالـCLI فارغة.

تحت مرحلة `status` نفسها يجري الآتي بالترتيب:

1. `docker inspect --format '{{json .Config.Labels}}' supabase_<service>_<project>`
   لكل من `db`, `auth`, `rest`, `kong`، والتحقق من project label.
2. `<workdir>/bin/supabase --workdir <workdir> status -o json`، ثم فحص
   endpoint المحلي وDB URL وأدوار مفاتيح CLI محليًا دون طباعتها.
3. اكتشاف العزل: فحص Kong وDocker network وجميع peers، وقراءة namespace
   لكل peer، ثم `docker exec supabase_kong_<project> id -u`.
4. bind namespaces وتثبيت قواعد IPv4/IPv6 والتحقق منها.
5. `docker cp <container>:/etc/hosts <owned-file>` ثم النسخ العكسي للـaliases المحلية.

أي أمر فاشل يرمي `Failure` بتصنيف ثابت وexit الأصلي. تظل المخرجات داخل الذاكرة
ولا يُحفظ stderr أو status JSON. تستدعي `finally` التنظيف وتعيد phase الأصلية،
ثم ينشر controller تقريرًا غير ناجح. لا يبدأ worker أو مجموعات الاختبار قبل
اكتمال هذه المتطلبات. نجاح التنظيف لا يحدد أي أمر سابق فشل.

## التغيير المحدود

لم يُفترض إصلاح وظيفي غير مثبت. أضيف إلى فشل subprocess فقط:

```json
{"diagnostic":{"operation":"supabase_status_json","reason":"unknown"}}
```

هذا مثال على الشكل وليس نتيجة تشغيل جديدة. `operation` و`reason` من قوائم
ثابتة. تميز العمليات فحص labels لكل خدمة، وCLI status، وفحص network/containers،
وقراءة UID/namespace، وbind، وفحص/إدراج/حذف قواعد host أو namespace، وقراءة
hosts أو كتابته. لا يتضمن التقرير اسم مورد أو argv أو مسارًا أو credential.
تُصنّف رسائل الفشل المحدودة إلى hints مثل `permission_denied`, `object_missing`,
`resource_busy` أو `unknown`؛ لا تُعامل هذه hints وحدها كسبب جذري مثبت.

يحافظ التغيير على category وexit الأصليين وعلى جميع assertions وقواعد العزل
والملكية والتنظيف والبصمات. لا retry أو fallback يتجاوز command فاشلًا.
لم تتغير ملفات التطبيق الاثنا عشر أو مصدره المثبت أو CLI/SDK/lockfile.
تُنشر diagnostic في تقرير integration قبل أن يكتب cleanup تقريره المستقل؛
خطوة workflow القائمة تحفظ التقريرين بهذا الترتيب أصلًا.

## التحقق المحلي

- مراجعات الحزمة: **56 ناجحًا، 0 فشل، 0 skipped**؛ كانت 52 قبل إضافة أربعة
  اختبارات تشخيصية. تتضمن fake subprocess results فقط؛ لا خدمات أو SQL أو Auth.
- اختُبرت العمليات والأسباب، وتسرب argv/paths/messages المصطنعة، ورفض
  diagnostic غير معروفة، وحفظ exit 7 و124 و143 وفشل تشغيل executable.
- تحققت بصمات ملفات التطبيق الـ12 دون تغيير؛ جُددت SHA256 لملفات الحزمة
  المتأثرة فقط بعد مطابقة `hashlib` و`sha256sum`.
- تبقى المجموعات الأصلية الـ21 mandatory وبلا skip/xfail؛ لم تُنفذ في هذه الجلسة.

## التنفيذ التالي

بعد تثبيت SHA الحزمة المصححة في workflow، يلزم **workflow_dispatch جديد واحد**
على فرع الاسترداد، مع `approve_disposable_run=true` وGitHub-hosted
`ubuntu-24.04` جديد. لا `Re-run jobs` للتشغيل `40272569296`.
تظل SHA التطبيق كما هي. افحص `integration.json` وخصوصًا
`infrastructureFailure.diagnostic` ثم `cleanup.json` وverdict لكل المجموعات.
إذا استمر الفشل، يُراجع الأمر المحدد والتلميح الآمن قبل أي تصحيح آخر؛ لا تُرفع
raw logs أو status JSON أو مفاتيح Auth. تبقى جاهزية الإنتاج والفوترة **NO-GO**.

حزمة التشخيص المثبتة للتشغيل التالي:
`9c38cb5a50d54cce3140361aa341ed65e8996e14`.
تغير في workflow حقلا package SHA وcheckout ref فقط؛ SHA التطبيق باقية.
اجتازت فحوص workflow المحلية الـ12 بعد إعادة التثبيت.
