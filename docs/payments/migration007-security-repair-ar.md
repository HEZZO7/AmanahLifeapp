# Migration007 — تنفيذ الإصلاح المعزول وأدلة الجاهزية

تاريخ التسليم: 2026-11-03. **SECURITY NO-GO / MERGE HOLD / PRODUCTION وLIVE BILLING NO-GO.** أُعدت اختبارات SQL إضافية واستعلام الأدلة؛ لم يبدأ SQL أو Native بسبب عوائق البيئة. هذا ليس إغلاقاً للثغرة المستضافة أو قبولاً للنشر.

## المصدر والتفويض

- المستودع: `HEZZO7/AmanahLifeapp`.
- الأصل المتحقق محلياً وعبر GitHub: `a1325ab1d2340c35eb05c888d1b549616ccb2d20`، بشجرة `21e1d2758364800070358d3ede083fe756ebc1ea`.
- الفرع المستقل: `repair/migration007-notification-security-20261102`، ابن مباشر للأصل. رابط SHA النهائي يسلّم خارج هذا الملف لتجنب مرجع ذاتي دائري.
- المرجع التنفيذي: ملف المالك `AmanahLife-Migration007-Codex-Execution.md` بتاريخ2026-11-02، وإيضاح المالك اللاحق بأن Schema/ACL الكاملة غير متاحة.
- لم تتغير شيفرة التطبيق أو migration007 أو أي migration أخرى أو lockfile أو workflow أو الحزمة الأصلية المثبتة. الملفات الجديدة اختبارات وتحضير أدلة وتوثيق فقط. لم يتغير main، ولم يُرسل Actions dispatch أو تُنشأ issue.
- لم يُنفذ SQL مستضاف أو نشر أو دمج أو اتصال بمزود دفع أو حذف حساب حقيقي. لا اتصال بصفوف المشروع أو credentials أو Push secrets.

## الحقائق المقدمة وحدودها

المشروع المؤكد من المالك: `nyhsnvjdgifphwkqzwel`. الجدولان `public.app_11941c8fec_notification_preferences` و`public.app_11941c8fec_push_subscriptions` مملوكان لـpostgres، ordinary tables، RLS مفعّل، دون custom triggers أو inheritance. `user_id` UUID؛ فهرس preferences.user_id فريد، وفهرس Push المركب `(user_id,endpoint)` وارد في المرفق. حقول التفضيلات والموقع الأساسية واردة فيه أيضاً.

anon وauthenticated لديهما effective SELECT/INSERT/UPDATE/DELETE على الجدولين، دون superuser/BYPASSRLS/CREATEROLE أو عضوية postgres/service_role. سياستا `service_role_all_prefs` و`service_role_all_subscriptions` **PERMISSIVE TO PUBLIC FOR ALL USING(true) WITH CHECK(true)**. التسمية لا تقصرهما على service_role. المالك يؤكد خلل التفويض، ولا يوجد دليل مقدم على exploit أو exfiltration.

النصوص والأدوار والأوامر وpermissive/restrictive لجميع السياسات الست الأخرى وACL/defaults/FKs الكاملة غير متاحة. يجب مراجعتها عند تحديد مدى الوصول الفعلي؛ لا نتجاهل سياسة restrictive محتملة. نموذج الاختبار يعيد إنتاج الوصول العابر للحسابات في baseline تمثيلي ذي سياسات permissive، وليس استعلاماً عن بيانات مستضافة أو إثباتاً لكل مسار استغلال.

## الإصلاح القائم ومطابقة المستهلكين

الإصلاح القابل للاختبار هو الملف القائم `app/frontend/supabase/migrations/202610180007_notification_table_authority.sql`، وبصمته SHA-256:

`d82c9ec53d32ccdc1a5edff927671aaccd34925626934992f762f066d46cb3db`

007 تبقي بيانات الصفوف، وتسحب grants الجدول والأعمدة وتعيد السياسات. تمنح authenticated قراءة/إدخال أعلام وموقع التفضيلات وتحديث الأعمدة المسموحة فقط؛ لا UPDATE(user_id) أو markers أو DELETE للتفضيلات، ولا وصول جدول Push للمستخدم. تبقي service_role على DML المطلوب دون grant options أو TRUNCATE/TRIGGER/REFERENCES/MAINTAIN. تتحقق من الصلاحيات الفعلية الموروثة، لا relacl وحدها، وتفشل المعاملة عند عدم تحقق postconditions. لم تتوسع grants ولم يُحذف assertion.

