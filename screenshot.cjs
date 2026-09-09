const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' });
  await page.click('.fc-timeGridWeek-button');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: '/tmp/verify.png' });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
