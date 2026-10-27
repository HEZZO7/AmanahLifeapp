# تدقيق gateway وAuth collector — Subscription 009

التشغيل: `40485609190`. روجعت الحزمة `63bffbc81558e43b3098673947a0a120231e98b6`
المثبتة في workflow فرع الاسترداد؛ لم يُنزّل commit التشغيل البعيد أو raw logs.
المصدر يبقى `e6dd3fc5e014ea0539df8da12a6ee84582b302b9`.

## الدليل وحدود الاستنتاج

الدليل sanitized الذي قدمه المستخدم: schema_dependencies نجح، وفشل real_auth_jwt
عند a_create_user مع response_error/server_error/http_5xx/no_matching_auth_log.
نجح offline ‏97/97 والفوترة ‏76/76 وindependent cleanup.

**أثبتت إعادة الإنتاج عيبًا في ترتيب تهيئة الحزمة، ولم تثبت السبب التاريخي لهذا
التشغيل.** غياب log مطابق لا يثبت أن GoTrue لم يستقبل الطلب. لا تعديل للتطبيق
أو Migration 009 أو أي سياسة مصادقة أو provider.

## تدقيق جامع السجلات أولًا

يختار collector الاسم المتوقع للحاوية Auth، ويتحقق من project label وID الكامل
وPID والحالة وnonprivileged mode وnamespace handle المحفوظة، مع marker/source
وjournal صحيحين. لا يُفحص Env. no_matching_auth_log يعني أن تلك الفحوص وقراءة
السجل نجحت، ثم لم يطابق parser حدثًا؛ لا يثبت صحة افتراض تنسيق الصورة التاريخية.

القراءة القديمة snapshot واحدة: نافذة الطلب حتى end+1s، وtail=64 و512KiB وcutoff=5s.
Docker --until يحد البيانات زمنيًا لكنه لا ينتظر بمفرده سجلًا مستقبليًا. يسجل
GoTrue request completed بعد إرسال الرد؛ إذًا قد يسبق snapshot اكتمال السجل.
وتبقى الكتابة المتأخرة أو tail أو تنسيق مختلف أو path مختلف أسبابًا محتملة
لعدم المطابقة. لا توجد مطابقة request_id مستقلة؛ ربط الأحداث زمني وللعملية فقط.

أثبتت تجربة مع حاوية بلا شبكة وخروج marker متأخر أن snapshot قبل موعد --until
لا يلتقطه بينما bounded follow يلتقطه. لم تُشغل Auth أو DB؛ أزيلت الحاوية وكل
anonymous volumes المملوكة. أضيف --follow للنافذة نفسها دون توسيع tail/bytes/cutoff.
بعض drivers تبقي follow مفتوحًا؛ عند ETIMEDOUT/SIGTERM فقط، وبعد إغلاق النافذة،
تُقبل buffers ذات سطور JSON مكتملة ومنتهية newline. لا يُقبل overflow أو signal
آخر أو JSON جزئي أو نافذة مفتوحة. يبقى الاستنتاج no_matching/ambiguous/unavailable
عند نقص الأدلة، ولا يغير التشخيص فشل المجموعة أو cleanup.

## عيب تهيئة Kong المثبت وإصلاحه

تسلسل الحزمة القديم: official CLI init/start وreadiness قبل العزل؛ ثم فحص status
وملكية الحاويات، وتثبيت firewall وحظر Docker DNS، ثم append للـaliases والتحقق
من البايتات. لم يحدث reload للقارئ الذي يحتفظ بملف hosts في الذاكرة.

توثيق Kong ‏2.8.1 في kong.conf.default، الخاصية dns_hostsfile، يصرح بأن الملف
يُقرأ مرة واحدة ويلزم reload بعد تغييره. وهذا الإصدار ظاهر كمرجع في archive
CLI المثبت 2.121.0. قورنت آلية DNS في kong/tools/dns.lua وسلوك headers في
kong/runloop/handler.lua وkong/init.lua. لا تُفترض مطابقة image bytes التاريخية.

أُعيد إنتاج السلوك فعليًا باستخدام kong:2.8.1:

| المرحلة | HTTP | إشارة الترويسات |
|---|---:|---|
| دون alias | 500 | response-latency موجودة، upstream-latency غائبة |
| بعد append دون reload | 500 | الإشارة نفسها |
| بعد reload لنفس الحاوية | 200 | upstream-latency موجودة، response-latency غائبة |

بقي PID ثابتًا. كانت network=none وcap-drop=ALL وno-new-privileges، بلا host ports
أو اتصال خارجي. استُخدم Admin API الخاص بـKong على loopback كـDNS-only upstream؛
لم تُنشأ Auth أو DB، ولا يُحسب الاختبار كبديل لأي مجموعة native. يوفر postgres:17
في helper Bash فقط دون تشغيل PostgreSQL. أزيلت الموارد المملوكة وتحقق التنظيف.
بدأ probe أولي بفشل قراءة config الاصطناعي ذي mode=600؛ صُحح هذا الملف العام
إلى read-only ‏444، دون تعديل أي ملف حزمة أو صلاحيات native. الاختبار المراجع
المضاف ci/subscription009/reproduce-gateway-hosts.py يكرر النتيجة والتنظيف.

