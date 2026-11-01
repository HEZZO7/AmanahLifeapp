# Phase 4C — أدلة أمن قاعدة البيانات وجاهزية Native

التاريخ: 2026-11-01. النتيجة: **BLOCKED**. هذا تسليم تشخيصي؛ لم تكتمل حزمة Native الموسعة، ولم تنفذ اختبارات SQL أو خدمات Native. لا أوصي بتشغيل Native مستضاف الآن. قبول الدمج يبقى HOLD، والإنتاج والفوترة الحية **NO-GO**.

## المصدر والنطاق

- المستودع: `HEZZO7/AmanahLifeapp`، والتحقق عبر Git المحلي وGitHub connector المعتمد.
- الأصل الدقيق: [`a8e1321fa7ae60ec2e726853ec881bc8b9139105`](https://github.com/HEZZO7/AmanahLifeapp/commit/a8e1321fa7ae60ec2e726853ec881bc8b9139105).
- شجرة الأصل: `ddb31ae8481fd9f84aaac81e3724598335356b1c`.
- الفرع الجديد: `diagnostic/phase4c-database-native-readiness-20261101`، والتزام التسليم ابن مباشر للأصل أعلاه. رابط SHA النهائي يُسلّم خارج هذا الملف لتجنب مرجع ذاتي دائري.
- حزمة 4B الأصلية تثبّت مصدر التطبيق `fece36e90b1f9eb79e1be36a39043ff5b697c427`، وتشمل 79 مدخلاً ببصمتي Git وSHA-256. أعيد توليدها والتحقق من سلامة المدخلات، دون تعديلها.

التغييرات هنا ستة ملفات تشخيص وتوثيق واختبارات فقط. لم تتغير ملفات التطبيق، وظائف Supabase، migrations 001–011، lockfiles، حزمة 4B، fixture الأصلي، assertions، أو workflows. لم يُغيّر main، ولم يحدث دمج أو نشر أو hosted migration أو اتصال Lemon Squeezy أو تفعيل فوترة أو Actions dispatch.

## تدقيق تعريفات الجداول

الأسماء الفعلية تبدأ بـ `public.app_11941c8fec_`. البحث في الأصل المحدد وفي التاريخ المتاح عبر connector لم يجد DDL موثقاً للجداول الثلاثة، ولا snapshot موثقاً من قاعدة البيانات المستضافة. هذا لا يعني أنها غير موجودة في الاستضافة.

| الجدول | المعلوم من المصدر | DDL / grants / RLS / FK / triggers المستضافة |
| --- | --- | --- |
| `bill_reminders_sync` | `reminderSync.ts` يتطلب `id,user_id,local_id,name,due_date,is_paid,due_date_sent_at,day_before_sent_at` | غير متاحة؛ UNKNOWN |
| `goal_reminders_sync` | الملف نفسه يتطلب `id,user_id,local_id,title,target_date,status,target_date_sent_at,three_day_sent_at` | غير متاحة؛ UNKNOWN |
| `email_digest` | weekly digest يتطلب `user_id,enabled,savings_data,last_sent_at`؛ migration 009 تدرجه في التنظيف | غير متاحة؛ UNKNOWN |

هذه عقود استخدام في الشيفرة، وليست إثباتاً للأنواع أو nullability أو uniqueness أو defaults أو ownership أو صلاحيات قاعدة البيانات.

migration 007 تخص `notification_preferences` و`push_subscriptions`؛ لا تثبت حماية الجداول الثلاثة أعلاه. migration 009 تنظف `subscriptions,search_history,email_digest,notification_preferences,push_subscriptions` ولا تذكر مرآتي bill/goal. لا يمكن إثبات نجاح حذف حساب له reminder rows دون معرفة FK/actions وAuth triggers الفعلية. لم تُخترع CASCADE ولم تُحذف قيود مجهولة.

fixture Native الحالي ينشئ تبعيات تنظيف اصطناعية `id,user_id,marker` مع FK إلى Auth؛ وfixture PGlite يبسط email إلى `user_id uuid` فقط. كلاهما ليس تعريف الاستضافة. لا يجوز استنتاج RLS أو الأعمدة المسموحة للجداول الفعلية منهما.

راجع البحث أيضاً trees كاملة غير مقطوعة عند `f29d8df16e434e8cd064968e4b832e9c8f84e2fb` و`e6dd3fc5e014ea0539df8da12a6ee84582b302b9`، والتزام تنفيذ المرايا `49c4a6ff2f2a6498c306b731fb1eb5bc36c2d971`. قائمة ثمانية مستندات تاريخية وروابطها وبصمات Git في `docs/security/phase4c-evidence-index.json`. هي scripts تحضير أو تقارير سردية؛ CSV الأصلي مذكور بأنه محفوظ خارج GitHub وغير متاح هنا. لم أعامل ادعاء إنشاء جدول أو تقريراً تاريخياً كدليل على حالة الاستضافة الحالية.

## الوصول المباشر وقرار migration

فلتر `user_id` في الواجهة لا يحمي REST/SQL مباشرة. الإثبات المطلوب يشمل صلاحيات PUBLIC/anon/authenticated الفعلية والموروثة، صلاحيات الأعمدة، RLS وFORCE RLS، الأدوار المالكة/BYPASSRLS، تركيب السياسات permissive/restrictive، الدوال SECURITY DEFINER، views، triggers وتبعيات الحذف. انكشاف REST يحتاج أيضاً إعداد PostgREST الموثق؛ صلاحية SQL لا تثبت تلقائياً endpoint REST.

أُضيف collector للـ catalog فقط داخل transaction READ ONLY و`search_path=pg_catalog` ثم ROLLBACK. يجمع metadata والبصمات دون قراءة صفوف التطبيق/Auth أو تنفيذ RPC، ولا يخرج أجسام الدوال أو قيم defaults أو policy literals أو trigger arguments كنصوص. **PREPARED / NOT EXECUTED**: اجتاز فحصاً معجمياً محلياً فقط؛ لم يُترجم أو يُنفذ على PostgreSQL. لا يغني إخراجه وحده عن مراجعة التعريفات المحجوبة ومصدرها وتاريخها وإعداد REST.

المحلل التشخيصي محافظ: كل catalog غير موثق يبقى BLOCKED. اختبارات PUBLIC TRUE، restrictive FALSE، inherited roles، column grants وTRUNCATE تستخدم مستندات اصطناعية؛ ليست اختبارات اختراق لقاعدة مستضافة. TRUNCATE يتجاوز RLS على SQL لكنه ليس بذلك endpoint REST.

**قرار migration: WITHHELD.** لم تثبت ثغرة تفويض حالية في هذه الجداول من schema موثقة، ولذلك لم تُضف migration تخمينية. يجب أولاً الحصول على تعريفات وصلاحيات موثقة ومراجعة سيناريو مستخدم A ضد B، ثم اقتراح أصغر تعديل يحفظ أعمدة الخدمة وownership وcleanup. لا يوجد ادعاء أن الجداول آمنة أو أن ثغرة أُصلحت.

## الشبكة والاعتمادات

البيئة المحلية تعمل والمصدر الدقيق متاح ومتحقق منه. الاتصالات العادية من shell إلى الـ proxy المطلوب على المنفذ 8080 تفشل بـ `EPERM`. لا تكفي هذه النتيجة لإثبات أن خدمة proxy متوقفة أو أن Git config قديم؛ هي منع وصول من sandbox في هذه المحاولة. GitHub connector المعتمد يعمل لقراءة المصادر ونشر فرع التشخيص. لم تُطبع أسرار proxy، ولم تُعدّل إعدادات شبكة النظام، أو يُلغَ proxy أو TLS، أو تُتجاوز ضوابط الشبكة.

| الاعتماد | الإصدار المثبت في lockfile | SHA-256 للـ lockfile | النتيجة |
| --- | --- | --- | --- |
| PGlite | `0.3.14` | `50c7667bb51d88b946b2e67386c53549414725566ae5206487eea9f42fd86b5e` | BLOCKED، لا artifact مستعاد |
| Supabase SDK لحزمة Native | `2.110.0` | `1c256eb7885c127bc679f6b0e381098591ac894d9321e5a4f7a6ef6ec8e43221` | BLOCKED، لا artifact مستعاد |

تمت مطابقة lockfiles مع المدخلات المثبتة، والتحقق من resolved HTTPS إلى registry.npmjs.org وSHA-512 SRI لكل حزمة: حزمة واحدة لـ PGlite وتسع لـ SDK وتبعياته. هذه مراجعة lockfiles وليست تحققاً من bytes حزم لم تُحمّل.

جرت محاولات `npm ci --ignore-scripts --audit=false --fund=false --fetch-retries=0 --fetch-timeout=10000` بكاش منفصل تحت `/tmp`، وانتهت online بـ exit 1 وEPERM؛ ومحاولة SDK offline انتهت ENOTCACHED. لم تُستبدل الإصدارات، ولم يُستخدم SDK العام للواجهة بديلاً عن الحزمة المثبتة. فحوص الواجهة استخدمت الاعتمادات المحلية المتاحة؛ لا تعني استعادة الاعتمادين المعزولين.

## مراجعة Native

أعيد توليد حزمة 4B في `/tmp/amanahlife-phase4b-native-phase4c-check` باستخدام المصدر المثبت `fece36e90b1f9eb79e1be36a39043ff5b697c427`: 79 مدخلاً متحققاً و27 ملفاً مولداً، والحالة PREPARED_NOT_EXECUTED. بقيت مجموعات Native الأصلية الـ21 وضوابط ownership/cleanup/namespace/no-egress والتحقق من المصدر دون إضعاف. هذا تحقق سلامة مصدر، لا تنفيذ runtime لهذه الضوابط.

الملف الأصلي يختبر 001–005/008/009 فقط. runner يتحقق من قائمة الأرقام أحادية الخانة، يطبق `migrationFiles.slice(0,6)` ثم يفرض 009 عند `migrationFiles[6]` ويعيدها مرتين. مجرد إلحاق 006/007/010/011 يخرق هذه الشروط أو يطبق مرحلة خاطئة. fixture التفضيلات المختزل يفتقد أعمدة وuniqueness المطلوبة لـ007؛ metadata الأصلي يفحص خمسة Auth FKs محددة، ولا يغطي customer ownership في011 أو reminder dependencies.

**توسعة fixture إلى 001–011 لم تكتمل.** يلزم تعريف schema حقيقي، فصل توقيت مراحل migrations دون حذف assertions الأصلية، فحوص إضافية لـ011 ولإشعارات المستخدمين A/B والأعمدة المحمية والمدخلات المشوهة، وتجربة حذف حساب مع reminder rows وrollback/cleanup وفق FK/triggers الحقيقية. الاعتمادات وSQL prerequisites غير متاحة؛ لم يُنشأ بديل اصطناعي يدعي مطابقة الاستضافة. الحزمة القديمة محفوظة وليست حزمة كاملة جاهزة للتشغيل المطلوب.

## النتائج الفعلية

| الفحص | PASS | FAIL | SKIP | الحكم |
| --- | ---: | ---: | ---: | --- |
| اختبارات المصدر، 20 ملفاً: 423 أصلية +15 تشخيصية جديدة | 438 | 0 | 0 | PASS |
| مراجعة حزمة Native offline | 134 | 1 | 0 | BLOCKED؛ اختبار117 تعذر استيراد SDK المثبت |
| SQL assertions | 0 | 0 | 0 | BLOCKED؛ لم يبدأ SQL |
| SQL runner كوحدة Node عند الاستيراد | 0 | 1 | 0 | exit 1، PGlite مفقود |
| TypeScript التطبيق وفحوص payment/helpers | — | — | — | PASS |
| ESLint | — | — | — | PASS |
| production build محلي | — | — | — | PASS؛ لم يُنشر |
| سلامة المدخلات الـ79 لحزمة 4B القديمة | — | — | — | PASS؛ لا تثبت اكتمال fixture الجديد |

أُعيد `npm --prefix app/frontend run test:payments` بنجاح: تقرير Node الأب يعرض 20 ملفاً ناجحاً؛ العد 438 مستخرج من TAP لكل ملف بإجراء مستقل مع `--test-isolation=none` وpreload `deny-network.mjs`. الاختبارات الجديدة تختبر تشخيص الأدلة والجاهزية ولا تستبدل SQL regressions.

أوامر التحقق الأخرى من `app/frontend`: `npm run lint`، `node_modules/.bin/tsc -p tsconfig.app.json --noEmit`، `npm run check:payment-types`، وفحص strict للمساعدات `pushSecurity.ts,digestSecurity.ts,notificationBackup.ts`، ثم `npm run build`. جرى `npm run test:payments:sql` فعلياً وفشل الاستيراد قبل أي SQL. مراجعة `review.test.mjs` للحزمة المولدة استخدمت preload منع الشبكة؛ لم تبدأ خدمات Postgres/GoTrue/Docker، ولم تُنفذ المجموعات الـ21 كاختبارات Native فعلية.

## الملفات الجديدة والبصمات

كل القيم التالية SHA-256 قبل إنشاء الالتزام؛ Git commit/tree يثبتان التقرير نفسه أيضاً. لا توجد ملفات حزم محملة أو مخرجات build في الالتزام.

| الملف | SHA-256 |
| --- | --- |
| `docs/security/phase4c-catalog-readonly.sql` | `ee1e753b3828e7033a287a53ffee6b08d6a7257cef878107a544b3e078529a09` |
| `docs/security/phase4c-evidence-index.json` | `141d33b60003b6ee8969c9e1407302c0cfa4a8d63acf72375babd2be16e5a568` |
| `app/frontend/tests/database-readiness.test.mjs` | `fffa4a47b85f957d32b4e0c7d42dd0bab8e9a9d893f782a4ea46a727d4999a92` |
| `app/frontend/tests/phase4c-readiness/readiness.mjs` | `5ccfa4d36abab37f8cea1e4e065f1c49e3b1ce086bb2271a1e339fa01c166451` |
| `app/frontend/tests/phase4c-readiness/README.md` | `6f59f0e76d442f1e74cdc92a86a19a6287795e2b99d0dd32e25bac0ebce09751` |
| `docs/payments/phase4c-database-native-readiness-ar.md` | يثبته Git tree للالتزام المنشور؛ تجنب بصمة ذاتية دائرية |

## القرار والخطوة المطلوبة

Phase 4C نُفذت كتدقيق مصدر وتشخيص محلي، ولم تكتمل كتحقق SQL/Native. المتبقي: وصول معتمد لحزم lockfiles مع تحقق SRI، وأدلة schema/catalog/REST الحالية، ثم fixture كامل001–011 واختبارات SQL وتفويض وحذف وحزمة immutable جديدة ناجحة محلياً. عندها فقط يمكن التوصية بمراجعة تشغيل Native مستضاف، مع موافقة منفصلة لأي Actions dispatch.

حتى ذلك الوقت: **BLOCKED / integration HOLD / لا توصية بتشغيل Native مستضاف / Production وLive Billing NO-GO**.
