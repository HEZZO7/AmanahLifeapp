# Payment Readiness — Phase 2

**NO-GO للإنتاج والفوترة.** تغييرات الفرع للمراجعة والاختبار، بلا نشر أو دمج أو تفعيل أو مشتريات أو تعديل إعدادات مزوّد. لم يُعد تشغيل Native Subscription 009.

## الأساس والتغييرات

الفرع `remediation/lemonsqueezy-security-billing-phase2-20261031` يبدأ من أحدث main وقت الجلب: `3ebe497e0fdd4c9c081422b92c48d4bef03518ec`. تقرير Phase 1 مثبت عند `5fdaf2f0146ac4b2c32bb84dc3d04182a1bcc0c5`. نُشرت استعادة الأساس الأمني المرتبط بالمهمة في `060f0ab`، دون merge أو cherry-pick؛ راجع [تقييم الأساس](phase2-baseline.md).

| النطاق | التنفيذ |
|---|---|
| ربط العميل بالحساب | `_shared/lemonPayments.ts` وmigrations 004–005: مصادقة المستخدم وتأكيد البريد، ثم intent دائم قبل الاتصال بالمزوّد. لا user_id في custom_data؛ nonce عشوائي256-bit يُخزن hash له، ويرتبط بالحساب والخطة والمتجر والـmode. الـWebhook لا يصدّق client user_id/email، ويتحقق من العلاقات والـIDs والحالة المرجعية عبر API المزوّد. |
| ملكية Customer | migration 011 تضيف ملكية خاصة دائمة حسب mode/customer، وتمنع ربط Customer بحساب آخر أو تغيير هوية binding. الترقية تتوقف عند تعارض تاريخي بدل اختيار مالك عشوائي. يمنع ذلك كشف اشتراكات حساب آخر عبر Customer Portal. |
| الأحداث المتكررة والمتأخرة | inbox دائم بمفتاح hash للجسم المتحقق، commit ذري مع dedup وrevision/قفل الحساب وwatermark للحالة المرجعية. تحديث قديم لا يستبدل الأحدث؛ proof واحد لا يمتد أو يستعيد صلاحية بعد استرداده بسبب replay. لا يُخزن raw payload/nonce/signature/Checkout URL. |
| دورة الاشتراك | يعالج subscription_created/updated/cancelled/resumed/paused/unpaused/expired وsubscription_payment_success/failed/recovered/refunded وorder_created/refunded. تُحل الفاتورة إلى subscription_id وتُجلب الفواتير والأمر والاشتراك من المصدر المرجعي؛ لا يعتبر redirect أو إنشاء الاشتراك وحده نجاح دفع. |
| الاستحقاق | migrations 005–006 وSubscriptionContext: قرار الخادم من ledger خاص وproof غير مسترد مع confirmed_at/access_end صالحين. cancelled يحتفظ بالمدة المدفوعة المثبتة؛ صفر مهلة إضافية بعد نهايتها حتى مع past_due/unpaid. paused/expired لا يكفيان للوصول. نهاية التجربة ووقت البداية من الخادم، وليس localStorage/وقت العميل. |
| الاسترداد | full refund يسحب proof المرتبط ولا يعيد replay تفعيله؛ استرداد ابتدائي لا يمحو renewal مستقلة مثبتة. partial refund يحتاج مراجعة ولا يثبت تمديدًا جديدًا؛ يُحفظ الحق القائم وفق النموذج المراجع. لا يُنفّذ refund أو إلغاء مزوّد تلقائي في هذا العمل. سياسة المالك ما زالت مطلوبة. |
| Checkout متزامن أو غامض | migration 010 تقفل الحساب وتمنع intent ثانٍ غير مربوط **حتى بعد انتهاء TTL المحلي**، مع أو بدون checkout_id. فشل/ضياع رد POST لا يحرر القفل ولا يعيد POST. المصالحة/تحرير حجز بعد تحقق المزوّد إجراء منفصل غير مؤتمت هنا. |
| التجربة | جميع Checkouts تطلب skip_trial=true؛ التجربة الوحيدة هي تجربة التطبيق7 أيام الصادرة من RPC الذري. لا تجمع تجربة المزوّد مع تجربة التطبيق حتى لمن لم يبدأ تجربته بعد. يجب تأكيد احترام هذا الخيار في Test mode. |
| إيقاف المبيعات الجديدة | `CHECKOUT_APPROVED` لكل mode افتراضيًا false، وDB `checkouts_enabled` افتراضيًا false. كلاهما مطلوبان؛ لا يُدرج صف mode تلقائيًا. إيقاف الجديد لا يحذف البيئة أو الأدلة ولا يغلق portal الموثق. تغيير خطة قد يغيّر فوترة، لذا يخضع للبوابة نفسها. |
| AI والأسرة | `_shared/aiAccess.ts` وhandlers أربع خدمات AI تستخدم JWT نفسه مع RPC خادمي لا يقبل user_id/plan من العميل. family_invite يعتمد entitlement الخاص وRPC قبول دعوة مربوط بالـJWT؛ migration003 تحرس الإنشاء والانضمام والحدود/صلاحيات RLS. أخطاء lookup تمنع الوصول بدل fallback. |
| حذف الحساب | migrations008–009 والـadapter محفوظة بايتًا مقابل e6. لا child deletes منفصلة؛ readiness ثم retention ثم Auth DELETE وتأكيد الغياب. أي تاريخ فوترة/intent يحجب الحذف ويحافظ على الاشتراك والدليل. Settings يشرح الرفض ويحفظ الجلسة ويوجه للإدارة. لا ادعاء بإلغاء الاشتراك عند حذف/رفض الحساب. |
| Test/Live | أسماء أسرار منفصلة دون fallback لأسرار عامة؛ فحص store/product/variant/type/customer/test_mode. Test endpoint يرفض مشروع التطبيق المستضاف المعروف. الواجهة وAuth وكل عناوين Edge Functions تستمد المشروع نفسه من إعداد صريح؛ لا endpoint إنتاج افتراضي. إعداد ناقص لا ينتقل إلى مشروع مستضاف. |
| landing والأسعار | أزيلت placeholders وروابط الشراء العامة؛ CTAs تتجه إلى `/subscription` ثم تسجيل الدخول وتأكيد الاختيار ثم Checkout من الخادم. auth return محصور في مسارات التطبيق. `public/payment-catalog.json` المصدر الوحيد لأسعار العرض والخصم، وتستخدمه صفحات Subscription/Pricing/landing وcurrency. الأسعار إرشادية **UNVERIFIED**، ولا تبقى وعود نسب سنوية متعارضة. |
| الخصم | `AMANAH30` موصوف في الكتالوج كمرشح30% للشهر الأول balanced/monthly، وليس إعدادًا مؤكدًا. `verified=false` يخفي العرض ويرفض استعماله على الخادم، حتى مع flag تشغيل خاطئ. يلزم تحقق المالك ومراجعة الكود قبل إظهاره. |
| Paddle | لم تُحذف أو تُعدّل checkout/webhook القديمة. checkout الجديد يرفض حسابًا ذا هوية فوترة قديمة غير موثوقة، ويمنع كذلك claim مدفوعًا قديمًا دون provider IDs من إنشاء التزام جديد ويطلب مراجعة. guard005 يمنع الكاتب القديم من استبدال إسقاط Lemon موثق. لا يُفترض غياب عملاء Paddle/Stripe؛ جردهم وتسوية حقوقهم شرط قبل النشر. |

