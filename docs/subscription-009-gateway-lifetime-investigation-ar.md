# Subscription 009 — عمر DNS وفشل التحقق من JWT، التشغيل 41187509490

الحالة: **NO-GO** للإنتاج والفوترة. ثبت خلل Kong مرجعي وأُصلح أثره داخل harness؛
لم يُثبت بعد أنه السبب التاريخي لهذا التشغيل. لم تُغيّر `main` أو workflows أو
Migration 009 أو شفرة التطبيق أو قواعد العزل، ولم يُطلق تشغيل مستضاف.

## المدخلات وحدود الدليل

الحزمة السابقة `39d7326705d08b015782ce29e5cf8c5334448f97`، والمصدر المثبت
`e6dd3fc5e014ea0539df8da12a6ee84582b302b9`. بدأ فرع الاسترداد نظيفًا عند الحزمة.
أعاد رابط artifact `13037800756` استجابة `HTTP 404` هنا؛ التحليل التاريخي يعتمد
الملخص المنقح المتحقق الذي قدمه المستخدم. لا توجد raw logs أو قيمة TTL فعلية أو
بصمات صورة Kong لذلك التشغيل متاحة بصورة مستقلة. لا تعني 404 أن artifact مفقود.

## أول فشل: rollback والتوكن، بصورة مستقلة

وقع أول فشل عند `rollback_each_cleanup_phase/token_valid/push_subscriptions`.
وفق ترتيب assertions، وصل fault المقصود إلى witness وزاد مرة واحدة، واستُعيدت
snapshots حساب B وحساب التحكم A وAuth-link counts قبل عملية التحقق الفاشلة.
اجتازت المراحل السابقة تحقق التوكن أيضًا. لم تُنفذ مرحلة fault الأخيرة `auth`،
ولم يكتمل `faultProof`. لذلك فشل شرط `fault_proof` في المجموعتين التاليتين؛ لا
يثبت ذلك فقد trial history أو السماح بمحاولة ثانية. الشروط باقية كما هي.

اسم `token_valid` لا يميز رفض Promise عن نتيجة getUser ذات error أو خطأ بنية؛
ولا يثبت أن JWT انتهى أو أُلغي. أُضيف رصد آمن لنتيجة `getUser(B.token)` وHTTP
والـgateway، وقرينة محلية فقط عن exp/nbf دون إظهار claims أو تبديل التوكن أو
refresh أو إعادة طلب. بقيت error=null وidentity assertions أصلية وإلزامية.

المهم زمنيًا: هذا الفشل سبق محاولة إنشاء fixture الرابعة. لم تبدأ السلسلة عند
createUser 4، ولا يصح تفسيرها بحد ثلاثة حسابات وحده. لا يستبعد ذلك أسبابًا
مستقلة متعددة أو rate limits، لكنه يمنع تحويل الترتيب إلى تشخيص غير مثبت.

## خلل Kong المؤكد وإعادة إنتاجه

في الصورة المرجعية Kong 2.8.1، يستدعي `conf_loader` ثم `kong.init` تهيئة نفس
DNS client. يحتفظ العميل بـvalidTtl من التهيئة السابقة، ويستخدمه أثناء إدراج
hosts ثانية قبل إسناد القيمة الجديدة. بذلك قد تقصر أعمار سجلات hosts رغم أن
الكود يقصد TTL مقداره عشر سنوات. طابقت ملفات الصورة الثلاثة المعنية tag العام
بـSHA256 مستقل، مع digest الصورة الوارد في JSON الدليل.

شُغّل reproducer مخصص داخل network-none، دون Auth أو DB أو provider أو host
ports، مع capabilities محذوفة وno-new-privileges. استُخدم TTL=1 لتقصير التجربة
فقط؛ لا ندعي أنه TTL التشغيل المستضاف. أعطت التجربة:

| الحالة | النتيجة الفعلية |
|---|---|
| اسم محلي قبل إضافة alias | HTTP 500، Kong response-latency فقط |
| بعد إضافة alias وreload المعتاد | بدأ HTTP 200، ثم انتهى HTTP 500؛ 21/31 نجاحًا و10 إخفاقات |
| reload بنفس PID وملف hosts مع TTL ثابت | 31/31 HTTP 200 بعد تجاوز انتهاء TTL الأصلي |
| upstream تجريبي أعاد HTTP 500 | upstream-latency دون response-latency |
| upstream رفض TCP، ولم يُرجع ردًا | HTTP 502 مع upstream-latency أيضًا |

هذا يفصل gateway-generated DNS failure عن رد upstream 500، ويؤكد أن
`proxy_attempted` لا يثبت أن upstream أرسل ردًا. صنف collector الجديد سجلات
Kong الفعلية للمكوّن إلى `gateway_dns_failure` و`upstream_connect_failure`.
بقي PID وdigest ملف hosts ثابتين، وأزيلت الموارد المملوكة وvolumes وتحققت إزالتها.
الخادم التجريبي مجرد HTTP routing control؛ ليس بديلًا عن Auth في أي اختبار أصلي.

