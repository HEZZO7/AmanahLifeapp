// Render the actual public deletion page in both languages, offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const entry = new URL('../src/pages/DeleteAccount.tsx', import.meta.url).href;
const data = source => 'data:text/javascript,' + encodeURIComponent(source);
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === entry) {
      if (specifier === '@/contexts/LanguageContext') return { url: data('export const useLanguage=()=>globalThis.__retentionLanguage;'), shortCircuit: true };
      if (specifier === 'react-router-dom') return { url: data('export const useNavigate=()=>()=>{throw Error("Unexpected navigation");};'), shortCircuit: true };
      if (['@/components/PageHeader', '@/components/Footer'].includes(specifier)) return { url: data('export default function Placeholder(){return null;}'), shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === entry) return { format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
let DeleteAccount;
try { DeleteAccount = (await import(entry)).default; } finally { hook.deregister(); }
for (const language of ['ar', 'en']) {
  test('public deletion page explains retained billing history and offers honest next steps: ' + language, () => {
    const previous = globalThis.__retentionLanguage;
    try {
      globalThis.__retentionLanguage = { language, isRTL: language === 'ar' };
      const html = renderToStaticMarkup(React.createElement(DeleteAccount));
      assert.match(html, language === 'ar' ? /dir="rtl"/ : /dir="ltr"/);
      assert.match(html, /href="\/subscription"/); assert.match(html, /href="mailto:support@amanahlife.com"/);
      assert.match(html, language === 'ar' ? /يمنع الحذف التلقائي/ : /blocks automatic deletion/);
      assert.match(html, language === 'ar' ? /بعد إلغاء التجديد أو انتهاء الاشتراك/ : /after renewal cancellation or expiry/);
      assert.match(html, language === 'ar' ? /لا يُلغي الاشتراك/ : /does not cancel a subscription/);
      assert.doesNotMatch(html, /within 30 days|خلال 30|all your data will be removed|سنقوم بحذف/);
    } finally {
      if (previous === undefined) delete globalThis.__retentionLanguage; else globalThis.__retentionLanguage = previous;
    }
  });
}
