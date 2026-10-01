import { test, expect } from '@playwright/test';
test('comparison loads BotD only on request, displays real result and clears evidence',async({page})=>{
 const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto('compare/');
 await expect(page.locator('#session-result')).toContainText('0.7.0');expect(requests.some(u=>u.endsWith('/lib/botd.js'))).toBe(false);
 await page.locator('#run-botd').click();await expect(page.locator('#comparison-status')).toContainText('Check complete');
 await expect(page.locator('#session-result')).toContainText('"source": "botd"');await expect(page.locator('#botd-result')).toContainText('"bot":');
 expect(requests.filter(u=>!u.startsWith('http://127.0.0.1:4178/'))).toEqual([]);
 await page.locator('#clear-botd').click();await expect(page.locator('#session-result')).not.toContainText('"source": "botd"');
});
test('comparison failed load is explicit and releases controls',async({page})=>{
 await page.route('**/lib/botd.js',r=>r.abort());await page.goto('compare/');await page.locator('#run-botd').click();await expect(page.locator('#botd-label')).toHaveText('CHECK FAILED');await expect(page.locator('#run-botd')).toBeEnabled();
});
test('comparison and navigation fit small touch screens',async({page})=>{
 await page.setViewportSize({width:320,height:780});for(const path of ['./','compare/']){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});