## الإصلاح المحدود

يضيف reload التحضيري الوحيد، بعد التحقق من aliases، الخيار:
`docker exec -e KONG_DNS_VALID_TTL=315360000 <owned-id> kong reload`.
هذه مدة hosts الأصلية في Kong المرجعي؛ تمنع expiry غير المقصود لعناوين peers
الثابتة طوال runner المؤقت. لم تُعدّل الصورة أو مكتبات Kong أو ملف hosts بهذه
الخطوة، ولم يُضف reload أثناء الاختبارات أو انتظار/retry لعلاج الفشل.

تبقى فحوص full ID/project/PID/UID/namespace قبل/بعد العملية وhealth والتحقق
الكامل من firewall كما هي. لا فتح لـDocker DNS أو اتصال خارجي أو مصدر جديد
لـIP، ولا تغيير لحدود شبكة العامل/capabilities/no-new-privileges أو التنظيف.
القيمة تؤثر في resolver الخاص بـKong؛ منع المرور الخارجي مستقل ويظل فعالًا.
لا نستخدمها لتجاوز فشل Auth أو SQL أو أي assertion.

## التشخيصات والشكوك المتبقية

- يسجل فشل rollback حقولًا مغلقة لنتيجة التوكن وHTTP وorigin وقرينة العمر
  المحلية. لا توثّق القرينة التوقيع أو الإلغاء؛ real Auth مطلوب دائمًا.
- يقيس billing RPC حقل `rpcOrigin` مستقلًا. HTTP 5xx مع missing_code لا يثبت
  انقطاع PostgreSQL، ولا يجوز استنتاج origin الفوترة من origin إنشاء المستخدم.
- يقرأ `gatewayFailure` نافذة Kong خاصة محدودة لمجالات GET user وPOST create
  وPOST billing policy فقط، بعد فحوص الملكية والـPID/namespace. سقفها 64 سطرًا،
  512KiB و5 ثوانٍ، وبداية/نهاية مقيدتان وtail إلى +1 ثانية. لا كتابة للـlogs
  على القرص، ولا إخراج نص أو URL أو مسار أو IDs أو headers/JWTs أو bodies.
- يلزم format Nginx المعروف وmethod/path المطابقان؛ التصنيفات مغلقة وتفصل
  DNS/connect/timeout/closed/resource/Lua عن unclassified/ambiguous/unavailable.
  لا تُقرأ Config.Env أو Health.Log. correlation بالوقت والمسار، لا request ID؛
  غياب المطابقة أو format مختلف أو tail loss لا يثبت عدم وصول طلب إلى upstream.
- `running` هو فحص process/namespace، وليس HTTP readiness. لا دليل مستقل على
  OOM أو استنزاف connections أو quota أو خلل Migration 009. الزمن/تسلسل الحالة
  أعادا إنتاج عيب DNS في المكوّن دون أي إنشاء مستخدم؛ ربطه بالتشغيل يحتاج native
  جديدًا أو إعداداته وسجلاته المنقحة. ربما توجد أسباب أخرى لم يكشفها الملخص.

## الملفات والتحقق

تغيرت `local-runtime.mjs`, `safety.mjs`, `integration.mjs`, `review.test.mjs`,
`README.md`, `source-manifest.json`، وأضيف
`ci/subscription009/reproduce-kong-dns-lifetime.py` والتقرير وJSON الدليل.
بقيت ملفات التطبيق و`fixture.sql/metadata.sql/isolation.mjs/package*.json`
وworkflows دون تغيير.

| الفحص | النتيجة |
|---|---|
| package offline | 135/135؛ صفر fail/skipped |
| billing دون شبكة | 76/76 |
| account deletion دون شبكة | 55/55 |
| owned hosts / workflow | 9/9 و14/14 |
| مقارنة AST بالحزمة السابقة | assertions الـ168 والعمليات الأصلية الـ146 متطابقة |
| سلامة المصدر/الحزمة | 12 و10 ملفات، SHA256 بطريقتين وGit blobs/bytes |
| الاعتماديات | 9 نسخ مطابقة للـlock/SRI؛ Node 24.19.0، SDK 2.110.0 |

المجموعات الأصلية الـ21 لم تُنفذ هنا؛ يلزم fresh GitHub-hosted ubuntu-24.04
والضوابط الموثقة، والتشغيل محظور في هذه المهمة. لا تُحسب نتائج المكوّن كـnative.

## الخطوة التالية

نعم، تشغيل مستضاف واحد مراجع مبرر بعد تثبيت PACKAGE_SHA الجديد مع إبقاء
SOURCE_SHA وجميع شروط العزل/التحقق/التنظيف كما هي. توجد هذه المرة معالجة لخلل
بنية تحتية أُعيد إنتاجه، ودليل مستقل لأول token failure وللفوترة إذا استمر الفشل.
لا تشغيل بالحزمة القديمة، ولا تعديل تلقائي لـmain أو dispatch من هذه الجلسة.
يبقى قرار الإنتاج والفوترة **NO-GO** حتى 21/21 وفحوص المزود المستقلة.
