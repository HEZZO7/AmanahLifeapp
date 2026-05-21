# AmanahLife — Design System Implementation Brief
**للمطور:** طبّق كل ما يلي حرفياً بدون اجتهاد. كل قيمة مقصودة.

---

## 1. الخطوط — Fonts

خطّان فقط، لا ثالث لهما:

| المتغير | الخط | الاستخدام |
|---|---|---|
| `--font-display` | **Amiri** | القرآن الكريم، الآيات، النصوص الدينية فقط |
| `--font-ui` | **Tajawal** | كامل الواجهة — كل نص آخر |

**الاستيراد عبر npm:**
```bash
npm install @fontsource/amiri @fontsource/tajawal
```

```js
// في ملف الـ entry الرئيسي
import '@fontsource/amiri/400.css'
import '@fontsource/amiri/700.css'
import '@fontsource/tajawal/300.css'
import '@fontsource/tajawal/400.css'
import '@fontsource/tajawal/500.css'
import '@fontsource/tajawal/700.css'
import '@fontsource/tajawal/800.css'
```

**أو عبر Google Fonts:**
```html
<link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet">
```

---

## 2. توكنز الألوان — Color Tokens

### الألوان الأساسية (Primitives)

```css
/* Forest — الأخضر الرئيسي */
--forest-900: #0A1F17;
--forest-800: #102B1F;
--forest-700: #163828;
--forest-600: #1D4A33;
--forest-500: #245C3F;
--forest-400: #2E7A54;
--forest-300: #3D9B6A;
--forest-200: #5DB882;
--forest-100: #A8DCBE;
--forest-50:  #E8F7EF;

/* Sacred Gold — للـ Premium والإنجازات حصراً */
--gold-900: #3A2800;
--gold-800: #5C3F00;
--gold-700: #7A5500;
--gold-600: #9E6E00;
--gold-500: #C4890A;
--gold-400: #D4A017;
--gold-300: #E8BC45;
--gold-200: #F2D07A;
--gold-100: #FAE9B8;
--gold-50:  #FDF7E8;

/* Pearl — سطوح الـ Light Mode */
--pearl-950: #F9F7F4;
--pearl-900: #F3EFE9;
--pearl-800: #EAE4DC;
--pearl-700: #DDD5C9;
--pearl-600: #C8BFAF;
--pearl-500: #B0A695;
--pearl-400: #968B7A;
--pearl-300: #7A6F60;
--pearl-200: #5E5448;
--pearl-100: #3D3530;

/* Ink — سطوح الـ Dark Mode */
--ink-950: #06110C;
--ink-900: #0C1C14;
--ink-800: #12271B;
--ink-700: #1A3324;
--ink-600: #22402E;
--ink-500: #2D5540;
--ink-400: #3A6B51;

/* Semantic — وظيفية */
--teal-glow:    #1FC7C1;
--teal-dim:     #0F8A86;
--teal-muted:   #0D6E6B;
--rose-alert:   #E84C6A;
--amber-warn:   #F59E0B;
--sage-success: #22C55E;
```

---

## 3. الثيم الفاتح والداكن — Semantic Tokens

الثيم يعمل بتغيير `data-theme="dark"` على الـ `<html>` أو `<body>`.

### Light Mode (الافتراضي)

```css
:root {
  /* Surfaces */
  --bg-base:      #F9F7F4;   /* pearl-950 */
  --bg-surface:   #FFFFFF;
  --bg-card:      #FFFFFF;
  --bg-card-alt:  #F3EFE9;   /* pearl-900 */
  --bg-input:     #F3EFE9;
  --bg-overlay:   rgba(10, 31, 23, 0.04);

  /* Borders */
  --border-subtle: rgba(10, 31, 23, 0.07);
  --border-medium: rgba(10, 31, 23, 0.12);
  --border-strong: rgba(10, 31, 23, 0.20);
  --border-gold:   rgba(212, 160, 23, 0.30);

  /* Text */
  --text-primary:   #0A1F17;  /* forest-900 */
  --text-secondary: #7A6F60;  /* pearl-300 */
  --text-muted:     #968B7A;  /* pearl-400 */
  --text-inverse:   #FFFFFF;
  --text-gold:      #9E6E00;  /* gold-600 */
  --text-green:     #2E7A54;  /* forest-400 */
  --text-teal:      #0F8A86;  /* teal-dim */

  /* Accents */
  --accent-primary:   #245C3F;  /* forest-500 */
  --accent-secondary: #D4A017;  /* gold-400 */
  --accent-teal:      #1FC7C1;

  /* Shadows */
  --shadow-xs:   0 1px 2px rgba(10,31,23,0.06);
  --shadow-sm:   0 2px 8px rgba(10,31,23,0.08), 0 1px 2px rgba(10,31,23,0.04);
  --shadow-md:   0 4px 16px rgba(10,31,23,0.10), 0 2px 4px rgba(10,31,23,0.06);
  --shadow-lg:   0 8px 32px rgba(10,31,23,0.12), 0 4px 8px rgba(10,31,23,0.08);
  --shadow-xl:   0 16px 48px rgba(10,31,23,0.16), 0 8px 16px rgba(10,31,23,0.10);
  --shadow-gold: 0 4px 20px rgba(212,160,23,0.25);
  --shadow-teal: 0 4px 20px rgba(31,199,193,0.25);
}
```

