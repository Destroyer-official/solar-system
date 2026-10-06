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

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // 1. Frame: Galactic (axes aligned)
  await page.selectOption('#frame', 'galactic-aligned');
  await page.waitForTimeout(500);

  // Set Trail length to 3 years
  await page.selectOption('#trailDays', '730.5');

  // Let simulation step forward for 3 seconds to generate clear trails
  await page.waitForTimeout(3500);

  // Zoom camera in closer (orbit controls drag / scroll zoom)
  // Let's scroll wheel on canvas to zoom into Sun
  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  // Zoom in via wheel
  for (let i = 0; i < 16; i++) {
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(50);
  }

  // Orbit camera slightly to get a crisp sideways perspective
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 180, centerY - 80, { steps: 10 });
  await page.mouse.up();

  await page.waitForTimeout(2000);

  const outDir = 'C:/Users/shant/.gemini/antigravity-ide/brain/adf5f721-a15e-4a2c-9cc7-9e66eca840b4';
  const closeupPath = path.join(outDir, 'galactic_corkscrew_closeup.png');
  await page.screenshot({ path: closeupPath });
  console.log(`Saved closeup screenshot: ${closeupPath}`);

  const readout = await page.innerText('#readout');
  console.log('=== CLOSEUP READOUT ===');
  console.log(readout);

  await browser.close();
}

main().catch(console.error);
