import { chromium } from "playwright";
const origin = process.env.MARKETRENDS_AUDIT_ORIGIN;
if (origin !== "http://127.0.0.1:3000") throw Error("Isolated local preview required");
const browser = await chromium.launch({headless:true});
const checks = [];
const errors = [];
try {
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    const context = await browser.newContext({ viewport, timezoneId:"Europe/Oslo" });
    const page = await context.newPage();
    let path = "/";
    page.on("pageerror", error => errors.push({path, message:error.message}));
    page.on("console", message => {
      if (/hydration|did not match|Minified React error #(?:418|423|425)|server HTML/i.test(message.text())) errors.push({path,message:message.text()});
    });
    for (path of ["/","/ai","/krypto","/fintech","/startup","/investering","/daytrading","/kategori/teknologi-ai","/topic/parlamentarisk-granskning","/entity/helix","/guide/slik-bruker-du-ai-til-markedsforing","/compare/coinbase-vs-binance"]) {
      const response = await page.goto(origin+path,{waitUntil:"domcontentloaded",timeout:30000});
      await page.locator("h1").first().waitFor({timeout:15000});
      await page.waitForTimeout(500);
      const h1 = await page.locator("h1").first().innerText();
      const canon = await page.locator('link[rel="canonical"]').evaluateAll(nodes=>nodes.map(n=>n.href));
      if(response.status()!==200 || !h1.trim() || canon.length!==1 || canon[0]!=="https://marketrends.no"+path) throw Error(JSON.stringify({path,status:response.status(),h1,canon}));
      checks.push({viewport:viewport.width,path,status:response.status(),h1,canonical:canon[0]});
    }
    path="/";
    await page.goto(origin,{waitUntil:"domcontentloaded"});
    const articleLink = page.locator('a[href^="/"]').filter({has:page.locator("h2,h3")}).first();
    const href = await articleLink.getAttribute("href",{timeout:15000});
    if(!href) throw Error("No article link");
    await articleLink.click();
    await page.waitForURL(url=>url.pathname===href,{timeout:15000});
    await page.locator("h1").first().waitFor();
    checks.push({viewport:viewport.width,navigation:href});
    path="/admin";
    await page.goto(origin+path,{waitUntil:"domcontentloaded"});
    await page.waitForURL(url=>url.pathname==="/auth",{timeout:20000});
    checks.push({viewport:viewport.width,signedOutAdminRedirect:"/auth"});
    await context.close();
  }
} finally { await browser.close(); console.log(JSON.stringify({checks,errors},null,2)); }
if(errors.length) process.exitCode=1;