| المسارات تحت `app/frontend/` | نتيجة مراجعة المصدر عند الأصل المحدد | النسخة المنشورة |
| --- | --- | --- |
| `src/components/BackupRestore.tsx` → `src/lib/notificationBackup.ts` و`backupClient.ts` | allowlist للتصدير/الاستعادة؛ لا مفاتيح أجهزة أو billing؛ UPDATE ثم INSERT دون UPDATE للهوية؛ أخطاء/partial failure معلنة | غير مثبتة |
| `src/pages/PrayerTimes.tsx` → `src/lib/notificationPreferenceClient.ts` | يستخدم `syncNotificationLocation` والتحقق من session ثم الكاتب المشترك؛ وصف direct upsert في المرفق يخص نسخة أقدم | غير مثبتة |
| `src/components/NotificationSettings.tsx` و`src/hooks/useNotifications.ts` | الأعلام والجهاز عبر push_notify؛ لا كتابة مباشرة لجدول Push | غير مثبتة |
| `src/lib/devicePush.ts` و`src/contexts/AuthContext.tsx` | إدارة جهاز وتغيير حساب/signout؛ لا وصول جدول Push مباشر | غير مثبتة |
| `src/hooks/useSavingsNotifications.ts` و`src/components/PrayerReminderSettings.tsx` | مسارات إرسال/إشعارات محلية؛ راجعت علاقتها بالhooks، لا SQL client إضافي | غير مثبتة |
| `supabase/functions/app_11941c8fec_push_notify/index.ts` | هوية من Auth؛ allowlist للأعلام؛ register/unregister مقيدان بالمستخدم؛ `onConflict:'user_id,endpoint'` يطابق الفهرس المركب | غير مثبتة |
| `supabase/functions/app_11941c8fec_push_scheduler/index.ts` | قراءة تفضيلات وكتابة markers بالخادم؛ العميل لا يحصل على صلاحيات هذه الحقول | غير مثبتة |

البحث في المصدر عن اسمي الجدولين وجد الوصول الصريح في الكاتب المحمول وpush_notify وpush_scheduler؛ المسارات غير المباشرة مدرجة أعلاه. لا يفيد ذلك جرد تطبيقات/إصدارات خارج المستودع. لم تتوفر بيانات Dashboard لنسخ Edge أو verify_jwt أو أصول Frontend المنشورة أو PostgREST exposed schemas. public schema في PostgreSQL لا تثبت وحدها انكشافها في API. لا تمثل بيانات GitHub دليلاً على إصدار مستضاف.

## ما أُعد فعلياً

أُضيف `tests/payment-phase2-db/migration007-repair.test.mjs` دون تعديل المجموعة القديمة. يستخدم نفس PGlite0.3.14 المثبتة في lockfile، ولا يقبل URL أو يقرأ environment credentials. ينشئ instance في الذاكرة ويغلقها في finally. يختبر SQL007 الفعلي والكاتب الفعلي للتفضيلات مع adapter SQL معزول، وليس Supabase SDK/GoTrue/Edge runtime حقيقية.

أُعدت **15 حالة SQL غير منفذة**: baseline permissive؛ حفظ الصفوف والفهارس؛ idempotence؛ collector؛ عزل A/B والأعمدة المحمية؛ anon وgrant options؛ INSERT للمالك ورفض الأجنبي؛ استعادة التفضيلات/legacy Push المستبعدة؛ malformed backups؛ permission failure دون local success؛ interleaving مضبوط لمسار23505؛ عمليات service-role المركبة والmarkers؛ وأربع حالات rollback كامل بسبب inherited table SELECT وprotected column UPDATE وcolumn grant option وPG17 MAINTAIN.

الـfixture لا تدعي مطابقة الاستضافة: defaults وNOT NULL وFK delete actions وmarker columns وتعريفات السياسات الست الأخرى **افتراضات اختبار تمثيلية موثقة**. المصادقة SQL claims صناعية، وليست JWT من GoTrue. interleaving ليس تزامناً باتصالات مستقلة. عمليات service SQL تختبر عقد كتابة المصدر، ولا تثبت تشغيل Edge. PG17 لا يثبت توافق PostgreSQL15.

أُضيفت أربع source preparation regressions للفصل بين static وSQL، وتقييد collector إلى catalog SELECT واحد، وتثبيت hash007 ومواءمة الكتّاب، وحفظ المدخلات الأصلية الـ79. هذه ليست بديلاً عن SQL أو Native.

