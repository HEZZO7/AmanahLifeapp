# تحقيق real_auth_jwt — Subscription 009

التشغيل: https://github.com/HEZZO7/AmanahLifeapp/actions/runs/40379165351

## النتائج المثبتة وحدودها

الدليل الذي قدمه المستخدم: المصدر `e6dd3fc5e014ea0539df8da12a6ee84582b302b9`،
الحزمة `5543bb6aa96aa0b7da991dc9a894821139cc0c97`، نجح schema_dependencies،
وفشل real_auth_jwt بـassertion_failed؛ لم تُختبر المجموعات الـ19 التالية.
نجح offline review ‏73/73 وoffline billing ‏76/76 وindependent cleanup.
لا يدعي هذا التحقيق تنزيل artifact أو معاينة private logs أو استعادة ردود Auth.

**الـassertion التاريخي المحدد غير معلوم، ولم يثبت عيب في التطبيق أو GoTrue أو
الحزمة.** رمز المجموعة وحده لا يكفي: تشمل إنشاء A/B وتسجيل دخولهما والتحقق
من JWT والهوية ورفض token غير صالح، وكذلك SQL لتهيئة البيانات وstart_trial RPC
وفحص trial snapshot. قد تفشل assertion في trial بعد نجاح المصادقة الفعلية.

وفق ترتيب الكود المثبت، schema_dependencies يطبق fixture و001/002/003/004/005/008،
ويبدأ تطبيق Migration 009 داخل المجموعة التالية migration_idempotency_metadata.
لذلك وقع هذا الفشل قبل تنفيذ SQL الخاص بـ009. لا يوجد دليل يبرر تعديل التطبيق.

فُحصت نسخ SDK المثبتة من lockfile بـnpm ci مع ignore-scripts، دون تغيير lockfile:
Supabase/auth-js/postgrest-js ‏2.110.0 والتبعيات التسع المقفلة. يؤكد مسار SDK:
admin.createUser يطلب GoTrue admin/users؛ signInWithPassword يستخدم password grant؛
getUser(token) يطلب GoTrue user بالـJWT المعطى ويتحقق الاختبار من تطابق الهوية.
لا تستخدم المجموعة JWT محلي الصنع لإثبات النجاح، ولا تستبدل Auth بمثال وهمي.
فحص الكود واستيراد SDK محليًا لا يثبتان نجاح هذه الطلبات في التشغيل التاريخي.

لم تُعد إعادة إنتاج الفشل بخدمات محلية: البيئة ليست fresh GitHub-hosted
ubuntu-24.04، وCLI المثبت 2.121.0 غير موجود، والصورة المحلية الوحيدة postgres:17.
لم تُنتحل شروط runner، ولم تُنشأ مجموعة خدمات بديلة بإعدادات أضعف. لم يُنفذ
أي native group أو SQL أو Auth request في هذا التحقيق المحلي.

## التشخيص المحدود

أضيف حقل اختياري `checks[].authStage` من 22 قيمة ثابتة، مفصلة في README:
مراحل create_user/password_signin/created_identity/session_token/verify_token/
verified_identity/seed_personal_data لكل من a/b، ثم a_seed_subscription و
b_trial_rpc وb_trial_result وdistinct_identities وreject_invalid_token و
read_trial_snapshot وtrial_row_count وtrial_used.

تلتف المراحل حول العمليات والـassertions الأصلية دون تغيير شروطها أو طلباتها.
تعمل كل عملية مرة واحدة؛ وتظل Failure بنفس category وexit، وتظل assertion
العادية فشلًا عاديًا. لا retries جديدة أو skips أو xfail أو mocked Auth.
لا تحتوي الرموز على JWT أو credentials أو بريد أو user ID أو URL أو paths أو
ردود SDK أو نصوص الأخطاء. تبقى A/B مجرد مواضع fixtures ثابتة.

يقبل controller المرحلة فقط مع real_auth_jwt بنتيجة failed أو
infrastructure_failed، ويرفض القيم غير المعروفة أو المرحلة على مجموعة أخرى أو
نتيجة passed. يعاد حساب النتيجة كالمعتاد؛ ولا يجيز التشخيص غياب أي مجموعة.

لم تتغير network/DNS isolation أو namespace pinning أو ownership أو sudo/setpriv
أو NoNewPrivs أو إسقاط capabilities أو credential transport أو independent cleanup.
لم يتغير source pin أو أي ملف تطبيق أو fixture/metadata/lockfile أو assertion
أصلية للمجموعات الـ21. تحديث manifest يقتصر على بصمات ملفات الحزمة الخمسة المتغيرة.

## الاختبارات المحلية والملفات

- نجح package offline: ‏79/79، دون فشل أو تخطي. تشمل الاختبارات الستة الجديدة
  allowlist، إخفاء assertion/SDK payloads، التنفيذ مرة واحدة، حفظ نوع الفشل وexit،
  وصول المرحلة عبر controller، رفض التقارير المزورة، ومنع نجاح نتيجة ناقصة/فاشلة.
- نجح billing مع deny-network preload: ‏76/76، دون فشل أو تخطي.
- نجح test-owned-hosts.py: ‏9/9؛ وtest-workflow.py: ‏14/14.
- نجحت Node syntax وgit diff --check.
- تحقق مستقل من source bytes للمصدر المثبت وGit blob وSHA256 للملفات الـ12.
  تطابق Python hashlib وGNU sha256sum لملفات الحزمة العشرة؛ نجح verifyPackage
  وverifySource، وتحققت إصدارات التبعيات التسع. لم تُضعف integrity assertions.

تغيرت integration.mjs وlocal-runtime.mjs وsafety.mjs وreview.test.mjs وREADME.md
وsource-manifest.json تحت app/frontend/tests/subscription-009-local/، مع هذه
المذكرة وdocs/evidence/subscription-009-real-auth-40379165351.json.
تُحفظ نتائج الاختبارات المحلية في /workspace/output/subscription009-validation/.

## القرار والخطوة التالية

يبقى الإنتاج والفوترة NO-GO حتى نجاح المجموعات الـ21 واستكمال فحوص billing/provider
المنفصلة. الخطوة التالية هي تحديث PACKAGE_SHA في workflow اليدوي على main إلى
commit الحزمة الجديد بعد مراجعته؛ ثم الحصول على checks[].authStage من تشغيل
مصرح به لاحقًا إن تكرر الفشل. لم يُعدّل main ولم يُطلق أي workflow هنا.

commit الحزمة المراجع محليًا: `172a0774dfd4cde1a8d794fa4a91a6ebdae6ac23`.
التغيير المطلوب يدويًا في workflow على main:

```yaml
PACKAGE_SHA: 172a0774dfd4cde1a8d794fa4a91a6ebdae6ac23
```

يبقى `SOURCE_SHA=e6dd3fc5e014ea0539df8da12a6ee84582b302b9` وcheckout الحزمة
`ref: ${{ env.PACKAGE_SHA }}` وشرط فرع main وسائر الضوابط كما هي.
ثُبت المرجع على نسخة workflow في فرع الاسترداد وحده؛ لم يُمس main أو يُرسل dispatch.