المسارات المختصرة أعلاه تحت `app/frontend/supabase/functions/` أو `supabase/migrations/` أو `src/` بحسب نوع الملف. لا يُغيّر هذا الفرع إعدادات endpoints مستضافة؛ حالة نشر جميع الوظائف القديمة **UNVERIFIED**.

مفتاح وقف إنشاء Checkout لا يبطل روابط سبق إصدارها ولا يلغي عقودًا قائمة لدى المزوّد. لذلك تبقى الحجوزات وWebhook والمصالحة فعالة، ويلزم جرد Checkouts غير المحسومة قبل إعلان توقف كل إمكانية لتحصيل جديد.

## التحقق وحدوده

| الفحص النهائي | النتيجة الفعلية |
|---|---|
| Node، دون شبكة | **270/270 PASS**، fail0، skipped0، cancelled0، todo0 |
| مجموعات PostgreSQL-WASM | **17/17 PASS**، fail0، skipped0؛ تشمل تنفيذ6 ملفات SQL regression أصلية دون تعديل assertions |
| TypeScript الصارم للـhelpers الأمنية | PASS |
| Deno2.5.6 `check` | PASS لثمانية entrypoints: Checkout/Webhook لكل من Test/Live وأربع خدمات AI؛ ليس تشغيلًا لها |
| بناء Vite مع deny-network | PASS؛ تحذير حجم chunk، دون نشر أو رفع build artifacts |
| سلامة مصدر/حزمة009 | PASS:12 مدخل مصدر و10 ملفات حزمة و9 migrations مطابقة للمصادر المثبتة |
| TypeScript الكامل | FAIL:9 أخطاء سابقة، وهي نفسها في main؛ صفر أخطاء إضافية في الملفات المعدلة |
| ESLint الكامل | BLOCKED: إعداد ESLint9 غير موجود في main، exit2 |
| Native21 على المصدر الجديد / Lemon Test | NOT TESTED؛ لا ادعاء بنقل نجاح التشغيل القديم |