## الأوامر والنتائج الحالية

البيئة تعمل في managed workspace. Node `v24.19.0` واعتمادات الواجهة المحلية متاحة. لم تُستبدل حزمة pinned بأخرى أو يُعدّل lockfile.

| الفحص | النتيجة الفعلية |
| --- | --- |
| `tests/*.test.mjs` لكل ملف في عملية مع preload `deny-network.mjs` | **451 PASS /0 FAIL /0 SKIP** عبر22 ملفاً؛447 سابقة +4 جديدة |
| `npm run test:payments` | exit0؛ تقرير Node الأب22 ملفاً ناجحاً |
| `tsc -p tsconfig.app.json --noEmit`، `npm run check:payment-types` | PASS |
| `npm run lint`، `npm run build` | PASS؛ بناء محلي دون نشر |
| `node --check tests/payment-phase2-db/migration007-repair.test.mjs` | PASS؛ JavaScript syntax فقط |
| استعلام collector | فحص معجمي/حدود مصدر PASS؛ لم يُترجم أو ينفذ على PostgreSQL |
| profile007 الجديد | exit1 عند `ERR_MODULE_NOT_FOUND @electric-sql/pglite`؛ **0 SQL statements/assertions**؛ ليست15 نتائج فشل أو نجاح |
| مجموعة SQL الأصلية `npm test` من مجلد DB | exit1 عند الاستيراد نفسه؛ **0 SQL statements/assertions** |
| تحضير حزمة4B الأصلية المثبتة |79 input dual hashes PASS،27 ملفاً مولداً، PREPARED_NOT_EXECUTED |
| مراجعة تلك الحزمة offline |135 حالة: **134 PASS /1 FAIL /0 SKIP**؛ اختبار117 يفتقد SDK المثبت، وليس Native execution |
| Docker المحلي | socket connect: operation not permitted؛ daemon موجود، task UID1000؛ لا native services أو مجموعات21 منفذة |
| `git diff --check` | PASS |

أمر profile007 من `app/frontend/tests/payment-phase2-db`:

```sh
node --experimental-strip-types --import ../deny-network.mjs --test --test-isolation=none --test-reporter=tap migration007-repair.test.mjs
```

محاولة `npm ci --ignore-scripts --audit=false --fund=false --fetch-retries=0 --fetch-timeout=10000` العادية أعادت connect EPERM إلى الوكيل المطلوب. طلب صلاحية شبكة إضافية سابق عُلّق ثم أُلغي من المستخدم؛ لم ينتج دليل تثبيت، ولم يُكرر. لم يُلغَ proxy أو TLS أو تُعدّل إعدادات النظام/صلاحيات socket، ولم يُعد تشغيل daemon أو تُضعف isolation guards.

## استعلام الأدلة الواحد

الملف `docs/security/migration007-evidence-readonly.sql` يحتوي **SELECT واحداً** للـcatalog فقط. يجمع وجود الجدولين ومالكيهما وRLS/FORCE RLS، الأعمدة وأنواعها وNULLABILITY وdefaults الآمنة أو بصماتها، FK actions، الفهارس، السياسات وأدوارها وأوامرها، ACL الجدول/الأعمدة، والصلاحيات الفعلية وgrant options والعضويات للأدوار الثلاثة. لا يقرأ صفوفاً أو ينفذ RPC أو يخرج أجسام دوال أو trigger arguments أو قيم Push.

تُحجب defaults الخاصة باعتمادات الجهاز والتعريفات غير المعروفة، وتُعاد presence/hash/reviewRequired. تُعرض policy expressions البسيطة الآمنة؛ التعريفات المعقدة تحتاج مراجعة محمية. لا يمكن توليد DDL/rollback مطابق من hash وحده. الاستعلام مُحضّر فقط؛ لا تدّعي static checks أنه صالح للتنفيذ على جميع إصدارات PostgreSQL.

المطلوب التالي من المالك هو إخراج هذا الاستعلام من الاتصال المصرح للمشروع المحدد، بعد مراجعة تنقيحه. لا حاجة لمفاتيح API أو tokens أو بيانات مستخدمين. هوية المشروع ونسخ Frontend/Edge وPostgREST configuration تحتاج أدلة نشر منفصلة، ولم يُستنتج أي منها من default أو اسم database.

## Rollback وrollout وبوابات الموافقة

