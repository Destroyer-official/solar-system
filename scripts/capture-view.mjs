import { chromium } from 'playwright';
import path from 'path';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // 1. Capture Solar System - Galactic Frame with along-track compression
  console.log('Setting frame to galactic-aligned...');
  await page.selectOption('#frame', 'galactic-aligned');

  // Let frame defaults apply
  await page.waitForTimeout(500);

  // Set trail days to 2 years (730.5)
  await page.selectOption('#trailDays', '730.5');

  // Wait 4 seconds for simulation to step forward and accumulate trails
  console.log('Simulating orbits along galactic path...');
  await page.waitForTimeout(4000);

  const solarReadout = await page.innerText('#readout');
  console.log('=== SOLAR SYSTEM GALACTIC READOUT ===');
  console.log(solarReadout);

  const outDir = 'C:/Users/shant/.gemini/antigravity-ide/brain/adf5f721-a15e-4a2c-9cc7-9e66eca840b4';
  const solarScreenshotPath = path.join(outDir, 'galactic_corkscrew.png');
  await page.screenshot({ path: solarScreenshotPath });
  console.log(`Saved screenshot: ${solarScreenshotPath}`);

  // 2. Switch to Milky Way Galaxy Mode
  console.log('Switching to Milky Way Galaxy mode...');
  await page.click('#modeGalaxy');
  await page.waitForTimeout(1000);

  // Select Edge-on view to see vertical bobbing
  await page.selectOption('#galCamera', 'edge-on');
  await page.waitForTimeout(2000);

  const galaxyReadout = await page.innerText('#galaxyReadout');
  console.log('=== MILKY WAY GALAXY READOUT ===');
  console.log(galaxyReadout);

  const galaxyScreenshotPath = path.join(outDir, 'milky_way_edge_on.png');
  await page.screenshot({ path: galaxyScreenshotPath });
  console.log(`Saved screenshot: ${galaxyScreenshotPath}`);

  // Also capture 3D perspective view
  await page.selectOption('#galCamera', 'perspective');
  await page.waitForTimeout(1000);
  const perspectiveScreenshotPath = path.join(outDir, 'milky_way_perspective.png');
  await page.screenshot({ path: perspectiveScreenshotPath });
  console.log(`Saved screenshot: ${perspectiveScreenshotPath}`);

  await browser.close();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
