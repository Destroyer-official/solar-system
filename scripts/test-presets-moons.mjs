import { chromium } from 'playwright';

async function testMoons() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  // 1. Click Earth & Moon preset
  console.log('Clicking Earth & Moon preset...');
  await page.click('button[data-preset="earthMoon"]');
  await page.waitForTimeout(1500);

  const earthMoonPath = 'C:\\Users\\shant\\.gemini\\antigravity-ide\\brain\\adf5f721-a15e-4a2c-9cc7-9e66eca840b4\\earth_moon_preset.png';
  await page.screenshot({ path: earthMoonPath });
  console.log('Saved:', earthMoonPath);

  // 2. Click Jupiter & Galilean Moons preset
  console.log('Clicking Jupiter & Galilean Moons preset...');
  await page.click('button[data-preset="jupiterMoons"]');
  await page.waitForTimeout(1500);

  const jupiterMoonsPath = 'C:\\Users\\shant\\.gemini\\antigravity-ide\\brain\\adf5f721-a15e-4a2c-9cc7-9e66eca840b4\\jupiter_moons_preset.png';
  await page.screenshot({ path: jupiterMoonsPath });
  console.log('Saved:', jupiterMoonsPath);

  // 3. Click Milky Way Overview preset
  console.log('Clicking Milky Way Overview preset...');
  await page.click('button[data-preset="milkyWay"]');
  await page.waitForTimeout(1500);

  const milkyWayPath = 'C:\\Users\\shant\\.gemini\\antigravity-ide\\brain\\adf5f721-a15e-4a2c-9cc7-9e66eca840b4\\milky_way_overview_preset.png';
  await page.screenshot({ path: milkyWayPath });
  console.log('Saved:', milkyWayPath);

  await browser.close();
}

testMoons().catch(console.error);
