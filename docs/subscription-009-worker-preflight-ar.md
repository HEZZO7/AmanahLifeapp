# Subscription 009 — مرحلة isolated_worker، 2026-10-26

التشغيل محل التحقيق:
https://github.com/HEZZO7/AmanahLifeapp/actions/runs/40315180426

## المثبت وحدود الاستنتاج

الدليل المقدم يثبت `phase=isolated_worker`, `category=assertion_failed` و
`completed=0/21` في تقرير controller، مع نجاح independent cleanup. الحزمة
`c4c415cbc7e075931fe1f7eb9ace75f492893146` والمصدر
`e6dd3fc5e014ea0539df8da12a6ee84582b302b9`.
لم يتكرر خطأ hosts السابق وفق هذا الدليل.

**السبب الجذري غير مثبت من التقرير المتاح.** المرحلة المسماة `isolated_worker`
تغطي أكثر من assertion. لا يدعي هذا التحقيق تنزيل raw logs أو معاينة بيئة
العامل في التشغيل البعيد. لم تُرسل أي محاولة تشغيل أو تُغيّر main أو الإنتاج.

المسار المفحوص في الحزمة المثبتة:

1. يعيد controller فحص جميع قواعد العزل ويقارن identity مع التي جُمعت أثناء
   setup. ثم يشغّل `sudo -n nsenter --net=<pinned-handle> -- setpriv ... node`.
2. تبقى `--reuid`, `--regid`, `--groups`, `--bounding-set=-all`,
   `--inh-caps=-all`, `--ambient-caps=-all`, `--no-new-privs` كما هي.
3. يفحص `initializeWorker` RUNNER_TEMP/workspace وowned marker وjournal
   وnamespace handle وnamespace العملية وUID/GID وNoNewPrivs وcancel marker.
4. قبل أول مجموعة يفحص العامل source/package integrity وstdin approval
   وcredentials المحلية وSDK import/version والعملاء وmigration order.
5. يقرأ controller `worker-report.json`، ويفحص JSON وsource وproduction flag
   وchecks وinfrastructure metadata وobservations وإعادة حساب النتيجة وexit status.

ثمة فقدان تشخيص مثبت في الكود القديم: ينقل controller category وexit فقط من
تقرير العامل، ويفقد تفاصيل preflight عند إعادة رمي الخطأ. وقد يفشل قبل ذلك
في قراءة التقرير أصلًا. كل ذلك يمكن أن يظهر كـassertion_failed تحت اسم واحد.
كذلك لا ينسخ controller نتائج المجموعات إلا بعد نجاح فحص التقرير؛ لذلك قد
يعني completed=0 رفض تقرير عامل لاحقًا، وليس بالضرورة عدم بدء العامل أي مجموعة.
اختبار report/exit-status الجديد يغطي هذا الاحتمال دون ادعاء تنفيذه في التشغيل السابق.

## التغيير المحدود

- أضيف `workerStage` من قائمة ثابتة لكل فحص أعلاه، دون طباعة القيمة الفاشلة.
- يرسل العامل قبل كل فحص رسالة من حقلين ثابتين على stdout الخاص الملتقط.
  يقبل controller فقط الشكل والقيم المسموح بها ويتجاهل كل المخرجات الأخرى.
  تُزال آخر إشارة preflight قبل بدء المجموعة الأولى لتجنب نسبة خطأ native
  لاحق إلى فحص قديم.
- إذا غاب التقرير أو تعذر نشره، يسجل controller مرحلة القراءة المحددة مع
  `workerPreflightStage` إن توفرت إشارة صحيحة. يحتفظ `workerExit` برقم محدود،
  وقد يتوفر `workerLaunchStage` من أربع قيم ثابتة لمصدر stderr: sudo/nsenter/
  setpriv/node. لا تُنشر الرسالة أو المسارات أو argv أو البيئة أو credentials.
- لا تزال التقارير تُفحص وتُحسب النتيجة independently؛ لا تصحح التشخيصات أي
  exit أو result ولا تسمح بغياب مجموعة. تُرفض diagnostic values غير المعروفة
  في تقرير العامل. تُحفظ stage metadata الصحيحة عند نقل الفشل إلى التقرير النهائي.

لم تتغير سياسة sudo أو تمرير البيئة أو flags التنفيذ أو أي شرط هوية أو
NoNewPrivs أو firewall أو cleanup. لم تتغير assertions المجموعات الـ21 أو
أي ملف تطبيق أو SDK/CLI/lockfile. التشخيص يحدد check/hint وليس قبولًا أو GO.

## إعادة إنتاج محدودة

شُغلت عملية Node مؤقتة فعلية مع `--worker`، ودون RUNNER_TEMP ومع preload
يمنع الشبكة. انتهت بـ1، ولم تنشئ workdir أو worker-report أو تبدأ خدمة/SQL.
التقطت الإشارة الآمنة `worker_runtime_temp` قبل تعذر publication.
هذه حالة ممكنة مثبتة محليًا، **وليست دليلًا على أن sudo حذف المتغير في التشغيل
التاريخي**. لم تُفحص sudoers الفعلية لذلك runner ولم يُفترض سبب غير مشاهد.
الدليل: `docs/evidence/subscription-009-worker-preflight-proof.json`.

## التحقق والتحديث التالي

تشمل مراجعات offline رفض كل فحص هوية وفحوص controller/report، وحفظ exit
الفاشل ومرحلة العامل، وحالة missing report، ورفض الرسائل ذات حقول/قيم إضافية
أو مخرجات خاصة مصطنعة، ومسح الإشارة قبل native groups. اختُبرت args الفعلية
للـlauncher بحقن subprocess results فقط؛ لا mock Auth في المجموعات الأصلية.

النتائج المحلية الفعلية: **69** اختبار حزمة ناجحًا، **9** اختبارات hosts
ناجحة، و**14** اختبار workflow ناجحًا، دون فشل أو skipped في الحزمة.
اجتازت ملفات mjs فحص syntax و`git diff --check`. بقيت ملفات المصدر الـ12
مطابقة للمصدر المثبت؛ حُدثت SHA256 لخمسة ملفات حزمة متأثرة فقط بعد مطابقة
`hashlib` و`sha256sum`. لم تتغير قواعد العزل أو fixtures أو migrations أو
metadata أو dependency lockfile. sudo غير متاح محليًا؛ لم تُدّع إعادة تنفيذ
سلسلة kernel isolation الكاملة أو مجموعات Auth الأصلية هنا.

يجب تحديث `env.PACKAGE_SHA` في workflow اليدوي على main إلى commit الحزمة
الجديدة فقط، مع بقاء source SHA وcheckout expression وحارس main كما هي.
لم يُنفذ هذا التحديث أو dispatch هنا. تستخدم أي محاولة لاحقة runner جديدًا
وتُفحص `workerStage` و`workerPreflightStage` و`workerLaunchStage` و`workerExit`
في التقرير المنقح قبل اقتراح تصحيح آخر. الإنتاج والفوترة **NO-GO**.
