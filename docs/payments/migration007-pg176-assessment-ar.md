# Migration007 — تقييم PostgreSQL17.6 وقرار GO/NO-GO

التاريخ: 2026-11-03. المستودع `HEZZO7/AmanahLifeapp`، الفرع الوحيد المعدل `repair/migration007-notification-security-20261102`، أصل هذه الجولة `a7c9d7ad4cc33df6afec31946909a6add8e38385`.

**القرار: NO-GO للتطبيق المستضاف وMERGE HOLD. المصدر وفحوصه PASS؛ الاختبارات التنفيذية المحلية لـSQL/RLS وNative BLOCKED.** نجاح الاستعلام الذي نفذه المالك على PostgreSQL17.6 موثق كدليل مقدم منه، وليس تنفيذاً لهذه الاختبارات أو migration007.

لم أغيّر main أو ملفات التطبيق/Edge أو migrations أو lockfiles أو workflows. لم أنفذ SQL مستضافاً أو نشرًا أو Actions dispatch أو provider calls أو حذف حسابات. profile007 لا يحتوي `DELETE FROM auth.users`؛ حسابا SQL فيه UUIDs صناعية ضمن schema معزول، ولم ينشأ ذلك schema فعلياً بسبب فشل تحميل المحرك.

## الأدلة المستضافة المستلمة

حُفظت الحقائق مع provenance في `docs/security/migration007-hosted-evidence.json`: مشروع `nyhsnvjdgifphwkqzwel`، جمع بواسطة المالك بتاريخ2026-11-03، `serverVersion=170006`، من استعلام الالتزام الأصلي أعلاه. لم يُرفق raw catalog JSON أو بيانات أشخاص، ولم يستعلم المساعد المشروع.

| الخاصية | النتيجة المقدمة |
| --- | --- |
| الجدولان | `public.app_11941c8fec_notification_preferences` و`public.app_11941c8fec_push_subscriptions` موجودان، kind=r، owner=postgres |
| RLS/topology | RLS=true، FORCE RLS=false، لا custom triggers أو inheritance؛ توجد FK triggers داخلية فقط |
| preferences |17 عموداً؛ UUID NOT NULL للهوية،6 أعلام boolean، حقول الموقع الخمسة؛ unique(user_id) valid/ready وغير جزئي |
| Push |7 أعمدة؛ UUID NOT NULL للهوية، endpoint/p256dh/auth_key من text؛ unique(user_id,endpoint) صالح |
| FK | user_id في الجدولين يشير إلى auth.users(id)، ON DELETE NO ACTION |
| ACL |anon وauthenticated لديهما SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN؛ لا Column ACL مستقلة |
| Roles |anon/authenticated دون superuser/BYPASSRLS؛ service_role لديه BYPASSRLS. الحقائق السابقة بشأن عدم CREATEROLE أو عضوية postgres/service_role محفوظة |
| Policies |السيستان service_role_all_prefs/service_role_all_subscriptions هما PERMISSIVE PUBLIC ALL TRUE/TRUE؛ الست الأخرى ملكية ولا تلغيان التعرض العام وفق نتيجة المالك |

المتاح ملخص موثق، وليس DDL كاملًا. بعض تعريفات القيود والسياسات كانت متاحة كبصمات فقط وفق المالك؛ لم أخترع أسماءها أو أجسامها أو قيم بصماتها. تظل defaults وnullability لبقية الأعمدة، وتعريفات السياسات الست وFK deferrability/ON UPDATE وعضويات الأدوار الكاملة وإعدادات النشر غير موثقة بالكامل. غياب Column ACL مستقلة **لا يعني غياب صلاحيات الأعمدة الفعلية**؛ grants الجدول الحالية تتيحها.

حُدّث تعليق collector ليذكر نجاحه لدى المالك؛ منطق SELECT لم يتغير، وطوبق بعد إزالة التعليقات مع الأصل. لذلك لا حاجة لاعتبار الملخص مجرد تخمين أو إعادة تشغيل استعلام لجمع الحقائق نفسها. عند اعتماد parity/rollback الكامل يلزم raw metadata الآمنة والتعريفات التي لا يمكن استنتاجها من hashes.

## مطابقة007 مع PostgreSQL17.6

الملف `app/frontend/supabase/migrations/202610180007_notification_table_authority.sql` بقي دون تعديل، SHA-256:
`d82c9ec53d32ccdc1a5edff927671aaccd34925626934992f762f066d46cb3db`.

راجعت أيضاً كود PostgreSQL الرسمي عند tag `REL_17_6`، والتزامه `7885b94dd81b98bbab9ed878680d156df7bf857f`:

