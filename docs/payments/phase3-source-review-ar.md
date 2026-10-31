# Phase 3 — مراجعة المصدر والتوافق

الأساس `b8ebc32946e2941761bd65ee69d3d8695a468c82`. هذا تحضير على فرع validation فقط، دون نشر أو استدعاء مزوّد أو تنفيذ native جديد. نتيجة run41200953611 تاريخية وليست نتيجة لهذا المصدر.

## الأخطاء التسعة وESLint

| السبب المثبت | التصحيح المحدود |
|---|---|
| خاصية vibrate الإضافية في كائني NotificationOptions | الاحتفاظ بالخاصية المدعومة في بعض المتصفحات داخل متغير خيارات ذي نوع مستنتج؛ لا any أو تعطيل تشخيص TypeScript |
| return annotation لـUint8Array توسّع buffer إلى ArrayBufferLike | ترك استنتاج constructor الذي ينشئ ArrayBuffer فعليًا لمفتاح Web Push |
| PostgREST builders هي PromiseLike وليست Promise | حذف cast غير الصحيح؛ Promise.all ينتظر thenables مباشرة بعد إزالة null |
| discriminated union في FamilyBudget | فحص `res.ok === false` قبل قراءة error |
| PageHeader لا يعلن props يستعملها أربعة callers | تعريف subtitle/rightAction وإظهارهما، وجعل icon اختياريًا لدعم صفحة DeleteAccount |
| ESLint9 بلا flat config | إضافة recommended JavaScript/TypeScript/React Hooks دون إطفاء rules؛ إزالة14 ملاحظة بسيطة في9 ملفات، أساسها imports/متغيرات غير مستعملة وثلاثة any لخاصية timer معروفة |

لا suppressions أو index signatures عامة أو تغيير قيود وصول/دفع. أزيل أيضًا endpoint ثابت متبقٍ في useNotifications إلى serviceEnvironment، كي يستخدم مشروع المصادقة نفسه. لا تغيير لقيم VAPID أو إعدادات المزوّد.

## تبعيات migrations والتوافق

- 001 تعتمد على subscription schema المراجع، 002 على helpers/family الأصلية، و003 على عدد/أسماء سياسات وtriggers الأسرة. فشل أي preflight عند drift مقصود.
- 004/005 تضيفان private intents/bindings/ledger/inbox وprojection محمية؛ 006 تعتمد على entitlement005.
- 007 تتطلب notification_preferences كاملة وunique user_id وpush schema، بلا triggers إضافية قبل الترقية. fixture009 الأصلية تختصر هذين الجدولين ولا تكفي لتطبيق007.
- 008 تحجب الحذف عند تاريخ فوترة/حجز؛ 009 تنظف داخل Auth DELETE وتعيد readiness تحت القفل. لم تتغير bytes migrations001–011 أو adapter009 عن أساس Phase2.
- 010 تضيف gate افتراضية false وحجزًا دائمًا للحالة الغامضة؛ 011 تضيف ملكية Customer خاصة وFK احتفاظ إضافية. metadata009 الأصلية تختبر جدولها المحدد؛ يجب إضافة تحقق منفصل للـRLS/ACL والـFK الجديد دون حذف assertions القديمة.
- يجب أن تثبت حزمة native كل migrations001–011 على fixture مراجع، ثم 009 مرتين مع بقاء البيانات. يلزم توضيح أن fake schema في اختبارات WASM لا تثبت GoTrue أو تزامن اتصالات مستقلة.

## عوائق مستقلة لا يجوز إخفاؤها

**FAIL / notification-client compatibility:** `src/components/BackupRestore.tsx` يصدّر جدول push بمفاتيح الجهاز، ويقرأ `*` من notification_preferences ثم يحاول DELETE/INSERT لصفوف backups مع حقول داخلية ويتجاهل أخطاء العمليات. Migration007 تمنع هذه الصلاحيات عمدًا. لا يجوز توسيع grants لحل عدم توافق العميل أو إعلان نجاح استيراد عند رفض DB. الإصلاح الآمن يحتاج تصدير/استعادة allowlist للحقول القابلة للنقل فقط، وعدم نقل device push credentials، وفحص كل نتيجة.

**FAIL / legacy notification writer:** `supabase/functions/app_11941c8fec_push_notify/index.ts`، action `update_preferences`، يبني upsert بالشكل `user_id: user.id, ...preferences` عبر service_role. يستطيع الحقل user_id داخل preferences استبدال الهوية قبل الكتابة، ولا تحمي RLS من service_role. هذا استنتاج من مسار مصدر فعلي، دون تجربة على حسابات أو endpoint مستضاف. لم يُعدّل writer في مرحلة تحضير الاختبارات؛ يلزم patch أمني مستقل وregressions لملكية الحقول قبل أي نشر أو قبول ميزة الإشعارات.

**UNVERIFIED / production schema:** لا توجد قراءة لقاعدة إنتاج أو provider dashboard. لا تُستنتج قابلية تطبيق migrations على الإنتاج من نجاح fixture. المخططات/الـtriggers الإضافية والعملاء السابقون وretention تبقى عوائق إطلاق.

حزمة native لا تنشر أو تستدعي push_notify ولا عميل BackupRestore؛ قبول حماية حذف الحساب/SQL لا يحوّل العائقين أعلاه إلى PASS ولا يجيز الإنتاج أو الدفع.
