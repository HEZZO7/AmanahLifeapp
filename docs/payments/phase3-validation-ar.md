# Payment Readiness — Phase 3: تحضير قبول مستضاف

**الحالة: PREPARED / native NOT EXECUTED / الإنتاج والفوترة NO-GO.**
لا تشغيل Actions أو Supabase native، ولا نشر أو linking أو migrations على مشروع
مستضاف أو استدعاءات Lemon Squeezy أو تفعيل Checkout/خصم خلال هذا العمل.

## النسخ المثبتة والنطاق

- الفرع: `validation/payment-readiness-phase3-20261031`، بدأ من remediation
  `b8ebc32946e2941761bd65ee69d3d8695a468c82` دون دمج main.
- مصدر القبول: `7e7ee889c4f356ba1da1856a668ca6e32fc791dd`، يتضمن الإصلاحات
  الآمنة لأخطاء الأنواع وESLint فقط، وتصحيح endpoint الإشعارات إلى مشروع الواجهة.
- حزمة القبول: `db22d73389fc6151d3c42e4b09f12dc8e01f93d2`.
- الحزمة التاريخية للمقارنة: `9baaa89718e51638d97dfd3f8030e50424c5f28c`؛
  نتيجة run`41200953611` لا تُنسب إلى المصدر أو migrations الجديدة.
- `app/frontend/tests/payment-phase3-native/` حزمة مستقلة؛ حزمة009 الأصلية
  وmigrations001–011 وadapter009 محفوظة، ولم تُعدّل للوصول إلى نتيجة خضراء.

يجهّز الـWorkflow runner جديدًا `ubuntu-24.04/github-hosted` وcheckoutين منفصلين
بـSHA كامل، مع Node24.19.0 وCLI2.121.0 ذي SHA256 معروف وSDK2.110.0 وSRI lockfile.
يفحص22 مدخل مصدر و14 ملف حزمة و7 مراجع تاريخية باستخدام Git blobs وSHA256 من
Python وsha256sum، مع مقارنة bytes بcommitات Git. نجح هذا الفاحص محليًا على
نسختين مؤقتتين نظيفتين ومثبتتين، دون خدمات أو اتصال دفع.

## Assertions والعزل

حُفظ ترتيب وأسماء المجموعات الأصلية الـ21، و**168 استدعاء assert أصلية** في
integration script حرفيًا؛ صار عددها177 بعد الإضافات. يراجع Acorn ذلك آليًا مع
التكرارات، ويرفض الحذف أو تغيير expected values. قائمة ملفات package المغلقة
وحدها توسعت من10 إلى14 ملفًا معروفًا؛ بقيت فحوص hashes/ownership/permissions
الأصلية. fixture.sql وmetadata.sql وisolation.mjs مطابقة بايتًا للحزمة التاريخية.

يمتد fixture الإشعارات بملف منفصل لتطبيق007، وتُطبّق001–011 قبل الاختبارات، ثم
009 مرتين مع assertions الأصلية. تشمل الإضافات RLS/ACL لـ006/007/011، FK
الاحتفاظ الجديد، snapshots لملكية Customer وحالة إغلاق إنشاء Checkout.

العزل يحافظ على أسماء الموارد والـlabels، namespace handles المثبتة، UID/GID،
no-new-privileges، إسقاط capabilities، منع Docker DNS والخروج الخارجي، التحقق
من hosts وإعادة تحميل Kong المراجع. لا sudo -E أو قواعد host OUTPUT عامة أو
مضاعفة محاولات Auth أو بديل mock عن GoTrue. مفاتيح Supabase المحلية تولد داخل
المكدس العابر وتصل إلى worker عبر stdin خاصة؛ لا أسرار Supabase/Lemon مستضافة.

اختبارات السباق الأصلية تحتاج RPC حجز SQL الحقيقي. يُتاح حارسه مؤقتًا **داخل
معاملات fixture غير committed** ثم يعاد false قبل commit؛ الخطأ/الإلغاء يعيد
المعاملة عبر finalizers الأصلية. لا وظيفة Checkout HTTP منشورة أو مستوردة، ولا
CHECKOUT_APPROVED أو discount approval، ولا اتصال بمزوّد. لا يُحفظ flag=true
مرئيًا لاتصال آخر. موافقة التنفيذ التالية يجب أن تشمل هذه instrumentation
المعلنة، ولا تجيز Checkout حقيقيًا.

التنظيف المستقل `always()` يلغي worker وجلساته المملوكة، ويوقف CLI مع
--no-backup، ويثبت غياب containers/volumes/networks ثم يزيل قواعد وبِنى journal
المملوكة فقط. unknown ownership يفشل ولا يجيز prune أو حذف موارد أخرى.
الأدلة المسموحة: نتائج المجموعات، counts، أسباب من allowlists، source hashes،
provenance ورابـط التشغيل ودليل التنظيف؛ لا raw logs أو status JSON أو tokens
أو IDs/بريد عملاء أو connection strings. الاحتفاظ7 أيام، وproductionReady=false
دائمًا حتى مع نجاح native.

