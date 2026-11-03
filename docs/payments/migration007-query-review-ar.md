# Migration007 — مراجعة الاستعلام وتشغيله في SQL Editor

تحديث الأدلة: أفاد المالك بنجاح الاستعلام على PostgreSQL17.6 بتاريخ2026-11-03 وقدّم نتائج schema/ACL إضافية. التقرير أدناه تاريخي عند `a7c9d7ad4cc33df6afec31946909a6add8e38385`؛ راجع [تقييم PostgreSQL17.6](migration007-pg176-assessment-ar.md) و`docs/security/migration007-hosted-evidence.json`. نجاح collector ليس نجاح migration007 أو اختبار SQL معزول.

التاريخ: 2026-11-03. الفرع الوحيد المعدل: `repair/migration007-notification-security-20261102`. الأصل لهذه المراجعة `793c77e6877fa8e0d2988b9ad15c44ddfa0d9f5a`، والمستودع `HEZZO7/AmanahLifeapp`.

**النتيجة: إصلاح المصدر وفحوصه PASS؛ تحقق PostgreSQL/SQL/RLS/Native BLOCKED؛ MERGE HOLD؛ Production وLive Billing NO-GO.** لم تُعدّل007 أو شيفرة التطبيق أو أي قاعدة مستضافة. لم تُشغّل providers أو Actions أو عمليات حذف حقيقية. لا Metadata كاملة وصلت في هذه الجولة، لذلك لم تُحوّل افتراضات fixture إلى حقائق.

## التعديل وسبب الحاجة إليه

في النسخة السابقة كانت ثلاث نداءات `unnest` غير مؤهلة: أدوار السياسة، أعمدة القيد، والأعمدة المرجعية. PostgreSQL يسمح بوجود overloads في application schemas؛ تحديد الدالة غير المؤهلة يتأثر بقواعد function resolution وsearch_path. هذا يتعارض مع غرض collector الذي يجب ألا يستدعي دوال التطبيق. العدد الصحيح ثلاث، وليس أربعاً كما ورد في تحديث التقدم الأول.

أصبحت جميعها `pg_catalog.unnest`. أُهلت أيضاً21 عملية cast حقيقية بـ`pg_catalog`، ومنها int4/jsonb/text/regclass/regprocedure، مع إبقاء النصوص التي تقارن default expressions كما هي. لم أُعد كتابة منطق الصلاحيات أو أقلل البيانات الوصفية المطلوبة.

أُضيف `columns[].number` بقيمة `attnum` لربط `indexes[].attributeNumbers` بأسماء الأعمدة بدقة؛ ترتيب القائمة وحده لا يكفي إذا ترك حذف أعمدة تاريخية فجوات في الترقيم. فحص SQL المُحضّر يتحقق من ربط unique preferences index بعمود الهوية الصحيح.

فحص المصدر أعاد3 نداءات و21 cast غير مؤهلين عند الأصل، وصفرًا بعد التعديل. هذه مراجعة مصدر مثبتة، **وليست إثبات تشغيل PostgreSQL** أو ادعاءً بأن syntax النسخة السابقة كان مرفوضاً.

أُضيف regression مصدر لمنع رجوع النداءات/types غير المؤهلة. وأُعد اختبار SQL إضافي ينشئ `public.unnest(oid[])` و`public.unnest(int2[])` صناعيين مع search_path يبدأ بـpublic؛ يشهد أولاً خطأZX007 من النداء غير المؤهل ثم يتوقع نجاح collector المؤهل. هذا الاختبار **لم يعمل** بسبب المحرك المفقود. profileSQL يحتوي الآن16 حالة مُحضّرة، ولا `.skip` أو assertions مخففة.

من ناحية ميزات catalog، مراجعة المصدر تستهدف PostgreSQL15/17: attidentity وattgenerated وindnkeyatts متاحة فيهما، وMAINTAIN محصورة بفرع server_version_num>=170000. النسخة الفعلية ستظهر في الناتج؛ لم تثبت هذه الجولة توافقاً تنفيذياً مع أي إصدار PG. لا يوجد parser أو server PostgreSQL محلي متاح، وPGlite المثبتة المطلوبة غير مستعادة.

## تعليمات المالك: استعلام واحد للقراءة فقط

