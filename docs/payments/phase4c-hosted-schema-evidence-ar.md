# Phase 4C — دمج أدلة Supabase ومراجعة حذف الحساب

التاريخ: 2026-11-02. **دُمجت الأدلة الجزئية؛ SQL وNative ما زالا BLOCKED، وقبول الدمج HOLD. الإنتاج والفوترة الحية NO-GO.** لم يُحذف حساب فعلي ولم تُستدعَ خدمات دفع أو يُرسل Actions dispatch.

## المصدر وحدود الأدلة

المستودع `HEZZO7/AmanahLifeapp`. الأصل الدقيق [`3d1bbfdb8aeaa0a1a6da92fb661850690d3cf9cf`](https://github.com/HEZZO7/AmanahLifeapp/commit/3d1bbfdb8aeaa0a1a6da92fb661850690d3cf9cf)، وشجرته `25b9a9ecf8c160de432798882b90c2cf2d65e53d`؛ طوبقا محلياً وعبر GitHub connector. الفرع الجديد `diagnostic/phase4c-hosted-schema-evidence-20261102` ابن مباشر لهذا الأصل. SHA التسليم ورابطه يرفقان بالتسليم الخارجي لتجنب مرجع ذاتي دائري.

نتائج Supabase التالية **موثقة ومقدمة من المستخدم**؛ قُبلت بهذه الصفة. لم يستعلم هذا التنفيذ قاعدة مستضافة، ولم يُرفق به إخراج catalog خام أو وقت الجمع أو أسماء القيود/أعمدتها أو نصوص السياسات. لا تتحول هذه النتائج الجزئية إلى شهادة تفويض كاملة أو إثبات تنفيذ migrations على الاستضافة.

| الجدول في `public`، بالبادئة `app_11941c8fec_` | الوجود وRLS | FK إلى `auth.users`: ON DELETE |
| --- | --- | --- |
| `bill_reminders_sync` | موجود، RLS مفعّل | CASCADE |
| `goal_reminders_sync` | موجود، RLS مفعّل | CASCADE |
| `email_digest` | موجود، RLS مفعّل | NO ACTION |

الـFKs الثلاثة validated، وnon-deferrable، وinitially immediate. توجد **خمس سياسات إجمالاً** عبر الجداول؛ توزيعها وأدوارها وUSING/WITH CHECK غير مقدمة. صلاحيات SQL الفعلية لـ`anon` و`authenticated` و`service_role` تحتاج مراجعة مع RLS. تفعيل RLS وعدد السياسات لا يثبتان عزل الحسابات، ولا ينفيان grants موروثة أو column grants أو تأثير table owner/BYPASSRLS أو views/RPC.

فهرس الأدلة يسجل الحقائق الجديدة وprovenance منفصلين عن نتائج 2026-11-01. بقي `hostedCatalogSnapshot=null` لغياب snapshot كامل، ولم يُنشأ catalog اصطناعي يُنسب إلى الاستضافة. التقرير السابق يحتفظ بنتائجه وبصماته التاريخية مع إحالة إلى هذا التحديث.

## هل يُحذف email قبل auth.users؟

**نعم من حيث ترتيب المصدر المراجع، بصورة مشروطة؛ لم تثبت الموثوقية على الاستضافة.**

في `app/frontend/supabase/migrations/202610210009_atomic_account_deletion.sql`، trigger المسمى `app_11941c8fec_transactional_account_cleanup` يعمل `BEFORE DELETE ON auth.users FOR EACH ROW`. دالته تراجع سياق التنفيذ، ثم readiness وسياسة الاحتفاظ بالفوترة قبل لمس الصفوف. بعد ذلك تحذف، بالترتيب:

`subscriptions → search_history → email_digest → notification_preferences → push_subscriptions`

كل DELETE مقيد بـ`user_id=OLD.id`، ثم تعيد الدالة `OLD` لتسمح بحذف صف Auth. حذف email ليس طلب REST منفصلاً، بل جزء من جملة حذف Auth ومعاملتها. لذلك يمكن للصفوف المرجعية أن تزول قبل فحص FK الفوري على حذف الأصل؛ **NO ACTION لا يعني فشلاً حتمياً، ولا يبرر تحويله إلى CASCADE**.

الدالة `SECURITY DEFINER`، مملوكة لـ`postgres` وذات `search_path=''` في المصدر؛ لا تبتلع استثناءات. إذا منع FK أو trigger أو خطأ صلاحية إحدى خطوات الجملة، تتراجع آثارها المعاملاتية، بما فيها تنظيف الاشتراك وسجل التجربة. هذا استنتاج من تعريف SQL وسلوك PostgreSQL، **وليس نتيجة اختبار SQL نفذ هنا**.

الاعتماد على ذلك يتطلب أن تكون نسخة 009 الصحيحة مطبقة وtrigger مفعلاً بلا شرط، وأن تطابق أعمدة FK صفوف `user_id` التي تنظفها الدالة، وأن تستطيع الدالة حذفها، وألا تمنع child triggers التنظيف أو توجد مراجع أخرى غير معالجة. هذه التفاصيل لم تُثبت في النتائج المقدمة. جاهزية 009 تتحقق من خمسة Auth FKs مختارة ومن trigger/ACL محددة، وليست inventory شاملاً لكل FK أو تعريفات سياسات email أو child triggers.

مرآتا bill/goal غير مذكورتين في تنظيف 009. أدلة CASCADE تشرح إمكان تنظيفهما عبر حذف الأصل دون إضافة DELETE يدوي، لكن نجاحهما وسلامة بقية التبعيات يحتاجان SQL/Native فعليين. لا يجوز اعتبار وجود CASCADE إثباتاً لصلاحية حذف حساب أو لإكمال تحقق الإشعارات.

## حالات الفشل والاحتفاظ بالفوترة

| الحالة | الأثر المتوقع من المصدر؛ لم تُرصد كفشل مستضاف هنا |
| --- | --- |
| 009/trigger/readiness غير مثبتة أو غير مطابقة | المسار يرفض قبل Auth DELETE بـ503 `billing_verification_unavailable` عند فشل preflight |
| صف email مطابق باقٍ، مثلاً لأن child BEFORE trigger أعاد NULL، أو تعذر تنظيفه | FK NO ACTION يمكن أن يمنع Auth DELETE؛ الخطأ لا يُبتلع، والتنظيف داخل الجملة يتراجع |
| خطأ permission/RLS/trigger أثناء التنظيف أو cascade | تفشل الجملة؛ لا تتحول الاستجابة إلى نجاح ولا تبدأ محاولة تنظيف HTTP بديلة |
| حساب له سجل دفع أو اشتراك مدفوع وفق008 | 409 `billing_review_required` قبل الحذف، مع إبقاء الاستحقاق المشروع وعدم إلغاء اشتراك |
| مرجع محتفظ به آخر، وخاصة customer-owner وحده بعد011 | قد يمر preflight008 ثم يمنع FK الحذف؛ يبقى التاريخ وتتراجع خطوات009 |

migration 008 تمنع الحذف عند وجود `payment_accounts/payment_intents/payment_bindings/payment_periods` أو أدلة اشتراك مدفوع، دون استثناء test/live أو cancelled/expired/refunded. إلغاء التجديد أو انتهاء الدفع لا يمحو واجب الاحتفاظ. كذلك يعاد فحص السياسة داخل جملة الحذف، ويظل تسلسل checkout/deletion والاحتفاظ بالتجارب دون تعديل.

migration 011 تنشئ `payment_customer_owners.user_id REFERENCES auth.users(id)` دون ON DELETE صريح، أي NO ACTION افتراضياً. جدول ownership ليس ضمن تنظيف009 ولا ضمن اختبار الوجود في `account_deletion_allowed` في008. مع سجل binding عادي تمنع008 الحذف مسبقاً؛ إذا بقي owner record وحده، يمكن أن تسمح008 بالمتابعة لكن FK في011 يمنع الحذف. **هذه حالة مستنتجة من المصدر، لا دليل على وجود بيانات مستضافة بهذه الحالة.** المنع يحفظ التاريخ؛ لا أعتبره مبرراً لحذف ownership أو تغيير FK، وإن كانت رسالة preflight أقل تحديداً في هذه الحالة.

الـEdge adapter يتحقق من المستخدم عبر `getUser(token)`، ولا يأخذ هوية الهدف أو ادعاء الإلغاء من JSON. يستدعي hard delete مرة واحدة فقط. خطأ Auth DELETE يؤدي إلى503 `account_deletion_unconfirmed` دون تسريب قيد/خطأ قاعدة البيانات أو retry؛ لا يدعي هل حدث commit عند ضياع الرد. النجاح يحتاج تأكيد غياب المستخدم صراحةً بـ`404/user_not_found`. لم تتغير رسائل الواجهة أو الشيفرة أو الاستحقاقات في هذا الالتزام.

**لا فشل حذف فعلي مثبت، ولا ضرورة مثبتة لتغيير FK أو RLS.** بقيت migrations 001–011 ووظائف التطبيق وACLs وبيانات الفوترة وملفات الاعتمادات دون تعديل. لا migration جديدة ولا تطبيق مستضاف.

## التحقق المنفذ فعلياً

| الفحص | PASS | FAIL | SKIP | النتيجة |
| --- | ---: | ---: | ---: | --- |
| اختبارات المصدر، 21 ملفاً: 438 سابقة +9 جديدة | 447 | 0 | 0 | PASS |
| مراجعة حزمة Native offline المعاد توليدها | 134 | 1 | 0 | BLOCKED؛ اختبار117 يفتقد SDK المثبت |
| SQL runner | 0 | 1 | 0 | exit1 عند استيراد PGlite؛ BLOCKED |
| SQL assertions/statements | 0 | 0 | 0 | لم يبدأ SQL، وليست PASS |
| TypeScript التطبيق وpayment types | — | — | — | PASS |
| ESLint وproduction build المحلي | — | — | — | PASS؛ لا نشر |
| سلامة حزمة4B الأصلية | — | — | — | PASS لـ79 مدخلاً؛ 27 ملفاً مولداً، PREPARED_NOT_EXECUTED |

الاختبارات الجديدة في `account-deletion-schema.test.mjs` تحفظ تمييز الأدلة الجزئية، وتفحص ترتيب BEFORE cleanup والهوية، والاحتفاظ بمرجع ownership، وتنفذ adapter الحقيقي مع SDK وهمي يحاكي أخطاء FK والصلاحيات ورفض readiness/الفوترة. **هذه اختبارات مصدر ومسار استجابة؛ لا تثبت SQL rollback أو عزل REST المستضاف.** لم تُضعف assertions الأصلية أو تُتخطَّ اختبارات.

جرى `npm run test:payments`، وتقرير Node الأب أعطى21 ملفاً ناجحاً. عُدّت447 حالة عبر TAP لكل ملف بأمر Node مستقل مع `--test-isolation=none` و`deny-network.mjs`. وجرى `tsc -p tsconfig.app.json --noEmit` و`npm run check:payment-types` و`npm run lint` و`npm run build`.

جرى `npm run test:payments:sql` فعلياً: `ERR_MODULE_NOT_FOUND` لـ`@electric-sql/pglite` قبل أول SQL. أعيد توليد حزمة4B المثبتة بالمصدر `fece36e90b1f9eb79e1be36a39043ff5b697c427` ومراجعتها offline: الفشل الوحيد `ERR_MODULE_NOT_FOUND` لـ`@supabase/supabase-js` داخل الحزمة المعزولة. لم يُستبدل اعتماد بآخر عام، ولم تُعد محاولة تنزيل الاعتمادات في هذا التحديث؛ تشخيص proxy القديم تاريخي وليس اختبار شبكة جديداً. لا خدمات Native أو قاعدة مستضافة أو حسابات حقيقية استُخدمت.

## الأدلة والمتطلبات المتبقية

1. تعريفات الأعمدة والقيود كاملة، واسم وأعمدة كل FK واتجاه ON UPDATE وكل المراجع الأخرى إلى Auth أو جداول التنظيف، مع هوية قاعدة البيانات ووقت جمع الأدلة.
2. نصوص السياسات الخمس وتوزيعها والأدوار والأوامر وpermissive/restrictive وUSING/WITH CHECK، وFORCE RLS والمالكين، وgrants الجدول/الأعمدة/PUBLIC/الأدوار الموروثة مع BYPASSRLS لكل دور. إعداد PostgREST/views/RPC يبقى مطلوباً؛ لم يُثبت التفويض المستضاف كاملاً.
3. تعريفات 008/009/011 المنشورة فعلياً، وأجسام الدوال وowners/search_path/ACL، وحالة وكل triggers على Auth والجداول التابعة، ومطابقة migration inventory للأصل المراجع. collector الحالي لم يُنفذ، وبصمات التعريفات وحدها لا تغني عن مراجعة منطقها.
4. bytes حزم PGlite `0.3.14` وSDK `2.110.0` وفق lockfiles المثبتة والتحقق من SRI عبر وصول معتمد. الـlockfiles لم تتغير؛ توفر اعتماد الواجهة لا يستبدل حزم SQL/Native المعزولة.
5. اختبار SQL disposable يثبت نجاح حذف email NO ACTION مع bill/goal CASCADE، وسلامة حساب B، وفشل child-delete/veto ومرجع owner محتفظ به مع استعادة كل الصفوف والتجربة والاستحقاقات، وحالات السباق. يجب إثبات الوصول لسبب الفشل المتوقع؛ فشل readiness المبكر لا يحل محل اختبار FK.
6. fixture Native كامل001–011 مع metadata الإضافية وإشعارات A/B وJWT حقيقي وحذف reminder rows، دون حذف مجموعات Native الـ21 أو ضوابط ownership/cleanup/isolation/no-egress. profile الحالي ما زال سبع migrations فقط ويثبت009 عندindex6؛ لم يُستكمل أو يُعاد توصيفه كحزمة جاهزة.

## الملفات والبصمات

| الملف المتغير | SHA-256 |
| --- | --- |
| `app/frontend/tests/account-deletion-schema.test.mjs` | `be2f99f6d4553af9b2f421cc8457ede4f79a0ffba3b4dc11c12b8cc592a6ac2a` |
| `app/frontend/tests/phase4c-readiness/README.md` | `31a5d7463fac7f1f944075afab5c5fb90857922eb8dd61a8715dabf8f68c9224` |
| `docs/security/phase4c-evidence-index.json` | `204ae7ef92432c692178c46c5501fe0a0b4c0fe15fb5691bd96f4a05fe4b8f8b` |
| `docs/payments/phase4c-database-native-readiness-ar.md` | `f6e2bae6c666bc3e3576d49d1572cb259f3b9d4e7840a45f0bf784fab021166b` |
| `docs/payments/phase4c-hosted-schema-evidence-ar.md` | يثبته Git tree للالتزام المنشور، دون بصمة ذاتية دائرية |

التوصية: يمكن مراجعة هذا التشخيص والأدلة الجزئية الآن؛ **لا أوصي بعد بتشغيل Native مستضاف أو قبول الدمج** قبل استكمال الأدلة والـfixture ونجاح SQL والمتطلبات المحلية وسلامة الحزمة immutable. main لم يتغير؛ لا hosted migrations أو نشر إنتاج أو حذف حساب فعلي أو provider calls أو Actions dispatch. **Production وLive Billing: NO-GO.**