## نتائج التحضير المنفذة

| الفحص | النتيجة |
|---|---|
| اختبارات التطبيق المعزولة |270/270 PASS، دون skip/xfail أو اتصال دفع |
| مراجعة الحزمة الأصلية دون تعديل |135/135 PASS |
| مراجعة الحزمة الجديدة ونموذج SQL |15/15 PASS، منها6 فحوص PostgreSQL-WASM، وليست native |
| فحوص Python للتحقق المستقل |4/4 PASS؛ traversal/symlink وتلف SHA256/Git blob مرفوضة |
| TypeScript الكامل |PASS، أُصلحت الأخطاء التسعة بلا suppressions |
| ESLint9 |0 errors؛ warning واحدة متبقية في PrayerTimes:108، react-hooks/exhaustive-deps؛ أُظهرت بفحص دون --quiet |
| Vite build |PASS مع منع شبكة Node؛ build خارج Git ولا نشر |
| actionlint1.7.7 |PASS للـWorkflow الجديد والـdispatcher |
| syntax مستقل |8 Bash blocks و3 Python blocks و2 Node blocks: PASS، دون تنفيذ الأوامر |
| تحقق النسختين المثبتتين |PASS لـ22 source inputs و14 package files و7 historical references |
| Native جديد |**0/21 منفذة، NOT TESTED** |
| Lemon Test / hosted Edge / Deno منشور |**NOT TESTED** |

نموذج WASM يخلق schema Auth اصطناعيًا في الذاكرة فقط. PGlite0.3.14 يفتح
template1؛ يُكيّف النموذج فقط شرط اسم قاعدة fixture إلى الاسم الصحيح مع فحصه
بصرامة. ملفات native على القرص لا تتغير وتبقى تشترط postgres، كما لا تتغير SQL
التطبيق. لا يثبت النموذج GoTrue أو locks متعددة الاتصالات أو سلامة نشر مستضاف.

## عوائق مستقلة باقية

1. **FAIL — توافق الإشعارات وأمن الكاتب القديم:** BackupRestore ينقل push
   credentials ويستخدم صلاحيات لا تسمح بها007 ويتجاهل الأخطاء؛ update_preferences
   في push_notify يسمح لspread العميل باستبدال user_id مع service_role. يلزم
   patch منفصل واختبارات قبل نشر هذين المسارين. لم تُضعف007 لحل التوافق.
2. **فجوة UX/retention موثقة:**008 لا تعد standalone customer-owner history ضمن
   رفض409 الودي. FK011 تمنع الحذف فعليًا وتعيد009/trial في المعاملة؛ أثبت نموذج
   SQL ذلك. لا ندّعي إثبات استجابة GoTrue لهذه الحالة دون native، ولا نعيد كتابة008
   خفيةً. يلزم توسيع policy برسالة مراجعة مناسبة في patch مستقل.
3. **UNVERIFIED — runtime:** دعم kernel/iptables/sudo والـnamespaces وصحة الصور
   يُفحص قبل worker على runner المخول فقط؛ لم يُجرب هنا. صور المكدس تأتي من
   defaults CLI المثبت، وليست image digests معتمدة استقلاليًا. لا تدّعي الحزمة
   تطابق bytes لجميع صور المستقبل أو hosted Supabase parity.
4. **BLOCKED — Lemon/النشر:** كتالوج Test، عقد أدلة الدفع والفترات/refunds، webhook
   gateway، سياسات المالك وجرد العملاء السابقين/schema الفعلية لم تتحقق. native
   لا يحل هذه العوائق ولا يفعّل بوابات الدفع أو الخصم أو المصالحة المستضافة.

المراجعة المستقلة المفصلة في [phase3-source-review-ar.md](phase3-source-review-ar.md)،
وقائمة المالك في [phase3-test-configuration-ar.md](phase3-test-configuration-ar.md)،
وخطة A/B في [phase3-lemon-test-plan-ar.md](phase3-lemon-test-plan-ar.md).

## الإجراء الواحد التالي

بعد مراجعة commit النهائي المنشور، يوافق المالك صراحة ويضغط **Run workflow**
للملف المسجل `subscription-009-native-validation.yml`، مع اختيار الفرع
`validation/payment-readiness-phase3-20261031` تحديدًا وضبط
`approve_disposable_run=true`. هذا الملف على فرع validation مجرد dispatcher إلى
`amanahlife-payment-phase3-native.yml` من commit التشغيل نفسه؛ نسخة main لم تتغير
ولا يلزم تسجيل workflow جديد عليها. لا تختَر main أو إعادة تشغيل محاولة قديمة.

هذه الموافقة تجيز **تشغيل native واحد فقط** على runner عابر، متضمنًا حجوزات
SQL الاصطناعية المعلنة، دون provider calls أو hosted credentials أو نشر. لم نضغط
Run أو نستدعِ dispatch. لا يوجد رابط تشغيل أو artifact جديد لنتائج native بعد.
