# تحقيق admin.createUser — Subscription 009

التشغيل محل التحقيق: `40437402291`؛ الحزمة المثبتة:
`172a0774dfd4cde1a8d794fa4a91a6ebdae6ac23`.

## الدليل والاستنتاج المحدود

الدليل الذي قدمه المستخدم يثبت نجاح schema_dependencies، وفشل real_auth_jwt
عند a_create_user؛ أُنجزت مجموعتان من 21، ونجحت واحدة، ولم تُختبر 19.
نجح offline review ‏79/79 وoffline billing ‏76/76 وindependent cleanup.
لم يُدّع تنزيل artifact أو الاطلاع على الردود الخاصة أو بيئة الحاوية التاريخية.

**السبب الجذري والفرق بين رفض API وفشل التحقق من النتيجة غير محسومين بهذا الدليل.**
في الكود المثبت يلف a_create_user انتظار admin.auth.admin.createUser ثم
assert.equal(response.error,null). يمكن أن يفشل الانتظار أو الوصول إلى رد غير
سليم أو assertion الخاصة بـerror. فحص UUID يحدث لاحقًا في a_created_identity؛
إذًا لا يثبت هذا الرمز التاريخي فشل UUID أو إصدار JWT أو trial RPC. كذلك لم
يُطبق SQL الخاص بـMigration 009 بعد؛ التطبيق يبدأ في المجموعة التالية.

فُحص auth-js ‏2.110.0: يحول createUser أخطاء Auth المعروفة إلى رد محلول فيه
error غير null، بدل رفض Promise. يشمل ذلك أخطاء HTTP والنقل وبعض أخطاء فك
الرد. لذلك لا يجوز تفسير عودة response.error كدليل على أن SDK استقبل JSON
صالحًا من API، ولا تفسير a_create_user وحده كرفض مصادقة.

## فحص الإعدادات والصلاحيات والهوية

نُزّل أرشيف CLI ‏2.121.0 المثبت وتطابقت بصمته المطلوبة مع Python وsha256sum:
`4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f`.
شُغل init فقط في مجلد مؤقت خارج المستودع وبـHOME خاص. لا start أو Auth/SQL.
الإعدادات المولدة: Auth وemail signup مفعّلان؛ anonymous sign-in معطل؛ minimum
password length=6؛ password requirements فارغة؛ email confirmations وSMTP
والـhooks معطلة. هذه إعدادات CLI الافتراضية المولدة محليًا، وليست dump لبيئة
التشغيل التاريخية أو إثباتًا لإعدادات صورة GoTrue الفعلية هناك.

يحمل binary المتحقق منه مرجع GoTrue ‏v2.197.0. قُرئ مصدره عند
`4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`: middleware يتحقق من Bearer JWT قبل
فحص admin roles؛ وتشمل الأدوار الافتراضية service_role. يفحص createUser صيغة
البريد وقوة كلمة المرور وقد يفشل في عمليات DB مستقلة. لم تُثبت بايتات الصورة
التاريخية أو إعدادات البيئة هناك، ولا يُستنتج منها سبب بعينه.

يمرر SDK مفتاح service المأخوذ من CLI local status في Authorization وapikey،
وتتحقق الحزمة من claims الخاصة بالدور والمصدر المحلي. هذا الفحص ليس إثباتًا
لصلاحية توقيع المفتاح؛ يظل GoTrue الحقيقي مسؤولًا عن التحقق الفعلي. لا override
للصلاحيات أو إنشاء JWT بديل. هوية fixture عشوائية وبريد اصطناعي محجوز وكلمة
مرور عشوائية بطول 36 مع مجموعات محارف، وemail_confirm=true. يفي طولها بالإعداد
المرئي، لكن لا يثبت ذلك قبول API. لم تُنشر أي قيم هوية أو credentials.

لم يُعد إنتاج فشل Auth ضمن شروط الحزمة: هذه ليست fresh GitHub-hosted
ubuntu-24.04، ولا يتوفر sudo على host أو stack مملوك مع فحوص namespace/firewall
المطلوبة. لم تُنتحل شروط runner ولم تُشغل خدمات بديلة بعزل أضعف.

## التغيير المسموح به فقط

أضيف تحقق صريح fail-closed من شكل رد SDK مع الحفاظ على error=null وفحص UUID.
كل استدعاء createUser حقيقي كما هو، مرة واحدة ودون retry أو mock أو bypass.
تصل تفاصيل ثابتة فقط إلى checks[]:

