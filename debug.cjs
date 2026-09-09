const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' });
  await page.click('.fc-timeGridWeek-button');
  await new Promise(r => setTimeout(r, 500));
  const info = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('.fc-timegrid-slot-label-cushion')).find(e => e.textContent.includes('12am'));
    if (!label) return { error: 'no 12am label found', all: Array.from(document.querySelectorAll('.fc-timegrid-slot-label-cushion')).map(e=>e.textContent) };
    let el = label;
    const chain = [];
    for (let i = 0; i < 8 && el; i++) {
      chain.push({ tag: el.tagName, cls: el.className });
      el = el.parentElement;
    }
    // find minor cells near the label's row
    const td = label.closest('td');
    const tr = td ? td.closest('tr') : null;
    const nextRows = [];
    let sib = tr ? tr.nextElementSibling : null;
    for (let i = 0; i < 5 && sib; i++) {
      const minorTd = sib.querySelector('td');
      nextRows.push({ trClass: sib.className, tdClass: minorTd ? minorTd.className : null });
      sib = sib.nextElementSibling;
    }
    return { chain, nextRows };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
