# قائمة إعداد Test فقط — قيم فعلية لا تُرسل في التقارير

كل البنود **UNVERIFIED** حتى يؤكدها المالك داخل حسابه. لا تطلب حزمة native أي
Lemon secret أو Supabase access token أو hosted project ref. لا يُعدّ إعداد هذه
القائمة أو نجاح native تصريحًا بتفعيل Checkout أو خصم أو استدعاء مزوّد.

## Lemon Squeezy: فحوص المالك

| الإعداد/المتغير | التأكيد المطلوب داخل Test |
|---|---|
| `AMANAHLIFE_LS_TEST_STORE_ID` | متجر Test مملوك للمهمة، عملة وضرائب وحالة الحساب معروفة؛ لا تخمين من اسم النطاق |
| `AMANAHLIFE_LS_TEST_BALANCED_PRODUCT_ID` | المنتج الصحيح للخطة balanced؛ تحقق من test_mode/store_id |
| `AMANAHLIFE_LS_TEST_FAMILY_PRODUCT_ID` | المنتج الصحيح للخطة family؛ تحقق من test_mode/store_id |
| `AMANAHLIFE_LS_TEST_BALANCED_MONTHLY_VARIANT_ID` | variant متميز، recurring/month/1 والمبلغ والعملة/رسوم الإعداد موثقة |
| `AMANAHLIFE_LS_TEST_BALANCED_YEARLY_VARIANT_ID` | recurring/year/1 وإجمالي سنوي معتمد؛ لا تحويل سعر شهري بالتخمين |
| `AMANAHLIFE_LS_TEST_FAMILY_MONTHLY_VARIANT_ID` | recurring/month/1 والخطة/الحدود المعلنة متطابقة |
| `AMANAHLIFE_LS_TEST_FAMILY_YEARLY_VARIANT_ID` | recurring/year/1 والخطة/الإجمالي السنوي متطابقان |
| `AMANAHLIFE_LS_TEST_API_KEY` | مفتاح من سياق Test وبأقل صلاحيات لازمة؛ يؤكد المالك نطاقه وعدم استخدام Live key، ولا يكشف قيمته |
| `AMANAHLIFE_LS_TEST_WEBHOOK_SECRET` | سر خاص بهذا endpoint وبيئة Test، منفصل عن Live، محفوظ في server secret store |
| `AMANAHLIFE_LS_TEST_APP_ORIGIN` | أصل HTTPS لواجهة الاختبار فقط، بلا path/query/userinfo، ومسموح للعودة من Checkout |
| API | العنوان القياسي `https://api.lemonsqueezy.com/v1/` قد يخدم الوضعين؛ الاسم وحده لا يثبت Test. يلزم test_mode=true وعلاقات store/product/variant/customer الصحيحة |
| أحداث Webhook | subscription_created/updated/cancelled/resumed/paused/unpaused/expired وsubscription_payment_success/failed/recovered/refunded وorder_created/refunded حسب الكتالوج الفعلي |
| endpoint | تابع لمشروع Test المستقل، وظيفة `app_11941c8fec_lemonsqueezy_webhook_test`، لا عنوان المشروع المعروف في الإنتاج ولا endpoint Live |
| canonical evidence | حقول total/refunded_amount/status وpagination وsubscription_id، ودلالة renews_at/ends_at مثبتة بتسليم Test حقيقي؛ المفقود لا يُستبدل بقيمة مختلقة |
| Customer Portal | cancel/resume، الفواتير، تحديث الدفع والتغييرات/proration المدعومة وسياسة عدم مشاركة Customer بين حسابين |
| `AMANAH30` | التحقق فقط من النسبة/المدة/الخطة/الأهلية. `promotion.verified=false` وDISCOUNT_VERIFIED تبقيان مغلقتين؛ لا إنشاء خصم أو تفعيله |

## Supabase وواجهة الاختبار المستضافة لاحقًا

- مشروع مستقل فارغ مملوك للمهمة؛ تأكيد project identity بدون مشاركة المفاتيح أو URLs خاصة، وعدم ربط CLI الحالي بإنتاج. native يستخدم project_id محليًا عابرًا فقط.
- مصدر معتمد ثابت وmigrations001–011 بعد التحقق من dependencies/schema drift. لا تنقل fixture أو fault triggers إلى مشروع مستضاف.
- Auth حقيقي، حسابان اصطناعيان A/B فقط، email verification وسياسة callback/redirect متطابقتان مع واجهة Test؛ لا نسخ مستخدمين أو كلمات مرور حقيقية.
- `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` من مشروع Test نفسه؛ `VITE_AMANAHLIFE_PAYMENT_MODE=test`. لا service_role أو Lemon secrets في VITE.
- Server `SUPABASE_URL` و`SUPABASE_ANON_KEY` و`SUPABASE_SERVICE_ROLE_KEY` تخص مشروع Test نفسه، وتبقى في مخزن أسرار الخادم فقط. native يولد مفاتيحه محليًا ويمررها على stdin الخاصة.
- `AMANAHLIFE_APP_ORIGIN` أصل Test HTTPS صريح لخدمات AI/family. لا تخفيف JWT أو توسيع CORS إلى مواقع غير معتمدة لتجاوز فشل.
- Webhook خارجي: تأكيد إعداد Supabase JWT gateway المناسب لتلك الوظيفة فقط كي يصل توقيع Lemon إلى HMAC؛ يبقى فحص HMAC إلزاميًا. Checkout يحافظ على Authorization والتحقق من getUser.
- `AMANAHLIFE_LS_TEST_CHECKOUT_APPROVED` **غائب/false**، وDB `checkouts_enabled=false`، ولا صف Live أو أسرار Live. لا تفتح أي بوابة في هذه المرحلة. instrumentation native تستخدم تغييرًا غير committed داخل معاملات SQL اصطناعية ثم تعيد false، دون وظيفة Checkout أو اتصال مزوّد.
- لا anonymous reconciliation endpoint أو cron أو صلاحية كتابة ledger من العميل. إعداد worker مصالحة Test يحتاج مراجعة وتفويض اتصال مزوّد منفصلين.
- RLS فعالة؛ حالات الرفض تتوقف ولا تُعالج بإعطاء service_role للمتصفح أو منح DELETE على subscription history.
- تأكيد جرد Paddle/Stripe/اشتراكات Lemon السابقة قبل أي خطة إنتاج. لا تعطيل webhook/إدارة عميل سابق أو سحب مفاتيحه بناءً على غياب دليل الاستخدام.

## GitHub native فقط

يُستخدم runner جديد `ubuntu-24.04/github-hosted`، محتوى قراءة فقط، بلا environments
أو secrets موروثة أو Supabase login/link. الـdispatch اليدوي وبند الموافقة الصريح
هما حد التنفيذ؛ لا push/schedule/PR trigger. تُحفظ artifacts المنقحة7 أيام.
لا ينبغي طلب أي بيانات اعتماد دفع لتشغيل native.
