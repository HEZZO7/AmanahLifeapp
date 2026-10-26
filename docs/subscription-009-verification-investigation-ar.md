# التحقيق في التشغيل 40276141514

الـworkflow المفحوص من Git:
`b6487f6a4fb3fa7504c1b915c12df652196c38b7`.
الحزمة المطلوبة: `9c38cb5a50d54cce3140361aa341ed65e8996e14`.

## السبب المثبت وإعادة الإنتاج

يحدد job قيمة `PACKAGE_SHA=9c38cb5a50d54cce3140361aa341ed65e8996e14`،
لكن `Check out immutable test package` يحدد
`ref: 8d5cdd246233a4a7ef4ad7ea2a62815ece08b153`.
إذًا يفشل assertion الثالث في خطوة التحقق:

```bash
test "$(git -C "$GITHUB_WORKSPACE/package" rev-parse HEAD)" = "$PACKAGE_SHA"
```

أُعيد إنتاج ذلك في checkoutين محليين مؤقتين مستقلين باستخدام Git، دون
worktree أو خدمات أو dispatch أو بيانات إنتاجية. نُفذت كتلة `verify` نفسها
المستخرجة من commit المحدد، في بيئة محلية محدودة المتغيرات ودون credentials:

| الفحص | الحزمة القديمة كما في workflow الفاشل |
|---|---|
| Node `24.19.0` | exit 0 |
| HEAD المصدر `e6dd3fc5e014ea0539df8da12a6ee84582b302b9` | exit 0 |
| HEAD الحزمة مقابل `PACKAGE_SHA` | **exit 1** |
| كتلة التحقق الأصلية كاملة | **exit 1، قبل إنشاء أدلة manifest** |

بعد تغيير checkout المحلي وحده إلى الحزمة المطلوبة `9c38cb5…`، اجتازت
الكتلة الأصلية كاملة بـexit 0. بذلك تحققت محليًا أيضًا:

- مسارات ملفات المصدر والحزمة، وغياب symlinks المخالفة.
- مطابقة bytes للـmanifest مع commit الحزمة.
- `sourceCommit` وعدد مدخلات المصدر الـ12 وملفات الحزمة الـ10.
- SHA256 عبر `hashlib` و`sha256sum`، وGit blob IDs، وbytes المصدر المثبتة.
- `verifySource` و`verifyPackage` و`assertCleanEnvironment`.
- Node `24.19.0` وSDK `2.110.0` في manifest وlockfile.

هذه إعادة إنتاج محلية لمرحلة التحقق؛ ليست نتيجة runner أو Auth جديدة.
لم تُقرأ raw logs أو بيانات credentials من التشغيل البعيد.

## الإصلاح المحدود

كان فرع الاسترداد يحتوي بالفعل على SHA الحزمة الصحيحة في موضعيها. لمنع
عودة خطأ التحديث اليدوي، تغير **سطر checkout واحد فقط** إلى:

```yaml
ref: ${{ env.PACKAGE_SHA }}
```

تبقى قيمة `PACKAGE_SHA` literal SHA كاملة مثبتة؛ وليست branch أو ref متغيرًا.
تبقى assertions التحقق كلها كما هي. أضيف اختبار regression يرفض ref القديم
المنفصل عن قيمة SHA، واختبار يمنع تحويل selector إلى branch أو expression.
اجتازت فحوص workflow الـ**14**، وفحوص YAML/Bash/Python و`git diff --check`.
لم تتغير الحزمة المثبتة أو ملفات التطبيق أو manifests أو hashes؛ لا حاجة
إلى SHA حزمة جديدة. نُظفت checkouts إعادة الإنتاج المؤقتة تلقائيًا.

## التحديث اليدوي المطلوب على main — غير منفذ هنا

في `.github/workflows/subscription-009-native-validation.yml` على `main`:

1. غيّر فقط `with.ref` لخطوة `Check out immutable test package` من
   `8d5cdd246233a4a7ef4ad7ea2a62815ece08b153` إلى `${{ env.PACKAGE_SHA }}`.
2. أبقِ `PACKAGE_SHA: 9c38cb5a50d54cce3140361aa341ed65e8996e14` وSHA التطبيق
   `e6dd3fc5e014ea0539df8da12a6ee84582b302b9` دون تغيير.
3. أبقِ حارس التنفيذ الخاص بنسخة `main` وهو `refs/heads/main`؛ لا تنسخ
   حارس فرع الاسترداد إلى `main` عند إجراء هذا التحديث المحدود.

لم يُعدّل `main` ولم يُرسل أي dispatch. جميع مجموعات Auth الـ21 غير منفذة
في هذه الجلسة، ولا تغير هذه النتيجة قرار **NO-GO** للإنتاج والفوترة.