- اختبارات Node: `npm --prefix app/frontend run test:payments`؛ جميع assertions الأصلية محفوظة. أضيفت موافقات صريحة إلى fixture الدفع لتلائم المتطلب الجديد، ومحول عنوان اختبار في fixture Settings؛ لم تُحذف assertions ولم تستخدم skips/xfail. الساعة المرجعية لاختبارات الدفع ثابتة.
- اختبارات SQL: `npm --prefix app/frontend run test:payments:sql`، بعد `npm ci --ignore-scripts --prefix app/frontend/tests/payment-phase2-db`. تستخدم `@electric-sql/pglite@0.3.14` المثبتة بالـlockfile، PostgreSQL17.5 في الذاكرة دون TCP أو مشروع Supabase. تنفيذ فعلي لـSQL/RLS/triggers مع schema Auth اصطناعي، **وليس GoTrue أو اختبار تزامن متعدد الاتصالات**. طلبات Promise المتزامنة تختبر الحجز المتسلسل؛ قفل صف الحساب وقيود DB هما ضمان التزامن المراد اختباره لاحقًا باتصالات مستقلة أيضًا.
- يشغل محول SQL ملفات regression الأصلية دون تعديل assertions، ويطبق فقط سلوك عميل psql للفصل بين statements و`gset`/متغيراته. هذا ضروري كي لا تغير Query واحدة كبيرة حدود المعاملات في fixtures. تغلق قاعدة البيانات في نهاية التشغيل؛ لا volumes أو حاويات أو جداول مستضافة.
- `npm --prefix app/frontend run verify:subscription009` يقارن SHA256 وGit blobs وbytes مقابل مصادر Git الأصلية:12 مدخل مصدر،10 ملفات حزمة، وجميع migrations التسع. الحزمة محفوظة حرفيًا عند `9baaa89718e51638d97dfd3f8030e50424c5f28c` ومصدرها e6؛ لم تُعدّل manifests لجعل source جديد يمرّ كأنه e6.
- متطلبات إعادة الفحوص: Node24.19، dependencies الواجهة، وتثبيت حزمة SQL بالـlockfile. يتطلب تحقق Git توفر commitَي e6 و9ba محليًا؛ في shallow clone يُجلبان صراحةً للقراءة فقط قبل الفحص، ولا يُحوّل نقص object إلى PASS.
- `npm --prefix app/frontend run check:payment-types` يفحص TypeScript الصارم لطبقة الدفع/التوقيع/AI access/family entitlement وإعداد البيئة والكتالوج منفصلًا عن المشاكل السابقة. بناء Vite ينفذ مع deny-network، ومخرجاته خارج المستودع.
- فحص TypeScript الكامل يجد9 أخطاء موجودة أيضًا في main (PrayerReminderSettings/useNotifications/familyBudgetSync/DeleteAccount/FamilyBudget/Goals/Planner/Wellness). ثبتت المقارنة بقراءة ملفات main من Git إلى compiler host دون تبديل الفرع. لا suppressions أو تعديلات assertions لإخفائها. `npm run lint` محجوب لغياب eslint.config في main، مع ESLint9؛ لا ندعي نجاحه.
- حُمّل Deno2.5.6 إلى مجلد مؤقت وفُحصت الأنواع لثمانية entrypoints دون تنفيذ Deno.serve. Deno bundling/deployment، PostgREST/GoTrue الحقيقي، Lemon API/Checkout، ومصالحة عامل مستضاف: **NOT TESTED**. imports العائمة في adapters الأصلية، ومنها adapter009 المحفوظ، ما زالت تحتاج تثبيتًا/مراجعة تشغيلية منفصلة؛ لا نزعم حلها بتغيير manifest.
- نجحت الفحوص النهائية بعد إصلاح Settings لمعالجة رفض الحذف، وتصحيح ترتيب fixtures ومحاكاة أوامر عميل psql في runner الجديد؛ لم تُضعف أي SQL assertion لمعالجة أخطاء الإعداد التي كشفتها الفحوص الأولى.
- نجاح Native21/21 السابق يخص e6، لا المصدر الجديد ولا migrations010–011. وجود الكود والاختبارات هنا لا يثبت جاهزية تشغيل إنتاجية.