### Dark Mode

```css
[data-theme="dark"] {
  /* Surfaces */
  --bg-base:      #06110C;   /* ink-950 */
  --bg-surface:   #0C1C14;   /* ink-900 */
  --bg-card:      #12271B;   /* ink-800 */
  --bg-card-alt:  #1A3324;   /* ink-700 */
  --bg-input:     #1A3324;
  --bg-overlay:   rgba(255,255,255,0.03);

  /* Borders */
  --border-subtle: rgba(255,255,255,0.05);
  --border-medium: rgba(255,255,255,0.09);
  --border-strong: rgba(255,255,255,0.15);
  --border-gold:   rgba(212,160,23,0.25);

  /* Text */
  --text-primary:   #F0EDE8;
  --text-secondary: rgba(240,237,232,0.55);
  --text-muted:     rgba(240,237,232,0.35);
  --text-inverse:   #0A1F17;  /* forest-900 */
  --text-gold:      #E8BC45;  /* gold-300 */
  --text-green:     #5DB882;  /* forest-200 */
  --text-teal:      #1FC7C1;  /* teal-glow */

  /* Accents */
  --accent-primary:   #3D9B6A;  /* forest-300 */
  --accent-secondary: #E8BC45;  /* gold-300 */

  /* Shadows (أثقل في الداكن) */
  --shadow-xs:   0 1px 2px rgba(0,0,0,0.30);
  --shadow-sm:   0 2px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.20);
  --shadow-md:   0 4px 16px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.25);
  --shadow-lg:   0 8px 32px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.30);
  --shadow-xl:   0 16px 48px rgba(0,0,0,0.50), 0 8px 16px rgba(0,0,0,0.35);
  --shadow-gold: 0 4px 20px rgba(212,160,23,0.20);
  --shadow-teal: 0 4px 20px rgba(31,199,193,0.20);
}
```

---

## 4. التايبوغرافي — Typography Scale

```css
:root {
  /* Font Families */
  --font-display: 'Amiri', 'Scheherazade New', 'Noto Serif Arabic', Georgia, serif;
  --font-ui:      'Tajawal', 'Noto Sans Arabic', 'Segoe UI', Arial, sans-serif;

  /* Size Scale */
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 15px;
  --text-md:   17px;
  --text-lg:   19px;
  --text-xl:   22px;
  --text-2xl:  26px;
  --text-3xl:  32px;
  --text-4xl:  40px;
  --text-5xl:  52px;

  /* Weights */
  --weight-light:   300;
  --weight-regular: 400;
  --weight-medium:  500;
  --weight-bold:    700;
  --weight-black:   800;

  /* Line Heights */
  --leading-tight:  1.20;
  --leading-snug:   1.35;
  --leading-normal: 1.50;
  --leading-loose:  1.75;
}
```

**الـ base styles:**
```css
body {
  font-family: var(--font-ui);
  font-size: var(--text-base);
  font-weight: var(--weight-regular);
  line-height: var(--leading-normal);
  direction: rtl;
}
```

---

## 5. المسافات والحواف — Spacing & Radius

```css
:root {
  /* Spacing */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-7:  28px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Border Radius */
  --radius-xs:   6px;
  --radius-sm:   10px;
  --radius-md:   14px;
  --radius-lg:   18px;
  --radius-xl:   24px;
  --radius-2xl:  32px;
  --radius-full: 9999px;
}
```

---

## 6. الحركة — Motion Tokens

```css
:root {
  --ease-out:    cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1.0);
  --ease-smooth: cubic-bezier(0.4, 0.0, 0.2, 1.0);

  --dur-instant: 80ms;
  --dur-fast:    150ms;
  --dur-normal:  250ms;
  --dur-slow:    400ms;
  --dur-slower:  600ms;
}
```

**تحول الثيم يكون ناعم دائماً:**
```css
body {
  transition:
    background var(--dur-slow) var(--ease-smooth),
    color var(--dur-slow) var(--ease-smooth);
}
```

---

## 7. قواعد المكونات — Component Rules

### الأزرار

```css
/* Primary — الزر الأساسي */
.btn-primary {
  padding: 14px var(--space-6);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--forest-500), var(--forest-400));
  color: #FFFFFF;
  font-family: var(--font-ui);
  font-size: var(--text-base);
  font-weight: var(--weight-bold);
  box-shadow: 0 4px 16px rgba(36,92,63,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
  transition: all var(--dur-fast) var(--ease-out);
}
.btn-primary:hover  { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(36,92,63,0.45), inset 0 1px 0 rgba(255,255,255,0.15); }
.btn-primary:active { transform: scale(0.98); }

/* Gold — للـ Premium فقط */
.btn-gold {
  background: linear-gradient(135deg, var(--gold-600), var(--gold-500));
  box-shadow: var(--shadow-gold), inset 0 1px 0 rgba(255,255,255,0.15);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  border: 1.5px solid var(--border-medium);
  color: var(--text-secondary);
  box-shadow: none;
}
.btn-ghost:hover { background: var(--bg-overlay); }
```