- authCreateOutcome=request_rejected: رفضت/رمت عملية SDK؛ لا يثبت هذا وحده رفض HTTP.
- response_error: اكتمل SDK برد يحتوي error غير null.
- malformed_response: الرد لا يحقق بنية error/data/user المطلوبة.
- identity_assertion: فشل فحص UUID الأصلي في created_identity اللاحقة.

يوفر authCreateReason تصنيفًا من 18 قيمة مغلقة لبعض SDK codes/status/name؛
ولا يُنشر أي منها خامًا. تصنيف no_http_status لا يثبت فشل نقل، فقد يحدث أيضًا
عند تعذر فك الرد داخل SDK. لا تُقرأ error.message أو response body للتشخيص.

يستخلص authCreateHttp تصنيفًا من ثماني قيم من سجل fetch المحمي الموجود أصلًا:
no_request أو no_response أو http_2xx أو http_4xx أو http_5xx أو http_other أو
unexpected_requests أو unavailable. يقارن السجل بالعملية الثابتة ثم ينشر التصنيف
فقط، دون route/status أو headers أو body. يساعد http_4xx/5xx على إثبات وصول
رد رفض؛ وhttp_2xx مع خطأ SDK يميز فشل معالجة الرد بعد نجاح HTTP. غياب الرد لا
يثبت أن الخادم لم يستقبل الطلب. تعذر التشخيص لا يخفي الفشل الأصلي.

يرفض controller والـsummary القيم غير المعروفة والتركيبات المتناقضة أو الحقول
على مجموعة أخرى/نتيجة passed. تبقى تقارير authStage القديمة مقبولة بنفس قيود
الفشل. بقيت المجموعات الـ21 وفحوص JWT والهوية والأذونات والعزل وNoNewPrivs
وcapability drops وownership وimmutable source وindependent cleanup إلزامية.
لا تعديلات تطبيق أو main أو dispatch أو إنتاج؛ source pin كما هو.

## التحقق والملفات

- نجحت الحزمة offline ‏89/89، دون فشل أو skip؛ أضيفت 10 اختبارات للنتائج الأربع،
  وتصنيفات HTTP، وحفظ failure category/exit، والتنفيذ مرة واحدة، ومنع تسريب
  البيانات، ورفض التفاصيل المزورة والمتناقضة. اختبارات validators هذه ليست
  تشغيلًا أو استبدالًا لـAuth في المجموعة الأصلية.
- نجحت الفوترة مع deny-network ‏76/76، دون فشل أو skip.
- نجحت فحوص hosts ‏9/9 وworkflow ‏14/14، وNode syntax وgit diff --check.
- تحقق مستقل من source bytes وGit blobs وSHA256 للملفات الـ12 ومن Python
  hashlib وGNU sha256sum لملفات الحزمة العشرة، مع versions للتبعيات التسع.
  حُدثت بصمات الملفات الخمسة المتغيرة فقط، دون تعديل source manifest entries.

الملفات تحت app/frontend/tests/subscription-009-local/: integration.mjs و
local-runtime.mjs وsafety.mjs وreview.test.mjs وREADME.md وsource-manifest.json،
مع هذه المذكرة وdocs/evidence/subscription-009-admin-create-40437402291.json.
لا تُحفظ CLI logs أو إعداداته أو ردود Auth الخام في Git.

يبقى الإنتاج والفوترة NO-GO حتى نجاح 21/21 واستكمال فحوص المزود المنفصلة.
الخطوة التالية هي مراجعة commit الحزمة وتحديث PACKAGE_SHA يدويًا على main؛
وإذا تكرر الفشل في تشغيل مصرح به لاحقًا، قراءة authCreateOutcome/authCreateHttp/
authCreateReason من عنصر real_auth_jwt في checks[] قبل أي تغيير للتطبيق.

commit الحزمة: `bc471667afe320a0dccf9b4fad7a8d6a0e720449`.
التغيير اليدوي المطلوب على main:

```yaml
PACKAGE_SHA: bc471667afe320a0dccf9b4fad7a8d6a0e720449
```

يبقى SOURCE_SHA=e6dd3fc5e014ea0539df8da12a6ee84582b302b9 وcheckout الحزمة
`ref: ${{ env.PACKAGE_SHA }}` وشرط فرع main وجميع القيود كما هي.
ثُبت المرجع الجديد في نسخة workflow على فرع الاسترداد وحده دون إطلاقها.
