import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  page.on('console', (msg) => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  const diag = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const app = document.querySelector('#app');
    const panel = document.querySelector('#panel');

    return {
      canvasRect: canvas ? canvas.getBoundingClientRect() : null,
      canvasWidth: canvas ? canvas.width : null,
      canvasHeight: canvas ? canvas.height : null,
      appRect: app ? app.getBoundingClientRect() : null,
      panelRect: panel ? panel.getBoundingClientRect() : null,
    };
  });

  console.log('DOM & Canvas Diagnostics:', JSON.stringify(diag, null, 2));

  const outPath = 'C:\\Users\\shant\\.gemini\\antigravity-ide\\brain\\adf5f721-a15e-4a2c-9cc7-9e66eca840b4\\canvas_fixed_fullscreen.png';
  await page.screenshot({ path: outPath });
  console.log('Saved screenshot to:', outPath);

  await browser.close();
}

diagnose().catch(console.error);
