# Phase 3 — تشخيص run 41273911129

الحالة: **إصلاح harness مُعاد إنتاجه محليًا؛ Native الجديد NOT TESTED؛ الإنتاج والفوترة NO-GO.**

## الدليل وحدود اليقين

- التشغيل المذكور: https://github.com/HEZZO7/AmanahLifeapp/actions/runs/41273911129
- المصدر الثابت لم يتغير: `7e7ee889c4f356ba1da1856a668ca6e32fc791dd`.
- الحزمة المتأثرة: `db22d73389fc6151d3c42e4b09f12dc8e01f93d2`.
- النتيجة المقدمة من المالك: schema_dependencies assertion_failed، ثم isolated_worker
  prerequisite_failed، وباقي20 مجموعة غير منفذة، والتنظيف المستقل ناجح.
- حاولنا قراءة قائمة artifacts مرة واحدة؛ GitHub API أعاد Forbidden من هذه البيئة.
  لم نقرأ artifact أو raw logs، ولم نكرر الطلب أو نغير بيانات الاعتماد.

## السبب المثبت وما لم يثبت

`jsonSQL` يطبق JSON.parse على stdout من psql -qAt. ستة مواضع query أضافتها
Phase3 في schema_dependencies تعيد boolean SQL خامًا؛ PostgreSQL boolout يرجع
`t`/`f`، وكلاهما SyntaxError عند JSON.parse. أول موضع معيب بعد metadata هو
has_table_privilege لدور anon على payment_customer_owners / SELECT. موضع سابع
في نهاية isolation_and_billing_preservation يحمل العيب نفسه.

أُعيد إنتاج ذلك بـPostgreSQL-WASM مع boolout(false/true)::text، وأُثبت أن
نفس استعلام ACL يعيد boolean وليس JSON. مواضع to_json المصححة تعيد false/true
كـJSON مع بقاء expected values والصلاحيات نفسها. لا يدل ذلك على عيب migrations.

الاختبارات السابقة في WASM قرأت JS booleans مباشرة ولم تمر عبر حدود psql/JSON،
ولذلك لم تلتقط الخطأ. صارت تستعمل دوال schema الأصلية نفسها مع محاكاة text boundary
وتمييز OID16 للـboolean و114/3802 للـJSON، باستخدام محرك SQL الحقيقي في الذاكرة.
هذا نموذج محلي لا يثبت GoTrue أو kernel/network namespace على runner مستضاف.

فشل schema_dependencies القاتل يرفع Failure(prerequisite_failed) عمدًا؛ يعيد
controller نشره تحت isolated_worker. إذًا هذه النتيجة الثانوية لا تثبت فشل
sudo/nsenter/setpriv أو initializeWorker. تنفيذ المجموعة يثبت أن العامل وصل
إلى exercise بعد preflight؛ لم نغيّر أي حارس startup أو ownership أو privileges.

**يبقى أول استثناء داخل التشغيل المستضاف غير مؤكد**: الملخص لا يتضمن nativeStage،
وقد يسبق تحويل boolean فشل metadata assertion. التشخيص المطلوب هو nativeStage
مغلق للفشل الأول، مع result/category الموجودة، دون raw errors أو SQL أو قيم فعلية.

## التعديل المحدود

- integration.mjs: تغليف نتائج scalar السبعة بـto_json؛ مشاركة schema setup/ACL
  بين native وoffline؛ الحفاظ على ترتیب001–011 وكل شروط ACL/RLS/retention.
- safety.mjs: إضافة18 رمز nativeStage مسموحًا فقط: fixture الأصلية والإضافة،
  كل migration001–011، environment seed، metadata، customer ACL، function ACL،
  notification ACL. القيم غير المعروفة والحقول غير المسموحة تُرفض.
- schema.test.mjs: إعادة إنتاج الخطأ، تنفيذ32 استعلام metadata/ACL الأصلية عبر
  text boundary، اختبارات grants حقيقية ممنوعة وحرمان حق مطلوب، رفض null/string/0،
  حقن فشل عند14 حد initialization وإثبات الخصوصية و20 missing groups.
- review.test.mjs: round-trip لكل18 مرحلة عبر controller الحقيقي، ورفض الرمز المجهول.
- README.md وsource-manifest.json: توثيق الحدود وتحديث hashes للملفات المتغيرة
  فقط بعد اتفاق hashlib وsha256sum؛ مدخلات المصدر والتاريخ غير معدلة.
- workflow الفرع الجديد: المصدر نفسه، PACKAGE_SHA جديد كامل، وbranch guard
  صريح؛ لا تعديل main أو triggers تلقائية أو dispatch أو provider calls.

لم تتغير local-runtime.mjs أو fixture.sql أو phase3-schema.sql أو metadata.sql
أو isolation.mjs أو أي migration أو assertions009 التاريخية. لا retries جديدة
ولا skip/xfail أو تخفيف JSON.parse أو صلاحيات قاعدة البيانات أو استقلال التنظيف.

## الفحوص المنفذة

| الفحص | النتيجة |
|---|---|
| package offline بما فيها نموذج SQL |21/21 PASS، بلا skip/xfail |
| original package review |135/135 PASS |
| application offline payments/security |270/270 PASS |
| independent verifier unit tests |4/4 PASS |
| original integration assertions |168/168 محفوظة حرفيًا، المجموع177 بعد امتداداتPhase3 |
| baseline manifest |PASS؛12 source +10 historical package entries و9 migrations الأصلية ثابتة |
| syntax / diff hygiene |PASS |
| Native جديد وLemon Test |NOT TESTED؛ لا خدمة Native أو اتصال مزوّد |

كل تطبيق migrations والبيانات الاصطناعية لهذا التحقيق داخل PostgreSQL-WASM
بالذاكرة. تعديل اسم قاعدة PGlite/template1 يخص النموذج فقط كما كان موثقًا؛
شرط native/postgres وملفات fixtures الأصلية باقية. لا إنتاج أو hosted DB أو أسرار.

## الإجراء التالي

تشغيل Native جديد **مبرر تشخيصيًا بعد الموافقة الصريحة**؛ ليس نجاحًا مضمونًا.
يُستخدم workflow المسجل subscription-009-native-validation.yml مع الفرع
`diagnostic/payment-phase3-schema-json-20261101` وapprove_disposable_run=true
لتشغيل واحد جديد، لا إعادة محاولة التشغيل السابق. مصدر التطبيق يبقى SHA المذكور.
لا main update أو نشر أو Lemon credentials مطلوبة. جميع بوابات الدفع تبقى مغلقة.
