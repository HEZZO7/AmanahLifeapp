# Subscription 009 — إصلاح write_owned_hosts، 2026-10-26

التشغيل المرجعي: https://github.com/HEZZO7/AmanahLifeapp/actions/runs/40296230956
بحسب الدليل المقدم: `phase=status`, `operation=write_owned_hosts`,
`reason=resource_busy`، و0/21 مجموعة منفذة، والتنظيف المستقل ناجح.

## السبب المثبت

يحاول المسار السابق إعادة ملف مولد إلى `/etc/hosts` باستخدام `docker cp`.
هذا الملف bind mount يديره Docker؛ استبدال mountpoint يفشل بـresource busy.
أُعيد إنتاج ذلك على Docker `28.4.0` بحاوية اختبار جديدة غير privileged من
الصورة المحلية `postgres:17`، مع `--network none` ودون منافذ أو PostgreSQL
أو Auth. أعاد copy-to-container exit 1 وresource busy. نجح append داخل الملف
المركب بـexit 0، وبقي inode والمحتوى السابق محفوظين، ونجح `getent hosts`
للاسم المحلي المصطنع. أزيلت حاوية الاختبار وتحقق غيابها.
الدليل القابل للقراءة آليًا: `docs/evidence/subscription-009-owned-hosts-proof.json`.

## التصحيح

تُضاف aliases إلى الملف الموجود دون استبداله. لتجنب افتراض وجود shell أو
`cat` أو `tee` داخل جميع صور الخدمات، يستخدم controller الكاتب نفسه على
ملف Docker backing المعلن في `HostsPath`:

- التحقق مجددًا من pinned namespace، وfull container ID، وproject label،
  وrunning state وPID وغياب privileged mode وعدد الشبكات وIP المكتشف سابقًا.
- يجب أن يطابق `HostsPath` تمامًا
  `<DockerRootDir>/containers/<full-container-id>/hosts` من daemon المحلي.
- الكاتب ثابت ومثبت ضمن `local-runtime.mjs`، ويعمل بـ`sudo -n python3 -I`
  الذي يعتمد على صلاحية sudo المطلوبة أصلًا للعزل. مدخلاته عبر stdin فقط.
- يفتح كل directory بواسطة FD و`O_NOFOLLOW`، ثم الملف الموجود فقط بواسطة
  `O_RDWR|O_APPEND|O_NOFOLLOW`. لا create أو truncate أو rename أو unlink.
  يرفض symlinks وhardlinks والملفات غير المنتظمة والمدخلات/الملفات الكبيرة.
- يقبل أسماء محدودة وIPs داخل subnet الخاص المكتشف، ويرفض تعارض alias قائم،
  ويحافظ على bytes السابقة وinode والمالك والصلاحيات. التكرار لا يضاعف aliases.
- يعيد digest فقط. يقرأ controller الملف من الحاوية عبر `docker cp` للقراءة
  وحدها، ويقارن SHA256 ثم يحذف snapshot الخاص. لا يُستخدم copy للكتابة.
- أي فشل في الهوية أو الكتابة أو readback يوقف الإعداد قبل worker، دون retry
  أو fallback، ثم تعمل آلية التنظيف الأصلية للموارد المملوكة.

## أثر الأمان والحدود

لم يتغير `isolation.mjs` أو أي firewall rule أو حظر Docker DNS عند
`127.0.0.11` أو قيود IPv4/IPv6 أو صلاحيات worker. لا DNS خارجي أو شبكة جديدة
أو container privileged أو خدمة إضافية في الحزمة. لا يُكتب `/etc/hosts` الخاص
بالمضيف؛ الكتابة محصورة بملف daemon الخاص بالـcontainer المملوك. يزيل Docker
هذا الملف عند حذف الحاوية عبر cleanup الأصلي. تبقى aliases ضمن الشبكة المحلية.

يتطلب التنفيذ على runner الوصول بـsudo إلى Docker storage المعتاد. يُرفض
layout غير مطابق أو symlink في المسار أو وصول غير متاح، ولا تُخفف القيود.
البيئة الحالية لا تحتوي sudo؛ لذلك اختُبر الكاتب الفعلي على ملفات مؤقتة تمثل
layout daemon، واختُبرت دلالة append على bind mount داخل Docker بشكل مستقل.
لم يُدّعَ تشغيل controller مع sudo على Docker storage هنا أو نجاح native Auth.

## تحقق محلي فعلي

- مراجعات الحزمة: **61 ناجحًا، 0 فشل، 0 skipped**. تشمل رفض استبدال mountpoint
  القديم، وكتابة aliases بالطريق المصحح، وملكية/PID/مسار/IP غير مطابق، وفشل
  helper دون إعادة محاولة، وتعارض readback وnamespace غير صالح.
- الكاتب الفعلي المستخرج من runtime: **9 اختبارات ناجحة** على filesystem
  مؤقت، تشمل inode/owner/mode/prefix والدقة/idempotency ورفض symlink/hardlink
  والمسارات والهويات والعناوين غير الصالحة وتعارض aliases وعدم إنشاء ملف غائب.
- workflow: **14 اختبارًا ناجحًا**، دون تغيير بوابة قبول المجموعات أو التنظيف.
- ملفات المصدر الـ12 مطابقة لـ`e6dd3fc5e014ea0539df8da12a6ee84582b302b9`؛
  جُددت بصمات ملفات الحزمة الأربعة المتأثرة فقط بعد مطابقة حسابي SHA256
  المستقلين. تبقى SDK/CLI/lockfile وmigration order وassertions الـ21 كما هي.
- لم يُنفذ أي dispatch أو native Auth group أو SQL أو طلب إنتاجي.

## main — تحديث يدوي لاحق فقط

نسخة main المقروءة أثناء هذه المهمة تستخدم `ref: ${{ env.PACKAGE_SHA }}`
بالفعل. بعد اعتماد commit الحزمة الجديد، غيّر قيمة `env.PACKAGE_SHA` فقط إلى
SHA الحزمة الجديدة. أبقِ SHA التطبيق `e6dd3fc…` وcheckout expression وحارس
`refs/heads/main` دون تغيير. لم يُعدّل main هنا، ولم تُرسل محاولة تشغيل.
تظل جاهزية الإنتاج والفوترة **NO-GO** حتى اجتياز المجموعات الـ21 والتحققات الأخرى.

الحزمة المصححة المثبتة: `c4c415cbc7e075931fe1f7eb9ace75f492893146`.
التغيير اليدوي الدقيق على main هو:

```yaml
PACKAGE_SHA: c4c415cbc7e075931fe1f7eb9ace75f492893146
```

لا تغيير لـ`SOURCE_SHA` أو `ref: ${{ env.PACKAGE_SHA }}` أو حارس main.