## عوائق القبول الباقية

1. **BLOCKED — كتالوج وبيئة المزوّد:** تأكيد المالك لـStore ID والـProducts والـVariants الأربعة في Test، العملة والإجماليات والفترات والضرائب والتجربة، ثم مطابقتها مع أسماء `AMANAHLIFE_LS_TEST_*`. لا نسخ لمفاتيح Live أو بيانات عملاء. الأرقام المعروضة مرشحة من المصدر السابق وليست اقتراح تعديل أسعار فعلية.
2. **BLOCKED — عقد أدلة الدفع:** توثيق أشكال subscription-invoices/orders الفعلية، `refunded_amount/total/status`، pagination ودلالة renews_at/ends_at بالنسبة للفترة المدفوعة. النموذج يضع confirmed_at عند الملاحظة الموثوقة ولا يخترع بداية خدمة من created_at. أي عقد مختلف يتطلب تصحيحًا مراجعًا قبل قبول منح وصول؛ لا يُعوّض الحقل المفقود بتخمين.
3. **BLOCKED — سياسات المالك:** ضمان14 يومًا، الرسوم/التجديدات والاسترداد الجزئي، توقيت سحب الحقوق، طريقة معالجة الدعم؛ النصوص الحالية تحتاج اعتمادًا تجاريًا/قانونيًا. تحقق AMANAH30 مستقل قبل عرضه؛ لا تُفعّل flag الخصم وحدها.
4. **BLOCKED — النشر/schema والعملاء السابقون:** جرد migrations/ACL/RLS/الـtriggers الفعلية وأي اختلافات، جرد Paddle/Stripe واشتراكات Lemon القديمة وتسوية trusted bindings/الفترات قبل النشر. النموذج لا يصادق على legacy tier الخام، لذا نشره بلا تسوية قد يسحب حقوق عميل حقيقي. Migration007 تتطلب توافق عميل الإشعارات كما يوضح مستند الأساس. لا تطبيق تلقائي للسلسلة.
5. **BLOCKED — التشغيل:** تثبيت/فحص Deno وimports المستخدمة في adapters الأصلية، endpoint Test منفصل ومفتاح توقيع، إعداد بوابة Supabase المناسب للـWebhook الخارجي مع HMAC إلزامي، الإبقاء على JWT في Checkout، وحدود الطلبات والمراقبة. Helpers recovery/reconciliation موجودة لكن لا cron أو anonymous endpoint أو جدولة منشورة. يلزم تمرين recovery وتحرير intent غير المحسوم بتأكيد المزوّد؛ لا حذف تلقائي.
6. **BLOCKED — قبول مصدر جديد:** تحديث حزمة قبول مستقلة بمصدر الفرع النهائي وmigrations الجديدة ومراجعة hashes، مع حفظ كل مجموعات/assertions009، ثم تشغيل native مخول لاحقًا. Workflow main وحزمته المثبتة لم تتغير. لا تُنسب نتيجة21/21 إلى هذا الفرع.
7. **مخاطر إصدار أخرى:** أخطاء TypeScript/إعداد lint السابقة، واستكمال إثبات الميزات الموعودة مثل المشاركة العائلية/التصدير وحدود الخطة المجانية. حماية AI والأسرة على الخادم لا تثبت اكتمال كل ميزة تسويقية.

