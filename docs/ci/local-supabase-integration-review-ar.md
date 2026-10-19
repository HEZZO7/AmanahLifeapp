# حالة حزمة التحقق المحلي بعد تثبيت التبعيات

PR #2 مسودة. التطبيق المستهدف f29d8df16e434e8cd064968e4b832e9c8f84e2fb؛ أساس مراجعة CI هو d80428205a9b2cae256cbf30e52f30ae9f3622b8. التغييرات الحالية محصورة في ci/notification-local وdocs/ci؛ لا تغيير لتطبيق أو migrations أو workflows نشطة أو الإنتاج.

**الحالة: المراجع مثبتة، والتحقق من bytes والتوافق التشغيلي غير مكتمل. لا تفعّل workflow الآن.** لا يمكن إعلان الإغلاق الكامل لعائق إعادة الإنتاج بناء على بيانات metadata وفحوص offline فقط. لا Docker/Supabase/SQL/Deno أو workflow شُغل هنا. الاشتراكات المدفوعة No-Go والمنتجات الرقمية مستقلة.

## الأقفال ومصادرها

- CLI2.121.0: أرشيف linux_amd64 محدد، وSHA-256 ثابت 4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f من digest أصل الإصدار في GitHub API. لم نعد ننزل checksums ديناميكيًا ونثق بها بجوار الأرشيف. يفحص الأرشيف قبل فكّه، ثم يتحقق من --version.
- 7 صور Docker مثبتة @sha256، مع --platform=linux/amd64 وفحص OCI architecture/OS وRepoDigests قبل تشغيل الخدمات، ثم مقارنة image IDs الفعلية للحاويات بالقائمة التي سُحبت. مراجع الصور ومصادر الأدلة بالضبط في runtime-lock.json.
- صور PostgreSQL17.11.0.004-r1 وAuth2.197.0-r0 وPostgREST16.4-r0 وEdge1.77.4-r0 مأخوذة من كتالوج CLI نفسه ومن إعلانات نشر supabase/slim-services التي تصرح linux/amd64 والدigest المطابق. يفعّل SUPABASE_USE_SLIM_IMAGES محليًا فقط. لا خلط عشوائي لنسخ الخدمات؛ التوافق الفعلي ما زال يحتاج تشغيلًا.
- Node22.23.3 وPython3.12.15 وKong2.8.1 مثبتة على manifests خاصة بـamd64 من docker-library/repo-info بمراجع Git ثابتة. npm10.9.9 مضمن في صورة Node، وتؤكده بيانات إصدار Node وفحص --version المستقبلي. Kong القديم لم يُسحب للتحقق من استمرار توفر digest؛ CLI يستعمل alias library/kong:2.8.1 بعد تحميل الدigest والتأكد من image ID، مع تعطيل إعادة كتابة registry الافتراضية. لا fallback إلى tag متحرك عند الفشل.
- Deno2.1.4 مضمن في صورة Edge المذكورة؛ التحقق من نسخة المصدر deno/Cargo.toml ليس تشغيلًا للثنائية. وظيفة ci_runtime_probe محلية للاختبار فقط تفحص Deno.version وlinux/x86_64 قبل الحسابين، ولا تقرأ أسرارًا أو قاعدة البيانات. لا تثبيت Deno latest أو setup-deno Action.
- package-lock.json v3 وnpm ci --ignore-scripts، مع 26 حزمة بإصدارات/SRI محددة. يحتفظ SDK2.110.0 المطابق لنسخة التطبيق، ويثبت web-push3.6.7 وتبعياته. قارنا31 حافة semver و12 شرط Node؛ كلها تقبل Node22.23.3. هذا لا يثبت توافق طبقة npm في Deno2.1.4 مع SDK الحديث.
- deno.lock/import_map.json/deno.json يثبتون جذري npm والgraph نفسه. JSON والاتساق فُحصا، ولم يعمل Deno نفسه للتحقق من parsing أو تطبيق frozen lock داخل الـruntime المضمن.

## حدود مصدر integrity — عائق باقٍ يجب عدم إخفائه

