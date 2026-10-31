# Subscription 009 — إنشاء fixtures وفشل RPC، التشغيل 41182311183

القرار: **NO-GO** للإنتاج والفوترة. إعادة تشغيل واحدة على runner الموثق مبررة
تشخيصيًا بعد تثبيت الحزمة الجديدة؛ لم يُطلق workflow من هذه الجلسة.

## الدليل وحدوده

المصدر المثبت `e6dd3fc5e014ea0539df8da12a6ee84582b302b9` والحزمة المفحوصة
`399961136fc582bc5bcac9bc5cd58fd48d1b0bd9`. بدأ فرع الاسترداد نظيفًا عندها.
أعاد رابط artifact `13034798945` استجابة `HTTP 404` رغم عمل Git المعتمد؛
لم تُقرأ محتوياته أو raw logs. نتائج التشغيل التالية هي الملخص المنقح المتحقق
الذي قدمه المستخدم، وليست نتائج تشغيل أعيد تنفيذه هنا:

- نجحت المجموعات 1–11، ومنها rollback لكل المراحل، حفظ المحاولة، وسباقا
  checkout/deletion. فشلت المجموعات 12/13/15/16/17 في `fixture_create_user`.
- فشلت `billing_history_retention` عند `billing_policy/active` مع
  `databaseEvidence=missing_error_code`. بقيت أربع مجموعات غير منفذة.
- اجتازت الحزمة 112 والفوترة 76 اختبارًا، ونجح التنظيف المستقل.

## النتائج المؤكدة

1. أول مجموعة فاشلة هي `trial_races_deletion` عند إنشاء أحد حساباتها. قد يكون
   ذلك في iteration rollback أو commit؛ اسم المرحلة لا يحدد أيهما. يقع الفشل
   داخل admin.createUser/فحص استجابته، قبل sign-in وUUID/JWT وبقية fixture
   الخاصة بذلك الحساب. لا يثبت الاسم أن assertion `error === null` تحديدًا
   فشل: تبقى احتمالات rejection أو response error أو malformed response.
2. **ثبت عيب تشخيصي في الحزمة**: يصنف `checkedAuthCreate` النتيجة بأمان، لكن
   `nativeStage` يعيد بناء Error ويحذف تلك الرموز. أُعيد إنتاج فقدها باختبار
   معزول للغلاف، ثم أُصلح نقل التصنيفات المغلقة فقط. لم يثبت عيب تطبيق/Auth
   يفسر التشغيل التاريخي، ولم تتغير Migration 009 أو أي شفرة تطبيق.
3. لا يوجد حد عدد حسابات مضاف في harness؛ يستخدم كل fixture بريدًا وكلمة مرور
   اصطناعيين عشوائيين وعمليات Auth فعلية. لا يحذف الحسابات الباقية بين المجموعات
   لأن A/B والسجل المالي وfixtures الشواهد ضوابط مقصودة؛ يزيل stack المملوك
   كل البيانات الاصطناعية في النهاية. لا تبرر الأدلة إضافة حذف انتقائي أو retries.
   حدود GoTrue/حصصه، OOM، sockets/file descriptors، pool exhaustion، تعطل Auth
   أو REST/gateway، والتلوث بين المجموعات كلها فرضيات غير متحققة.
4. نجاح السباقين السابقين يشمل مسار `withSessions/finally` الذي يتحقق من غياب
   backends المملوكة بالاسم. لا يثبت ذلك صحة pools الخدمة أو استحالة أي تسرب
   آخر، ولا يوجد دليل على أن cleanup أوقف Auth أو REST.
5. فشل الفوترة منفصل: كتابة fixture وتحديث حالته وقراءة ledger سبقت RPC
   الفاشل ونجحت وفق ترتيب المرحلة. لذلك لا يثبت الرمز وحده انقطاع PostgreSQL.
   SDK المثبت يحول بعض أخطاء النقل/قراءة الاستجابة إلى `status=0/code=""`،
   كما يمكن لاستجابة HTTP غير مهيكلة أن تفتقد code. لا نساوي غياب الرمز
   باتصال مرفوض، ولا نفترض سببًا مشتركًا مع إخفاقات Auth.

## التعديل المحدود

- `fixtureCreateOutcome/Reason/Http` تحفظ الرموز الآمنة المفقودة؛ وعند 5xx فقط
  يُستخدم collector القائم للـAuth وقرائن gateway المقيدة نفسها.
- `fixtureCreateAttempt/fixtureCreateSucceeded` عدادات bounded لمحاولات/إقرارات
  الإنشاء الاصطناعي. ليست عدد المستخدمين الباقين أو دليل نجاح fixture كامل.
