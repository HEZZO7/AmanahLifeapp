import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

test('landing conversion routes on desktop and mobile without live authentication', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
      const page = await browser.newPage({viewport});
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
        if (url.pathname === '/login') return route.fulfill({status:200,contentType:'text/html',body:'<html>Isolated login destination</html>'});
        return route.continue();
      });
      for (const plan of ['balanced','family']) {
        for (const billing of ['monthly','yearly']) {
          await page.goto('http://127.0.0.1:4173/landing.html');
          const toggle = page.locator('#pricingToggle');
          if ((await toggle.getAttribute('aria-checked') === 'true') !== (billing === 'yearly')) await toggle.click();
          await Promise.all([
            page.waitForURL(url => url.pathname === '/login'),
            page.locator('button[onclick="handleCheckout(\''+plan+'\')"]').click()
          ]);
          const url = new URL(page.url());
          assert.equal(url.searchParams.get('mode'),'signup');
          assert.equal(url.searchParams.get('next'),'subscription');
          assert.equal(url.searchParams.get('plan'),plan);
          assert.equal(url.searchParams.get('billing'),billing);
        }
      }
      await page.goto('http://127.0.0.1:4173/landing.html');
      await Promise.all([page.waitForURL('**/login?mode=signup'),page.locator('[data-i18n="hero_cta_primary"]').click()]);
      await page.close();
    }
  } finally { await browser.close(); }
});