لم تتوفر اتصالات registry/download من أداة التنفيذ؛ لم نحمل أرشيف CLI أو صور OCI أو npm tarballs. بيانات إصدار CLI وكتالوج الصور بيانات ناشرين، وليست شهادة على bytes سحبناها محليًا.

قيم npm SRI ليست مأخوذة من registry npm مباشرة: قيم حزم SDK التسع متطابقة في lockfileين عامين مستقلين عند Git blob ثابت؛ graph web-push مأخوذ من lockfile عام، وقيمة web-push الأساسية وبعض القيم طابقت مصدرًا ثانيًا. بقية القيم ليست موثقة من ناشر الحزمة مباشرة. أسماء المصادر وblob IDs في runtime-lock.json؛ لم ننسخ أو نشغل كود تلك المشاريع. لا نصف هذه القيم بأنها تحقق ناشر مستقل أو npm audit أو attestation. يلزم تحقق canonical registry أو تنزيل bytes والتحقق منها في بيئة مأذونة قبل اعتبار عائق الثقة مغلقًا بالكامل. أي mismatch يجب أن يفشل، لا أن يعيد توليد الأقفال أو يقبل hash جديدًا تلقائيًا.

## كيف يُفرض الفشل المغلق دون اعتماد على Deno lock وحده

1. تمسح بيئة host بـenv -i وHOME مؤقت، ويُنسخ 13 Git blob مسموحًا من المصدر الثابت. لا mount للمستودع الكامل أو .env أو .git أو Docker socket في الاختبارات. لا secrets.* أو environment أو OIDC؛ contents:read وcheckout مثبت بـSHA وpersist-credentials:false فقط.
2. يتحقق من CLI والدigests والمنصة ونسخ أدوات الحاويات قبل استخدامها. npm ci لا يشغّل lifecycle scripts ولا يحدّث lockfile؛ فحص لاحق يقارن أسماء ونسخ الحزم المثبتة.
3. تنزل tarballs من registry.npmjs.org فقط، مع رفض redirect خارجه، وفحص SHA-512 واسم/نسخة package.json والdependencies قبل بدء الخدمات. لا فك ملفات tar إلى filesystem في هذا الفحص.
4. استُبدل CONNECT proxy الخارجي بمرآة HTTP محلية read-only على شبكة internal فقط، منذ البداية. لا bridge أو outbound fetch داخل المرآة، ولا مسار fallback. لا تخدم إلا metadata للنسخ المثبتة وtarballs المقفلة، ويعاد فحص digest عند تقديمها. مجهول/تلاعب/مسار آخر يرفض. NPM_CONFIG_REGISTRY يمرر إلى عملية Edge نفسها حسب مصدر CLI المثبت، وCLI --import-map يضبط imports الأصلية دون تعديل ملفات التطبيق.
5. هذه المرآة المقفلة هي حد فرض إضافي إذا لم يطبق embedder إعداد frozen في deno.json. دعم الـlock وشكل metadata/cache وإعادة تشغيل العمال ما زال يحتاج أول تشغيل حقيقي. عدم توافقه يفشل دون فتح الإنترنت أو تبديل نسخ.
6. baseline ACL غير الآمن،007 مرتان وبصمات حفظ البيانات، JWT/RLS/count=exact/race/false/Edge تبقى في الحزمة. assert-network يتحقق من الصور والمفاتيح المحلية وغياب proxy خارجي؛ canary ذو positive control ثم namespaces الخدمات الخمس. لا probe إلى نطاق إنتاجي.
7. التنظيف جزء من الحكم؛ no-backup يستهدف stack هذا التشغيل فقط ويتحقق من زوال containers/volumes. لا تقرير اكتمال دون marker الاختبار وmarker teardown وكل phase ناجح. لا artifacts/cache upload أو raw DB/Edge/status/credentials logs.

عنوان إنتاج عام قد يوجد في المستودع الذي ينفذ host checkout؛ لا ندعي استحالة معرفته. مدخلات الحاويات المسموح بها لا تحتوي إعداد Supabase مستضافًا، وحظر الاتصال يحتاج إثباتًا ديناميكيًا. لم نفحص تاريخ المستودع كله بحثًا عن أسرار. لا مفاتيح إنتاج أو بيانات عملاء جُمعت لهذه المهمة.

