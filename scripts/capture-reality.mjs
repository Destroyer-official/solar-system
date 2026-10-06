import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER ERROR:', err));

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1500);

  console.log('Waiting for #toggleReality...');
  await page.waitForSelector('#toggleReality', { timeout: 10000 });

  // 1. Open Reality & Honesty Inspector
  await page.click('#toggleReality');
  await page.waitForTimeout(500);

  // 2. Open Horizons Validation Table
  await page.click('#valTableBtn');
  await page.waitForTimeout(500);

  // 3. Switch Frame to CMB rest frame (aligned)
  await page.selectOption('#frame', 'cmb-aligned');
  await page.waitForTimeout(1000);

  const outDir = 'C:/Users/shant/.gemini/antigravity-ide/brain/adf5f721-a15e-4a2c-9cc7-9e66eca840b4';
  const realityScreenshotPath = path.join(outDir, 'reality_and_cmb_frame.png');
  await page.screenshot({ path: realityScreenshotPath });
  console.log(`Saved screenshot: ${realityScreenshotPath}`);

  const readout = await page.innerText('#readout');
  console.log('=== CMB FRAME READOUT ===');
  console.log(readout);

  // 4. Switch to JPL DE440 Ephemeris Mode
  await page.click('#toggleDynamics');
  await page.waitForTimeout(1000);

  const ephemScreenshotPath = path.join(outDir, 'de440_ephemeris_mode.png');
  await page.screenshot({ path: ephemScreenshotPath });
  console.log(`Saved screenshot: ${ephemScreenshotPath}`);

  const ephemReadout = await page.innerText('#readout');
  console.log('=== EPHEMERIS MODE READOUT ===');
  console.log(ephemReadout);

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