- [acl.h:160](https://github.com/postgres/postgres/blob/7885b94dd81b98bbab9ed878680d156df7bf857f/src/include/utils/acl.h#L160): `ACL_ALL_RIGHTS_RELATION` تشمل الصلاحيات الثماني، بما فيها MAINTAIN.
- [aclchk.c:1881](https://github.com/postgres/postgres/blob/7885b94dd81b98bbab9ed878680d156df7bf857f/src/backend/catalog/aclchk.c#L1881): مسار GRANT/REVOKE يحول ALL PRIVILEGES إلى تلك المجموعة للجدول.
- [aclchk.c:3451](https://github.com/postgres/postgres/blob/7885b94dd81b98bbab9ed878680d156df7bf857f/src/backend/catalog/aclchk.c#L3451): عضوية `pg_maintain` قد تمنح MAINTAIN ضمنياً دون grant على كل جدول.

هذه مطابقة مصدر إصدار محدد، **ليست تجربة SQL منفذة هنا**. لا أضع SQL PASS بناءً عليها.

| الحد المطلوب | ما تفعله007 في المصدر | حالة الإثبات التنفيذي |
| --- | --- | --- |
| سحب الصلاحيات الثماني المباشرة |REVOKE ALL من PUBLIC/anon/authenticated/service_role؛ تشمل MAINTAIN على17.6 | BLOCKED محلياً |
| إزالة أي Column ACL |REVOKE ALL لكل الأعمدة، ثم منح الحد المسموح | BLOCKED محلياً |
| anon |لا grants أو سياسة قراءة/كتابة شخصية | BLOCKED محلياً |
| authenticated/preferences |SELECT/INSERT للهوية و11 حقلًا محمولًا؛ UPDATE للحقول الـ11 فقط؛ RLS يربطها بـauth.uid | BLOCKED محلياً |
| authenticated/Push |لا وصول مباشر للجدول أو secrets | BLOCKED محلياً |
| service_role |DML فقط للجدولين؛ BYPASSRLS لا يلغي ضرورة ACL | BLOCKED محلياً |
| TRUNCATE/REFERENCES/TRIGGER/MAINTAIN |لا يعاد منحها لأي من أدوار API؛ ولا grant options | BLOCKED محلياً |
| الصلاحيات الموروثة |postconditions تفحص effective privileges؛ عند بقاء صلاحية زائدة تفشل المعاملة كاملةً | BLOCKED محلياً |

RLS لا يحمي TRUNCATE؛ والقدرة على إنشاء FK/trigger ليست كتابة صف عادية. ثبوت صلاحية SQL لا يعني تلقائياً وجود REST endpoint لتنفيذها؛ يلزم جرد PostgREST/RPC منفصل. لا دليل مقدم على exploit أو exfiltration.

REVOKE على الجدول لا يسحب عضوية role أخرى. لذلك007 لا تدعي إزالة MAINTAIN الموروثة من pg_maintain أو منح custom role؛ بل ترفض الحالة وتعيد المعاملة. لو وقع ذلك مستقبلاً فلن يعد الجدول مُصلحاً لمجرد بدء التنفيذ. مراجعة العضوية/منح الدور الآخر ستكون تغييراً مستقلاً محدداً ومعتمداً؛ لا نحذفها أو نضعف assertion تلقائياً.

## Fixture واختبارات مُحضّرة

حُدث profile `tests/payment-phase2-db/migration007-repair.test.mjs` ليطابق **جميع الخصائص المثبتة**:17/7 عموداً، UUID NOT NULL، FK NO ACTION صريح، RLS دون FORCE، لا custom triggers/inheritance، لا Column ACL عند baseline، وGRANT ALL للدورين غير الموثوقين على PostgreSQL17. baseline صلاحيات service DML وتعريفات defaults والسياسات الست المفصلة تظل افتراضات عقد اختبار معلنة؛ ليست ادعاء parity كاملة.

عدد الحالات المُحضّرة19. تشمل استدعاءات فعلية للـSQL عند توفر المحرك: SELECT/UPDATE/DELETE العابر للحسابات قبل الإصلاح، ثم رفض anon وعزل A/B، والأعمدة المحمية وPush secrets، وINSERT للمالك، وidempotence وحفظ الصفوف والفهارس، والـcollector وتصادم search_path، والكاتب الفعلي لـportable restore ومسار23505 وmalformed/permission failure، وservice registration/unregister والmarkers.

أضيفت عمليات TRUNCATE وCREATE TRIGGER وREFERENCES مع witnesses قبل007 ورفض42501 بعدها. مخطط FK probe دائم وصناعي مملوك لدور fixture، دون منح CREATE علىpublic؛ استخدام TEMP FK إلى جدول دائم كان سيختبر قيد PostgreSQL غير المتعلق بالتفويض. وأضيفت مقارنة constraints وFK triggers إلى snapshots، وحالة pg_maintain فوق حالات inheritance/grant option الأخرى، وجميع الصلاحيات الثماني وcolumn REFERENCES ضمن postchecks. لا توجد assertions متخطاة أو مخففة.

## النتائج المنفذة فعلياً والعائق التقني

| الفحص | PASS | FAIL | SKIP | الحكم |
| --- | ---: | ---: | ---: | --- |
| اختبارات source،22 ملفاً مع deny-network |453 |0 |0 | PASS؛ لا اتصال فعلي بخدمات |
| TypeScript التطبيق وpayment types، ESLint، build |—|—|—| PASS محلياً؛ لا نشر |
| syntax JavaScript للـprofile007 |—|—|—| PASS؛ لا SQL compile |
| سلامة79 مدخلاً أصلياً للحزمة المثبتة |—|—|—| PASS؛ لا تغيير native/assertions/workflows |
| collector المستضاف |—|—|—| نجاح17.6 مقدم من المالك، ليس تشغيل migration007 |
| profileSQL007 |0 |1 harness import |0 | BLOCKED؛0 SQL statements/assertions؛ الحالات19 لم تبدأ |
| Native/PostgREST/GoTrue |—|—|—| BLOCKED قبل تشغيل الخدمات |

profileSQL توقف عند `ERR_MODULE_NOT_FOUND @electric-sql/pglite`. محاولة npm ci بالـlockfile نفسه وignore-scripts ودون retry انتهت connect EPERM إلى الوكيل الموروث. registry.npmjs.org ضمن allowlist؛ المنع في طبقة اتصال executor، وليس خطأ اعتماد Supabase. لم أعد الطلب الإضافي المعلق الذي أُلغي سابقاً، ولم ألْغِ proxy أو TLS.

بحث البديل المحلي لم يجد postgres/postmaster/initdb/psql أو .deb محفوظة أو engine WASM/tarball في المسارات المقروءة أو npm cache المفحوصة؛ لا parser/driver PostgreSQL مثبت. gcc/make دون مصدر ومحرك موثقين لا يوفران قاعدة SQL. عميل Docker موجود لكن الاتصال بالـUnix socket يفشل operation not permitted رغم daemon يعمل؛ task UID غير جذري، ولم أغير socket/group أو أشغّل daemon منافساً. SQLite أو pg-mem أو mocks ليست بدائل صالحة لإثبات RLS/MAINTAIN ولا استُخدمت كنجاح تنفيذي.

**أقصر حل قابل للتنفيذ:** استعادة بيئة executor تسمح بالوصول إلى الوكيل المطلوب أو توفر artifact PGlite0.3.14 الموافق للـSRI من الكاش المعتمد، ثم تشغيل الأمرين أدناه داخل بيئة الاختبار. هذا المسار لا يحتاج Docker لاختبارات WASM، لكنه لا يثبت Native17.6. البديل الأصلي يحتاج PostgreSQL17.6 وأدواته المعتمدة في workspace معزول أو Docker محلياً بصلاحية socket؛ لا يتوفر أي منهما هنا.

من `app/frontend/tests/payment-phase2-db` بعد تعافي البيئة:

```sh
npm ci --ignore-scripts --audit=false --fund=false
node --experimental-strip-types --import ../deny-network.mjs --test --test-isolation=none --test-reporter=tap migration007-repair.test.mjs
```

لا حاجة لمفاتيح مشروع الإنتاج لتشغيل هذا الاختبار. المحرك المحلي عند توفره يجب تسجيل نسخته الفعلية؛ PGlite هو PostgreSQL17 WASM ولا يُسمى تلقائياً PostgreSQL17.6 native.

## توافق العملاء وأثر NO ACTION

فحوص المصدر الحالية تختبر BackupRestore والـadapter/allowlist ورسائل الفشل، وPrayerTimes والكاتب المشترك، وpush_notify والجهاز والسجل ومخطط الفهرس المركب، وscheduler مع SDK doubles. SQL profile يربط الكاتب الفعلي بعمليات SQL معزولة؛ لم ينفذ. لا يوجد إثبات منشور لنسخة Frontend/Edge أو verify_jwt أو exposed schemas، لذلك **لا أضع PASS لتوافق النشر أو Edge runtime/HTTP فعلي**. التصدير الكامل لجداول email/search خارج حدود الجدولين لا يكتسب parity من هذا الملخص.

NO ACTION للجدولين يعني أن Auth DELETE قد يفشل إذا بقيت صفوف مرجعية؛ RLS أو سحب client DELETE ليسا CASCADE ولا cleanup. مصدر009 ينظف preferences وPush مع الاشتراكات/search/email في BEFORE Auth DELETE داخل المعاملة، ويحتاج008 وبنية الدفع وreadiness وtrigger مطابقاً. هذا متوافق ترتيبياً مع إزالة المراجع قبل تحقق FK، لكنه لم يثبت على الاستضافة. آخر دليل مقدم بشأن009 أفاد غياب cleanup/trigger؛ الملخص الجديد لا يجرد Auth triggers أو يثبت تغير ذلك. FK deferrability لهذه الجداول لم تُفصل، فلا أفترض توقيت فحص آخر غير الموثق.

007 تبقي service DELETE للجدولين حتى يستطيع المسار الخادمي المعتمد التنظيف؛ لا تفتح client DELETE ولا تغير FK. حُذفت الحاجة إلى أي تشغيل حذف حساب لإجراء هذه المراجعة: كانت قراءة مصدر فقط. الكاتب القديم الذي يحذف صفوفاً عبر طلبات HTTP ثم يفشل Auth ليس معاملة ذرية، ويجب منع اعتماده في خطة النشر. لا تحويل لـCASCADE أو تعديل008/009 أو تاريخ فوترة لتجاوز فشل.

## خطة النشر والاحتواء والتراجع — غير منفذة

1. إكمال مطابقة التعريفات غير المفصلة وتوثيق أي role inheritance/pg_maintain وgrants؛ تجميد ملف/hash007 وشروط ما قبل/بعد التنفيذ ونافذة التوقف.
2. تعافي البيئة، ثم19 حالة SQL دون تخطٍّ، ثم native PostgreSQL17.6/PostgREST/GoTrue بهويات صناعية وتحقق من الحد المطلوب دون أي حساب إنتاج أو provider calls. تحديث حزمة validation immutable منفصلة؛ الحزمة الأصلية ذات21 مجموعة لا تتغير ولا تُعاد تسميتها حزمة كاملة لـ007.
3. إثبات backup/PITR وتجربة استعادة وتسجيل الفروق والحقوق والكتابات اللاحقة؛ لا اعتماد بيانات دفع من flags العميل ولا مسح سجل قائم.
4. موافقة منفصلة على إصدار Frontend/Edge المتوافق، مع version evidence وlegacy-client/cache plan. لا تفعيل للدفع ضمن هذه المهمة.
5. موافقة SQL مستقلة على المشروع `nyhsnvjdgifphwkqzwel` والملف/hash والنافذة. لا replay لمهاجرات أكتوبر ولا migration repair أو reset. بعدها فقط تُراجع postconditions بالmetadata وتراقب الأخطاء دون مفاتيح أو صفوف شخصية.

قبل commit، أي فشل يجب أن يعيد المعاملة. بعد commit، لا تعاد PUBLIC TRUE أو grants الثماني للدورين لإصلاح عميل قديم. تُحافظ حدود البيانات الجديدة وتوقف الميزة المتأثرة مؤقتاً أو يعتمد roll-forward ضيق بعد مراجعة؛ إخفاء UI وحده لا يغلق REST/SQL. استعادة نسخة DB كاملة ليست علاجاً اعتيادياً لتعديل ACL وقد تفقد كتابات أحدث، فتحتاج خطة وحفظ deltas وموافقة مستقلة. لم يُنتج rollback أصلي مزعوم من تعريفات hash-only، ولم يُختبر recovery؛ يبقى ذلك شرطاً مانعاً للإطلاق.

## الملفات والبصمات

| الملف المتغير | SHA-256 |
| --- | --- |
| `docs/security/migration007-hosted-evidence.json` | `a9f56a68a5a9e434f8012a6007fc0a389f5b742d1ea9dd09aed4e17c80cbcd9e` |
| `docs/security/migration007-evidence-readonly.sql` | `5479ac92a45e9806033ed062e8339d05c882bb2baa1fd670c053eb6423fb4579` |
| `app/frontend/tests/migration007-preparation.test.mjs` | `f5866d28ec5a9474368a348cfca6be6cc7200c7c5bf5f6c26c469121989b2d3f` |
| `app/frontend/tests/payment-phase2-db/migration007-repair.test.mjs` | `0e0c0fb809c82c6cfa9f77e9fbf36f899d58ef8a12c4a1cd076a1317a5d6dd85` |
| `app/frontend/tests/payment-phase2-db/MIGRATION007-REPAIR.md` | `241f7e9ce6cb6f5c6dc274a33d55b708d19afc5d947bfc453246b378266ef4cb` |
| `docs/payments/migration007-query-review-ar.md` | `81f434076df611013c6bca235f7b4576043143fa80bfa4e7eae79cc530c47c92` |
| `docs/payments/migration007-pg176-assessment-ar.md` | يثبته Git tree للالتزام النهائي دون hash ذاتي |

الإنجاز **PARTIAL**. نجاح جمع Metadata لا يساوي إصلاح الاستضافة، ومطابقة مصدر PostgreSQL لا تعوض الاختبارات التنفيذية. **NO-GO / SQL وNative BLOCKED / MERGE HOLD / Production وLive Billing NO-GO.**