الإصلاح: reload واحد للـKong master المملوك بعد اكتمال aliases/readbacks، ثم
health وإعادة verifyIsolation كاملة قبل worker. تُفحص marker/source وjournal
identity وID/name/project/nonprivileged وUID/PID وnamespace قبل وبعد reload.
أي اختلاف أو أمر فاشل يوقف setup. لا restart أو إعادة اكتشاف هوية بديلة، ولا
فتح DNS أو تغيير resolver/config/defaults أو sleep/retry في الحزمة. يبقى reload
داخل الحاوية ذاتها والـfirewall مثبتًا. فشل reload/health له operation code ثابت.
health الخاص بـKong لا يثبت صحة Auth/DB؛ تظل جميع assertions الأصلية ضرورية.

## تشخيص منشأ الرد دون قراءة body

أضيف authCreateOrigin فقط لفشل admin create ذي http_5xx. تُقرأ ثلاث ترويسات
محددة وتُحفظ نتيجة من خمس قيم ثابتة فقط:

- gateway_generated: إشارة response-latency الرقمية المتوافقة مع رد Kong نفسه.
- proxy_attempted: upstream-latency؛ لا تثبت أن upstream رد. مصدر Kong يضع flag
  KONG_PROXIED عند نية proxy قبل احتمال فشل balancer.
- gotrue_error_signal: ترويسة Auth المعروفة؛ إشارة وليست إثبات منشأ تشفيريًا.
- conflicting_headers أو unavailable: أدلة متعارضة أو غائبة أو غير معروفة.

لا قراءة أو تخزين للـbody، أو Server/Via، أو القيم الخام أو JWT أو credentials
أو هويات أو عناوين أو request IDs. لا يكفي Server:Kong لتحديد منشأ الرد.
يرفض controller والـsummary الرمز غير المعروف أو على نتيجة passed أو دون 5xx
أو على مرحلة/مجموعة مختلفة. تبقى authCreateServer لتصنيف دليل DB إن توفر؛ لا
يستخدم غيابها أو غياب headers لنفي وصول الطلب.

## الفحوص والقرار

- الحزمة offline: ‏104/104، دون فشل أو skip؛ تشمل reload ownership/UID/PID/namespace
  قبل/بعد، وفشل الأوامر دون retry، وorigin privacy، وbounded log capture والتقارير المزورة.
- التطبيق مع deny-network والـloader الموجود: ‏390/390، تشمل 76 للفوترة، دون skip.
- hosts: ‏9/9؛ workflow: ‏14/14؛ Node syntax وPython syntax وgit diff --check نجحت.
- تحقق source bytes وGit blobs وSHA256 للملفات الـ12، مع حسابين مستقلين لبصمات
  ملفات الحزمة العشرة وإصدارات التبعيات التسع. تحديث الخمس المتغيرة فقط؛ لا تغيير
  sourceCommit أو app source hashes أو lockfile أو fixture/metadata.

لا تتوفر هنا fresh GitHub-hosted ubuntu-24.04 وhost sudo، ولم يُطلق workflow، لذا
لم تُنفذ المجموعات الـ21 الأصلية. الأدلة المصغرة تثبت إصلاح شرط تهيئة محلي، لا
نجاح 21/21 أو أن 40485609190 كان حتمًا DNS. يبقى الإنتاج والفوترة NO-GO حتى native
21/21 وفحوص billing/provider المنفصلة.

تغيرت integration.mjs وlocal-runtime.mjs وsafety.mjs وreview.test.mjs وREADME.md
وsource-manifest.json في الحزمة، مع script إعادة الإنتاج وهذه المذكرة وJSON الدليل.
الخطوة التالية تحديث PACKAGE_SHA يدويًا على main بعد المراجعة، مع بقاء source pin
وجميع ضوابط التشغيل كما هي. لم يُعدّل main أو production ولم يحدث dispatch.

commit الحزمة: `772f0a77f6ae1f59b360e190783939b880223cb2`.
التحديث اليدوي المطلوب على main:

```yaml
PACKAGE_SHA: 772f0a77f6ae1f59b360e190783939b880223cb2
```

يبقى SOURCE_SHA=e6dd3fc5e014ea0539df8da12a6ee84582b302b9 وcheckout الحزمة
`ref: ${{ env.PACKAGE_SHA }}` وشرط فرع main وكل القيود كما هي.
ثُبت المرجع في workflow فرع الاسترداد فقط، ولم تُرسل محاولة تشغيل.