**Rollback إنتاج مطابق للأصل: WITHHELD.** النصوص الكاملة للسياسات الست وACL/defaults الأصلية غير متاحة؛ لا أصطنع script وأسميه verified. اختبارات فشل المعاملة المُحضّرة تقارن ACL/policies/indexes وrow hashes قبل وبعد rollback في fixture فقط، ولم تعمل بعد.

الخطة: قبل commit يجب أن يعيد أي فشل007 كامل المعاملة. بعد commit، لا يعاد PUBLIC TRUE مع client DML كـrollback إنتاج؛ ذلك يعيد التعرض المؤكد. إن تعطل عميل قديم، يكون الاحتواء بإيقاف الميزة المتأثرة أو إصدار آمن مراجع مع إبقاء حدود البيانات المصححة، ثم roll-forward محدود. إخفاء UI وحده لا يعالج REST/SQL. أي استعادة DB كاملة تستلزم نسخة احتياطية مجربة وخطة حفظ التغييرات الأحدث وموافقة مستقلة؛ ليست rollback عادية لتعديل ACL.

تسلسل النشر المقترح، غير المنفذ:

1. تثبيت metadata الأصلية الكاملة ووقت الجمع وهوية المشروع ونسخ جميع الكتّاب وlegacy clients؛ تأكيد FK/index/defaults وتقييم السياسات restrictive والموروثة.
2. استعادة الاعتمادات عبر وصول معتمد وإتاحة native isolation؛ تشغيل profile007 والمجموعة القديمة، ثم مطابقة fixture كاملة واختبار PostgreSQL المستهدف وGoTrue/PostgREST مع A/B/anon. الحفاظ على21 مجموعة وضوابط الملكية والتنظيف والتحقق immutable. لا Actions dispatch ضمن هذا التفويض.
3. تجربة rollback/recovery في disposable DB من snapshot أصلية معتمدة، وتحديد safe fallback لا يعيد سياسات PUBLIC المتساهلة. التحقق من backup/PITR وخطة استعادة قبل أي تعديل مستضاف.
4. إعداد release متوافق للمستهلكين وEdge وتوثيق version IDs وverify_jwt/أصول البناء، ثم طلب **موافقة نشر منفصلة**؛ لا تعني مهمة الإشعارات اعتماد تغييرات الدفع أو تفعيلها.
5. بعد إثبات التوافق ونجاح الاختبارات وسلامة الحزمة، طلب **موافقة SQL منفصلة** على الملف/hash والمشروع والنافذة والتوقف والـpostconditions المحددة. لا replay آلي لـ001–011 ولا migration repair ولا reset.007 standalone.
6. تحقق metadata بعد التغيير وفق موافقة التنفيذ؛ اختبارات السلوك بحسابات صناعية في البيئة المعتمدة، دون قراءة بيانات أشخاص أو إرسال Push حقيقي أو حذف حساب حقيقي. أي mismatch يوقف rollout.

لا يُطلب الآن اعتماد hosted SQL لأن شروط القبول لم تتحقق. MERGE وdeployment وActions dispatch والفوترة تحتاج تفويضها المنفصل؛ production/live billing يبقيان NO-GO.

## الملفات الجديدة والبصمات

| الملف | SHA-256 |
| --- | --- |
| `app/frontend/tests/payment-phase2-db/migration007-repair.test.mjs` | `c34bb01f6ae450b40d70f1ad7d58986454919fdd9f190324898e43d838731949` |
| `app/frontend/tests/payment-phase2-db/MIGRATION007-REPAIR.md` | `556458f474860635d6dcafd39483122691989b639fb05cae4233cba0e94a1342` |
| `app/frontend/tests/migration007-preparation.test.mjs` | `ec485264d6608bf50b21ca1e3310c3527a7915bf1b4dc0cc15be49e1d12fa22d` |
| `docs/security/migration007-evidence-readonly.sql` | `3681752803c8172ebc125522cbed2e93f0f02e8c3c18a782dbf1b0c286589ca8` |
| `docs/payments/migration007-security-repair-ar.md` | يثبته Git tree للالتزام النهائي دون hash ذاتي دائري |

الإنجاز الحالي **PARTIAL**: الإصلاح القائم جرى ربطه بالأدلة الجزئية والكتّاب، وأُعد profileSQL إضافي واستعلام واحد للأدلة. القبول **BLOCKED** بسبب الاعتمادات وDocker وغياب schema/ACL الكاملة والتحقق من النشر وrollback الأصلي. لا SQL/native PASS ولا ادعاء إصلاح الاستضافة.