1. افتح المشروع المؤكد من حسابك المصرح: `https://supabase.com/dashboard/project/nyhsnvjdgifphwkqzwel`، وطابق Project Reference في Settings مع المعرّف نفسه. لا ترسل credentials.
2. افتح **SQL Editor → New query**. استخدم جلسة مصرحاً لها بقراءة catalog. لا حاجة لإضافة token أو key أو connection string إلى النص.
3. انسخ **كامل الملف الحالي** [migration007-evidence-readonly.sql](../security/migration007-evidence-readonly.sql) من الالتزام المسلّم مع هذا التقرير. لا تستخدم ملف migration007 الذي يحتوي تغييرات صلاحيات؛ هذا ملف أدلة مختلف.
4. راجع أن النص يحتوي WITH/SELECT واحداً وينتهي بـ`as migration007_catalog_evidence;`، ثم شغّله وحده. لا تضف migration أو repair أو reset أو SET ROLE أو أوامر منح.
5. انسخ قيمة JSON الوحيدة في عمود `migration007_catalog_evidence` أو نزّل نتيجة هذا الاستعلام فقط. أرسل JSON مع تأكيد Project Reference. لا تُصدر جداول التطبيق أو Auth أو HAR/headers أو مفاتيح Push.
6. إذا ظهر خطأ، يكفي SQLSTATE والرسالة وموضع الخطأ بعد تنقيح أي بيانات حساسة؛ لا تغيّر الاستعلام لتوسيع صلاحيات أو قراءة صفوف.

استعلام الأدلة لا يقرأ صفوف المستخدمين أو يشغّل RPC، ولا يخرج أجسام دوال أو trigger arguments أو قيم endpoint/p256dh/auth_key. defaults غير الآمنة/غير المعروفة والسياسات المعقدة تبقى hash مع reviewRequired؛ لا تُملأ بالتخمين. ظهور أسماء أعمدة أو أسماء أدوار لا يعني عرض قيم credentials.

هوية المشروع ونسخ Frontend/Edge وPostgREST exposure ليست قابلة للإثبات من database name؛ لذلك تبقى حقول VERIFY_EXTERNALLY/NOT_COLLECTED مقصودة، ولا تعني نجاح تحقق نشر.

## المطابقة التالية عند وصول Metadata

تُراجع: الجدولان بالاسم الصحيح وkind=r وowner=postgres؛ RLS/FORCE RLS؛ غياب custom triggers/inheritance؛ نوع user_id UUID؛ حقول boolean والموقع؛ unique index صالح وغير جزئي/تعبيري بمفتاح user_id واحد؛ وفهرس Push المركب وفق contract الكود. تُطابق FK actions وnullability/defaults وكل الأعمدة الإضافية قبل تعديل fixture.

تُراجع ACL الجدول والأعمدة، grant options والعضويات الفعلية، وأوامر وأدوار وتركيب السياسات الثماني permissive/restrictive وUSING/WITH CHECK. لا تُستنتج scope من الاسم `service_role_all_*`، ولا تُتجاهل restrictive policies، ولا تُعامل hash كتعريف DDL كامل.

بعد اكتمال التعريفات تُستبدل افتراضات fixture الموثقة بالتعريفات الفعلية مع مستخدمين صناعيين فقط، ثم تُشغل حالات العزل A/B/anon والأعمدة المحمية وسرية Push وservice writes وmarkers، وفشل المعاملة/idempotence/الصلاحيات الموروثة. يظل Native/PostgREST/GoTrue وتزامن الاتصالات المستقلة مطلوباً فوق WASM. لا يكفي PASS لمجموعة source أو نموذج schema لإغلاق التفويض المستضاف.

توافق المصدر الحالي: BackupRestore يستعمل allowlist وUPDATE ثم INSERT؛ PrayerTimes يستعمل الكاتب المشترك بدلاً من legacy upsert؛ push_notify يستعمل composite conflict key وهوية من Auth؛ scheduler يستعمل صلاحيات الخدمة للmarkers. اختبارات المصدر تغطي هذه المسارات مع doubles؛ النسخ المنشورة وverify_jwt وسلوك HTTP الفعلي ما زالت غير مثبتة.

## النتائج المنفذة الآن