### Filter Pills

```css
.pill {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1.5px solid var(--border-medium);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
}

/* Active = Forest دائماً */
.pill.active {
  background: var(--forest-600);
  border-color: var(--forest-500);
  color: #FFFFFF;
  box-shadow: var(--shadow-sm);
}
[data-theme="dark"] .pill.active {
  background: var(--forest-500);
  border-color: var(--forest-400);
}

/* Gold Active = Premium فقط */
.pill.gold-active {
  background: linear-gradient(135deg, var(--gold-600), var(--gold-500));
  border-color: var(--gold-500);
  color: #FFFFFF;
  box-shadow: var(--shadow-gold);
}
```

### Streak Card — Gold Gradient

```css
.streak-card {
  background: linear-gradient(120deg, var(--gold-700) 0%, var(--gold-600) 50%, var(--gold-500) 100%);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  box-shadow: var(--shadow-gold);
  overflow: hidden;
  position: relative;
}
/* الـ emoji الزخرفي */
.streak-card::before {
  content: '🔥';
  position: absolute;
  right: -10px;
  bottom: -10px;
  font-size: 80px;
  opacity: 0.2;
  pointer-events: none;
}
```

### Toggle

```css
.toggle {
  width: 48px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--border-medium);
  position: relative;
  cursor: pointer;
  transition: all var(--dur-normal) var(--ease-smooth);
}
/* الـ knob */
.toggle::after {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #FFFFFF;
  top: 3px;
  right: 3px;
  transition: transform var(--dur-normal) var(--ease-spring);
}

/* ON = Teal دائماً */
.toggle.on {
  background: var(--teal-glow);
  border-color: var(--teal-glow);
  box-shadow: var(--shadow-teal);
}

/* Gold ON = إعدادات Premium فقط */
.toggle.gold-on {
  background: var(--gold-500);
  border-color: var(--gold-400);
  box-shadow: var(--shadow-gold);
}

.toggle.on::after,
.toggle.gold-on::after {
  transform: translateX(-20px);  /* RTL: يتحرك لليسار */
}
```

### Bottom Navigation

```css
.bottom-nav {
  display: flex;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-subtle);
}
[data-theme="dark"] .bottom-nav {
  background: rgba(12,28,20,0.92);
  border-top-color: rgba(255,255,255,0.06);
  backdrop-filter: blur(20px);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-2) var(--space-1);
  cursor: pointer;
}

/* Active label */
.nav-item.active .nav-label {
  color: var(--teal-glow);
  font-weight: var(--weight-bold);
}

/* Active pill — Teal + glow */
.nav-active-pill {
  width: 32px;
  height: 3px;
  background: var(--teal-glow);
  border-radius: var(--radius-full);
  position: absolute;
  top: 0;
  box-shadow: 0 0 8px var(--teal-glow);
}
```

---

## 8. القواعد الذهبية — لا استثناءات

| القاعدة | ✅ صح | ❌ خطأ |
|---|---|---|
| **Active filter/pill** | `forest-600` أو `teal-glow` | أي لون بني أو برتقالي |
| **Gold** | Premium، streak، إنجازات فقط | أزرار عادية، active states |
| **Toggle ON** | `teal-glow` دائماً | forest، gold (إلا Premium settings) |
| **Bottom nav active** | Teal pill + glow | Forest أو Gold |
| **نصوص قرآنية** | `font-display` (Amiri) | font-ui أو أي خط آخر |
| **كل نص ثانٍ** | `font-ui` (Tajawal) | أي خط آخر |
| **الألوان المسموحة** | Forest، Gold، Teal، Pearl، Ink | Orange، Purple، Brown، Red |

---

## 9. تطبيق الثيم — Theme Switching

```js
// تطبيق الثيم
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('amanahlife-theme', theme)
}

// استعادة الثيم عند التحميل
const saved = localStorage.getItem('amanahlife-theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
setTheme(saved || (prefersDark ? 'dark' : 'light'))
```

---

## 10. ملاحظات التطبيق

- **RTL أولاً:** كل الـ layout بـ `direction: rtl` — لا `dir="ltr"` في أي مكان إلا للأرقام الإنجليزية
- **لا hardcoded colors:** كل لون من الـ semantic tokens (`var(--bg-card)`) — لا `#ffffff` مباشرة في المكونات
- **الـ Teal للتفاعل:** كل active state و interactive element يستخدم Teal — Forest للـ primary actions فقط
- **الـ shadows من الـ tokens:** `var(--shadow-sm)` وليس `box-shadow: 0 2px 4px #000`
- **الـ transition على الـ body:** يضمن أن تحول الثيم يكون ناعم على كل العناصر تلقائياً
