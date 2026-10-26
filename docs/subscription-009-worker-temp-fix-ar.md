# إصلاح سياق المجلد المؤقت للعامل — Subscription 009

التشغيل: https://github.com/HEZZO7/AmanahLifeapp/actions/runs/40361669068

## السبب المثبت وحدود الدليل

الدليل الذي قدمه المستخدم يحدد `controller_report_file` مع آخر مرحلة
`worker_runtime_temp` و`workerExit=1`، و`completed=0/21` ونجاح cleanup.
فُحص الكود في `1df108401c0a64e6a7689971287c6cb4f22ecffd`؛ يحلّ العامل
`process.env.RUNNER_TEMP` قبل إنشاء تقريره، ثم يعتمد عليه أيضًا عند نشر التقرير.
يمرره controller إلى بيئة عملية sudo فقط، دون عقد يضمن احتفاظ sudo به.

أثبتت تجربة فعلية في حاوية مؤقتة `postgres:17`، بلا شبكة وبلا privileged، أن
sudo `1.9.16p2` مع `env_reset` الافتراضي يحذف `RUNNER_TEMP`، بينما يحتفظ به
setpriv منفردًا. بقي stdin الخاص متاحًا عبر sudo ثم setpriv، مع
`NoNewPrivs=1` و`CapInh=CapBnd=CapAmb=0`. حُذفت الحاويات بـ`--rm`، وأظهر
استعلام Docker المحلي المستقل عدم بقاء أي حاوية من الصورة.

المثبت هو خلل الاعتماد على انتقال البيئة عبر sudo، وآلية فشل قابلة لإعادة
الإنتاج متوافقة مع artifact. لم تُعاين بيئة العامل التاريخية أو sudoers الخاصة
به؛ لا يكشف stage وحده الفرق بين متغير غائب ومسار غير صالح. لم تُنفّذ سلسلة
nsenter الكاملة أو مجموعات Auth هنا؛ التجربة ليست GitHub-hosted runner.

## الإصلاح المحدود

- يعيد prepare المجلد الفعلي الذي تحقق منه controller أصلًا في `runtimeTemp`.
- يفحص controller هذا السياق ويضيفه إلى JSON الخاص على stdin مع approval
  وcredentials المحلية. لا يعتمد تشغيل العامل على تمرير RUNNER_TEMP إلى sudo.
- يقرأ العامل القناة الخاصة المحدودة ويفحص approval، ثم يفحص السياق صراحة:
  string محدود، absolute، canonical وموجود، directory، والأب المباشر لـworkdir
  ذي الاسم المعتمد. تُرفض القيم المفقودة والأنواع الخاطئة والروابط الرمزية
  وtraversal والملفات والمسارات الغريبة. يعاد الفحص قبل نشر التقرير.
- تستخدم initialization وفصل source ومسار worker-report السياق المتحقق منه.
  يبقى controller وindependent cleanup على سياقهما الأصلي دون تعديل.

لم تتغير flags sudo/nsenter/setpriv، ولا UID/GID/groups أو NoNewPrivs أو إسقاط
capabilities أو namespace pinning أو owned marker/journal أو firewall/DNS.
لا يوجد `sudo -E` أو preserve-env أو credentials في argv/environment/logs.
لم تتغير أي assertion للمجموعات الـ21 أو ملفات التطبيق أو lockfile أو source pin.
لا يجيز السياق الصالح تجاوز أي فحص هوية أو integrity أو report validation.

## الملفات والتحقق

التغييرات: `local-runtime.mjs`, `integration.mjs`, `review.test.mjs`, `README.md`
و`source-manifest.json` تحت `app/frontend/tests/subscription-009-local/`.
تضاف هذه المذكرة و`docs/evidence/subscription-009-worker-temp-proof.json`.

- `npm run review:offline`: نجح 73/73، دون fail أو skip؛ تتضمن missing/invalid/valid
  context، رفض المسارات الفعلية غير الصالحة، قبول السياق مع بيئة مفقودة/غريبة،
  ومنع privileged launch قبل صلاحية السياق، مع جميع فحوص الهوية السابقة.
- `python3 ci/subscription009/test-owned-hosts.py`: نجح 9/9.
- `python3 ci/subscription009/test-workflow.py`: نجح 14/14.
- نجحت فحوص Node syntax و`git diff --check`.
- تحقق مستقل من 12 source file: تطابق البايتات مع source commit المثبت وGit blobs
  وSHA256. حُسبت checksums لملفات الحزمة العشرة بـPython hashlib وGNU sha256sum؛
  حُدثت القيم الأربع المتغيرة فقط بعد تطابق الحسابين.

المجموعات الأصلية الـ21 لم تُنفذ محليًا. لا نشر أو تعديل main أو تشغيل workflow
أو تعامل مع الإنتاج. يظل القرار NO-GO حتى تنفيذ الأدلة المطلوبة بنجاح.

## التثبيت التالي على main

commit الحزمة: `5543bb6aa96aa0b7da991dc9a894821139cc0c97`.
التغيير اليدوي الوحيد المطلوب في workflow على main:

```yaml
PACKAGE_SHA: 5543bb6aa96aa0b7da991dc9a894821139cc0c97
```

يظل `SOURCE_SHA=e6dd3fc5e014ea0539df8da12a6ee84582b302b9`، وcheckout
الحزمة `ref: ${{ env.PACKAGE_SHA }}` وشرط فرع main وسائر الضوابط كما هي.
لا يحدّث هذا العمل main ولا يطلق أي تشغيل. ثُبت المرجع الجديد في نسخة workflow
على فرع الاسترداد وحده لتسهيل المراجعة.