| الفحص | النتيجة |
| --- | --- |
| اختبارات source،22 ملفاً مع deny-network | **452 PASS،0 FAIL،0 SKIP**؛ أُعيد ملف preparation ذي5 حالات بعد آخر تعديل |
| TypeScript التطبيق وpayment types، ESLint، build | **PASS**؛ لا نشر |
| syntax JavaScript للـprofile007 | **PASS**؛ لا يعني SQL compile |
| حدود الاستعلام وqualification/baseline hash | **PASS static**؛ بقي SELECT واحداً و007 بذات hash |
| profile007 ذو16 حالة ومجموعة SQL الأصلية | كلاهما exit1 عند استيراد `@electric-sql/pglite`؛ **0 SQL statements/assertions** |
| مراجعة حزمة Native القديمة offline | **134 PASS /1 FAIL /0 SKIP** من135؛ SDK المثبت مفقود؛ ليست Native execution |
| socket Docker المحلي | **BLOCKED: operation not permitted**؛ لم تبدأ خدمات Native |
| مدخلات الحزمة المثبتة الأصلية الـ79 | **PASS** ببصمتي Git وSHA-256؛ لم تتغير المجموعة الأصلية أو ضوابطها |
| Supabase read access | **غير متاح**: لا connector مناسب أو إعداد اتصال Supabase في الجلسة؛ لم تُستخدم D1 أو خدمة أخرى بديلاً |

لم أكرر طلب صلاحية الشبكة المعلق الذي أُلغي سابقاً، ولم أتجاوز proxy أو TLS أو صلاحية Docker. SQL/native acceptance وfixture parity وdeployed compatibility ليست PASS.

## الاحتواء والتراجع

007 لا تغيّر صفوف التطبيق؛ أي فشل داخل معاملتها يجب أن يعيد ACL والسياسات كاملةً، لكن الاختبارات التي تثبت ذلك ما زالت غير منفذة. لا يمكن تقديم rollback مطابق للأصل قبل Metadata الكاملة واختباره مع snapshot معتمدة في disposable DB.

بعد أي تغيير مستقبلي معتمد، لا تعاد سياسات PUBLIC TRUE أو client-wide DML كوسيلة رجوع. عند عدم توافق إصدار قديم، خطة الاحتواء هي إيقاف الميزة المتأثرة أو استخدام إصدار آمن مراجع، مع الحفاظ على حدود البيانات المصححة والحقوق والتفضيلات. إخفاء زر أو إيقاف واجهة لا يعالج وحده وصول REST/SQL. يلزم roll-forward محدود ومراجع بدلاً من فتح الجداول. أي restore كلي يحتاج backup مجرباً وحفظ التغييرات اللاحقة وموافقة مستقلة.

ترتيب الاعتماد يظل: Metadata مكتملة → fixture مطابق → SQL/RLS ناجح → Native وHTTP ناجح وحزمة immutable مراجعة → backup/recovery مثبتة → موافقة منفصلة على نشر المستهلكين المتوافقين → موافقة منفصلة على SQL007 للمشروع والنسخة/النافذة المحددة. لا نشر أو merge أو hosted change أو billing في هذه الجولة، ولا طلب قبول إنتاج قبل اجتياز الشروط.

## بصمات الملفات

| الملف | SHA-256 |
| --- | --- |
| `docs/security/migration007-evidence-readonly.sql` | `57076376b034571a5c2580af04d4439352d3614f632aac6e813084ee73104ba9` |
| `app/frontend/tests/migration007-preparation.test.mjs` | `d1b16da4fb9c7a4e109d2007047231a728d155fc7a93a367bfa331e24fecd54a` |
| `app/frontend/tests/payment-phase2-db/migration007-repair.test.mjs` | `d3a0ff1697f197ff1179087aa0ab57fe887fc9a4d5ecfc13d8900e39fd2f3a34` |
| `app/frontend/tests/payment-phase2-db/MIGRATION007-REPAIR.md` | `7af09aa03abfa110fd19c6a6e2ff44b74d03101ff28598f4b088661b51c4f688` |
| `docs/payments/migration007-security-repair-ar.md` | `a3523a3b29a57919159e93f601d1313664f2f999aa154a248abd72eb2e661eaa` |
| هذا التقرير | يثبته Git tree للالتزام المسلّم دون hash ذاتي |

الخطوة التي تحتاج دليلاً خارج المستودع الآن هي نتيجة الاستعلام أعلاه. **الحالة PARTIAL / SQL وNative BLOCKED / MERGE HOLD / Production وLive Billing NO-GO.**