## الاختبار التنفيذي التالي بدقة

بعد مراجعة الكود وتوفير حساب المالك، اطلب **قبولًا منفصلًا** لنشر الفرع على مشروع HTTPS اختباري جديد مملوك للمهمة فقط، بلا credentials أو بيانات إنتاج. لا يبدأ ذلك تلقائيًا من هذا التقرير.

1. تحقق من schema الاختبار والإصدارات وconfig: `VITE_SUPABASE_URL/ANON_KEY` لمشروع الاختبار نفسه، `VITE_AMANAHLIFE_PAYMENT_MODE=test`، و`AMANAHLIFE_LS_TEST_*` للكتالوج/المفتاح/التوقيع/APP_ORIGIN، و`AMANAHLIFE_APP_ORIGIN` لأصل واجهة الاختبار HTTPS في AI/family CORS. طبّق migrations بعد مراجعة ترتيبها وتبعياتها في بيئة الاختبار وحدها.
2. قبل فتح المبيعات، تحقق أن Checkout الجديد مرفوض وأن Auth/portal/الحقوق القائمة لا تعتمد على flag إنشاء جديد. بعد تأكيد مالك الكتالوج **في Test فقط** يلزم تصريحه لضبط `CHECKOUT_APPROVED=true` و`payment_environment(mode='test',checkouts_enabled=true)` في ذلك المشروع، لا في الإنتاج. يبقى الخصم غير مفعل.
3. أنشئ حسابين اصطناعيين A/B. من landing→Subscription→Login، اختر `balanced_monthly` ثم أكمل Checkout باستخدام وسيلة الاختبار الرسمية الموثقة لدى المزوّد. تحقق: intent واحد دائم قبل الطلب، mode/store/product/variant صحيحة، وعدم منح B أو منح عبر success=true وحدها.
4. سلّم الحدث الحقيقي إلى endpoint Test. قارن الـsubscription/invoice/order المرجعية، ثم أثبت أن وصول A محدود بالمدة المدفوعة ومن ledger خاص، وB مرفوض. أعد تسليم الحدث ثم سلّم حدثًا أقدم: لا تكرار أو إعادة حالة قديمة. بيانات الأدلة تكون أسماء مراحل/أكواد/أعداد فقط دون JWT/أسرار/معلومات عملاء أو bodies خام.
5. بعد نجاح هذه الحالة الأولى، نفذ مصفوفة [Phase1](../audits/lemon-squeezy-payment-readiness-phase1-ar.md): الخطط الأربع، التجربة والتزامن، التجديد/failed/recovered، cancel مع استمرار الوصول ثم expiry، pause/resume، refund كامل/جزئي، Customer Portal، حدود الأسرة/AI، retention والحذف، Webhook outage/recovery ووقف Checkouts الجديدة دون قطع الحقوق/الأحداث. اختبر تزامن DB الحقيقي باتصالات مستقلة أيضًا.

**قرار GO لا يصدر من نجاح offline وحده.** يلزم إنهاء العوائق والقبول الاختباري والتحقق من المصدر النهائي؛ أي تفعيل Live أو دمج أو نشر إنتاج يحتاج قرارًا لاحقًا مستقلًا.
