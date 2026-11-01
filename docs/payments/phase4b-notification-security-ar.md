# Phase 4B — أدلة أمن الإشعارات وحدود قبول التكامل

2026-11-01. **الإنتاج والفوترة الحية: NO-GO. اعتماد التكامل: HOLD.**

## المصدر ومراجعة Phase 4A

- المستودع: `HEZZO7/AmanahLifeapp`، المعرّف `1272912875`.
- الفرع الجديد: `remediation/phase4b-notification-security-20261101`.
- قُرئ `AGENTS.md` وتقرير Phase 4A الفعلي: [`phase4a-remediation-ar.md`](phase4a-remediation-ar.md).
- تأكد عبر GitHub أن فرع Phase 4A يشير إلى `b7a3e169517507f7413a38c3831cd5b21f7d2502`، وأُراجع فرق ملفاته الـ14 ضد أساسه الموثق `7e7ee889c4f356ba1da1856a668ca6e32fc791dd`. تطابقت شجرة المصدر المحلية والمنشورة؛ لم يُستخدم main القديم بديلًا.
- بقيت معالجة ownership وallowlists في 4A سليمة ضمن نطاق اختبارات المصدر. بقيت مشكلة PrayerTimes، وتبين وجود إخفاقات صامتة إضافية، وعناوين push غير مقيدة، وإرسال digest جماعي دون تفويض داخلي.
- لقطة التطبيق المختبرة لهذه المرحلة هي [`fece36e90b1f9eb79e1be36a39043ff5b697c427`](https://github.com/HEZZO7/AmanahLifeapp/commit/fece36e90b1f9eb79e1be36a39043ff5b697c427)، وشجرتها `684872f47e47c6da14412ebec3297d014eed159e`، ووالدها المباشر هو التزام 4A أعلاه.
- الالتزام اللاحق في الفرع يضيف هذا التقرير وmanifest الحزمة فقط، كي يشير manifest إلى لقطة تطبيق ثابتة دون مرجع ذاتي دائري.

## جرد الكتّاب وحدود الوصول

| المسار | النتيجة والإصلاح |
|---|---|
| `PrayerTimes.tsx` → notification_preferences | استبدال upsert الذي يطلب UPDATE(user_id) بكاتب الأعمدة المسموحة من 4A: UPDATE ثم INSERT للصف المفقود. مطابقة هوية الجلسة قبل الطلب، والتحقق من البيانات، وإظهار فشل المزامنة مع إبقاء الإعدادات المحلية. لا كتابة scheduler markers. |
| `useNotifications` / `NotificationSettings` | إرسال patch الأعلام المتغيرة فقط؛ لا تحديث الحالة قبل success=true. رفض جلسة حساب آخر والاستجابات المتأخرة، تصفير تفضيلات الحساب السابق، والتحقق من نوع الاستجابة. تعطيل التعديل عند فشل القراءة أو أثناء الحفظ؛ لا إعلان تفعيل الإشعارات قبل تسجيل الجهاز فعليًا. |
| `BackupRestore` / `backupClient` / `notificationBackup` | احتُفظ بحدود 4A: export بقائمة أعمدة، no device credentials أو billing authority، ownership من الجلسة وRLS، وعدم تحديث user_id في صف موجود. أُعيد استخدام الكاتب نفسه لموقع الصلاة بدل توسيع grants. |
| `push_notify`: subscribe/unsubscribe | ownership من JWT فقط. تحقق من endpoint ومواد المفتاح قبل الكتابة. unsubscribe مقيد بالمستخدم؛ لا يمكن JSON اختيار حساب آخر. تظل defaults لا تعيد تفعيل الأعلام المعطلة. |
| `push_notify`: إرسال وتنظيف الأجهزة | السماح فقط بمضيفي FCM/Mozilla/Apple/WNS المعروفين وHTTPS دون userinfo أو منفذ مخصص. يشمل التحقق الصفوف القديمة قبل Web Push، لمنع SSRF. رفض محتوى malformed وعناوين تنقل/أيقونات خارج التطبيق. تنظيف الجهاز المنتهي مقيد بـuser_id وid؛ فحص الخطأ، وفشل الإرسال/الإعداد لا يعيد success كاذبًا. لا تُعاد مفاتيح الأجهزة أو تُسجل. |
| دورة حياة الجهاز / `AuthContext` | تدوير اشتراك المتصفح عند اختلاف مالك الجهاز أو غيابه، وتسلسل التدوير والإلغاء لمنع التعارض. إلغاء الاشتراك المحلي قبل الخروج وعند تغير الحساب، دون انتظار serviceWorker.ready. رفض المتصفح للإلغاء يبقى تحذيرًا ظاهرًا؛ لا يمنع تسجيل الخروج ولا يضمن أن متصفحًا رافضًا أوقف التسليم. |
| `useSavingsNotifications` | مطابقة جلسة المستخدم قبل طلب milestone push، وفحص رد الخادم وإظهار رفض طلب الخلفية، مع إبقاء الإنجاز المحلي. الخادم يفرض الإرسال للنفس. |
| `BillReminders` / `Goals` | صفوف mirror مبنية من حقول ثابتة، بهوية الجلسة، مع تحقق runtime قبل DELETE. توقف عند رفض DELETE/INSERT وإظهار فشل المزامنة؛ لا نسخ للهوية أو markers من localStorage. العمليات البعيدة المتتابعة ليست ذرية. |
| `push_scheduler` | POST وسر داخلي مطلوبان. فحص كل قراءة وكتابة، اختيار أعمدة محددة، وربط marker بالمستخدم/الصف المخزنين. لا marker أو زيادة sent عند skipped/no-device/refused/unconfirmed. الرد يذكر احتمال التسليم الجزئي عند فشل لاحق، والسجلات لا تنقل أخطاء SDK أو هوية المستخدم. |
| `weekly_digest` / `EmailDigestToggle` | إغلاق send_digests خلف `INTERNAL_DIGEST_SECRET` و`X-Internal-Digest-Secret`؛ غياب السر يرفض الطلب قبل القراءة أو SMTP. subscribe/get_preferences بهوية Bearer، enabled boolean وبيانات محددة؛ HTML مخزّن يُتحقق منه ويُهرب. فحص markers وإزالة عناوين البريد/UID/الاستثناءات الخام من السجلات. التفضيل يُقرأ من الخادم، دون إعادة لعب cache حساب سابق أو ادعاء نجاح كتابة مرفوضة. |

لم يظهر كاتب إضافي لـFCM/Expo/device_token في شجرة الويب المراجعة. تسجيل Web Push محصور في Edge؛ service worker يعرض الرسائل ولا يكتب جدول credentials. وظائف الدفع والأسرة لا تُغيّر بهذا العمل.

**007 تغطي جدولين فقط.** لا توجد في المصدر أدلة مراجعة كافية لصلاحيات وFK/triggers الفعلية لجداول `bill_reminders_sync` و`goal_reminders_sync` و`email_digest`. تقييد كاتب التطبيق لا يثبت منع مستخدم خبيث من مخاطبة REST مباشرة إن كانت grants/policies المستضافة واسعة. لم أختلق schema أو أوسع صلاحيات أو أضيف migration تخمينية. هذا عائق تحقق/إطلاق صريح. كذلك يبقى تصميم المحتوى المحلي المشترك بين الجلسات خارج ضمان عزل بيانات شامل على جهاز مشترك؛ لا تُنسب إليه حماية غير مثبتة.

## الملفات المتغيرة في لقطة التطبيق

```text
app/frontend/src/components/EmailDigestToggle.tsx
app/frontend/src/components/NotificationSettings.tsx
app/frontend/src/contexts/AuthContext.tsx
app/frontend/src/hooks/useNotifications.ts
app/frontend/src/hooks/useSavingsNotifications.ts
app/frontend/src/lib/devicePush.ts
app/frontend/src/lib/notificationBackup.ts
app/frontend/src/lib/notificationPreferenceClient.ts
app/frontend/src/lib/reminderSync.ts
app/frontend/src/pages/BillReminders.tsx
app/frontend/src/pages/Goals.tsx
app/frontend/src/pages/PrayerTimes.tsx
app/frontend/supabase/functions/_shared/digestSecurity.ts
app/frontend/supabase/functions/_shared/notificationPreferences.ts
app/frontend/supabase/functions/_shared/pushSecurity.ts
app/frontend/supabase/functions/app_11941c8fec_push_notify/index.ts
app/frontend/supabase/functions/app_11941c8fec_push_scheduler/index.ts
app/frontend/supabase/functions/app_11941c8fec_weekly_digest/index.ts
app/frontend/tests/device-push-security.test.mjs
app/frontend/tests/digest-security.test.mjs
app/frontend/tests/native-preparation-security.test.mjs
app/frontend/tests/notification-client-security.test.mjs
app/frontend/tests/payment-phase2-db/notification-security-regression.sql
app/frontend/tests/payment-phase2-db/run.test.mjs
app/frontend/tests/phase4b-native/README.md
app/frontend/tests/phase4b-native/prepare.mjs
app/frontend/tests/push-notify-security.test.mjs
app/frontend/tests/push-scheduler-security.test.mjs
```

يضيف التزام التثبيت النهائي `tests/phase4b-native/source-manifest.json` وهذا التقرير. migrations001–011 وحزمة `subscription-009-local` الأصلية وworkflows وlockfiles بقيت مطابقة لـ4A.

## نتائج الاختبارات الفعلية

Node `v24.19.0`. لا شبكة خارجية في اختبارات المصدر، ولا استدعاءات Lemon Squeezy أو SMTP/Web Push حقيقية. frontend dependencies موجودة مسبقًا؛ لا dependency أو lockfile جديد.

| الفحص | النتيجة |
|---|---|
| جميع `tests/*.test.mjs`، كل ملف بعملية مستقلة وpreload منع الشبكة | **423 PASS / 0 FAIL** عبر 19 ملفًا؛ تشمل 338 السابقة و85 حالة جديدة |
| `npm run test:payments` | **19 ملفات PASS / 0 FAIL**؛ عد الحالات الداخلي أعلاه جُمع من TAP لكل ملف |
| push_notify | **52 PASS**؛ 36 حالة سابقة و16 جديدة. استُبدلت المفاتيح الوهمية القصيرة ببيانات اختبار صحيحة الطول/الصيغة مع الإبقاء على assertions الأصلية |
| client ownership / PrayerTimes / mirrors / save refusals / malformed input | **32 PASS** |
| account/device switching and revocation | **7 PASS** |
| digest authorization / malformed data / HTML / markers | **16 PASS** |
| scheduler authorization / storage refusals / partial delivery | **9 PASS** |
| immutable preparation input/tamper checks | **5 PASS** |
| `npm run lint` | **PASS** دون تعطيل rules |
| `tsc -p tsconfig.app.json --noEmit`، payment types، strict helpers | **PASS** |
| strict check للـEdge entries الثلاثة باستخدام SDK types وdeclarations محلية لواجهات npm/Deno | **PASS**؛ ليس `deno check` أو تشغيل Deno |
| `npm run build` | **PASS**، بناء محلي فقط |
| `git diff --check` وحفظ migrations/الحزمة الأصلية/workflows/lockfiles | **PASS** |
| `npm run test:payments:sql` | **BLOCKED قبل SQL**: import الحزمة `@electric-sql/pglite@0.3.14` غير متاح |
| مراجعة الحزمة Native المولّدة دون شبكة | **134 PASS / 1 FAIL بسبب تبعية مفقودة** من 135؛ الحالة المتوقفة مصنفة **BLOCKED**، وليست PASS أو assertion متجاوزًا |
| Native PostgreSQL/GoTrue / hosted Actions | **NOT RUN** |

أمر عد الحالات، من `app/frontend`، لكل ملف:

```sh
node --experimental-strip-types --import ./tests/deny-network.mjs --test --test-isolation=none --test-reporter=tap tests/notification-client-security.test.mjs
```

جُمعت الأعداد مع اشتراط exit=0 وfail=0 لكل ملف؛ لا skip/todo أو حذف assertions لجعل النتائج خضراء.

## SQL: محاولة الاستعادة وحالة BLOCKED

تحقق أن lockfile SQL لم يتغير، وSHA256 له:
`50c7667bb51d88b946b2e67386c53549414725566ae5206487eea9f42fd86b5e`.

الإصدار مثبت `0.3.14`، مع npm tarball وSRI SHA512 في lockfile الأصلي. نُفّذ `npm ci --ignore-scripts --audit=false --fund=false` باستخدام cache داخل `/tmp`، دون retries؛ رُفض الاتصال بالوكيل `:8080` محليًا بـ`EPERM`. محاولة صلاحية شبكة إضافية لم تكتمل، ولم تُكرر بعد الاستئناف. لا artifact موثّق في cache؛ لم أستبدل الإصدار أو أتجاوز الوكيل/TLS أو إعدادات النظام. تشغيل SQL أعاد `ERR_MODULE_NOT_FOUND` قبل أي assertion.

أُضيفت حالة SQL إلى runner القائم تستدعي `notification-security-regression.sql`: حفظ صفوف007، UPDATE الحقول المسموحة وINSERT الصف المفقود، منع cross-account وUPDATE(user_id) وmarkers/timestamps وSELECT* وDELETE وupsert القديم وقراءة credentials. جميع تغييرات fixture داخل transaction تتراجع. **هذه assertions مضافة ولم تُنفذ؛ لا SQL PASS.**

## حزمة Native المثبتة ولماذا يلزم تشغيل جديد

[`tests/phase4b-native/README.md`](../../app/frontend/tests/phase4b-native/README.md) وmanifest يثبتان 79 ملفًا بـGit blob SHA1 وSHA256 على لقطة التطبيق `fece36e9…`. تحقق التحضير ونتج bundle من 27 ملفًا بحالة `PREPARED_NOT_EXECUTED` و`productionReady=false`.

الحزمة الأصلية لم تتغير. manifest القديم يشير إلى `e6dd3fc5…`، وبصمة معالج الحذف فيه تختلف عن نص 4A؛ لا تُنسب نتيجة Native القديمة إلى هذا المصدر. الـoverlay المولّد يُحدّث مصدر SHA والثابت وassertion مساواته الدقيق وchecksums فقط؛ يبقي جميع 21 مجموعة والـfixture/metadata وحواجز العزل والتنظيف بلا إضعاف. تُحفظ layout ومسارات ملفات المصدر اللازمة للمراجعة.

مراجعة هذا الـbundle نجحت في 134 حالة؛ الحالة المتوقفة احتاجت `@supabase/supabase-js@2.110.0` داخل الحزمة. تثبيتها من lockfile في الوضع offline توقف بـ`ENOTCACHED`. لم أستبدل حزمة Native بتبعيات frontend لمجرد تطابق رقم الإصدار. تبقى نتيجة المراجعة الكاملة **BLOCKED**.

ملف validation-plan يميز ثلاثة profiles: إعادة21 مجموعة على المصدر المثبت، full-schema/HTTP لتطبيق001–011 و009 مرتين مع007 واختبارات JWT/RLS، وDeno/browser مع fake transports ومنع egress. **امتداد fixture/HTTP الكامل للـprofile الثاني يحتاج تنفيذًا ومراجعة؛ ليس ادعاءً بوجود harness مكتمل أو schema إنتاج مؤكدة.** المرفق SQL supplement ليس بديلًا عن Auth/HTTP أو عن assertions القديمة.

يلزم تشغيل isolated hosted جديد مع اعتماد منفصل بعد اكتمال مراجعة الحزمة والـfixture: المصدر القديم مختلف، والـ21 الأصلية تستثني006/007/010/011 ولا تشغّل كتّاب الإشعارات أو المتصفح. يجب كذلك التحقق من حذف الحساب بوجود related reminder rows بدل افتراض FK/cascade أو نطاق cleanup.

## قرار التكامل والقيود المتبقية

**HOLD لاعتماد دمج 4A/4B.** يلزم نجاح SQL من lockfile، واستكمال مراجعة ACL/FK/trigger للجداول الثلاثة، وامتداد fixture/HTTP الكامل، ثم إعادة Native على المصدر المثبت بعد اعتماد التشغيل. حزمة الإشعارات تتطلب مستقبلًا مراجعة إعداد `INTERNAL_DIGEST_SECRET` وcron header ومزودي push المعتمدين؛ لم تُفعّل إعدادات مستضافة هنا. اختبارات المتصفح الفعلية وDeno والتسليم الحقيقي غير مثبتة بهذه doubles.

لم يتغير `main` أو فرع 4A، ولم يحدث merge أو deployment أو migration مستضافة أو اتصال Lemon Squeezy Test/Live أو billing activation أو GitHub Actions dispatch. **الإنتاج والفوترة الحية يظلان NO-GO.**