## ما نُفذ بالفعل

- 13 اختبارًا offline للحزمة: syntax، الأقفال، checksum/SRI mismatch ببيانات unit اصطناعية، هوية tarball، رفض graph متغير أو image متحرك، routing المرآة دون TCP، وعدم قبول ملخص ناقص أو نجاح ملف دون الحالات.
- 128 حالة أصلية من f29: notification-preferences68، notification-preference-client30، notification-backup7، notification-preference-write23. جميعها0 فشل/إلغاء/تخطٍ ومع deny-network. هذه اختبارات المصدر المعزولة وليست اختبارات Supabase الحقيقي.
- اكتُشف أن أوضاع تشغيل معينة هنا قد تخرج0 دون إثبات الحالات الداخلية. استُبدل loader worker في harness فقط بـregisterHooks المتزامن (متاح من Node22.15)، وأضيف فحص إلزامي لأعداد الحالات. لم نعد نعتبر نجاح ملف واحد/خروج0 دليلًا كافيًا.
- host الفعلي Node24.19.0/npm11.9.0. نجح npm ci --dry-run --offline، لكنه لم ينزل أو يثبت أي حزمة (node_modules لم ينشأ)، وأصدر EBADENGINE متوقعًا لأن root يطلب Node22.23.3. لا تنسب هذه النتيجة إلى تنفيذ npm10.9.9 المثبت.
- YAML والصلاحيات/trigger، وتحويل config على template CLI، وبصمات13 ملفًا، وJSON/semver/engines فُحصت. bash -n وnode --check وPython AST ضمن الفحوص.
- لم يُنفذ npm ci حقيقي، أو تنزيل/تحقق bytes حقيقي، أو Deno parse/check/cache، أو OCI pull/inspect، أو Docker/Supabase/Auth/PostgREST/SQL/Edge/JWT integration. لم تعمل مجموعة CI الكاملة أو lint/build في هذه المهمة.

## الباقي والتفعيل

قبل التفعيل: مراجعة provenance لقيم npm والتحقق canonical/bytes، ومراجعة هذا diff والأقفال، وموافقة مستقلة على التشغيل. لا يُنشأ فرع تشغيل الآن. يلزم أول تشغيل فعلي لإثبات توفر الصور القديمة، Linux/amd64 الفعلي، دعم slim containers وإعدادها، npm10.9.9، تحميل Deno2.1.4 للgraph والمرآة وnative lock، ثم اختبارات الخدمات والتنظيف. OS/Docker/Python/curl على runner القياسي قد تتغير؛ الأقفال لا تعني آلة bit-for-bit.

قبل rollout لاحقًا: defaults الإنتاجية ما زالت تمثيلية؛ القيود تطابق fixture المدقق، وليس فحصًا جديدًا للإنتاج. تبقى نسخ العملاء/Edge المنشورة وJWT/JWKS/gateway وهوية مالك DB والتجربة المستضافة المعزولة غير مثبتة. لا نشر007 أو001–006 أو تعديل أي grants/RLS إنتاجي ضمن المهمة.

التكلفة لم تتغير: standard ubuntu-24.04 في المستودع العام لا يفرض رسوم دقائق؛ لا مشاريع Supabase أو خدمات مدفوعة أو billing changes. تقدير15–30 دقيقة باردة، سقف40 دقيقة، غير مقاس؛ rate limits/Actions allowlist/disk قد تمنع التشغيل ولا تبرر ترقية تلقائية.

المراجع: https://github.com/supabase/cli/releases/tag/v2.121.0 ؛ https://github.com/supabase/cli/blob/8a549dffa6bc5c88069c61c1f55ef55ad9b82ae2/packages/stack/src/Artifacts.ts ؛ https://github.com/supabase/edge-runtime/blob/v1.77.4/deno/Cargo.toml ؛ مصادر الصور والحزم الإضافية بالـruntime-lock.json. Template ما زال docs/ci/notification-local-supabase.yml.proposed خارج .github/workflows؛ commit التوثيق يستخدم [skip ci].
