# Subscription 009 — تجهيز GitHub Actions، 2026-10-26

**الحالة: BLOCKED قبل dispatch؛ مجموعات Auth الـ21 لم تُنفذ.**
التشغيل مأذون بطلب المستخدم الحالي؛ لا حاجة لإعادة طلب نفس التفويض.

## المدخلات المثبتة

- التطبيق: `e6dd3fc5e014ea0539df8da12a6ee84582b302b9`.
- الحزمة: `8d5cdd246233a4a7ef4ad7ea2a62815ece08b153`.
- قورئت تعليمات README كاملة؛ لم تُعدل الحزمة أو manifest أو assertions فيها.
- Node `24.19.0`، SDK `2.110.0`، CLI `2.121.0` وchecksum الأرشيف كما في README.
- اجتازت مراجعة الحزمة تحقق 12 مدخل مصدر و10 ملفات حزمة.
- تحققت SHAs لإجراءات checkout/setup-node/upload-artifact بمقارنتها مع tags الرسمية عبر Git.

## الـworkflow الجديد

الملف: `.github/workflows/subscription-009-native-validation.yml`.
يدوي فقط، وعلى فرع `recovery/subscription-009-validation-20261026` فقط،
بـ`approve_disposable_run=true` ومحاولة أولى، دون تعديل workflows القائمة.
يستخدم GitHub-hosted `ubuntu-24.04` جديدًا وصلاحية `contents: read`؛
لا repository environment ولا مراجع `secrets` ولا credentials إنتاجية.
checkoutان مثبتان، مع `persist-credentials: false`، ثم التحقق من SHA والبصمات
وقيود credentials قبل الخدمات. تثبيت SDK عبر lock وSRI؛ CLI عبر SHA256 ثابت.

تفحص الخطوات sudo وDocker وnamespaces وIPv4/IPv6 firewall قبل الخدمات.
الحزمة نفسها تثبت وتتحقق من قواعد العزل وnamespace ownership قبل تحميل SDK
والـadapter. لا تُضعف الشروط إذا غابت capability. صلاحية التشغيل الفعلية
على runner لم تُثبت بعد؛ أي فشل يمنع قبول التشغيل.

توجد خطوة cleanup مستقلة بـ`always()` بعد التحقق من مصدر الحزمة، بما في ذلك
فشل أو timeout خطوة التكامل. يُنسخ تقرير integration قبل cleanup لأن الحزمة
تكتب التقريرين إلى المسار نفسه. تتطلب بوابة قبول مستقلة: exit 0، و21 مجموعة
مرتبة فريدة ناجحة، وعدم missing/failed/infrastructure failures، وتنظيفًا
داخليًا ومستقلًا ناجحًا، واختبارات offline منفذة بلا skip.
حتى النتيجة الناجحة تحمل `productionReady=false`.

الأثر المتوقع على GitHub Actions عند التنفيذ: `subscription-009-native-<run_id>`،
باحتفاظ 7 أيام. يتضمن تقارير JSON النهائية، hashes، SHA المصدر والحزمة والـworkflow،
إحصاءات offline، ورابط التشغيل الفعلي وSHA256SUMS. لا يُرفع workdir أو status
أو credentials أو raw subprocess logs. تُحذف السجلات الخاصة بعد حفظ التقارير.
لم يُنتج artifact أو رابط تشغيل فعلي في هذه الجلسة.

## مراجعات منفذة محليًا

| التحقق | النتيجة |
|---|---|
| `python3 ci/subscription009/test-workflow.py` | 12 ناجحًا |
| `npm run review:offline` للحزمة المثبتة | 52 ناجحًا، دون fail/skip |
| اختبارات `lemon-payments.test.mjs` و`webhook-signature.test.mjs` مع منع الشبكة | 76 ناجحًا، دون fail/skip |
| YAML و8 كتل Bash وPython المضمن | اجتاز فحص syntax |
| native PostgreSQL/Auth groups | 0 منفذ، 21 NOT TESTED |

اختبارات الـworkflow تحققت من رفض missing/duplicate/skipped/security failures،
وفشل exit status، وفشل cleanup، ومصدر غير مطابق، وغياب التقارير أو عدم تنفيذ
الفوترة. لا mock Auth في suite الأصلية؛ الفحوص المحلية تختبر بوابة التقارير فقط.

## العائق المثبت

نجح وصول Git إلى فرع الاسترداد. فشل طلب GitHub Actions API إلى
`api.github.com` بـ`403` من proxy عند CONNECT، والنطاق غير موجود في قائمة
السماح الحالية. لم يُكرر الطلب المحجوب ولم تُستخرج tokens أو تُطلب أسرار.
بالتالي لم يمكن التحقق من تسجيل workflow/صلاحيات Actions أو إرسال dispatch
أو الحصول على run ID/URL. لا يُدّعى أن إضافة workflow إلى فرع غير افتراضي
تضمن تسجيله لدى GitHub؛ يجب فحص التسجيل عبر API قبل التنفيذ، دون تعديل `main`.

الخطوة التالية: السماح لـ`api.github.com` في إعدادات بيئة التنفيذ، ثم إعادة
فحص API بعد تطبيق التغيير. يُستخدم التفويض المحقون الموجود؛ لا يُطلب token
في المحادثة. إذا ظهر بعد ذلك مانع تسجيل workflow أو إذن Actions منفصل،
يُبلغ به تحديدًا ويُتوقف قبل أي إجراء يخالف منع تعديل `main`.

## القرار

**NO-GO للتحقق native المكتمل والإنتاج والفوترة.**
المجموعات الـ21 جميعها NOT TESTED بسبب العائق السابق، ولا نتائج skip/xfail.
لم يُنشأ Supabase stack محلي أو hosted، ولم تتغير خدمات الإنتاج أو إعدادات المزود.