- `rpcOutcome/rpcErrorKind/rpcSdkHttp/rpcHttp` تفصل rejection وSDK error
  وmalformed response وassertion عن خطأ SQL/PostgREST، مع فصل HTTP المرصود عن
  status الـSDK. callback للرصد يسبق classifier القائم، والشرط `data === false`
  محفوظ. لا تغيير لـPGRST202 polling القائم أو إضافة retries جديدة.
- `requestTransport` يأخذ أسماء ثابتة فقط من codes/names محدودة قبل SDK:
  رفض/reset/timeout/abort/DNS/resource/header-overflow/parser وغيرها، دون
  messages أو stacks أو raw codes. أخطاء التشخيص لا تستبدل خطأ fetch الأصلي.
- snapshot واحد محدود بثلاث ثوانٍ لـDocker inspect يفحص gateway/DB/Auth/REST
  المملوكة فقط، ويعيد states مغلقة بلا IDs أو أسماء حاويات. تُراجع marker/source/
  journal/full ID/project/non-privileged state وPID/namespace عند تطابق العملية.
  لا دخول إلى namespace قديم أو تشغيل أو restart أو تغيير شبكات. حالات OOM
  وrestart snapshots لا تثبت زمن الحدث أو السببية؛ running لا يثبت HTTP readiness.
- يرفض controller والملخص metadata غير المعروفة أو المتناقضة أو المرتبطة
  بمجموعة/مرحلة/نتيجة غير صحيحة. لا تنشر credentials أو tokens أو هويات أو
  URLs أو paths أو request/response bodies أو SQL/server logs خام.

الملفات: `integration.mjs`, `local-runtime.mjs`, `safety.mjs`, `review.test.mjs`,
`README.md`, `source-manifest.json`، وreproducer مستقل
`ci/subscription009/reproduce-postgrest-transport.py` وهذا التقرير وJSON الدليل.
لم تتغير workflows أو `fixture.sql/metadata.sql/isolation.mjs/package*.json`.

## تحقق فعلي

| الفحص | النتيجة |
|---|---|
| package offline | 124/124؛ صفر fail/skipped |
| billing دون شبكة | 76/76 |
| account deletion دون شبكة | 55/55 |
| owned hosts / workflow | 9/9 و14/14 |
| source/package integrity | 12 ملف مصدر و10 ملفات حزمة؛ SHA256 بطريقتين وGit blobs/bytes |
| dependency versions | 9 مطابقة للـlock/SRI؛ Node 24.19.0، SDK 2.110.0 |
| AST مقارنة مع الحزمة السابقة | 168 assertions و146 عملية أصلية محفوظة، مع normalization لوسيط observe الإضافي فقط |

شُغّل اختبار مكوّن مستقل على `node:24.19.0-bookworm-slim` مع network none،
دون host ports، مستخدم غير root، root filesystem وpackage للقراءة فقط،
capabilities محذوفة وno-new-privileges. أرسل SDK طلب RPC واحدًا إلى loopback
دون listener؛ كانت النتيجة الفعلية connection_refused وstatus=0/code="".
لم تعمل خدمة Auth أو PostgreSQL أو provider. هذه إعادة إنتاج للآلية فقط وليست
للسبب التاريخي. تحقق أيضًا قالب inspect فعليًا؛ احتاج Health الاختياري
`index .State "Health"` لأن القراءة المباشرة تفشل عند غياب المفتاح، فصُحح
القالب التشخيصي الجديد. أزيلت موارد المكوّن الموسومة وتحققت إزالتها.

لم تُنفذ مجموعات Auth الأصلية هنا: العقد يشترط fresh GitHub-hosted
ubuntu-24.04، وتشغيل workflow محظور في هذه المهمة. لم تُزوّر متغيرات runner
أو تخفف الشروط لتشغيلها محليًا. لا تُحسب اختبارات المكوّن نتائج native.

## الخطوة التالية

مراجعة وتثبيت SHA الحزمة المنشورة الجديد يدويًا في workflow validation المعتمد
على `main`، مع بقاء SOURCE_SHA وcheckout والعزل والتنظيف كما هي، ثم تشغيل hosted
واحد مراجع. سجله يجب أن يميز HTTP refusal/server/malformed/transport ونوع RPC
وحالة الخدمات، بدل إعادة التشغيل بالحزمة القديمة أو تخمين السبب.
يبقى الإنتاج والفوترة NO-GO حتى اجتياز 21/21 وفحوص المزود المستقلة.
